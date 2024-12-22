# -----------------------------------------------------------------------------
# Builder stage
# -----------------------------------------------------------------------------
FROM node:20-alpine AS builder

# Set working directory
WORKDIR /app

# Install build dependencies and security updates
RUN apk update && \
    apk upgrade && \
    apk add --no-cache python3 make g++ && \
    npm install -g npm@latest

# Copy package files for dependency caching
COPY package*.json ./

# Install dependencies with npm ci for reproducible builds
RUN npm ci

# Copy source code with respect to .dockerignore
COPY . .

# Build TypeScript application with optimizations
RUN npm run build

# Prune development dependencies
RUN npm prune --production

# -----------------------------------------------------------------------------
# Runtime stage
# -----------------------------------------------------------------------------
FROM node:20-alpine AS runtime

# Add labels for container metadata
LABEL maintainer="AI-SMS Platform Team" \
      service="api-gateway" \
      version="1.0.0" \
      security.scan-date="2024-01-01" \
      monitoring.metrics-endpoint="/metrics" \
      build.git-commit="${GIT_COMMIT}"

# Install security updates and runtime dependencies
RUN apk update && \
    apk upgrade && \
    apk add --no-cache tini curl && \
    addgroup -g 1001 appgroup && \
    adduser -u 1001 -G appgroup -s /bin/sh -D appuser

# Set working directory
WORKDIR /app

# Copy built artifacts and dependencies from builder stage
COPY --from=builder /app/dist ./dist
COPY --from=builder /app/node_modules ./node_modules
COPY --from=builder /app/package*.json ./

# Set secure environment variables
ENV NODE_ENV=production \
    PORT=3000 \
    LOG_LEVEL=info \
    METRICS_PORT=9090 \
    HEALTH_CHECK_INTERVAL=30 \
    MAX_OLD_SPACE_SIZE=2048

# Configure security settings
RUN chmod -R 555 /app && \
    chown -R appuser:appgroup /app

# Expose ports for API and metrics
EXPOSE 3000 9090

# Set up health check
HEALTHCHECK --interval=30s --timeout=5s --start-period=10s --retries=3 \
    CMD curl -f http://localhost:3000/health || exit 1

# Switch to non-root user
USER appuser

# Use tini as init system
ENTRYPOINT ["/sbin/tini", "--"]

# Start the application with security flags
CMD ["node", \
     "--max-old-space-size=2048", \
     "--no-deprecation", \
     "--security-revert=CVE-2023-46809", \
     "--disable-proto=delete", \
     "dist/index.js"]

# Apply security options
SECURITY_OPTS --security-opt=no-new-privileges:true \
             --security-opt=seccomp=unconfined \
             --read-only \
             --cap-drop=ALL \
             --cap-add=NET_BIND_SERVICE

# Set read-only paths
VOLUME ["/app/node_modules", "/app/dist"]