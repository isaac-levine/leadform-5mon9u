/**
 * Analytics Metric Model for the AI-SMS Lead Platform
 * Implements database schema and business logic for tracking various performance metrics
 * @version 1.0.0
 */

import { Entity, Column, Index } from 'typeorm'; // v0.3.17
import { BaseEntity, MetricType, TimeRange } from '../../../shared/types/analytics.types';
import { validate as uuidValidate } from 'uuid'; // v9.0.0

@Entity('metrics')
@Index(['organizationId', 'type'])
@Index(['timestamp'])
@Index(['timeRange'])
export class MetricModel implements BaseEntity {
  @Column('uuid', { primary: true })
  id: string;

  @Column('uuid')
  organizationId: string;

  @Column({
    type: 'enum',
    enum: MetricType
  })
  type: MetricType;

  @Column('float')
  value: number;

  @Column({
    type: 'enum',
    enum: TimeRange
  })
  timeRange: TimeRange;

  @Column('timestamp with time zone')
  timestamp: Date;

  @Column('timestamp with time zone')
  createdAt: Date;

  @Column('timestamp with time zone')
  updatedAt: Date;

  /**
   * Creates a new metric instance with validation
   * @param organizationId - UUID of the organization
   * @param type - Type of metric being recorded
   * @param value - Numeric value of the metric
   * @param timeRange - Time range for the metric
   */
  constructor(
    organizationId: string,
    type: MetricType,
    value: number,
    timeRange: TimeRange
  ) {
    this.id = crypto.randomUUID();
    this.organizationId = organizationId;
    this.type = type;
    this.value = value;
    this.timeRange = timeRange;
    this.timestamp = new Date();
    this.createdAt = new Date();
    this.updatedAt = new Date();

    if (!this.validate()) {
      throw new Error('Invalid metric data');
    }
  }

  /**
   * Validates metric data based on type-specific rules
   * @returns boolean indicating if metric data is valid
   */
  validate(): boolean {
    // Validate organization ID
    if (!uuidValidate(this.organizationId)) {
      return false;
    }

    // Validate metric value ranges based on type
    switch (this.type) {
      case MetricType.RESPONSE_TIME:
        if (this.value < 0 || this.value > 10000) return false; // Max 10 seconds
        break;
      case MetricType.LEAD_ENGAGEMENT:
      case MetricType.CONVERSION_RATE:
      case MetricType.AI_CONFIDENCE:
      case MetricType.USER_ADOPTION:
        if (this.value < 0 || this.value > 100) return false; // Percentage values
        break;
      case MetricType.LEAD_QUALITY:
        if (this.value < 0 || this.value > 10) return false; // 0-10 scale
        break;
      case MetricType.SYSTEM_UPTIME:
        if (this.value < 0 || this.value > 100) return false; // Percentage
        break;
    }

    // Validate time range compatibility
    const validTimeRanges = new Set([
      TimeRange.HOUR,
      TimeRange.DAY,
      TimeRange.WEEK,
      TimeRange.MONTH
    ]);
    if (!validTimeRanges.has(this.timeRange)) {
      return false;
    }

    // Validate timestamp
    const now = new Date();
    const oneYearAgo = new Date();
    oneYearAgo.setFullYear(now.getFullYear() - 1);
    
    if (this.timestamp < oneYearAgo || this.timestamp > now) {
      return false;
    }

    return true;
  }

  /**
   * Converts metric to JSON representation with formatted values
   * @returns Formatted metric object
   */
  toJSON(): Record<string, unknown> {
    const formattedMetric: Record<string, unknown> = {
      id: this.id,
      organizationId: this.organizationId,
      type: this.type,
      timeRange: this.timeRange,
      timestamp: this.timestamp.toISOString(),
      createdAt: this.createdAt.toISOString(),
      updatedAt: this.updatedAt.toISOString()
    };

    // Format value based on metric type
    switch (this.type) {
      case MetricType.RESPONSE_TIME:
        formattedMetric.value = Math.round(this.value);
        formattedMetric.formattedValue = `${this.value}ms`;
        formattedMetric.target = 500; // Target: <500ms
        break;
      case MetricType.LEAD_ENGAGEMENT:
        formattedMetric.value = this.value;
        formattedMetric.formattedValue = `${this.value}%`;
        formattedMetric.target = 80; // Target: 80% response rate
        break;
      case MetricType.CONVERSION_RATE:
        formattedMetric.value = this.value;
        formattedMetric.formattedValue = `${this.value}%`;
        formattedMetric.target = 25; // Target: 25% improvement
        break;
      case MetricType.AI_CONFIDENCE:
        formattedMetric.value = this.value;
        formattedMetric.formattedValue = `${this.value}%`;
        break;
      case MetricType.LEAD_QUALITY:
        formattedMetric.value = this.value;
        formattedMetric.formattedValue = `${this.value}/10`;
        break;
      case MetricType.SYSTEM_UPTIME:
        formattedMetric.value = this.value;
        formattedMetric.formattedValue = `${this.value}%`;
        formattedMetric.target = 99.9; // Target: 99.9% uptime
        break;
      case MetricType.USER_ADOPTION:
        formattedMetric.value = this.value;
        formattedMetric.formattedValue = `${this.value}%`;
        formattedMetric.target = 90; // Target: 90% active rate
        break;
    }

    return formattedMetric;
  }
}