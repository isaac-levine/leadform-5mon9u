#!/usr/bin/env bash

# Monitoring Stack Setup Script v1.0.0
# Purpose: Deploy and configure production-grade monitoring stack with HA and security
# Dependencies:
# - kubectl v1.27+
# - helm v3.12+
# - aws-cli v2+

set -euo pipefail

# Global variables
readonly PROMETHEUS_VERSION="v2.45.0"
readonly GRAFANA_VERSION="9.5.0"
readonly JAEGER_VERSION="1.47"
readonly MONITORING_NAMESPACE="monitoring"
readonly HA_REPLICAS=3
readonly RETENTION_DAYS=30
readonly BACKUP_RETENTION=90
readonly ALERT_TIMEOUT="5m"

# Color codes for output
readonly RED='\033[0;31m'
readonly GREEN='\033[0;32m'
readonly YELLOW='\033[1;33m'
readonly NC='\033[0m' # No Color

# Logging functions
log_info() {
    echo -e "${GREEN}[INFO]${NC} $1"
}

log_warn() {
    echo -e "${YELLOW}[WARN]${NC} $1"
}

log_error() {
    echo -e "${RED}[ERROR]${NC} $1"
}

# Check prerequisites and security requirements
check_prerequisites() {
    log_info "Checking prerequisites..."

    # Check kubectl version and access
    if ! kubectl version --client &>/dev/null; then
        log_error "kubectl not found or not in PATH"
        return 1
    fi

    # Verify cluster access and permissions
    if ! kubectl auth can-i create namespace &>/dev/null; then
        log_error "Insufficient cluster permissions"
        return 1
    }

    # Check helm installation
    if ! helm version &>/dev/null; then
        log_error "helm not found or not in PATH"
        return 1
    }

    # Verify AWS CLI and credentials
    if ! aws sts get-caller-identity &>/dev/null; then
        log_warn "AWS credentials not configured - backup features may be limited"
    }

    # Check storage classes
    if ! kubectl get storageclass high-iops-ssd &>/dev/null; then
        log_error "Required storage class 'high-iops-ssd' not found"
        return 1
    }

    log_info "Prerequisites check completed successfully"
    return 0
}

# Create and configure monitoring namespace
setup_namespace() {
    log_info "Setting up monitoring namespace..."

    # Create namespace if it doesn't exist
    if ! kubectl get namespace "$MONITORING_NAMESPACE" &>/dev/null; then
        kubectl create namespace "$MONITORING_NAMESPACE"
    fi

    # Apply security policies
    kubectl label namespace "$MONITORING_NAMESPACE" \
        security-tier=restricted \
        monitoring=enabled \
        environment=production

    # Apply resource quotas
    cat <<EOF | kubectl apply -f -
apiVersion: v1
kind: ResourceQuota
metadata:
  name: monitoring-quota
  namespace: $MONITORING_NAMESPACE
spec:
  hard:
    requests.cpu: "8"
    requests.memory: 16Gi
    limits.cpu: "16"
    limits.memory: 32Gi
    persistentvolumeclaims: "10"
EOF

    log_info "Namespace setup completed"
}

# Deploy and configure Prometheus
setup_prometheus() {
    log_info "Setting up Prometheus..."

    # Add Prometheus helm repo
    helm repo add prometheus-community https://prometheus-community.github.io/helm-charts
    helm repo update

    # Create Prometheus values file
    cat <<EOF > prometheus-values.yaml
prometheus:
  prometheusSpec:
    replicas: $HA_REPLICAS
    retention: ${RETENTION_DAYS}d
    storageSpec:
      volumeClaimTemplate:
        spec:
          storageClassName: high-iops-ssd
          resources:
            requests:
              storage: 50Gi
    securityContext:
      runAsNonRoot: true
      runAsUser: 65534
    serviceMonitorSelector:
      matchLabels:
        monitoring: prometheus
    additionalScrapeConfigs:
      - job_name: 'api-gateway'
        metrics_path: '/metrics'
        scrape_interval: 10s
        static_configs:
          - targets: ['gateway-service:3000']
EOF

    # Install Prometheus with values
    helm upgrade --install prometheus prometheus-community/prometheus \
        --namespace "$MONITORING_NAMESPACE" \
        --values prometheus-values.yaml \
        --version "${PROMETHEUS_VERSION#v}" \
        --wait

    log_info "Prometheus setup completed"
}

# Deploy and configure Grafana
setup_grafana() {
    log_info "Setting up Grafana..."

    # Add Grafana helm repo
    helm repo add grafana https://grafana.github.io/helm-charts
    helm repo update

    # Create Grafana values file
    cat <<EOF > grafana-values.yaml
replicas: $HA_REPLICAS
persistence:
  enabled: true
  storageClassName: high-iops-ssd
  size: 10Gi
securityContext:
  runAsUser: 472
  runAsGroup: 472
  fsGroup: 472
datasources:
  datasources.yaml:
    apiVersion: 1
    datasources:
      - name: Prometheus
        type: prometheus
        url: http://prometheus-server
        access: proxy
        isDefault: true
dashboardProviders:
  dashboardproviders.yaml:
    apiVersion: 1
    providers:
      - name: default
        type: file
        updateIntervalSeconds: 30
        allowUiUpdates: false
        options:
          path: /var/lib/grafana/dashboards
EOF

    # Install Grafana with values
    helm upgrade --install grafana grafana/grafana \
        --namespace "$MONITORING_NAMESPACE" \
        --values grafana-values.yaml \
        --version "${GRAFANA_VERSION}" \
        --wait

    log_info "Grafana setup completed"
}

# Setup backup and retention policies
setup_backups() {
    log_info "Configuring backup policies..."

    # Create S3 bucket for backups if it doesn't exist
    local bucket_name="monitoring-backups-$(date +%s)"
    if ! aws s3 ls "s3://$bucket_name" &>/dev/null; then
        aws s3api create-bucket \
            --bucket "$bucket_name" \
            --region us-east-1
        
        # Enable versioning and encryption
        aws s3api put-bucket-versioning \
            --bucket "$bucket_name" \
            --versioning-configuration Status=Enabled

        aws s3api put-bucket-encryption \
            --bucket "$bucket_name" \
            --server-side-encryption-configuration '{
                "Rules": [
                    {
                        "ApplyServerSideEncryptionByDefault": {
                            "SSEAlgorithm": "AES256"
                        }
                    }
                ]
            }'
    fi

    # Setup backup cronjob
    cat <<EOF | kubectl apply -f -
apiVersion: batch/v1
kind: CronJob
metadata:
  name: monitoring-backup
  namespace: $MONITORING_NAMESPACE
spec:
  schedule: "0 1 * * *"
  successfulJobsHistoryLimit: 3
  failedJobsHistoryLimit: 1
  jobTemplate:
    spec:
      template:
        spec:
          serviceAccountName: monitoring-backup
          containers:
          - name: backup
            image: amazon/aws-cli:2.0.6
            command:
            - /bin/sh
            - -c
            - |
              aws s3 sync /backup s3://${bucket_name}/$(date +%Y-%m-%d)/
          restartPolicy: OnFailure
          securityContext:
            runAsNonRoot: true
            runAsUser: 1000
EOF

    log_info "Backup configuration completed"
}

# Verify monitoring stack health
verify_monitoring_stack() {
    log_info "Verifying monitoring stack..."
    local retries=0
    local max_retries=30
    local retry_interval=10

    # Check Prometheus health
    while [[ $retries -lt $max_retries ]]; do
        if kubectl get pods -n "$MONITORING_NAMESPACE" -l app=prometheus -o jsonpath='{.items[*].status.phase}' | grep -q "Running"; then
            log_info "Prometheus is healthy"
            break
        fi
        ((retries++))
        sleep $retry_interval
    done

    # Check Grafana health
    retries=0
    while [[ $retries -lt $max_retries ]]; do
        if kubectl get pods -n "$MONITORING_NAMESPACE" -l app.kubernetes.io/name=grafana -o jsonpath='{.items[*].status.phase}' | grep -q "Running"; then
            log_info "Grafana is healthy"
            break
        fi
        ((retries++))
        sleep $retry_interval
    done

    # Verify metrics collection
    if ! curl -s "http://prometheus-server:9090/api/v1/query?query=up" | grep -q "success"; then
        log_error "Metrics collection verification failed"
        return 1
    fi

    log_info "Monitoring stack verification completed successfully"
    return 0
}

# Main execution
main() {
    log_info "Starting monitoring stack setup..."

    # Run setup steps
    if ! check_prerequisites; then
        log_error "Prerequisites check failed"
        exit 1
    fi

    setup_namespace
    setup_prometheus
    setup_grafana
    setup_backups

    if ! verify_monitoring_stack; then
        log_error "Monitoring stack verification failed"
        exit 1
    fi

    log_info "Monitoring stack setup completed successfully"
}

# Execute main function
main "$@"