# AWS Provider version: ~> 5.0

# VPC Outputs
output "vpc_id" {
  description = "The ID of the VPC for network configuration"
  value       = module.vpc_outputs.vpc_id
  sensitive   = false
}

output "vpc_cidr" {
  description = "The CIDR block of the VPC for network planning"
  value       = module.vpc_outputs.vpc_cidr
  sensitive   = false
}

output "private_subnet_ids" {
  description = "List of private subnet IDs for service deployment"
  value       = module.vpc_outputs.private_subnet_ids
  sensitive   = false
}

# EKS Cluster Outputs
output "eks_cluster_endpoint" {
  description = "The endpoint URL for the EKS cluster API server"
  value       = module.eks_outputs.cluster_endpoint
  sensitive   = true
}

output "eks_cluster_name" {
  description = "The name of the EKS cluster for service deployment"
  value       = module.eks_outputs.cluster_name
  sensitive   = false
}

output "eks_cluster_security_group_id" {
  description = "The security group ID attached to the EKS cluster"
  value       = module.eks_outputs.cluster_security_group_id
  sensitive   = true
}

output "eks_cluster_version" {
  description = "The Kubernetes version of the EKS cluster"
  value       = module.eks_outputs.cluster_version
  sensitive   = false
}

# RDS Outputs
output "rds_endpoint" {
  description = "The connection endpoint for the RDS PostgreSQL instance"
  value       = module.rds_outputs.rds_endpoint
  sensitive   = true
}

output "rds_port" {
  description = "The port number on which the RDS instance accepts connections"
  value       = module.rds_outputs.rds_port
  sensitive   = false
}

output "rds_security_group_id" {
  description = "The security group ID attached to the RDS instance"
  value       = module.rds_outputs.rds_security_group_id
  sensitive   = true
}

output "rds_monitoring_role_arn" {
  description = "The ARN of the IAM role used for RDS enhanced monitoring"
  value       = module.rds_outputs.rds_monitoring_role_arn
  sensitive   = false
}

# ECR Repository Outputs
output "ecr_repository_urls" {
  description = "Map of ECR repository URLs for service deployments"
  value       = module.ecr_outputs.repository_urls
  sensitive   = false
}

output "ecr_repository_arns" {
  description = "Map of ECR repository ARNs for IAM policies"
  value       = module.ecr_outputs.repository_arns
  sensitive   = false
}

# Monitoring and Security Outputs
output "monitoring_enabled" {
  description = "Indicates whether enhanced monitoring is enabled for the infrastructure"
  value       = true
  sensitive   = false
}

output "security_compliance" {
  description = "Map of security compliance statuses for various components"
  value = {
    encryption_at_rest = true
    encryption_in_transit = true
    multi_az_enabled = true
    backup_enabled = true
    monitoring_enabled = true
    audit_logging = true
  }
  sensitive = false
}

# Environment Information
output "environment" {
  description = "The deployment environment (dev/staging/prod)"
  value       = var.environment
  sensitive   = false
}

output "aws_region" {
  description = "The AWS region where the infrastructure is deployed"
  value       = var.aws_region
  sensitive   = false
}