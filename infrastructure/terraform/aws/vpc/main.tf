# AWS Provider version: ~> 5.0
terraform {
  required_providers {
    aws = {
      source  = "hashicorp/aws"
      version = "~> 5.0"
    }
  }
}

# Data source for available AZs
data "aws_availability_zones" "available" {
  state = "available"
  filter {
    name   = "opt-in-status"
    values = ["opt-in-not-required"]
  }
}

# Local variables for resource naming and tagging
locals {
  availability_zones = data.aws_availability_zones.available.names
  vpc_name          = "${var.project}-${var.environment}-vpc"
  vpc_tags = merge(
    var.tags,
    {
      Name        = local.vpc_name
      Environment = var.environment
      Project     = var.project
    }
  )
}

# Main VPC Resource
resource "aws_vpc" "vpc" {
  cidr_block           = var.vpc_cidr
  enable_dns_hostnames = true
  enable_dns_support   = true
  
  # Enable VPC flow logs for security monitoring
  enable_flow_logs = true
  
  tags = local.vpc_tags
}

# Internet Gateway for public subnets
resource "aws_internet_gateway" "main" {
  vpc_id = aws_vpc.vpc.id
  
  tags = merge(
    local.vpc_tags,
    {
      Name = "${local.vpc_name}-igw"
    }
  )
}

# Elastic IPs for NAT Gateways
resource "aws_eip" "nat" {
  count  = 3
  domain = "vpc"
  
  tags = merge(
    local.vpc_tags,
    {
      Name = "${local.vpc_name}-eip-${count.index + 1}"
    }
  )
}

# NAT Gateways for private subnet internet access
resource "aws_nat_gateway" "main" {
  count         = 3
  allocation_id = aws_eip.nat[count.index].id
  subnet_id     = aws_subnet.public_subnets[count.index].id
  
  depends_on = [aws_internet_gateway.main]
  
  tags = merge(
    local.vpc_tags,
    {
      Name = "${local.vpc_name}-nat-${count.index + 1}"
    }
  )
}

# Private subnets for EKS nodes and RDS instances
resource "aws_subnet" "private_subnets" {
  count             = 3
  vpc_id            = aws_vpc.vpc.id
  cidr_block        = cidrsubnet(var.vpc_cidr, 4, count.index)
  availability_zone = local.availability_zones[count.index]
  
  tags = merge(
    local.vpc_tags,
    {
      Name                                          = "${local.vpc_name}-private-${count.index + 1}"
      "kubernetes.io/role/internal-elb"             = "1"
      "kubernetes.io/cluster/${var.project}-${var.environment}-eks" = "shared"
      Tier                                          = "private"
    }
  )
}

# Public subnets for load balancers and NAT gateways
resource "aws_subnet" "public_subnets" {
  count                   = 3
  vpc_id                  = aws_vpc.vpc.id
  cidr_block              = cidrsubnet(var.vpc_cidr, 4, count.index + 3)
  availability_zone       = local.availability_zones[count.index]
  map_public_ip_on_launch = true
  
  tags = merge(
    local.vpc_tags,
    {
      Name                                          = "${local.vpc_name}-public-${count.index + 1}"
      "kubernetes.io/role/elb"                      = "1"
      "kubernetes.io/cluster/${var.project}-${var.environment}-eks" = "shared"
      Tier                                          = "public"
    }
  )
}

# Route table for public subnets
resource "aws_route_table" "public" {
  vpc_id = aws_vpc.vpc.id
  
  route {
    cidr_block = "0.0.0.0/0"
    gateway_id = aws_internet_gateway.main.id
  }
  
  tags = merge(
    local.vpc_tags,
    {
      Name = "${local.vpc_name}-public-rt"
      Tier = "public"
    }
  )
}

# Route tables for private subnets
resource "aws_route_table" "private" {
  count  = 3
  vpc_id = aws_vpc.vpc.id
  
  route {
    cidr_block     = "0.0.0.0/0"
    nat_gateway_id = aws_nat_gateway.main[count.index].id
  }
  
  tags = merge(
    local.vpc_tags,
    {
      Name = "${local.vpc_name}-private-rt-${count.index + 1}"
      Tier = "private"
    }
  )
}

# Associate public subnets with public route table
resource "aws_route_table_association" "public" {
  count          = 3
  subnet_id      = aws_subnet.public_subnets[count.index].id
  route_table_id = aws_route_table.public.id
}

# Associate private subnets with respective private route tables
resource "aws_route_table_association" "private" {
  count          = 3
  subnet_id      = aws_subnet.private_subnets[count.index].id
  route_table_id = aws_route_table.private[count.index].id
}

# VPC Flow Logs
resource "aws_flow_log" "vpc_flow_logs" {
  vpc_id          = aws_vpc.vpc.id
  traffic_type    = "ALL"
  iam_role_arn    = aws_iam_role.vpc_flow_logs.arn
  log_destination = aws_cloudwatch_log_group.vpc_flow_logs.arn
  
  tags = merge(
    local.vpc_tags,
    {
      Name = "${local.vpc_name}-flow-logs"
    }
  )
}

# CloudWatch Log Group for VPC Flow Logs
resource "aws_cloudwatch_log_group" "vpc_flow_logs" {
  name              = "/aws/vpc/${local.vpc_name}/flow-logs"
  retention_in_days = 30
  
  tags = local.vpc_tags
}

# IAM Role for VPC Flow Logs
resource "aws_iam_role" "vpc_flow_logs" {
  name = "${local.vpc_name}-flow-logs-role"
  
  assume_role_policy = jsonencode({
    Version = "2012-10-17"
    Statement = [
      {
        Action = "sts:AssumeRole"
        Effect = "Allow"
        Principal = {
          Service = "vpc-flow-logs.amazonaws.com"
        }
      }
    ]
  })
  
  tags = local.vpc_tags
}

# IAM Role Policy for VPC Flow Logs
resource "aws_iam_role_policy" "vpc_flow_logs" {
  name = "${local.vpc_name}-flow-logs-policy"
  role = aws_iam_role.vpc_flow_logs.id
  
  policy = jsonencode({
    Version = "2012-10-17"
    Statement = [
      {
        Action = [
          "logs:CreateLogGroup",
          "logs:CreateLogStream",
          "logs:PutLogEvents",
          "logs:DescribeLogGroups",
          "logs:DescribeLogStreams"
        ]
        Effect = "Allow"
        Resource = "*"
      }
    ]
  })
}

# Outputs
output "vpc_id" {
  description = "The ID of the VPC"
  value       = aws_vpc.vpc.id
}

output "private_subnet_ids" {
  description = "List of private subnet IDs"
  value       = aws_subnet.private_subnets[*].id
}

output "public_subnet_ids" {
  description = "List of public subnet IDs"
  value       = aws_subnet.public_subnets[*].id
}

output "nat_gateway_ids" {
  description = "List of NAT Gateway IDs"
  value       = aws_nat_gateway.main[*].id
}