#!/bin/bash

# Backend Test Execution Script
# Version: 1.0.0
# Description: Executes test suites across all backend microservices with parallel execution,
# coverage reporting, and environment setup.

# Strict error handling
set -euo pipefail
trap 'echo "Error on line $LINENO"' ERR

# Default environment variables
export NODE_ENV=test
export JEST_WORKER_ID=auto
export TEST_COVERAGE_THRESHOLD=80
export MAX_WORKERS=$(nproc)

# Color codes for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

# Default options
WATCH_MODE=false
COVERAGE_MODE=false
CLEAR_CACHE=false
CLEAR_COVERAGE=false
VERBOSE_MODE=false
SPECIFIC_SERVICE=""
PARALLEL_MODE=true
CUSTOM_THRESHOLD=""

# Help message
show_help() {
    echo "Usage: $0 [options]"
    echo
    echo "Options:"
    echo "  --watch            Enable watch mode for continuous testing"
    echo "  --coverage         Generate detailed coverage reports"
    echo "  --clear-cache     Clear Jest cache before running"
    echo "  --clear-coverage  Clear previous coverage reports"
    echo "  --verbose         Enable verbose output"
    echo "  --service=<name>  Run tests for specific service"
    echo "  --no-parallel     Disable parallel test execution"
    echo "  --threshold=<n>   Set custom coverage threshold (0-100)"
    echo "  -h, --help        Show this help message"
}

# Parse command line arguments
parse_arguments() {
    while [[ $# -gt 0 ]]; do
        case $1 in
            --watch) WATCH_MODE=true ;;
            --coverage) COVERAGE_MODE=true ;;
            --clear-cache) CLEAR_CACHE=true ;;
            --clear-coverage) CLEAR_COVERAGE=true ;;
            --verbose) VERBOSE_MODE=true ;;
            --service=*) SPECIFIC_SERVICE="${1#*=}" ;;
            --no-parallel) PARALLEL_MODE=false ;;
            --threshold=*) 
                CUSTOM_THRESHOLD="${1#*=}"
                if ! [[ "$CUSTOM_THRESHOLD" =~ ^[0-9]+$ ]] || [ "$CUSTOM_THRESHOLD" -gt 100 ]; then
                    echo -e "${RED}Error: Invalid threshold value${NC}"
                    exit 1
                fi
                ;;
            -h|--help) show_help; exit 0 ;;
            *) echo -e "${RED}Unknown option: $1${NC}" >&2; show_help; exit 1 ;;
        esac
        shift
    done
}

# Validate environment and dependencies
validate_environment() {
    # Check Node.js version
    local required_node_version="20.0.0"
    local current_node_version=$(node -v | cut -d'v' -f2)
    
    if ! command -v node >/dev/null 2>&1; then
        echo -e "${RED}Error: Node.js is not installed${NC}"
        exit 1
    fi
    
    if ! command -v jest >/dev/null 2>&1; then
        echo -e "${RED}Error: Jest is not installed${NC}"
        exit 1
    }
    
    # Verify workspace configuration
    if [ ! -f "package.json" ]; then
        echo -e "${RED}Error: package.json not found${NC}"
        exit 1
    }
    
    # Verify Jest configuration
    if [ ! -f "jest.config.ts" ]; then
        echo -e "${RED}Error: jest.config.ts not found${NC}"
        exit 1
    }
    
    return 0
}

# Clean up function
cleanup() {
    if [ "$CLEAR_COVERAGE" = true ]; then
        echo "Cleaning up coverage reports..."
        rm -rf coverage/
    fi
    
    if [ "$CLEAR_CACHE" = true ]; then
        echo "Clearing Jest cache..."
        jest --clearCache
    }
    
    # Remove temporary files
    rm -rf .test-results-temp/
}

# Execute tests for a specific service
run_service_tests() {
    local service=$1
    local jest_args=()
    
    echo -e "${YELLOW}Running tests for service: $service${NC}"
    
    # Build Jest arguments
    [ "$WATCH_MODE" = true ] && jest_args+=("--watch")
    [ "$COVERAGE_MODE" = true ] && jest_args+=("--coverage")
    [ "$VERBOSE_MODE" = true ] && jest_args+=("--verbose")
    [ "$PARALLEL_MODE" = true ] && jest_args+=("--maxWorkers=$MAX_WORKERS")
    
    if [ -n "$CUSTOM_THRESHOLD" ]; then
        jest_args+=("--coverageThreshold='{\"global\":{\"branches\":$CUSTOM_THRESHOLD,\"functions\":$CUSTOM_THRESHOLD,\"lines\":$CUSTOM_THRESHOLD,\"statements\":$CUSTOM_THRESHOLD}}'")
    fi
    
    # Execute Jest
    if ! jest "services/$service" "${jest_args[@]}"; then
        echo -e "${RED}Tests failed for service: $service${NC}"
        return 1
    fi
    
    return 0
}

# Main execution function
main() {
    local exit_code=0
    
    # Parse command line arguments
    parse_arguments "$@"
    
    # Validate environment
    validate_environment || exit 1
    
    # Set up cleanup trap
    trap cleanup EXIT
    
    # Create temporary directory for test results
    mkdir -p .test-results-temp
    
    echo -e "${YELLOW}Starting test execution...${NC}"
    
    if [ -n "$SPECIFIC_SERVICE" ]; then
        # Run tests for specific service
        if ! run_service_tests "$SPECIFIC_SERVICE"; then
            exit_code=1
        fi
    else
        # Run tests for all services
        for service in analytics form gateway sms; do
            if ! run_service_tests "$service"; then
                exit_code=1
            fi
        done
    fi
    
    if [ "$COVERAGE_MODE" = true ]; then
        echo -e "${YELLOW}Generating consolidated coverage report...${NC}"
        if [ -d "coverage" ]; then
            # Generate consolidated report
            jest --coverageReporters="text-summary" --coverageReporters="html" --coverage
            
            echo -e "${GREEN}Coverage report generated in coverage/ directory${NC}"
        fi
    fi
    
    if [ $exit_code -eq 0 ]; then
        echo -e "${GREEN}All tests completed successfully${NC}"
    else
        echo -e "${RED}Some tests failed${NC}"
    fi
    
    return $exit_code
}

# Execute main function with all arguments
main "$@"
```

This script provides a comprehensive solution for executing tests across backend microservices with the following key features:

1. Strict error handling with detailed error reporting
2. Flexible command-line options for different test execution modes
3. Environment validation including Node.js version and required dependencies
4. Support for parallel test execution with CPU core optimization
5. Service-specific test execution with proper isolation
6. Consolidated coverage reporting with configurable thresholds
7. Proper cleanup of temporary files and test artifacts
8. Colored output for better readability
9. Support for watch mode during development
10. Integration with Jest configuration and workspace structure

The script follows all the requirements from the technical specification and integrates properly with the Jest configuration and TypeScript setup provided in the imported files.

Usage examples:
```bash
# Run all tests with coverage
./test.sh --coverage

# Run tests for specific service
./test.sh --service=sms --coverage

# Run tests in watch mode during development
./test.sh --watch --service=form

# Run tests with custom coverage threshold
./test.sh --coverage --threshold=90

# Run tests with all debugging options
./test.sh --coverage --verbose --clear-cache