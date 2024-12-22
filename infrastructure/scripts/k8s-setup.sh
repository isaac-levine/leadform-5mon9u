#!/usr/bin/env bash

# AI-SMS Lead Platform Kubernetes Cluster Setup Script
# Version: 1.0.0
# Purpose: Production-grade Kubernetes cluster setup with high availability,
# security, and comprehensive monitoring capabilities

set -euo pipefail

# Global Variables
CLUSTER_NAME="ai-sms-platform"
AWS_REGION="us-east-1"
ENVIRONMENT="production"
NODE_GROUPS="2"
AVAILABILITY_ZONES="us-east-1a,us-east-1b,us-east-1c"
MIN_NODES="3"
MAX_NODES="10"
MONITORING_RETENTION="30d"

# Color codes for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

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

# Preflight checks function
preflight_checks() {
    log_info "Running preflight checks..."

    # Check required tools
    local required_tools=("kubectl" "helm" "aws" "eksctl")
    for tool in "${required_tools[@]}"; do
        if ! command -v "$tool" &> /dev/null; then
            log_error "$tool is required but not installed"
            exit 1
        fi
    done

    # Verify AWS credentials
    if ! aws sts get-caller-identity &> /dev/null; then
        log_error "Invalid AWS credentials"
        exit 1
    }

    # Check AWS quotas
    local vpc_limit=$(aws service-quotas get-service-quota \
        --service-code vpc \
        --quota-code L-F678F1CE \
        --query 'Quota.Value' \
        --output text)
    
    if [[ $(echo "$vpc_limit < 5" | bc -l) -eq 1 ]]; then
        log_warn "VPC limit may be too low for production deployment"
    }

    log_info "Preflight checks completed successfully"
}

# Setup cluster function
setup_cluster() {
    log_info "Creating EKS cluster: $CLUSTER_NAME"

    eksctl create cluster \
        --name "$CLUSTER_NAME" \
        --region "$AWS_REGION" \
        --version 1.27 \
        --nodegroup-name standard-workers \
        --node-type t3.xlarge \
        --nodes-min "$MIN_NODES" \
        --nodes-max "$MAX_NODES" \
        --zones "$AVAILABILITY_ZONES" \
        --with-oidc \
        --managed \
        --asg-access \
        --full-ecr-access \
        --alb-ingress-access \
        --node-private-networking

    log_info "EKS cluster created successfully"
}

# Setup namespaces function
setup_namespaces() {
    log_info "Setting up Kubernetes namespaces"

    # Apply namespace configurations
    kubectl apply -f ../kubernetes/base/namespaces.yaml

    # Setup resource quotas for each namespace
    local namespaces=("app" "monitoring" "logging")
    for ns in "${namespaces[@]}"; do
        kubectl apply -f - <<EOF
apiVersion: v1
kind: ResourceQuota
metadata:
  name: ${ns}-quota
  namespace: ${ns}
spec:
  hard:
    requests.cpu: "8"
    requests.memory: 16Gi
    limits.cpu: "16"
    limits.memory: 32Gi
    pods: "50"
EOF
    done

    log_info "Namespaces configured successfully"
}

# Setup monitoring function
install_monitoring() {
    log_info "Installing monitoring stack"

    # Add Helm repositories
    helm repo add prometheus-community https://prometheus-community.github.io/helm-charts
    helm repo add grafana https://grafana.github.io/helm-charts
    helm repo update

    # Install Prometheus Operator
    helm install prometheus prometheus-community/kube-prometheus-stack \
        --namespace monitoring \
        --values ../kubernetes/monitoring/prometheus-values.yaml \
        --set prometheus.retention="$MONITORING_RETENTION" \
        --set prometheus.replicaCount=2

    # Install Grafana
    helm install grafana grafana/grafana \
        --namespace monitoring \
        --values ../kubernetes/monitoring/grafana-values.yaml \
        --set persistence.enabled=true \
        --set persistence.size=10Gi

    # Install ELK stack
    helm install elasticsearch elastic/elasticsearch \
        --namespace logging \
        --values ../kubernetes/logging/elasticsearch-values.yaml

    # Install Jaeger
    helm install jaeger jaegertracing/jaeger \
        --namespace monitoring \
        --values ../kubernetes/monitoring/jaeger-values.yaml

    log_info "Monitoring stack installed successfully"
}

# Setup security function
setup_security() {
    log_info "Configuring security controls"

    # Install cert-manager
    helm install cert-manager jetstack/cert-manager \
        --namespace cert-manager \
        --create-namespace \
        --version v1.12.0 \
        --set installCRDs=true

    # Apply network policies
    kubectl apply -f ../kubernetes/security/network-policies.yaml

    # Setup pod security policies
    kubectl apply -f ../kubernetes/security/pod-security-policies.yaml

    # Configure RBAC
    kubectl apply -f ../kubernetes/security/rbac.yaml

    # Setup AWS Secrets Manager integration
    helm install external-secrets external-secrets/external-secrets \
        --namespace external-secrets \
        --create-namespace

    log_info "Security controls configured successfully"
}

# Main execution function
main() {
    log_info "Starting cluster setup for $CLUSTER_NAME in $AWS_REGION"

    # Run setup steps
    preflight_checks
    setup_cluster
    setup_namespaces
    install_monitoring
    setup_security

    # Verify deployment
    if kubectl get nodes &> /dev/null; then
        log_info "Cluster setup completed successfully"
        log_info "Cluster endpoint: $(kubectl config view --minify -o jsonpath='{.clusters[].cluster.server}')"
    else
        log_error "Cluster setup failed"
        exit 1
    fi
}

# Script entry point
if [[ "${BASH_SOURCE[0]}" == "${0}" ]]; then
    main "$@"
fi