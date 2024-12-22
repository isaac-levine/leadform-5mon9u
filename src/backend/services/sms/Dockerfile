# Stage 1: Builder
FROM node:20.11.0-alpine3.19 AS builder

# Set working directory
WORKDIR /app

# Copy package files for dependency installation
COPY package*.json ./

# Install dependencies with frozen lockfile for reproducible builds
RUN npm ci --ignore-scripts

# Copy source code
COPY . .

# Build TypeScript code
RUN npm run build

# Prune dev dependencies
RUN npm prune --production

# Stage 2: Production
FROM node:20.11.0-alpine3.19

# Set labels for container metadata and monitoring
LABEL maintainer="DevOps Team <devops@company.com>" \
      service="sms-service" \
      version="1.0.0" \
      environment="production" \
      com.datadoghq.tags.service="sms-service" \
      com.datadoghq.tags.version="1.0.0"

# Install curl for health checks
RUN apk add --no-cache curl=8.5.0-r0

# Create non-root user and set permissions
RUN addgroup -g 1001 -S node && \
    adduser -u 1001 -S node -G node

# Set working directory
WORKDIR /app

# Copy built artifacts and dependencies from builder stage
COPY --from=builder --chown=node:node /app/dist ./dist
COPY --from=builder --chown=node:node /app/node_modules ./node_modules
COPY --from=builder --chown=node:node /app/package*.json ./

# Set environment variables
ENV NODE_ENV=production \
    PORT=3000 \
    HOST=0.0.0.0 \
    NODE_OPTIONS="--max-old-space-size=2048" \
    TZ=UTC

# Expose service port
EXPOSE 3000

# Create volume mount points
VOLUME ["/app/node_modules", "/tmp"]

# Set security configurations
USER node
WORKDIR /app

# Configure health check
HEALTHCHECK --interval=30s --timeout=10s --start-period=20s --retries=3 \
    CMD curl -f http://localhost:3000/health || exit 1

# Set security options
SECURITY_OPTS=["no-new-privileges:true", "seccomp=unconfined"]

# Drop all capabilities except those needed
RUN setcap 'cap_net_bind_service=+ep' /usr/local/bin/node

# Set read-only root filesystem
RUN chmod -R 555 /app

# Set entry point with memory limits
ENTRYPOINT ["node", "--max-old-space-size=2048", "dist/index.js"]