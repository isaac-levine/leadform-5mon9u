/**
 * @fileoverview Message model implementation for SMS message handling with AI confidence tracking
 * @version 1.0.0
 */

import { Model, DataTypes } from 'sequelize'; // v6.35.0
import { 
  Message, 
  MessageDirection, 
  MessageStatus 
} from '../../../shared/types/sms.types';
import { UUID } from 'crypto';

/**
 * Validates message status transitions to ensure data integrity
 */
const VALID_STATUS_TRANSITIONS: Record<MessageStatus, MessageStatus[]> = {
  [MessageStatus.QUEUED]: [MessageStatus.SENT, MessageStatus.FAILED],
  [MessageStatus.SENT]: [MessageStatus.DELIVERED, MessageStatus.FAILED, MessageStatus.EXPIRED],
  [MessageStatus.DELIVERED]: [MessageStatus.READ, MessageStatus.FAILED],
  [MessageStatus.READ]: [],
  [MessageStatus.FAILED]: [],
  [MessageStatus.BLOCKED]: [],
  [MessageStatus.EXPIRED]: []
};

/**
 * Message model class implementing database schema and business logic for SMS messages
 * Includes AI confidence tracking and enhanced validation
 */
@Table({
  tableName: 'messages',
  indexes: [
    { fields: ['conversationId'] },
    { fields: ['status'] },
    { fields: ['direction'] },
    { fields: ['createdAt'] }
  ]
})
export class MessageModel extends Model<Message> implements Message {
  @Column({
    type: DataTypes.UUID,
    defaultValue: DataTypes.UUIDV4,
    primaryKey: true
  })
  public id!: UUID;

  @Column({
    type: DataTypes.UUID,
    allowNull: false
  })
  public conversationId!: UUID;

  @Column({
    type: DataTypes.TEXT,
    allowNull: false,
    validate: {
      notEmpty: true,
      len: [1, 1600] // SMS message length limit
    }
  })
  public content!: string;

  @Column({
    type: DataTypes.ENUM(...Object.values(MessageDirection)),
    allowNull: false
  })
  public direction!: MessageDirection;

  @Column({
    type: DataTypes.ENUM(...Object.values(MessageStatus)),
    allowNull: false,
    defaultValue: MessageStatus.QUEUED
  })
  public status!: MessageStatus;

  @Column({
    type: DataTypes.FLOAT,
    allowNull: false,
    defaultValue: 0,
    validate: {
      min: 0,
      max: 1
    }
  })
  public aiConfidence!: number;

  @Column({
    type: DataTypes.JSONB,
    allowNull: false,
    defaultValue: {}
  })
  public metadata!: Record<string, any>;

  @Column({
    type: DataTypes.DATE,
    allowNull: false,
    defaultValue: DataTypes.NOW
  })
  public createdAt!: Date;

  @Column({
    type: DataTypes.DATE,
    allowNull: false,
    defaultValue: DataTypes.NOW
  })
  public updatedAt!: Date;

  /**
   * Initializes a new message instance with validation
   */
  constructor(attributes: Partial<Message>) {
    super(attributes);
    
    // Initialize metadata with audit trail
    this.metadata = {
      ...this.metadata,
      version: '1.0.0',
      createdTimestamp: new Date().toISOString(),
      statusHistory: [],
      confidenceHistory: [],
      processingMetrics: {
        startTime: new Date().toISOString()
      }
    };

    // Set default status for outbound messages
    if (this.direction === MessageDirection.OUTBOUND && !this.status) {
      this.status = MessageStatus.QUEUED;
    }

    // Validate required fields
    if (!this.conversationId) {
      throw new Error('conversationId is required');
    }
    if (!this.content) {
      throw new Error('content is required');
    }
    if (!this.direction) {
      throw new Error('direction is required');
    }
  }

  /**
   * Updates message status with transition validation
   * @throws Error if status transition is invalid
   */
  public async updateStatus(newStatus: MessageStatus): Promise<void> {
    const validTransitions = VALID_STATUS_TRANSITIONS[this.status];
    if (!validTransitions.includes(newStatus)) {
      throw new Error(
        `Invalid status transition from ${this.status} to ${newStatus}`
      );
    }

    // Update status and audit trail
    const previousStatus = this.status;
    this.status = newStatus;
    this.metadata.statusHistory.push({
      from: previousStatus,
      to: newStatus,
      timestamp: new Date().toISOString()
    });

    await this.save();
  }

  /**
   * Updates AI confidence score with validation and history tracking
   * @throws Error if confidence score is invalid
   */
  public async updateAIConfidence(confidence: number): Promise<void> {
    if (confidence < 0 || confidence > 1) {
      throw new Error('Confidence score must be between 0 and 1');
    }

    // Update confidence and history
    const previousConfidence = this.aiConfidence;
    this.aiConfidence = confidence;
    this.metadata.confidenceHistory.push({
      from: previousConfidence,
      to: confidence,
      timestamp: new Date().toISOString()
    });

    await this.save();
  }

  /**
   * Converts message to JSON with enhanced formatting
   */
  public toJSON(): Message {
    const json = super.toJSON() as Message;
    
    // Format dates
    json.createdAt = new Date(json.createdAt).toISOString();
    json.updatedAt = new Date(json.updatedAt).toISOString();

    // Add computed fields
    json.metadata = {
      ...json.metadata,
      age: Date.now() - new Date(json.createdAt).getTime(),
      processingTime: json.metadata.processingMetrics?.endTime 
        ? new Date(json.metadata.processingMetrics.endTime).getTime() - 
          new Date(json.metadata.processingMetrics.startTime).getTime()
        : null,
      confidencePercentage: `${(json.aiConfidence * 100).toFixed(2)}%`
    };

    return json;
  }
}

export default MessageModel;