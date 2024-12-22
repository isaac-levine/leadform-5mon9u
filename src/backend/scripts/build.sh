#!/usr/bin/env bash

# Advanced build script for AI-SMS Platform backend services
# Version: 1.0.0
# Requires: Node.js >= 20.0.0, npm >= 9.0.0

set -euo pipefail

# Configuration and constants
readonly SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
readonly ROOT_DIR="$(cd "${SCRIPT_DIR}/.." && pwd)"
readonly BUILD_DIR="${ROOT_DIR}/dist"
readonly CACHE_DIR="${ROOT_DIR}/.build-cache"
readonly LOG_DIR="${ROOT_DIR}/logs"
readonly BUILD_LOG="${LOG_DIR}/build-$(date +%Y%m%d-%H%M%S).log"
readonly MIN_NODE_VERSION="20.0.0"
readonly MIN_NPM_VERSION="9.0.0"
readonly MIN_DISK_SPACE_GB=5
readonly MIN_MEMORY_GB=4

# Logging utilities
log() {
    local level="$1"
    local message="$2"
    local timestamp=$(date '+%Y-%m-%d %H:%M:%S')
    echo "[$timestamp] [$level] $message" | tee -a "$BUILD_LOG"
}

info() { log "INFO" "$1"; }
error() { log "ERROR" "$1"; }
debug() { [[ "${LOG_LEVEL:-info}" == "debug" ]] && log "DEBUG" "$1"; }

# Version comparison utility
version_compare() {
    local version1="$1"
    local version2="$2"
    if [[ "$(printf '%s\n' "$version1" "$version2" | sort -V | head -n1)" == "$version2" ]]; then
        return 0
    else
        return 1
    fi
}

# Enhanced prerequisites check
check_prerequisites() {
    info "Checking build prerequisites..."
    
    # Create log directory if it doesn't exist
    mkdir -p "${LOG_DIR}"
    
    # Check Node.js version
    local node_version=$(node --version | cut -d 'v' -f 2)
    if ! version_compare "$node_version" "$MIN_NODE_VERSION"; then
        error "Node.js version $MIN_NODE_VERSION or higher is required (found $node_version)"
        return 1
    fi
    
    # Check npm version
    local npm_version=$(npm --version)
    if ! version_compare "$npm_version" "$MIN_NPM_VERSION"; then
        error "npm version $MIN_NPM_VERSION or higher is required (found $npm_version)"
        return 1
    }
    
    # Check available disk space
    local available_space_gb=$(df -BG "${ROOT_DIR}" | awk 'NR==2 {print $4}' | tr -d 'G')
    if [[ ${available_space_gb} -lt ${MIN_DISK_SPACE_GB} ]]; then
        error "Insufficient disk space. Required: ${MIN_DISK_SPACE_GB}GB, Available: ${available_space_gb}GB"
        return 1
    }
    
    # Check available memory
    local available_memory_gb=$(free -g | awk '/^Mem:/{print $7}')
    if [[ ${available_memory_gb} -lt ${MIN_MEMORY_GB} ]]; then
        error "Insufficient memory. Required: ${MIN_MEMORY_GB}GB, Available: ${available_memory_gb}GB"
        return 1
    }
    
    # Verify required tools
    local required_tools=("typescript" "lerna" "git")
    for tool in "${required_tools[@]}"; do
        if ! command -v "$tool" &> /dev/null; then
            error "Required tool not found: $tool"
            return 1
        fi
    done
    
    # Verify configuration files
    local required_configs=("package.json" "tsconfig.json" "lerna.json")
    for config in "${required_configs[@]}"; do
        if [[ ! -f "${ROOT_DIR}/${config}" ]]; then
            error "Required configuration file not found: ${config}"
            return 1
        fi
    done
    
    # Check npm registry access
    if ! npm ping &> /dev/null; then
        error "Unable to access npm registry"
        return 1
    }
    
    info "Prerequisites check passed successfully"
    return 0
}

# Advanced cleaning of build artifacts
clean_build_dir() {
    info "Cleaning build directory..."
    
    # Create backup of last successful build if it exists
    if [[ -d "${BUILD_DIR}" ]]; then
        local backup_dir="${CACHE_DIR}/backup-$(date +%Y%m%d-%H%M%S)"
        mkdir -p "${backup_dir}"
        cp -r "${BUILD_DIR}" "${backup_dir}"
        info "Created build backup at ${backup_dir}"
    fi
    
    # Clean build artifacts
    local dirs_to_clean=(
        "${BUILD_DIR}"
        "${ROOT_DIR}/.tsbuildinfo"
        "${ROOT_DIR}/coverage"
        "${ROOT_DIR}/.nyc_output"
        "${ROOT_DIR}/services/*/dist"
        "${ROOT_DIR}/shared/*/dist"
    )
    
    for dir in "${dirs_to_clean[@]}"; do
        if [[ -d "$dir" ]]; then
            rm -rf "$dir"
            debug "Cleaned directory: $dir"
        fi
    done
    
    # Clean caches selectively
    find "${ROOT_DIR}" -type d -name ".cache" -exec rm -rf {} +
    find "${ROOT_DIR}" -type d -name ".webpack" -exec rm -rf {} +
    
    info "Build directory cleaned successfully"
    return 0
}

# Enhanced dependency installation
install_dependencies() {
    info "Installing dependencies..."
    
    # Run security audit
    if ! npm audit --production; then
        error "Security vulnerabilities found in dependencies"
        return 1
    fi
    
    # Install dependencies with CI mode for reproducible builds
    if ! npm ci; then
        error "Failed to install root dependencies"
        return 1
    }
    
    # Bootstrap lerna packages
    if ! npx lerna bootstrap --hoist; then
        error "Failed to bootstrap lerna packages"
        return 1
    }
    
    # Verify peer dependencies
    if ! npx check-peer-dependencies; then
        error "Peer dependency issues detected"
        return 1
    }
    
    info "Dependencies installed successfully"
    return 0
}

# Optimized service building
build_services() {
    info "Building services..."
    
    # Create build directory
    mkdir -p "${BUILD_DIR}"
    
    # Build shared packages first
    info "Building shared packages..."
    if ! npx lerna run build --scope=@ai-sms/shared; then
        error "Failed to build shared packages"
        return 1
    fi
    
    # Build all services in parallel with proper error handling
    info "Building services..."
    if ! npx lerna run build --ignore=@ai-sms/shared --parallel --stream; then
        error "Failed to build services"
        return 1
    fi
    
    # Generate TypeScript declarations
    info "Generating TypeScript declarations..."
    if ! npx tsc --emitDeclarationOnly --declaration --project tsconfig.json; then
        error "Failed to generate TypeScript declarations"
        return 1
    }
    
    info "Services built successfully"
    return 0
}

# Comprehensive test execution
run_tests() {
    info "Running tests..."
    
    # Run unit tests with coverage
    if ! npx lerna run test:coverage; then
        error "Unit tests failed"
        return 1
    fi
    
    # Run integration tests if in CI environment
    if [[ "${CI:-false}" == "true" ]]; then
        if ! npx lerna run test:integration; then
            error "Integration tests failed"
            return 1
        fi
    fi
    
    info "Tests completed successfully"
    return 0
}

# Main build process
main() {
    local start_time=$(date +%s)
    
    # Create build cache directory
    mkdir -p "${CACHE_DIR}"
    
    # Execute build steps
    check_prerequisites || exit 1
    clean_build_dir || exit 1
    install_dependencies || exit 1
    build_services || exit 1
    run_tests || exit 1
    
    local end_time=$(date +%s)
    local duration=$((end_time - start_time))
    
    info "Build completed successfully in ${duration} seconds"
    return 0
}

# Script execution
if [[ "${BASH_SOURCE[0]}" == "${0}" ]]; then
    trap 'error "Build failed! Check logs for details."' ERR
    
    # Export environment variables
    export NODE_ENV=${NODE_ENV:-production}
    export LOG_LEVEL=${LOG_LEVEL:-info}
    
    main "$@"
fi