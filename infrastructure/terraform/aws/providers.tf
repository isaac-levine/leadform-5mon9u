# Configure Terraform version and required providers
terraform {
  # Terraform version constraint as per technical specifications
  required_version = ">= 1.5.0"

  required_providers {
    # AWS provider version ~> 5.0 as per technical specifications
    aws = {
      source  = "hashicorp/aws"
      version = "~> 5.0"
    }
  }
}

# Primary region provider configuration
provider "aws" {
  alias  = "primary"
  region = var.aws_region

  # Default tags applied to all resources in primary region
  default_tags {
    tags = {
      Environment         = var.environment
      Project            = var.project
      ManagedBy          = "terraform"
      SecurityCompliance = "required"
      BackupEnabled      = "true"
      MonitoringEnabled  = "true"
      DataClassification = "confidential"
      CostCenter         = "platform-infrastructure"
    }
  }
}

# Disaster Recovery (DR) region provider configuration
provider "aws" {
  alias  = "dr"
  region = var.dr_region

  # Default tags applied to all resources in DR region
  default_tags {
    tags = {
      Environment         = var.environment
      Project            = var.project
      ManagedBy          = "terraform"
      SecurityCompliance = "required"
      BackupEnabled      = "true"
      MonitoringEnabled  = "true"
      DataClassification = "confidential"
      CostCenter         = "platform-infrastructure"
      DRRegion           = "true"
    }
  }
}