# Backend configuration for Terraform state management
# AWS Provider Version: ~> 5.0

terraform {
  backend "s3" {
    # S3 bucket for state storage with project-based naming
    bucket = "${var.project}-terraform-state"
    
    # Environment-specific state file path
    key = "${var.environment}/terraform.tfstate"
    
    # Primary region for state storage
    region = "us-east-1"
    
    # Enable encryption at rest for state file
    encrypt = true
    
    # DynamoDB table for state locking
    dynamodb_table = "${var.project}-terraform-locks"
    
    # Workspace management configuration
    workspace_key_prefix = "workspaces"
    
    # Access control configuration
    acl = "private"
    
    # Enable versioning for state history
    versioning = true
    
    # Server-side encryption configuration
    server_side_encryption_configuration {
      rule {
        apply_server_side_encryption_by_default {
          sse_algorithm = "AES256"
        }
      }
    }
    
    # Lifecycle rules for state file versions
    lifecycle_rule {
      enabled = true
      
      # Expire old state versions after 90 days
      noncurrent_version_expiration {
        days = 90
      }
      
      # Transition old versions to cheaper storage after 30 days
      noncurrent_version_transition {
        days          = 30
        storage_class = "STANDARD_IA"
      }
    }
    
    # Cross-region replication for disaster recovery
    replication_configuration {
      role = "arn:aws:iam::ACCOUNT_ID:role/terraform-state-replication-role"
      
      rules {
        id     = "state-replication"
        status = "Enabled"
        
        destination {
          bucket        = "arn:aws:s3:::${var.project}-terraform-state-replica"
          storage_class = "STANDARD"
          
          # KMS encryption for replicated state
          replica_kms_key_id = "arn:aws:kms:REGION:ACCOUNT_ID:key/KEY_ID"
          
          # Account configuration for cross-account replication
          account = "ACCOUNT_ID"
          
          # Object ownership controls
          access_control_translation {
            owner = "Destination"
          }
          
          # Encryption configuration for replicated objects
          encryption_configuration {
            replica_kms_key_id = "arn:aws:kms:REGION:ACCOUNT_ID:key/KEY_ID"
          }
        }
      }
    }
  }
}