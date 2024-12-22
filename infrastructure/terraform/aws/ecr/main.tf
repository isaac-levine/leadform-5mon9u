# AWS Provider version: ~> 5.0
terraform {
  required_providers {
    aws = {
      source  = "hashicorp/aws"
      version = "~> 5.0"
    }
  }
}

# Local variables for repository configuration
locals {
  repository_names = [
    "ai-service",
    "analytics-service", 
    "form-service",
    "gateway-service",
    "sms-service",
    "frontend-service"
  ]

  tags = {
    ManagedBy     = "terraform"
    Project       = var.project
    Environment   = var.environment
    SecurityScan  = "enabled"
    Replicated    = "true"
  }
}

# Data source for current AWS account information
data "aws_caller_identity" "current" {}

# ECR Repositories with enhanced security configuration
resource "aws_ecr_repository" "service_repos" {
  for_each = toset(local.repository_names)

  name                 = "${var.project}-${each.value}-${var.environment}"
  image_tag_mutability = "IMMUTABLE"

  # Enable image scanning on push for security compliance
  image_scanning_configuration {
    scan_on_push = true
  }

  # Enable KMS encryption for images at rest
  encryption_configuration {
    encryption_type = "KMS"
    kms_key = "aws/ecr"
  }

  # Force HTTPS for all repository operations
  image_force_delete_enabled = false

  tags = local.tags
}

# Lifecycle policies for image retention management
resource "aws_ecr_lifecycle_policy" "service_repos_lifecycle" {
  for_each   = toset(local.repository_names)
  repository = aws_ecr_repository.service_repos[each.key].name

  policy = jsonencode({
    rules = [
      {
        rulePriority = 1
        description  = "Keep last 30 tagged release images"
        selection = {
          tagStatus      = "tagged"
          tagPrefixList  = ["v"]
          countType      = "imageCountMoreThan"
          countNumber    = 30
        }
        action = {
          type = "expire"
        }
      },
      {
        rulePriority = 2
        description  = "Remove untagged images after 7 days"
        selection = {
          tagStatus   = "untagged"
          countType   = "sinceImagePushed"
          countUnit   = "days"
          countNumber = 7
        }
        action = {
          type = "expire"
        }
      }
    ]
  })
}

# Repository policies for cross-account access and security controls
resource "aws_ecr_repository_policy" "service_repos_policy" {
  for_each   = toset(local.repository_names)
  repository = aws_ecr_repository.service_repos[each.key].name

  policy = jsonencode({
    Version = "2012-10-17"
    Statement = [
      {
        Sid    = "EnforceIAMAuth"
        Effect = "Deny"
        Principal = "*"
        Action = [
          "ecr:GetDownloadUrlForLayer",
          "ecr:BatchGetImage",
          "ecr:BatchCheckLayerAvailability"
        ]
        Condition = {
          Bool = {
            "aws:SecureTransport": "false"
          }
        }
      }
    ]
  })
}

# Cross-region replication configuration for disaster recovery
resource "aws_ecr_replication_configuration" "cross_region" {
  replication_configuration {
    rules {
      destinations {
        region      = "us-west-2"  # DR region
        registry_id = data.aws_caller_identity.current.account_id
      }

      repository_filters {
        filter_type = "PREFIX_MATCH"
        filter_value = "${var.project}-"
      }
    }
  }
}

# Outputs for repository URLs and ARNs
output "repository_urls" {
  description = "Map of ECR repository URLs for service deployments"
  value = {
    for name in local.repository_names :
    name => aws_ecr_repository.service_repos[name].repository_url
  }
}

output "repository_arns" {
  description = "Map of ECR repository ARNs for IAM policies"
  value = {
    for name in local.repository_names :
    name => aws_ecr_repository.service_repos[name].arn
  }
}