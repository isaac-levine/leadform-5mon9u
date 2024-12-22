/**
 * @fileoverview Controller for managing SMS conversations with human takeover capabilities
 * @version 1.0.0
 */

import { Request, Response } from 'express'; // ^4.18.0
import { StatusCodes } from 'http-status-codes'; // ^2.2.0
import { body, query, param } from 'express-validator'; // ^7.0.0
import Redis from 'ioredis'; // ^5.0.0
import { ConversationModel } from '../models/conversation.model';
import { ConversationStatus } from '../../../shared/types/sms.types';
import { AI_CONFIG, ERROR_THRESHOLDS } from '../../../shared/constants';

// Initialize Redis client for caching
const redis = new Redis({
  enableOfflineQueue: false,
  maxRetriesPerRequest: 3,
  retryStrategy: (times: number) => Math.min(times * 50, 2000)
});

/**
 * Validation middleware for conversation requests
 */
const conversationValidators = {
  list: [
    query('page').optional().isInt({ min: 1 }),
    query('limit').optional().isInt({ min: 1, max: 100 }),
    query('status').optional().isIn(Object.values(ConversationStatus)),
    query('agentId').optional().isUUID(),
    query('startDate').optional().isISO8601(),
    query('endDate').optional().isISO8601()
  ],
  status: [
    param('id').isUUID(),
    body('status').isIn(Object.values(ConversationStatus))
  ],
  agent: [
    param('id').isUUID(),
    body('agentId').isUUID()
  ]
};

/**
 * Controller class for conversation management with performance tracking
 */
export class ConversationController {
  /**
   * Retrieves paginated list of conversations with SLA monitoring
   */
  @ValidatePaginationParams()
  @CacheResponse(5 * 60) // Cache for 5 minutes
  @TrackMetrics('getConversations')
  public async getConversations(req: Request, res: Response): Promise<void> {
    try {
      const {
        page = 1,
        limit = 20,
        status,
        agentId,
        startDate,
        endDate
      } = req.query;

      // Build query filters
      const filters: any = {};
      if (status) filters.status = status;
      if (agentId) filters.assignedAgent = agentId;
      if (startDate && endDate) {
        filters.lastActivity = {
          $between: [new Date(startDate as string), new Date(endDate as string)]
        };
      }

      // Fetch conversations with pagination
      const offset = (Number(page) - 1) * Number(limit);
      const conversations = await ConversationModel.findAndCountAll({
        where: filters,
        limit: Number(limit),
        offset,
        order: [['lastActivity', 'DESC']],
        attributes: { include: ['metadata'] }
      });

      // Calculate SLA metrics
      const slaMetrics = this.calculateSLAMetrics(conversations.rows);

      res.status(StatusCodes.OK).json({
        data: conversations.rows,
        pagination: {
          total: conversations.count,
          page: Number(page),
          limit: Number(limit),
          pages: Math.ceil(conversations.count / Number(limit))
        },
        metrics: slaMetrics
      });
    } catch (error) {
      this.handleError(error, res);
    }
  }

  /**
   * Retrieves single conversation by ID with performance tracking
   */
  @ValidateParam('id')
  @CacheResponse(1 * 60) // Cache for 1 minute
  @TrackMetrics('getConversationById')
  public async getConversationById(req: Request, res: Response): Promise<void> {
    try {
      const conversation = await ConversationModel.findByPk(req.params.id);
      if (!conversation) {
        res.status(StatusCodes.NOT_FOUND).json({
          error: 'Conversation not found'
        });
        return;
      }

      res.status(StatusCodes.OK).json({ data: conversation });
    } catch (error) {
      this.handleError(error, res);
    }
  }

  /**
   * Updates conversation status with validation and audit logging
   */
  @ValidateStatusTransition()
  @TransactionManaged()
  @AuditLog('updateStatus')
  public async updateConversationStatus(req: Request, res: Response): Promise<void> {
    try {
      const { id } = req.params;
      const { status } = req.body;

      const conversation = await ConversationModel.findByPk(id);
      if (!conversation) {
        res.status(StatusCodes.NOT_FOUND).json({
          error: 'Conversation not found'
        });
        return;
      }

      await conversation.updateStatus(status);
      await redis.del(`conversation:${id}`); // Invalidate cache

      res.status(StatusCodes.OK).json({ data: conversation });
    } catch (error) {
      this.handleError(error, res);
    }
  }

  /**
   * Assigns agent to conversation with validation
   */
  @ValidateAgent()
  @TransactionManaged()
  @AuditLog('assignAgent')
  public async assignAgentToConversation(req: Request, res: Response): Promise<void> {
    try {
      const { id } = req.params;
      const { agentId } = req.body;

      const conversation = await ConversationModel.findByPk(id);
      if (!conversation) {
        res.status(StatusCodes.NOT_FOUND).json({
          error: 'Conversation not found'
        });
        return;
      }

      await conversation.assignAgent(agentId);
      await redis.del(`conversation:${id}`); // Invalidate cache

      res.status(StatusCodes.OK).json({ data: conversation });
    } catch (error) {
      this.handleError(error, res);
    }
  }

  /**
   * Unassigns agent from conversation with validation
   */
  @ValidateConversation()
  @TransactionManaged()
  @AuditLog('unassignAgent')
  public async unassignAgentFromConversation(req: Request, res: Response): Promise<void> {
    try {
      const { id } = req.params;

      const conversation = await ConversationModel.findByPk(id);
      if (!conversation) {
        res.status(StatusCodes.NOT_FOUND).json({
          error: 'Conversation not found'
        });
        return;
      }

      await conversation.unassignAgent();
      await redis.del(`conversation:${id}`); // Invalidate cache

      res.status(StatusCodes.OK).json({ data: conversation });
    } catch (error) {
      this.handleError(error, res);
    }
  }

  /**
   * Calculates SLA metrics for conversations
   */
  private calculateSLAMetrics(conversations: ConversationModel[]): Record<string, any> {
    const metrics = {
      averageResponseTime: 0,
      slaCompliance: 0,
      aiConfidenceAverage: 0,
      humanTakeoverRate: 0
    };

    if (!conversations.length) return metrics;

    const totalConversations = conversations.length;
    let totalResponseTime = 0;
    let compliantConversations = 0;
    let totalAiConfidence = 0;
    let humanTakeovers = 0;

    conversations.forEach(conversation => {
      // Calculate response times
      const responseTime = this.calculateResponseTime(conversation);
      totalResponseTime += responseTime;
      if (responseTime <= AI_CONFIG.PROCESSING_TIMEOUT) {
        compliantConversations++;
      }

      // Calculate AI confidence
      if (conversation.metadata.aiMetrics) {
        totalAiConfidence += conversation.metadata.aiMetrics.averageConfidence;
      }

      // Track human takeovers
      if (conversation.status === ConversationStatus.HUMAN_TAKEOVER) {
        humanTakeovers++;
      }
    });

    metrics.averageResponseTime = totalResponseTime / totalConversations;
    metrics.slaCompliance = (compliantConversations / totalConversations) * 100;
    metrics.aiConfidenceAverage = totalAiConfidence / totalConversations;
    metrics.humanTakeoverRate = (humanTakeovers / totalConversations) * 100;

    return metrics;
  }

  /**
   * Calculates response time for a conversation
   */
  private calculateResponseTime(conversation: ConversationModel): number {
    const activities = conversation.metadata.activityLog;
    if (!activities.length) return 0;

    let totalResponseTime = 0;
    let messageCount = 0;

    for (let i = 1; i < activities.length; i++) {
      if (activities[i].type === 'response') {
        const responseTime = new Date(activities[i].timestamp).getTime() -
          new Date(activities[i - 1].timestamp).getTime();
        totalResponseTime += responseTime;
        messageCount++;
      }
    }

    return messageCount ? totalResponseTime / messageCount : 0;
  }

  /**
   * Handles errors with appropriate status codes
   */
  private handleError(error: any, res: Response): void {
    console.error('Conversation Controller Error:', error);

    if (error.name === 'ValidationError') {
      res.status(StatusCodes.BAD_REQUEST).json({
        error: error.message
      });
      return;
    }

    if (error.name === 'NotFoundError') {
      res.status(StatusCodes.NOT_FOUND).json({
        error: error.message
      });
      return;
    }

    res.status(StatusCodes.INTERNAL_SERVER_ERROR).json({
      error: 'Internal server error'
    });
  }
}