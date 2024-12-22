# Provider version constraints are typically defined in versions.tf, but including version info here as a comment
# AWS Provider Version: ~> 5.0

# Project Configuration
variable "project" {
  description = "Project name used for resource naming and tagging"
  type        = string
  default     = "ai-sms-platform"

  validation {
    condition     = can(regex("^[a-z0-9-]+$", var.project))
    error_message = "Project name must contain only lowercase letters, numbers, and hyphens"
  }
}

variable "environment" {
  description = "Deployment environment (dev/staging/prod) for resource configuration"
  type        = string

  validation {
    condition     = contains(["dev", "staging", "prod"], var.environment)
    error_message = "Environment must be dev, staging, or prod"
  }
}

# Regional Configuration
variable "aws_region" {
  description = "Primary AWS region for resource deployment"
  type        = string
  default     = "us-east-1"
}

variable "dr_region" {
  description = "Disaster recovery AWS region for high availability"
  type        = string
  default     = "us-west-2"
}

# Network Configuration
variable "vpc_cidr" {
  description = "CIDR block for VPC network configuration"
  type        = string
  default     = "10.0.0.0/16"

  validation {
    condition     = can(cidrhost(var.vpc_cidr, 0))
    error_message = "VPC CIDR must be a valid IPv4 CIDR block"
  }
}

variable "availability_zones" {
  description = "List of availability zones for multi-AZ deployment"
  type        = list(string)
  default     = ["us-east-1a", "us-east-1b", "us-east-1c"]
}

# EKS Configuration
variable "eks_cluster_version" {
  description = "Kubernetes version for EKS cluster deployment"
  type        = string
  default     = "1.27"
}

variable "eks_node_instance_types" {
  description = "Instance types for EKS node groups with cost optimization"
  type        = list(string)
  default     = ["t3.large", "t3.xlarge"]
}

# Database Configuration
variable "rds_instance_class" {
  description = "Instance class for RDS PostgreSQL database"
  type        = string
  default     = "db.t3.large"
}

# High Availability Configuration
variable "enable_multi_az" {
  description = "Enable Multi-AZ deployment for high availability"
  type        = bool
  default     = true
}

# Security Configuration
variable "enable_encryption" {
  description = "Enable encryption for data at rest across all services"
  type        = bool
  default     = true
}

# Backup Configuration
variable "backup_retention_days" {
  description = "Number of days to retain backups for disaster recovery"
  type        = number
  default     = 7

  validation {
    condition     = var.backup_retention_days >= 7
    error_message = "Backup retention must be at least 7 days for compliance"
  }
}

# Resource Tagging
variable "tags" {
  description = "Common tags for all resources including compliance and cost tracking"
  type        = map(string)
  default = {
    ManagedBy           = "terraform"
    Project             = "ai-sms-platform"
    Environment         = null # Will be set dynamically using var.environment
    CostCenter          = "platform-infrastructure"
    DataClassification  = "confidential"
  }
}

# The following locals block ensures environment-specific tags are properly set
locals {
  common_tags = merge(
    var.tags,
    {
      Environment = var.environment
    }
  )
}