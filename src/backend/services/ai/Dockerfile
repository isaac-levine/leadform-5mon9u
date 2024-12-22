# -----------------------------
# Stage 1: Builder
# -----------------------------
FROM python:3.11-slim AS builder

# Build arguments
ARG POETRY_VERSION=1.5.1
ARG PYTHON_VERSION=3.11
ARG BUILD_DATE
ARG VCS_REF

# Labels for container metadata
LABEL org.opencontainers.image.created="${BUILD_DATE}" \
      org.opencontainers.image.revision="${VCS_REF}" \
      org.opencontainers.image.version="1.0.0" \
      org.opencontainers.image.title="AI Service" \
      org.opencontainers.image.description="AI-powered conversation management service" \
      org.opencontainers.image.vendor="AI-SMS Platform"

# Set environment variables
ENV PYTHONUNBUFFERED=1 \
    PYTHONDONTWRITEBYTECODE=1 \
    POETRY_VERSION=${POETRY_VERSION} \
    POETRY_HOME="/opt/poetry" \
    POETRY_NO_INTERACTION=1 \
    POETRY_VIRTUALENVS_CREATE=false

# Install system dependencies
RUN apt-get update && apt-get install -y --no-install-recommends \
    build-essential \
    curl \
    && rm -rf /var/lib/apt/lists/*

# Install Poetry
RUN curl -sSL https://install.python-poetry.org | python3 -

# Set working directory
WORKDIR /app

# Copy dependency files
COPY pyproject.toml poetry.lock ./

# Install dependencies
RUN poetry install --no-dev --no-root

# Copy source code
COPY src/ ./src/

# Build application
RUN poetry build

# -----------------------------
# Stage 2: Runtime
# -----------------------------
FROM python:3.11-slim

# Set environment variables
ENV PYTHONUNBUFFERED=1 \
    PYTHONDONTWRITEBYTECODE=1 \
    PORT=8000 \
    WORKERS=4 \
    WORKER_CLASS="uvicorn.workers.UvicornWorker" \
    MAX_REQUESTS=10000 \
    MAX_REQUESTS_JITTER=1000 \
    TIMEOUT=120 \
    KEEP_ALIVE=5 \
    GRACEFUL_TIMEOUT=30

# Install runtime system dependencies
RUN apt-get update && apt-get install -y --no-install-recommends \
    curl \
    && rm -rf /var/lib/apt/lists/*

# Create non-root user
RUN useradd -m -s /bin/bash appuser

# Set working directory
WORKDIR /app

# Copy built application from builder stage
COPY --from=builder /app/dist /app/dist
COPY --from=builder /app/src /app/src

# Create necessary directories with correct permissions
RUN mkdir -p /app/data /app/cache \
    && chown -R appuser:appuser /app

# Switch to non-root user
USER appuser

# Create volumes for persistence
VOLUME ["/app/data", "/app/cache"]

# Expose port
EXPOSE 8000

# Health check
HEALTHCHECK --interval=30s --timeout=10s --start-period=40s --retries=3 \
    CMD curl --fail http://localhost:8000/health || exit 1

# Start application with optimized settings
CMD ["python", "-m", "uvicorn", \
     "--host", "0.0.0.0", \
     "--port", "8000", \
     "--workers", "4", \
     "--worker-class", "uvicorn.workers.UvicornWorker", \
     "--proxy-headers", \
     "--forwarded-allow-ips", "*", \
     "--log-level", "info", \
     "--timeout-keep-alive", "5", \
     "--limit-concurrency", "1000", \
     "--backlog", "2048", \
     "src.main:app"]