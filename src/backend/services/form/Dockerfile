# Build stage
FROM node:20-alpine AS builder

# Install dumb-init for proper process signal handling
RUN apk add --no-cache dumb-init=1.2.5-r2

# Set working directory with explicit permissions
WORKDIR /app

# Copy package files with explicit ownership
COPY --chown=node:node package*.json ./

# Install dependencies with security measures
RUN npm ci --audit=true \
    && npm cache clean --force

# Copy source code with proper permissions
COPY --chown=node:node . .

# Build TypeScript code with optimizations
RUN npm run build \
    # Remove dev dependencies and clear npm cache
    && npm prune --production \
    && npm cache clean --force \
    # Run security audit
    && npm audit

# Production stage
FROM node:20-alpine

# Set environment variables
ENV NODE_ENV=production
ENV PORT=3000

# Copy dumb-init from builder
COPY --from=builder /usr/bin/dumb-init /usr/bin/dumb-init

# Set working directory
WORKDIR /app

# Copy package files and install production dependencies
COPY --chown=node:node package*.json ./
RUN npm ci --only=production --audit=true \
    && npm cache clean --force

# Copy compiled code from builder
COPY --chown=node:node --from=builder /app/dist ./dist

# Use non-root user
USER node

# Health check configuration
HEALTHCHECK --interval=30s --timeout=5s --start-period=5s --retries=3 \
    CMD wget --no-verbose --tries=1 --spider http://localhost:${PORT}/health || exit 1

# Set resource limits
ENV NODE_OPTIONS="--max-old-space-size=512"

# Expose port
EXPOSE ${PORT}

# Use dumb-init as entrypoint for proper signal handling
ENTRYPOINT ["/usr/bin/dumb-init", "--"]

# Start the application
CMD ["node", "dist/index.js"]

# Labels for container metadata
LABEL maintainer="AI-SMS Platform Team" \
    org.opencontainers.image.title="Form Service" \
    org.opencontainers.image.description="Form Service for AI-SMS Platform" \
    org.opencontainers.image.version="1.0.0" \
    org.opencontainers.image.vendor="AI-SMS Platform" \
    org.opencontainers.image.created="${BUILD_DATE}" \
    org.opencontainers.image.source="https://github.com/ai-sms/form-service" \
    security.capabilities.drop="ALL"

# Security configurations
RUN addgroup -S appgroup && adduser -S appuser -G appgroup
USER appuser