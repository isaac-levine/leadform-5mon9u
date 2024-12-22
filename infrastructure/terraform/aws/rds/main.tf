# AWS Provider version: ~> 5.0
terraform {
  required_providers {
    aws = {
      source  = "hashicorp/aws"
      version = "~> 5.0"
    }
    random = {
      source  = "hashicorp/random"
      version = "~> 3.0"
    }
  }
}

# Data source for VPC configuration from remote state
data "terraform_remote_state" "vpc" {
  backend = "s3"
  config = {
    bucket = "${var.project}-${var.environment}-terraform-state"
    key    = "vpc/terraform.tfstate"
    region = var.aws_region
  }
}

# Generate random password for RDS instance
resource "random_password" "rds_password" {
  length           = 32
  special          = true
  override_special = "!#$%&*()-_=+[]{}<>:?"
}

# Store RDS password in AWS Secrets Manager
resource "aws_secretsmanager_secret" "rds_password" {
  name = "${var.project}-${var.environment}-rds-password"
  tags = {
    Name        = "${var.project}-${var.environment}-rds-password"
    Environment = var.environment
    Project     = var.project
    ManagedBy   = "terraform"
  }
}

resource "aws_secretsmanager_secret_version" "rds_password" {
  secret_id     = aws_secretsmanager_secret.rds_password.id
  secret_string = random_password.rds_password.result
}

# IAM role for enhanced monitoring
resource "aws_iam_role" "rds_monitoring_role" {
  name = "${var.project}-${var.environment}-rds-monitoring-role"

  assume_role_policy = jsonencode({
    Version = "2012-10-17"
    Statement = [
      {
        Action = "sts:AssumeRole"
        Effect = "Allow"
        Principal = {
          Service = "monitoring.rds.amazonaws.com"
        }
      }
    ]
  })

  tags = {
    Name        = "${var.project}-${var.environment}-rds-monitoring-role"
    Environment = var.environment
    Project     = var.project
    ManagedBy   = "terraform"
  }
}

resource "aws_iam_role_policy_attachment" "rds_monitoring_policy" {
  role       = aws_iam_role.rds_monitoring_role.name
  policy_arn = "arn:aws:iam::aws:policy/service-role/AmazonRDSEnhancedMonitoringRole"
}

# RDS subnet group
resource "aws_db_subnet_group" "rds_subnet_group" {
  name        = "${var.project}-${var.environment}-rds-subnet-group"
  subnet_ids  = data.terraform_remote_state.vpc.outputs.private_subnet_ids
  description = "Subnet group for RDS instance"

  tags = {
    Name        = "${var.project}-${var.environment}-rds-subnet-group"
    Environment = var.environment
    Project     = var.project
    ManagedBy   = "terraform"
  }
}

# Security group for RDS
resource "aws_security_group" "rds_security_group" {
  name        = "${var.project}-${var.environment}-rds-sg"
  description = "Security group for RDS instance"
  vpc_id      = data.terraform_remote_state.vpc.outputs.vpc_id

  ingress {
    from_port       = 5432
    to_port         = 5432
    protocol        = "tcp"
    security_groups = [var.eks_worker_security_group_id]
    description     = "Allow PostgreSQL access from EKS workers"
  }

  tags = {
    Name        = "${var.project}-${var.environment}-rds-sg"
    Environment = var.environment
    Project     = var.project
    ManagedBy   = "terraform"
  }
}

# RDS parameter group
resource "aws_db_parameter_group" "rds_parameter_group" {
  name        = "${var.project}-${var.environment}-pg15"
  family      = "postgres15"
  description = "Custom parameter group for PostgreSQL 15"

  parameter {
    name  = "shared_preload_libraries"
    value = "pg_stat_statements"
  }

  parameter {
    name  = "log_min_duration_statement"
    value = "1000"
  }

  parameter {
    name  = "log_connections"
    value = "1"
  }

  parameter {
    name  = "log_disconnections"
    value = "1"
  }

  parameter {
    name  = "log_lock_waits"
    value = "1"
  }

  parameter {
    name  = "log_temp_files"
    value = "0"
  }

  tags = {
    Name        = "${var.project}-${var.environment}-pg15"
    Environment = var.environment
    Project     = var.project
    ManagedBy   = "terraform"
  }
}

# RDS instance
resource "aws_db_instance" "postgres" {
  identifier = "${var.project}-${var.environment}-postgres"

  # Engine configuration
  engine                      = "postgres"
  engine_version             = "15"
  instance_class             = var.rds_instance_class
  allocated_storage          = 100
  max_allocated_storage      = 1000
  storage_type               = "gp3"
  storage_encrypted         = true
  kms_key_id                = data.aws_kms_key.rds_encryption.arn

  # Database configuration
  db_name  = "ai_sms_platform"
  username = "admin"
  password = random_password.rds_password.result
  port     = 5432

  # Network configuration
  multi_az               = true
  db_subnet_group_name   = aws_db_subnet_group.rds_subnet_group.name
  vpc_security_group_ids = [aws_security_group.rds_security_group.id]
  publicly_accessible    = false

  # Backup configuration
  backup_retention_period   = 7
  backup_window            = "03:00-04:00"
  maintenance_window       = "Mon:04:00-Mon:05:00"
  copy_tags_to_snapshot    = true
  final_snapshot_identifier = "${var.project}-${var.environment}-final-snapshot"
  skip_final_snapshot      = false

  # Monitoring and logging
  monitoring_interval             = 60
  monitoring_role_arn            = aws_iam_role.rds_monitoring_role.arn
  performance_insights_enabled    = true
  performance_insights_retention_period = 7
  performance_insights_kms_key_id = data.aws_kms_key.rds_encryption.arn
  enabled_cloudwatch_logs_exports = ["postgresql", "upgrade"]

  # Parameter and option groups
  parameter_group_name = aws_db_parameter_group.rds_parameter_group.name

  # Maintenance and upgrades
  auto_minor_version_upgrade = true
  deletion_protection       = true

  tags = {
    Name                = "${var.project}-${var.environment}-postgres"
    Environment         = var.environment
    Project            = var.project
    ManagedBy          = "terraform"
    BackupRetention    = "7days"
    SecurityCompliance = "required"
  }
}

# Outputs
output "rds_endpoint" {
  description = "The connection endpoint for the RDS instance"
  value       = aws_db_instance.postgres.endpoint
}

output "rds_port" {
  description = "The port number of the RDS instance"
  value       = aws_db_instance.postgres.port
}

output "rds_monitoring_role_arn" {
  description = "The ARN of the RDS monitoring role"
  value       = aws_iam_role.rds_monitoring_role.arn
}