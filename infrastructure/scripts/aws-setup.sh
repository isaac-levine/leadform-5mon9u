#!/usr/bin/env bash

# AWS Infrastructure Setup Script
# Version: 1.0.0
# Description: Automates AWS infrastructure setup for the AI-SMS Lead Platform
# Dependencies: aws-cli v2.x, terraform v1.5.x, jq v1.6+

set -euo pipefail
IFS=$'\n\t'

# Global Constants
readonly SCRIPT_VERSION="1.0.0"
readonly REQUIRED_AWS_CLI_VERSION="2.0.0"
readonly REQUIRED_TERRAFORM_VERSION="1.5.0"
readonly REQUIRED_JQ_VERSION="1.6"

# AWS Regions
readonly AWS_PRIMARY_REGION="us-east-1"
readonly AWS_DR_REGION="us-west-2"

# Resource Naming
readonly PROJECT_NAME="ai-sms-platform"
readonly STATE_BUCKET_PREFIX="terraform-state"
readonly ECR_REPO_NAMES=("frontend" "backend" "ai-service" "sms-service")

# Logging Configuration
readonly LOG_FILE="/var/log/aws-setup.log"
readonly LOG_LEVEL="INFO"

# Color codes for output
readonly RED='\033[0;31m'
readonly GREEN='\033[0;32m'
readonly YELLOW='\033[1;33m'
readonly NC='\033[0m' # No Color

# Logging Functions
log() {
    local level=$1
    local message=$2
    local timestamp
    timestamp=$(date +"%Y-%m-%d %H:%M:%S")
    echo -e "${timestamp} [${level}] ${message}" | tee -a "${LOG_FILE}"
}

log_info() {
    log "INFO" "$1"
}

log_error() {
    log "ERROR" "${RED}$1${NC}"
}

log_warning() {
    log "WARNING" "${YELLOW}$1${NC}"
}

log_success() {
    log "SUCCESS" "${GREEN}$1${NC}"
}

# Error Handling
error_handler() {
    local exit_code=$?
    local line_number=$1
    if [ $exit_code -ne 0 ]; then
        log_error "Error occurred in script at line ${line_number}. Exit code: ${exit_code}"
        cleanup_failed_setup
        exit $exit_code
    fi
}
trap 'error_handler ${LINENO}' ERR

# Cleanup function for failed setup
cleanup_failed_setup() {
    log_warning "Initiating cleanup of failed setup..."
    # Add cleanup logic here if needed
}

# Version comparison function
version_gt() {
    test "$(printf '%s\n' "$@" | sort -V | head -n 1)" != "$1"
}

# Prerequisites check
check_prerequisites() {
    log_info "Checking prerequisites..."

    # Check AWS CLI version
    if ! command -v aws &> /dev/null; then
        log_error "AWS CLI is not installed"
        return 1
    fi
    
    local aws_version
    aws_version=$(aws --version | cut -d/ -f2 | cut -d' ' -f1)
    if version_gt "${REQUIRED_AWS_CLI_VERSION}" "${aws_version}"; then
        log_error "AWS CLI version ${aws_version} is lower than required version ${REQUIRED_AWS_CLI_VERSION}"
        return 1
    fi

    # Check AWS credentials
    if ! aws sts get-caller-identity &> /dev/null; then
        log_error "AWS credentials are not properly configured"
        return 1
    }

    # Check Terraform installation
    if ! command -v terraform &> /dev/null; then
        log_error "Terraform is not installed"
        return 1
    }

    local terraform_version
    terraform_version=$(terraform version | head -n1 | cut -d'v' -f2)
    if version_gt "${REQUIRED_TERRAFORM_VERSION}" "${terraform_version}"; then
        log_error "Terraform version ${terraform_version} is lower than required version ${REQUIRED_TERRAFORM_VERSION}"
        return 1
    }

    # Check jq installation
    if ! command -v jq &> /dev/null; then
        log_error "jq is not installed"
        return 1
    }

    log_success "All prerequisites checked successfully"
    return 0
}

# Setup Terraform backend
setup_terraform_backend() {
    local region=$1
    local bucket_name="${PROJECT_NAME}-${STATE_BUCKET_PREFIX}-${region}"
    local dynamodb_table="${PROJECT_NAME}-terraform-locks"

    log_info "Setting up Terraform backend in ${region}..."

    # Create S3 bucket with versioning and encryption
    aws s3api create-bucket \
        --bucket "${bucket_name}" \
        --region "${region}" \
        --create-bucket-configuration LocationConstraint="${region}" &> /dev/null || true

    # Enable versioning
    aws s3api put-bucket-versioning \
        --bucket "${bucket_name}" \
        --versioning-configuration Status=Enabled

    # Enable default encryption
    aws s3api put-bucket-encryption \
        --bucket "${bucket_name}" \
        --server-side-encryption-configuration '{
            "Rules": [
                {
                    "ApplyServerSideEncryptionByDefault": {
                        "SSEAlgorithm": "AES256"
                    }
                }
            ]
        }'

    # Create DynamoDB table for state locking
    aws dynamodb create-table \
        --region "${region}" \
        --table-name "${dynamodb_table}" \
        --attribute-definitions AttributeName=LockID,AttributeType=S \
        --key-schema AttributeName=LockID,KeyType=HASH \
        --provisioned-throughput ReadCapacityUnits=5,WriteCapacityUnits=5 &> /dev/null || true

    # Enable point-in-time recovery
    aws dynamodb update-continuous-backups \
        --table-name "${dynamodb_table}" \
        --point-in-time-recovery-specification PointInTimeRecoveryEnabled=true \
        --region "${region}"

    log_success "Terraform backend setup completed in ${region}"
}

# Create ECR repositories
create_ecr_repositories() {
    local region=$1
    
    log_info "Creating ECR repositories in ${region}..."

    for repo in "${ECR_REPO_NAMES[@]}"; do
        local repo_name="${PROJECT_NAME}-${repo}"
        
        # Create repository
        aws ecr create-repository \
            --repository-name "${repo_name}" \
            --region "${region}" \
            --image-scanning-configuration scanOnPush=true \
            --encryption-configuration encryptionType=AES256 &> /dev/null || true

        # Set lifecycle policy
        aws ecr put-lifecycle-policy \
            --repository-name "${repo_name}" \
            --region "${region}" \
            --lifecycle-policy-text '{
                "rules": [
                    {
                        "rulePriority": 1,
                        "description": "Keep last 30 images",
                        "selection": {
                            "tagStatus": "any",
                            "countType": "imageCountMoreThan",
                            "countNumber": 30
                        },
                        "action": {
                            "type": "expire"
                        }
                    }
                ]
            }'
    done

    log_success "ECR repositories created successfully in ${region}"
}

# Setup IAM roles
setup_iam_roles() {
    log_info "Setting up IAM roles..."

    # Create EKS cluster role
    aws iam create-role \
        --role-name "${PROJECT_NAME}-eks-cluster-role" \
        --assume-role-policy-document '{
            "Version": "2012-10-17",
            "Statement": [
                {
                    "Effect": "Allow",
                    "Principal": {
                        "Service": "eks.amazonaws.com"
                    },
                    "Action": "sts:AssumeRole"
                }
            ]
        }' &> /dev/null || true

    # Attach required policies
    aws iam attach-role-policy \
        --role-name "${PROJECT_NAME}-eks-cluster-role" \
        --policy-arn "arn:aws:iam::aws:policy/AmazonEKSClusterPolicy"

    log_success "IAM roles setup completed"
}

# Main execution function
main() {
    log_info "Starting AWS infrastructure setup (v${SCRIPT_VERSION})"

    # Check prerequisites
    check_prerequisites || exit 1

    # Setup in primary region
    log_info "Setting up infrastructure in primary region (${AWS_PRIMARY_REGION})"
    setup_terraform_backend "${AWS_PRIMARY_REGION}"
    create_ecr_repositories "${AWS_PRIMARY_REGION}"

    # Setup in DR region
    log_info "Setting up infrastructure in DR region (${AWS_DR_REGION})"
    setup_terraform_backend "${AWS_DR_REGION}"
    create_ecr_repositories "${AWS_DR_REGION}"

    # Setup IAM roles (global)
    setup_iam_roles

    log_success "AWS infrastructure setup completed successfully"
}

# Script execution
main "$@"