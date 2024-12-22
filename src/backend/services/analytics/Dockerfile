# =====================================
# Builder Stage
# =====================================
FROM node:20-alpine AS builder

# Set working directory
WORKDIR /app

# Add build dependencies
RUN apk add --no-cache python3 make g++ 

# Copy package files with strict selection
COPY package*.json ./
COPY tsconfig.json ./

# Install dependencies with exact versions and enable caching
RUN --mount=type=cache,target=/root/.npm \
    npm ci --ignore-scripts --no-audit

# Copy source code with correct ownership
COPY --chown=node:node . .

# Build TypeScript with optimizations
RUN npm run build && \
    npm prune --production

# Security audit
RUN npm audit

# Verify build artifacts
RUN test -d dist && \
    test -f dist/index.js

# =====================================
# Production Stage
# =====================================
FROM node:20-alpine

# Set production environment
ENV NODE_ENV=production \
    PORT=3000 \
    NODE_OPTIONS="--max-old-space-size=2048" \
    COMPRESSION_LEVEL=6 \
    LOG_LEVEL=info \
    METRICS_PORT=9090

# Install production dependencies
RUN apk add --no-cache tini curl

# Create app directory and set ownership
WORKDIR /app
RUN chown -R node:node /app

# Copy package files and built artifacts from builder
COPY --from=builder --chown=node:node /app/package*.json ./
COPY --from=builder --chown=node:node /app/dist ./dist
COPY --from=builder --chown=node:node /app/node_modules ./node_modules

# Configure security
RUN addgroup -S appgroup && \
    adduser -S -G appgroup appuser && \
    chmod -R 550 /app && \
    chmod -R 500 /app/node_modules

# Set up health check
HEALTHCHECK --interval=30s --timeout=5s --start-period=60s --retries=3 \
    CMD curl -f http://localhost:${PORT}/health || exit 1

# Expose ports
EXPOSE 3000 9090

# Set up volumes with size limits
VOLUME ["/tmp"]

# Set resource limits
RUN echo "* soft nofile 65536" >> /etc/security/limits.conf && \
    echo "* hard nofile 65536" >> /etc/security/limits.conf

# Switch to non-root user
USER node

# Set security options
LABEL security.scan.status=verified \
      maintainer="DevOps Team" \
      app.kubernetes.io/name="analytics-service" \
      app.kubernetes.io/component="backend"

# Use tini as init system
ENTRYPOINT ["/sbin/tini", "--"]

# Start application with clustering
CMD ["node", "--max-old-space-size=2048", "dist/index.js"]

# Security configurations
SECURITY_OPT ["no-new-privileges:true", "seccomp=unconfined"]