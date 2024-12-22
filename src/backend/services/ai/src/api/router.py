"""
Main FastAPI router configuration for the AI service.
Implements comprehensive middleware stack, monitoring, and error handling.

Version: 1.0.0
"""

import time
from typing import Dict, Any
from uuid import uuid4
from fastapi import FastAPI, Request, Response
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse
from fastapi.middleware.gzip import GZipMiddleware
from prometheus_client import Counter, Histogram, generate_latest, CONTENT_TYPE_LATEST
from slowapi import Limiter
from slowapi.util import get_remote_address
from circuitbreaker import circuit

from .endpoints.conversation import router as conversation_router
from .endpoints.intent import router as intent_router

# Performance monitoring metrics
REQUEST_LATENCY = Histogram(
    'http_request_duration_seconds',
    'HTTP request latency',
    ['method', 'endpoint']
)
ERROR_COUNTER = Counter(
    'http_errors_total',
    'Total count of HTTP errors',
    ['method', 'endpoint', 'status']
)

# Rate limiting configuration
limiter = Limiter(key_func=get_remote_address)
RATE_LIMIT = "100/minute"

# Circuit breaker configuration
CIRCUIT_BREAKER_THRESHOLD = 5
CIRCUIT_BREAKER_TIMEOUT = 30

# Request timeout in seconds
REQUEST_TIMEOUT = 5

# Initialize main router
router = APIRouter(prefix="/api/v1")

def configure_routes(app: FastAPI) -> None:
    """
    Configure FastAPI application with comprehensive middleware stack and routes.
    
    Args:
        app: FastAPI application instance
    """
    # Configure CORS
    app.add_middleware(
        CORSMiddleware,
        allow_origins=["*"] if app.debug else ["https://*.example.com"],
        allow_credentials=True,
        allow_methods=["*"],
        allow_headers=["*"],
        expose_headers=["X-Request-ID"]
    )

    # Add request ID middleware
    @app.middleware("http")
    async def add_request_id(request: Request, call_next):
        request_id = str(uuid4())
        request.state.request_id = request_id
        response = await call_next(request)
        response.headers["X-Request-ID"] = request_id
        return response

    # Add timing middleware
    @app.middleware("http")
    async def add_timing(request: Request, call_next):
        start_time = time.time()
        response = await call_next(request)
        process_time = time.time() - start_time
        
        # Record metrics
        REQUEST_LATENCY.labels(
            method=request.method,
            endpoint=request.url.path
        ).observe(process_time)
        
        response.headers["X-Process-Time"] = str(process_time)
        return response

    # Add rate limiting middleware
    @app.middleware("http")
    async def rate_limit_middleware(request: Request, call_next):
        try:
            await limiter.check(request)
            response = await call_next(request)
            return response
        except Exception:
            return JSONResponse(
                status_code=429,
                content={"detail": "Too many requests"}
            )

    # Add circuit breaker middleware
    @app.middleware("http")
    @circuit(failure_threshold=CIRCUIT_BREAKER_THRESHOLD, recovery_timeout=CIRCUIT_BREAKER_TIMEOUT)
    async def circuit_breaker_middleware(request: Request, call_next):
        try:
            response = await call_next(request)
            return response
        except Exception as e:
            ERROR_COUNTER.labels(
                method=request.method,
                endpoint=request.url.path,
                status=500
            ).inc()
            raise e

    # Add compression middleware
    app.add_middleware(GZipMiddleware, minimum_size=1000)

    # Add security headers middleware
    @app.middleware("http")
    async def add_security_headers(request: Request, call_next):
        response = await call_next(request)
        response.headers["X-Content-Type-Options"] = "nosniff"
        response.headers["X-Frame-Options"] = "DENY"
        response.headers["X-XSS-Protection"] = "1; mode=block"
        response.headers["Strict-Transport-Security"] = "max-age=31536000; includeSubDomains"
        return response

    # Include routers
    app.include_router(conversation_router, prefix="/conversations")
    app.include_router(intent_router, prefix="/intent")

    # Add global error handler
    @app.exception_handler(Exception)
    async def handle_errors(request: Request, exc: Exception) -> JSONResponse:
        """Global error handler with monitoring."""
        error_detail = str(exc)
        status_code = getattr(exc, "status_code", 500)
        
        # Increment error counter
        ERROR_COUNTER.labels(
            method=request.method,
            endpoint=request.url.path,
            status=status_code
        ).inc()
        
        return JSONResponse(
            status_code=status_code,
            content={
                "detail": error_detail,
                "request_id": getattr(request.state, "request_id", None)
            }
        )

    # Add health check endpoint
    @app.get("/health")
    async def health_check() -> Dict[str, Any]:
        """Health check endpoint for infrastructure monitoring."""
        return {
            "status": "healthy",
            "version": "1.0.0",
            "timestamp": time.time()
        }

    # Add metrics endpoint
    @app.get("/metrics")
    async def metrics() -> Response:
        """Prometheus metrics endpoint."""
        return Response(
            generate_latest(),
            media_type=CONTENT_TYPE_LATEST
        )

# Export configured router
__all__ = ["configure_routes", "router"]