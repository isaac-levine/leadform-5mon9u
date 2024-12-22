"""
Main entry point for the AI service.
Initializes FastAPI application with comprehensive monitoring, error handling, and service configuration.

Version: 1.0.0
"""

import asyncio
import logging
import multiprocessing
import uvicorn  # uvicorn v0.22.0
from fastapi import FastAPI, Request, Response
from fastapi.middleware.cors import CORSMiddleware
from prometheus_fastapi_instrumentator import Instrumentator  # prometheus-fastapi-instrumentator v5.9.0
from redis import Redis  # redis v4.5.0
from typing import Tuple

from .config import Settings
from .api.router import configure_routes
from .services.llm_service import LLMService
from .services.context_service import ContextService

# Initialize settings and core application
settings = Settings()
app = FastAPI(
    title=settings.APP_NAME,
    version=settings.APP_VERSION,
    docs_url="/api/docs" if settings.ENV != "production" else None,
    redoc_url="/api/redoc" if settings.ENV != "production" else None
)

# Configure logging
logging.basicConfig(
    level=logging.INFO if settings.ENV == "production" else logging.DEBUG,
    format='%(asctime)s - %(name)s - %(levelname)s - %(message)s'
)
logger = logging.getLogger(__name__)

async def init_services() -> Tuple[LLMService, ContextService]:
    """
    Initialize and validate required services with proper error handling.
    
    Returns:
        Tuple[LLMService, ContextService]: Initialized service instances
        
    Raises:
        RuntimeError: If service initialization fails
    """
    try:
        # Initialize context service
        context_service = ContextService(settings)
        
        # Initialize LLM service with context service
        llm_service = LLMService(settings, context_service)
        
        # Validate services
        await asyncio.gather(
            asyncio.to_thread(context_service.redis_client.ping),
            llm_service.validate_api_access()
        )
        
        return llm_service, context_service
        
    except Exception as e:
        logger.error(f"Failed to initialize services: {str(e)}")
        raise RuntimeError(f"Service initialization failed: {str(e)}")

def configure_metrics(app: FastAPI) -> None:
    """
    Configure comprehensive Prometheus metrics for monitoring.
    
    Args:
        app: FastAPI application instance
    """
    instrumentator = Instrumentator(
        should_group_status_codes=False,
        should_ignore_untemplated=True,
        should_respect_env_var=True,
        should_instrument_requests_inprogress=True,
        excluded_handlers=[".*healthcheck", "/metrics"],
        env_var_name="ENABLE_METRICS",
        inprogress_name="http_requests_inprogress",
        inprogress_labels=True
    )
    
    # Add default metrics
    instrumentator.add(
        metrics_namespace="ai_service",
        metrics_subsystem="http",
        latency_lowr_buckets=[0.1, 0.25, 0.5, 0.75, 1.0, 2.5, 5.0],
        should_include_handler=True,
        should_include_method=True,
        should_include_status=True
    )
    
    # Add custom metrics
    instrumentator.instrument(app)

@app.on_event("startup")
async def startup_event() -> None:
    """
    Comprehensive startup event handler with health checks and logging.
    """
    try:
        logger.info(f"Starting AI service in {settings.ENV} environment")
        
        # Initialize services
        app.state.llm_service, app.state.context_service = await init_services()
        logger.info("Services initialized successfully")
        
        # Configure routes
        configure_routes(app)
        logger.info("Routes configured successfully")
        
        # Configure metrics
        configure_metrics(app)
        logger.info("Metrics configured successfully")
        
        # Configure CORS
        app.add_middleware(
            CORSMiddleware,
            allow_origins=settings.ALLOWED_ORIGINS,
            allow_credentials=True,
            allow_methods=["*"],
            allow_headers=["*"]
        )
        
        logger.info("AI service startup completed successfully")
        
    except Exception as e:
        logger.error(f"Startup failed: {str(e)}")
        raise RuntimeError(f"Service startup failed: {str(e)}")

@app.on_event("shutdown")
async def shutdown_event() -> None:
    """
    Graceful shutdown handler for cleaning up resources.
    """
    try:
        logger.info("Initiating AI service shutdown")
        
        # Close Redis connections
        if hasattr(app.state, "context_service"):
            app.state.context_service.redis_client.close()
            await asyncio.to_thread(
                app.state.context_service.connection_pool.disconnect
            )
        
        # Cleanup LLM service resources
        if hasattr(app.state, "llm_service"):
            await app.state.llm_service.cleanup()
        
        logger.info("AI service shutdown completed successfully")
        
    except Exception as e:
        logger.error(f"Shutdown error: {str(e)}")
        raise RuntimeError(f"Service shutdown failed: {str(e)}")

@app.get("/health")
async def health_check() -> Response:
    """Health check endpoint for infrastructure monitoring."""
    try:
        # Verify service health
        await asyncio.gather(
            asyncio.to_thread(
                app.state.context_service.redis_client.ping
            ),
            app.state.llm_service.validate_api_access()
        )
        
        return {"status": "healthy", "version": settings.APP_VERSION}
    except Exception:
        return Response(
            status_code=503,
            content={"status": "unhealthy"}
        )

def main() -> None:
    """
    Production-ready main entry point with environment-specific configuration.
    """
    # Configure worker count based on CPU cores
    worker_count = multiprocessing.cpu_count()
    workers = min(worker_count * 2, 8)  # Max 8 workers
    
    # Configure uvicorn server
    uvicorn.run(
        "main:app",
        host=settings.HOST,
        port=settings.PORT,
        workers=workers if settings.ENV == "production" else 1,
        loop="uvloop",
        http="httptools",
        log_level="info" if settings.ENV == "production" else "debug",
        reload=settings.ENV != "production",
        access_log=settings.ENV != "production",
        proxy_headers=True,
        forwarded_allow_ips="*"
    )

if __name__ == "__main__":
    main()