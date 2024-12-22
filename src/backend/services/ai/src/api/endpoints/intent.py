"""
FastAPI endpoint handlers for intent classification and management.
Provides APIs for message intent analysis and human handoff decisions.

Version: 1.0.0
"""

from typing import Dict, Any, List, Optional
from fastapi import APIRouter, Depends, HTTPException, BackgroundTasks
from fastapi.responses import JSONResponse
from pydantic import BaseModel, Field, validator
from fastapi_cache import Cache
from fastapi_cache.decorator import cache
from prometheus_client import Histogram, Counter

from ...models.intent import Intent, IntentType
from ...services.llm_service import LLMService

# Performance monitoring metrics
PROCESSING_TIME = Histogram(
    'intent_processing_seconds',
    'Time spent processing intent classification',
    buckets=[.1, .25, .5, .75, 1.0]
)
CLASSIFICATION_ERRORS = Counter(
    'intent_classification_errors',
    'Total number of classification errors',
    ['error_type']
)
CONFIDENCE_SCORES = Histogram(
    'intent_confidence_scores',
    'Distribution of intent confidence scores'
)

# Router configuration
router = APIRouter(
    prefix="/api/v1/intent",
    tags=["intent"],
    responses={
        500: {"description": "Internal server error"},
        503: {"description": "Service temporarily unavailable"}
    }
)

# Constants
MAX_MESSAGE_LENGTH = 1000
CONFIDENCE_THRESHOLD = 0.85

class IntentRequest(BaseModel):
    """
    Pydantic model for intent classification request with validation.
    """
    message: str = Field(
        ...,
        max_length=MAX_MESSAGE_LENGTH,
        description="Message content to classify"
    )
    context: Dict[str, Any] = Field(
        default_factory=dict,
        description="Additional context for classification"
    )
    metadata: Optional[Dict[str, Any]] = Field(
        default_factory=dict,
        description="Optional request metadata"
    )

    @validator('message')
    def validate_message(cls, value: str) -> str:
        """Validate message content."""
        if not value or value.isspace():
            raise ValueError("Message cannot be empty or whitespace")
        return value.strip()

class IntentResponse(BaseModel):
    """
    Pydantic model for intent classification response.
    """
    type: str
    confidence: float = Field(..., ge=0.0, le=1.0)
    requires_human: bool
    metadata: Dict[str, Any]
    processing_time: float

async def get_llm_service() -> LLMService:
    """
    Dependency injection for LLM service.
    """
    try:
        # Initialize LLM service with configuration
        from ...config import Settings
        settings = Settings()
        llm_config = settings.get_llm_config()
        
        # Create service instance with monitoring
        service = LLMService(settings)
        return service
    except Exception as e:
        CLASSIFICATION_ERRORS.labels(error_type='service_init').inc()
        raise HTTPException(
            status_code=503,
            detail="Failed to initialize LLM service"
        )

@router.post(
    '/classify',
    response_model=IntentResponse,
    responses={
        200: {"description": "Successfully classified message intent"},
        422: {"description": "Invalid request format"},
        500: {"description": "Internal server error"},
        503: {"description": "Service temporarily unavailable"}
    }
)
async def classify_message_intent(
    request: IntentRequest,
    background_tasks: BackgroundTasks,
    llm_service: LLMService = Depends(get_llm_service)
) -> IntentResponse:
    """
    Classify message intent with performance monitoring and error handling.
    """
    try:
        with PROCESSING_TIME.time() as processing_time:
            # Classify intent using LLM service
            intent = await llm_service.classify_intent(
                request.message,
                request.context
            )
            
            # Record confidence score
            CONFIDENCE_SCORES.observe(intent.confidence)
            
            # Check if human handoff is needed
            requires_human = intent.should_handoff(CONFIDENCE_THRESHOLD)
            
            # Prepare response
            response = IntentResponse(
                type=intent.type.value,
                confidence=intent.confidence,
                requires_human=requires_human,
                metadata={
                    **intent.to_dict(),
                    **request.metadata,
                    "threshold": CONFIDENCE_THRESHOLD,
                    "service_version": "1.0.0"
                },
                processing_time=processing_time
            )
            
            # Add background task for metrics recording
            background_tasks.add_task(
                record_classification_metrics,
                intent.type,
                intent.confidence,
                processing_time
            )
            
            return response

    except ValueError as e:
        CLASSIFICATION_ERRORS.labels(error_type='validation').inc()
        raise HTTPException(
            status_code=422,
            detail=str(e)
        )
    except Exception as e:
        CLASSIFICATION_ERRORS.labels(error_type='processing').inc()
        raise HTTPException(
            status_code=500,
            detail="Intent classification failed"
        )

@router.get(
    '/types',
    response_model=List[str],
    responses={
        200: {"description": "Successfully retrieved intent types"}
    }
)
@cache(expire=3600)  # Cache for 1 hour
async def get_intent_types() -> List[str]:
    """
    Retrieve available intent types with caching.
    """
    try:
        # Get all intent types from enum
        intent_types = [intent_type.value for intent_type in IntentType]
        return intent_types
    except Exception as e:
        CLASSIFICATION_ERRORS.labels(error_type='types_retrieval').inc()
        raise HTTPException(
            status_code=500,
            detail="Failed to retrieve intent types"
        )

async def record_classification_metrics(
    intent_type: str,
    confidence: float,
    processing_time: float
) -> None:
    """
    Background task to record classification metrics.
    """
    try:
        # Record detailed metrics for monitoring
        CONFIDENCE_SCORES.observe(confidence)
        PROCESSING_TIME.observe(processing_time)
        
        # Additional metric recording could be added here
        # e.g., intent type distribution, processing time by type, etc.
    except Exception as e:
        CLASSIFICATION_ERRORS.labels(error_type='metrics').inc()