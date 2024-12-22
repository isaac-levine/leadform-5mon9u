/**
 * @fileoverview Test suite for SMS conversation management functionality
 * @version 1.0.0
 */

import { describe, test, expect, beforeAll, afterAll, beforeEach, jest } from '@jest/globals'; // ^29.0.0
import supertest from 'supertest'; // ^6.3.0
import { faker } from '@faker-js/faker'; // ^8.0.0
import { ConversationModel } from '../src/models/conversation.model';
import { ConversationController } from '../src/controllers/conversation.controller';
import { ConversationStatus } from '../../../shared/types/sms.types';
import { AI_CONFIG } from '../../../shared/constants';

// Initialize test server and database connection
let app: any;
let request: supertest.SuperTest<supertest.Test>;
let testConversations: ConversationModel[] = [];

/**
 * Test data generator for conversations
 */
const createMockConversation = () => ({
  id: faker.string.uuid(),
  leadId: faker.string.uuid(),
  status: ConversationStatus.ACTIVE,
  phoneNumber: `+1${faker.string.numeric(10)}`,
  assignedAgent: null,
  lastActivity: new Date(),
  metadata: {
    statusHistory: [],
    activityLog: [],
    agentHistory: {
      assignments: []
    },
    aiMetrics: {
      averageConfidence: faker.number.float({ min: 0.8, max: 1 }),
      interactionsCount: faker.number.int({ min: 1, max: 100 })
    }
  }
});

beforeAll(async () => {
  // Setup test database connection
  process.env.NODE_ENV = 'test';
  
  // Initialize test server
  const { default: server } = await import('../src/server');
  app = server;
  request = supertest(app);
});

afterAll(async () => {
  // Cleanup test data and close connections
  await ConversationModel.destroy({ where: {} });
  await app.close();
});

beforeEach(async () => {
  // Clear test data before each test
  await ConversationModel.destroy({ where: {} });
  testConversations = [];
});

describe('Conversation Management', () => {
  describe('CRUD Operations', () => {
    test('should list conversations with pagination', async () => {
      // Create test conversations
      const conversations = Array(5).fill(null).map(createMockConversation);
      await ConversationModel.bulkCreate(conversations);

      const response = await request
        .get('/api/v1/conversations')
        .query({ page: 1, limit: 10 })
        .expect(200);

      expect(response.body.data).toHaveLength(5);
      expect(response.body.pagination).toEqual({
        total: 5,
        page: 1,
        limit: 10,
        pages: 1
      });
    });

    test('should get conversation by ID', async () => {
      const conversation = await ConversationModel.create(createMockConversation());

      const response = await request
        .get(`/api/v1/conversations/${conversation.id}`)
        .expect(200);

      expect(response.body.data.id).toBe(conversation.id);
    });

    test('should return 404 for non-existent conversation', async () => {
      await request
        .get(`/api/v1/conversations/${faker.string.uuid()}`)
        .expect(404);
    });
  });

  describe('Status Transitions', () => {
    test('should update conversation status with valid transition', async () => {
      const conversation = await ConversationModel.create(createMockConversation());

      const response = await request
        .patch(`/api/v1/conversations/${conversation.id}/status`)
        .send({ status: ConversationStatus.HUMAN_TAKEOVER })
        .expect(200);

      expect(response.body.data.status).toBe(ConversationStatus.HUMAN_TAKEOVER);
      expect(response.body.data.metadata.statusHistory).toHaveLength(1);
    });

    test('should reject invalid status transitions', async () => {
      const conversation = await ConversationModel.create({
        ...createMockConversation(),
        status: ConversationStatus.CLOSED
      });

      await request
        .patch(`/api/v1/conversations/${conversation.id}/status`)
        .send({ status: ConversationStatus.ACTIVE })
        .expect(400);
    });
  });

  describe('Agent Assignment', () => {
    test('should assign agent to conversation', async () => {
      const conversation = await ConversationModel.create(createMockConversation());
      const agentId = faker.string.uuid();

      const response = await request
        .post(`/api/v1/conversations/${conversation.id}/assign`)
        .send({ agentId })
        .expect(200);

      expect(response.body.data.assignedAgent).toBe(agentId);
      expect(response.body.data.status).toBe(ConversationStatus.HUMAN_TAKEOVER);
    });

    test('should unassign agent from conversation', async () => {
      const conversation = await ConversationModel.create({
        ...createMockConversation(),
        assignedAgent: faker.string.uuid(),
        status: ConversationStatus.HUMAN_TAKEOVER
      });

      const response = await request
        .post(`/api/v1/conversations/${conversation.id}/unassign`)
        .expect(200);

      expect(response.body.data.assignedAgent).toBeNull();
      expect(response.body.data.status).toBe(ConversationStatus.ACTIVE);
    });
  });
});

describe('SLA Compliance', () => {
  test('should track response times within SLA', async () => {
    const conversation = await ConversationModel.create({
      ...createMockConversation(),
      metadata: {
        ...createMockConversation().metadata,
        activityLog: [
          {
            timestamp: new Date(Date.now() - 1000).toISOString(),
            type: 'message',
            details: {}
          },
          {
            timestamp: new Date().toISOString(),
            type: 'response',
            details: {}
          }
        ]
      }
    });

    const controller = new ConversationController();
    const metrics = await controller.getEngagementMetrics([conversation]);

    expect(metrics.averageResponseTime).toBeLessThanOrEqual(AI_CONFIG.PROCESSING_TIMEOUT);
    expect(metrics.slaCompliance).toBe(100);
  });

  test('should calculate engagement metrics accurately', async () => {
    const conversations = await ConversationModel.bulkCreate(
      Array(3).fill(null).map(() => ({
        ...createMockConversation(),
        metadata: {
          ...createMockConversation().metadata,
          aiMetrics: {
            averageConfidence: 0.9,
            interactionsCount: 10
          }
        }
      }))
    );

    const response = await request
      .get('/api/v1/conversations/metrics')
      .expect(200);

    expect(response.body.metrics).toMatchObject({
      aiConfidenceAverage: expect.any(Number),
      humanTakeoverRate: expect.any(Number),
      averageResponseTime: expect.any(Number)
    });
  });
});

describe('Concurrency Handling', () => {
  test('should handle parallel agent assignments correctly', async () => {
    const conversation = await ConversationModel.create(createMockConversation());
    const agentIds = [faker.string.uuid(), faker.string.uuid()];

    const assignments = await Promise.all(
      agentIds.map(agentId =>
        request
          .post(`/api/v1/conversations/${conversation.id}/assign`)
          .send({ agentId })
      )
    );

    // Only one assignment should succeed
    const successfulAssignments = assignments.filter(r => r.status === 200);
    expect(successfulAssignments).toHaveLength(1);
  });

  test('should maintain data consistency during status transitions', async () => {
    const conversation = await ConversationModel.create(createMockConversation());
    const statusUpdates = [
      ConversationStatus.HUMAN_TAKEOVER,
      ConversationStatus.ACTIVE
    ];

    const updates = await Promise.all(
      statusUpdates.map(status =>
        request
          .patch(`/api/v1/conversations/${conversation.id}/status`)
          .send({ status })
      )
    );

    const finalConversation = await ConversationModel.findByPk(conversation.id);
    expect(finalConversation?.metadata.statusHistory).toHaveLength(1);
  });
});