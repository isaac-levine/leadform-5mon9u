/**
 * @fileoverview Conversation model for SMS messaging system with human takeover capabilities
 * @version 1.0.0
 */

import { Model, DataTypes } from 'sequelize'; // ^6.35.0
import { 
  Conversation,
  ConversationStatus
} from '../../../shared/types/sms.types';
import { VALIDATION_RULES } from '../../../shared/constants';

/**
 * Type for activity tracking in conversation metadata
 */
interface ActivityLog {
  timestamp: string;
  type: string;
  details: Record<string, any>;
}

/**
 * Type for status history in conversation metadata
 */
interface StatusHistory {
  timestamp: string;
  fromStatus: ConversationStatus;
  toStatus: ConversationStatus;
  triggeredBy?: string;
}

/**
 * Enhanced metadata structure for conversations
 */
interface ConversationMetadata {
  statusHistory: StatusHistory[];
  activityLog: ActivityLog[];
  agentHistory: {
    assignments: Array<{
      agentId: string;
      timestamp: string;
      action: 'assigned' | 'unassigned';
    }>;
  };
  aiMetrics?: {
    averageConfidence: number;
    interactionsCount: number;
  };
}

/**
 * Valid status transitions matrix for conversation state management
 */
const VALID_STATUS_TRANSITIONS: Record<ConversationStatus, ConversationStatus[]> = {
  [ConversationStatus.ACTIVE]: [
    ConversationStatus.PAUSED,
    ConversationStatus.CLOSED,
    ConversationStatus.HUMAN_TAKEOVER
  ],
  [ConversationStatus.PAUSED]: [
    ConversationStatus.ACTIVE,
    ConversationStatus.CLOSED,
    ConversationStatus.HUMAN_TAKEOVER
  ],
  [ConversationStatus.CLOSED]: [],
  [ConversationStatus.HUMAN_TAKEOVER]: [
    ConversationStatus.ACTIVE,
    ConversationStatus.CLOSED
  ]
};

/**
 * Conversation model implementing database schema and business logic
 * for conversation management with human takeover capabilities
 */
@Table({
  tableName: 'conversations',
  indexes: [
    { fields: ['leadId'] },
    { fields: ['status'] },
    { fields: ['lastActivity'] },
    { fields: ['assignedAgent'] }
  ]
})
export class ConversationModel extends Model<Conversation> implements Conversation {
  public id!: UUID;
  public leadId!: UUID;
  public status!: ConversationStatus;
  public phoneNumber!: string;
  public assignedAgent!: UUID | null;
  public lastActivity!: Date;
  public metadata!: ConversationMetadata;
  public readonly createdAt!: Date;
  public readonly updatedAt!: Date;

  /**
   * Initializes a new conversation instance with validation
   */
  constructor(attributes: Partial<Conversation>) {
    super(attributes);
    
    // Validate phone number format
    if (!VALIDATION_RULES.PHONE_REGEX.test(this.phoneNumber)) {
      throw new Error('Invalid phone number format');
    }

    // Initialize metadata structure
    this.metadata = {
      statusHistory: [],
      activityLog: [],
      agentHistory: {
        assignments: []
      },
      aiMetrics: {
        averageConfidence: 0,
        interactionsCount: 0
      }
    };

    // Set initial status and activity
    this.status = ConversationStatus.ACTIVE;
    this.lastActivity = new Date();
  }

  /**
   * Updates conversation status with validation and history tracking
   */
  public async updateStatus(newStatus: ConversationStatus): Promise<void> {
    // Validate status transition
    const allowedTransitions = VALID_STATUS_TRANSITIONS[this.status];
    if (!allowedTransitions.includes(newStatus)) {
      throw new Error(`Invalid status transition from ${this.status} to ${newStatus}`);
    }

    const oldStatus = this.status;
    this.status = newStatus;

    // Update status history
    this.metadata.statusHistory.push({
      timestamp: new Date().toISOString(),
      fromStatus: oldStatus,
      toStatus: newStatus
    });

    this.lastActivity = new Date();
    await this.save();
  }

  /**
   * Assigns an agent to the conversation with validation
   */
  public async assignAgent(agentId: UUID): Promise<void> {
    if (this.status === ConversationStatus.CLOSED) {
      throw new Error('Cannot assign agent to closed conversation');
    }

    this.assignedAgent = agentId;
    
    // Update agent history
    this.metadata.agentHistory.assignments.push({
      agentId: agentId.toString(),
      timestamp: new Date().toISOString(),
      action: 'assigned'
    });

    await this.updateStatus(ConversationStatus.HUMAN_TAKEOVER);
    this.lastActivity = new Date();
    await this.save();
  }

  /**
   * Removes agent assignment and returns to AI handling
   */
  public async unassignAgent(): Promise<void> {
    if (!this.assignedAgent) {
      throw new Error('No agent currently assigned');
    }

    // Update agent history
    this.metadata.agentHistory.assignments.push({
      agentId: this.assignedAgent.toString(),
      timestamp: new Date().toISOString(),
      action: 'unassigned'
    });

    this.assignedAgent = null;
    await this.updateStatus(ConversationStatus.ACTIVE);
    this.lastActivity = new Date();
    await this.save();
  }

  /**
   * Updates the last activity timestamp with validation
   */
  public async updateLastActivity(activityType: string): Promise<void> {
    this.lastActivity = new Date();
    
    // Log activity
    this.metadata.activityLog.push({
      timestamp: this.lastActivity.toISOString(),
      type: activityType,
      details: {
        status: this.status,
        hasAgent: !!this.assignedAgent
      }
    });

    await this.save();
  }

  /**
   * Converts conversation model to plain JSON with formatted dates
   */
  public toJSON(): Conversation {
    const json = super.toJSON() as Conversation;
    
    // Format dates
    json.lastActivity = this.lastActivity.toISOString();
    json.createdAt = this.createdAt.toISOString();
    json.updatedAt = this.updatedAt.toISOString();

    return json;
  }

  /**
   * Model initialization options
   */
  static initOptions = {
    attributes: {
      id: {
        type: DataTypes.UUID,
        defaultValue: DataTypes.UUIDV4,
        primaryKey: true
      },
      leadId: {
        type: DataTypes.UUID,
        allowNull: false
      },
      status: {
        type: DataTypes.ENUM(...Object.values(ConversationStatus)),
        allowNull: false,
        defaultValue: ConversationStatus.ACTIVE
      },
      phoneNumber: {
        type: DataTypes.STRING,
        allowNull: false,
        validate: {
          is: VALIDATION_RULES.PHONE_REGEX
        }
      },
      assignedAgent: {
        type: DataTypes.UUID,
        allowNull: true
      },
      lastActivity: {
        type: DataTypes.DATE,
        allowNull: false,
        defaultValue: DataTypes.NOW
      },
      metadata: {
        type: DataTypes.JSONB,
        allowNull: false,
        defaultValue: {
          statusHistory: [],
          activityLog: [],
          agentHistory: {
            assignments: []
          },
          aiMetrics: {
            averageConfidence: 0,
            interactionsCount: 0
          }
        }
      }
    },
    indexes: [
      { fields: ['leadId'] },
      { fields: ['status'] },
      { fields: ['lastActivity'] },
      { fields: ['assignedAgent'] }
    ]
  };
}