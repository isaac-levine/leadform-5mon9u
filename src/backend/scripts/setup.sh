#!/usr/bin/env bash

# =============================================================================
# Advanced setup script for AI-SMS Platform backend development environment
# Version: 1.0.0
# 
# Features:
# - Comprehensive prerequisite validation
# - Secure environment configuration
# - Optimized dependency installation
# - Database initialization with monitoring
# - Service health validation
# =============================================================================

set -euo pipefail
IFS=$'\n\t'

# =============================================================================
# Global Variables
# =============================================================================

# Script location
readonly SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
readonly ROOT_DIR="$(dirname "$SCRIPT_DIR")"

# Version requirements
readonly MIN_NODE_VERSION="20.0.0"
readonly MIN_NPM_VERSION="9.0.0"
readonly MIN_DOCKER_VERSION="20.10.0"
readonly MIN_COMPOSE_VERSION="2.0.0"

# System requirements
readonly MIN_MEMORY_MB=4096
readonly MIN_DISK_GB=20

# Color codes
readonly RED='\033[0;31m'
readonly GREEN='\033[0;32m'
readonly YELLOW='\033[1;33m'
readonly NC='\033[0m'

# =============================================================================
# Helper Functions
# =============================================================================

log_info() {
    echo -e "${GREEN}[INFO]${NC} $1"
}

log_warn() {
    echo -e "${YELLOW}[WARN]${NC} $1"
}

log_error() {
    echo -e "${RED}[ERROR]${NC} $1"
}

version_compare() {
    local version1=$1
    local version2=$2
    if [[ "$(printf '%s\n' "$version2" "$version1" | sort -V | head -n1)" == "$version2" ]]; then
        return 0
    else
        return 1
    fi
}

check_command() {
    if ! command -v "$1" &> /dev/null; then
        log_error "Required command '$1' not found"
        return 1
    fi
}

# =============================================================================
# Validation Functions
# =============================================================================

check_prerequisites() {
    log_info "Checking prerequisites..."
    
    # Check Node.js version
    if ! check_command "node"; then
        log_error "Node.js is required but not installed"
        return 1
    fi
    
    local node_version
    node_version=$(node -v | cut -d 'v' -f 2)
    if ! version_compare "$node_version" "$MIN_NODE_VERSION"; then
        log_error "Node.js version $MIN_NODE_VERSION or higher is required (found $node_version)"
        return 1
    fi
    
    # Check npm version
    if ! check_command "npm"; then
        log_error "npm is required but not installed"
        return 1
    }
    
    local npm_version
    npm_version=$(npm -v)
    if ! version_compare "$npm_version" "$MIN_NPM_VERSION"; then
        log_error "npm version $MIN_NPM_VERSION or higher is required (found $npm_version)"
        return 1
    }
    
    # Check Docker
    if ! check_command "docker"; then
        log_error "Docker is required but not installed"
        return 1
    }
    
    local docker_version
    docker_version=$(docker version --format '{{.Server.Version}}' 2>/dev/null)
    if ! version_compare "$docker_version" "$MIN_DOCKER_VERSION"; then
        log_error "Docker version $MIN_DOCKER_VERSION or higher is required (found $docker_version)"
        return 1
    }
    
    # Check Docker Compose
    if ! check_command "docker-compose"; then
        log_error "Docker Compose is required but not installed"
        return 1
    }
    
    # Check system resources
    local memory_mb
    memory_mb=$(free -m | awk '/^Mem:/{print $2}')
    if [[ $memory_mb -lt $MIN_MEMORY_MB ]]; then
        log_error "Insufficient memory: ${memory_mb}MB available, ${MIN_MEMORY_MB}MB required"
        return 1
    }
    
    local disk_gb
    disk_gb=$(df -BG "$(pwd)" | awk 'NR==2 {print $4}' | tr -d 'G')
    if [[ $disk_gb -lt $MIN_DISK_GB ]]; then
        log_error "Insufficient disk space: ${disk_gb}GB available, ${MIN_DISK_GB}GB required"
        return 1
    }
    
    # Check required ports
    local required_ports=(3000 5432 6379 27017 9090)
    for port in "${required_ports[@]}"; do
        if netstat -tln | grep -q ":$port "; then
            log_error "Port $port is already in use"
            return 1
        fi
    done
    
    log_info "All prerequisites checked successfully"
    return 0
}

# =============================================================================
# Environment Setup Functions
# =============================================================================

setup_environment() {
    log_info "Setting up environment..."
    
    # Backup existing .env if present
    if [[ -f "$ROOT_DIR/.env" ]]; then
        local backup_file="$ROOT_DIR/.env.backup.$(date +%Y%m%d_%H%M%S)"
        cp "$ROOT_DIR/.env" "$backup_file"
        log_info "Backed up existing .env to $backup_file"
    fi
    
    # Copy .env.example to .env
    cp "$ROOT_DIR/.env.example" "$ROOT_DIR/.env"
    chmod 600 "$ROOT_DIR/.env"
    
    # Generate secure random values for secrets
    {
        echo "JWT_SECRET=$(openssl rand -hex 32)"
        echo "MONGODB_PASSWORD=$(openssl rand -base64 24)"
        echo "POSTGRES_PASSWORD=$(openssl rand -base64 24)"
        echo "REDIS_PASSWORD=$(openssl rand -base64 24)"
    } >> "$ROOT_DIR/.env"
    
    log_info "Environment configuration completed"
    return 0
}

# =============================================================================
# Dependency Installation Functions
# =============================================================================

install_dependencies() {
    log_info "Installing dependencies..."
    
    # Verify package.json integrity
    if ! jq -e . "$ROOT_DIR/package.json" >/dev/null 2>&1; then
        log_error "Invalid package.json"
        return 1
    }
    
    # Clean npm cache and install dependencies
    npm cache clean --force
    
    # Install root dependencies
    npm ci --no-audit --ignore-scripts
    
    # Install workspace dependencies
    npm run bootstrap
    
    # Run security audit
    npm audit
    
    # Build packages
    npm run build
    
    log_info "Dependencies installed successfully"
    return 0
}

# =============================================================================
# Database Setup Functions
# =============================================================================

setup_databases() {
    log_info "Setting up databases..."
    
    # Create docker network if it doesn't exist
    docker network create ai-sms-network 2>/dev/null || true
    
    # Start databases with health checks
    docker-compose up -d postgres mongodb redis
    
    # Wait for databases to be ready
    local max_attempts=30
    local attempt=1
    
    while [[ $attempt -le $max_attempts ]]; do
        log_info "Waiting for databases to be ready (attempt $attempt/$max_attempts)..."
        
        # Check PostgreSQL
        if docker-compose exec -T postgres pg_isready -U admin -d forms >/dev/null 2>&1; then
            log_info "PostgreSQL is ready"
            break
        fi
        
        # Check MongoDB
        if docker-compose exec -T mongodb mongosh --eval "db.adminCommand('ping')" >/dev/null 2>&1; then
            log_info "MongoDB is ready"
            break
        fi
        
        # Check Redis
        if docker-compose exec -T redis redis-cli ping >/dev/null 2>&1; then
            log_info "Redis is ready"
            break
        fi
        
        ((attempt++))
        sleep 2
    done
    
    if [[ $attempt -gt $max_attempts ]]; then
        log_error "Timeout waiting for databases"
        return 1
    fi
    
    # Run database migrations
    npm run db:migrate
    
    log_info "Databases setup completed"
    return 0
}

# =============================================================================
# Service Startup Functions
# =============================================================================

start_services() {
    log_info "Starting services..."
    
    # Build and start services
    docker-compose build --no-cache
    docker-compose up -d
    
    # Wait for services to be healthy
    local services=(gateway ai-service analytics-service form-service sms-service)
    local max_attempts=30
    local attempt=1
    
    while [[ $attempt -le $max_attempts ]]; do
        local all_healthy=true
        
        for service in "${services[@]}"; do
            local health
            health=$(docker-compose ps --format json "$service" | jq -r '.[].Health')
            
            if [[ "$health" != "healthy" ]]; then
                all_healthy=false
                break
            fi
        done
        
        if [[ "$all_healthy" == "true" ]]; then
            log_info "All services are healthy"
            break
        fi
        
        ((attempt++))
        sleep 2
    done
    
    if [[ $attempt -gt $max_attempts ]]; then
        log_error "Timeout waiting for services to be healthy"
        return 1
    }
    
    # Display service access information
    echo -e "\n${GREEN}Services are ready:${NC}"
    echo "Gateway API: http://localhost:3000"
    echo "API Documentation: http://localhost:3000/api/docs"
    echo "Metrics: http://localhost:9090/metrics"
    
    return 0
}

# =============================================================================
# Main Script
# =============================================================================

main() {
    log_info "Starting AI-SMS Platform setup..."
    
    # Run setup steps
    if ! check_prerequisites; then
        log_error "Prerequisites check failed"
        exit 1
    fi
    
    if ! setup_environment; then
        log_error "Environment setup failed"
        exit 1
    fi
    
    if ! install_dependencies; then
        log_error "Dependency installation failed"
        exit 1
    fi
    
    if ! setup_databases; then
        log_error "Database setup failed"
        exit 1
    fi
    
    if ! start_services; then
        log_error "Service startup failed"
        exit 1
    }
    
    log_info "Setup completed successfully"
    return 0
}

# Execute main function
main "$@"