/**
 * @fileoverview Comprehensive test suite for API Gateway route handlers
 * @version 1.0.0
 * 
 * Tests authentication, authorization, rate limiting, security, and performance
 * for AI, Form, and SMS endpoints with extensive mocking and assertions.
 */

import request from 'supertest'; // v6.3.3
import { Express } from 'express'; // v4.18.2
import { StatusCodes } from 'http-status-codes'; // v2.2.0
import Redis from 'ioredis'; // v5.3.2
import MockRedis from 'ioredis-mock'; // v8.9.0
import aiRouter from '../src/routes/ai.routes';
import formRouter from '../src/routes/form.routes';
import smsRouter from '../src/routes/sms.routes';
import { authenticate, authorize } from '../src/middleware/auth.middleware';
import { rateLimitMiddleware } from '../src/middleware/ratelimit.middleware';
import { Logger } from '../../../shared/utils/logger';
import { ConversationStatus, MessageDirection } from '../../../shared/types/sms.types';

// Test configuration constants
const TEST_CONFIG = {
  JWT_SECRET: 'test-secret-key-min-32-chars-long-for-security',
  RATE_LIMIT: {
    windowMs: 1000, // 1 second for testing
    maxRequests: 5,
    blockDuration: 2000,
    trustProxy: false,
    skipPaths: ['/health']
  },
  SECURITY: {
    CORS_ORIGINS: ['http://localhost:3000'],
    MAX_PAYLOAD_SIZE: '1mb'
  }
};

// Test data constants
const TEST_DATA = {
  VALID_USER: {
    userId: 'test-user-id',
    role: 'agent'
  },
  VALID_ADMIN: {
    userId: 'test-admin-id',
    role: 'admin'
  },
  VALID_MESSAGE: {
    conversationId: 'test-conv-id',
    content: 'Test message content',
    direction: MessageDirection.OUTBOUND
  },
  VALID_FORM: {
    name: 'Test Form',
    fields: [{ type: 'text', label: 'Name' }],
    styling: { theme: 'light' }
  }
};

/**
 * Base class for route testing with common utilities
 */
class BaseRouteTest {
  protected app: Express;
  protected redisMock: MockRedis;
  protected logger: Logger;

  constructor() {
    this.logger = new Logger('RouteTest', 'TestSuite');
    this.redisMock = new MockRedis();
    this.app = this.setupTestApp();
  }

  /**
   * Sets up test Express application with mocked dependencies
   */
  private setupTestApp(): Express {
    const express = require('express');
    const app = express();

    // Configure middleware
    app.use(express.json());
    app.use(express.urlencoded({ extended: true }));

    // Mock Redis for rate limiting
    jest.mock('ioredis', () => MockRedis);

    // Configure routes with mocked dependencies
    app.use('/api/v1/ai', aiRouter);
    app.use('/api/v1/forms', formRouter);
    app.use('/api/v1/sms', smsRouter);

    return app;
  }

  /**
   * Generates test JWT token
   */
  protected generateTestToken(role: string = 'agent'): string {
    const jwt = require('jsonwebtoken');
    return jwt.sign(
      { userId: 'test-user', role },
      TEST_CONFIG.JWT_SECRET,
      { expiresIn: '1h' }
    );
  }

  /**
   * Cleans up test resources
   */
  async cleanup(): Promise<void> {
    await this.redisMock.flushall();
    jest.clearAllMocks();
  }
}

/**
 * AI Route Tests
 */
describe('AI Routes', () => {
  const testSuite = new BaseRouteTest();

  afterEach(async () => {
    await testSuite.cleanup();
  });

  describe('POST /api/v1/ai/conversations', () => {
    it('should process message with valid token and payload', async () => {
      const token = testSuite.generateTestToken('agent');
      const response = await request(testSuite.app)
        .post('/api/v1/ai/conversations')
        .set('Authorization', `Bearer ${token}`)
        .send(TEST_DATA.VALID_MESSAGE);

      expect(response.status).toBe(StatusCodes.OK);
      expect(response.body).toHaveProperty('processed_content');
      expect(response.body).toHaveProperty('confidence_score');
    });

    it('should reject request without authentication', async () => {
      const response = await request(testSuite.app)
        .post('/api/v1/ai/conversations')
        .send(TEST_DATA.VALID_MESSAGE);

      expect(response.status).toBe(StatusCodes.UNAUTHORIZED);
    });

    it('should enforce rate limits', async () => {
      const token = testSuite.generateTestToken('agent');
      const requests = Array(6).fill(null).map(() => 
        request(testSuite.app)
          .post('/api/v1/ai/conversations')
          .set('Authorization', `Bearer ${token}`)
          .send(TEST_DATA.VALID_MESSAGE)
      );

      const responses = await Promise.all(requests);
      const tooManyRequests = responses.filter(
        r => r.status === StatusCodes.TOO_MANY_REQUESTS
      );

      expect(tooManyRequests.length).toBeGreaterThan(0);
    });
  });
});

/**
 * Form Route Tests
 */
describe('Form Routes', () => {
  const testSuite = new BaseRouteTest();

  afterEach(async () => {
    await testSuite.cleanup();
  });

  describe('POST /api/v1/forms', () => {
    it('should create form with admin token', async () => {
      const token = testSuite.generateTestToken('admin');
      const response = await request(testSuite.app)
        .post('/api/v1/forms')
        .set('Authorization', `Bearer ${token}`)
        .send(TEST_DATA.VALID_FORM);

      expect(response.status).toBe(StatusCodes.CREATED);
      expect(response.body).toHaveProperty('id');
    });

    it('should reject form creation with agent token', async () => {
      const token = testSuite.generateTestToken('agent');
      const response = await request(testSuite.app)
        .post('/api/v1/forms')
        .set('Authorization', `Bearer ${token}`)
        .send(TEST_DATA.VALID_FORM);

      expect(response.status).toBe(StatusCodes.FORBIDDEN);
    });
  });
});

/**
 * SMS Route Tests
 */
describe('SMS Routes', () => {
  const testSuite = new BaseRouteTest();

  afterEach(async () => {
    await testSuite.cleanup();
  });

  describe('POST /api/v1/sms/messages', () => {
    it('should send message with valid token', async () => {
      const token = testSuite.generateTestToken('agent');
      const response = await request(testSuite.app)
        .post('/api/v1/sms/messages')
        .set('Authorization', `Bearer ${token}`)
        .send(TEST_DATA.VALID_MESSAGE);

      expect(response.status).toBe(StatusCodes.CREATED);
      expect(response.body).toHaveProperty('id');
    });

    it('should handle retry logic on failure', async () => {
      const token = testSuite.generateTestToken('agent');
      // Mock service failure
      jest.spyOn(global, 'fetch').mockRejectedValueOnce(new Error('Service unavailable'));
      
      const response = await request(testSuite.app)
        .post('/api/v1/sms/messages')
        .set('Authorization', `Bearer ${token}`)
        .send(TEST_DATA.VALID_MESSAGE);

      expect(response.status).toBe(StatusCodes.CREATED);
      expect(global.fetch).toHaveBeenCalledTimes(2); // Initial + 1 retry
    });
  });

  describe('GET /api/v1/sms/conversations', () => {
    it('should return filtered conversations', async () => {
      const token = testSuite.generateTestToken('agent');
      const response = await request(testSuite.app)
        .get('/api/v1/sms/conversations')
        .query({
          status: ConversationStatus.ACTIVE,
          page: 1,
          limit: 10
        })
        .set('Authorization', `Bearer ${token}`);

      expect(response.status).toBe(StatusCodes.OK);
      expect(response.body).toHaveProperty('data');
      expect(response.body).toHaveProperty('pagination');
    });
  });
});

/**
 * Security Tests
 */
describe('Security Features', () => {
  const testSuite = new BaseRouteTest();

  it('should prevent CSRF attacks', async () => {
    const token = testSuite.generateTestToken('agent');
    const response = await request(testSuite.app)
      .post('/api/v1/forms')
      .set('Authorization', `Bearer ${token}`)
      .set('Origin', 'http://malicious-site.com')
      .send(TEST_DATA.VALID_FORM);

    expect(response.status).toBe(StatusCodes.FORBIDDEN);
  });

  it('should validate content-type headers', async () => {
    const token = testSuite.generateTestToken('agent');
    const response = await request(testSuite.app)
      .post('/api/v1/forms')
      .set('Authorization', `Bearer ${token}`)
      .set('Content-Type', 'text/plain')
      .send('malicious content');

    expect(response.status).toBe(StatusCodes.UNSUPPORTED_MEDIA_TYPE);
  });
});

/**
 * Performance Tests
 */
describe('Performance Requirements', () => {
  const testSuite = new BaseRouteTest();

  it('should process AI requests within 500ms', async () => {
    const token = testSuite.generateTestToken('agent');
    const startTime = Date.now();
    
    await request(testSuite.app)
      .post('/api/v1/ai/conversations')
      .set('Authorization', `Bearer ${token}`)
      .send(TEST_DATA.VALID_MESSAGE);

    const processingTime = Date.now() - startTime;
    expect(processingTime).toBeLessThan(500);
  });
});