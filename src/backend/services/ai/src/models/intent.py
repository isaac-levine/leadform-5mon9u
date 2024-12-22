"""
Intent classification models for AI service.

This module provides Pydantic models and enums for handling message intent classification,
confidence scoring, and human handoff decisions with comprehensive validation.

Version: 1.0.0
"""

from enum import Enum
from typing import Dict, Any, Optional
from datetime import datetime
from pydantic import BaseModel, Field  # pydantic v2.0.0

class IntentType(str, Enum):
    """
    Enumeration of possible message intent types.
    
    Inherits from str to ensure JSON serialization compatibility.
    """
    GREETING = "greeting"
    QUESTION = "question"
    COMPLAINT = "complaint"
    REQUEST_HUMAN = "request_human"
    FAREWELL = "farewell"
    UNKNOWN = "unknown"

class Intent(BaseModel):
    """
    Pydantic model for intent classification with validation and processing logic.
    
    Attributes:
        type (IntentType): The classified intent type
        confidence (float): Confidence score between 0 and 1
        requires_human (bool): Flag indicating if human intervention is needed
        metadata (Dict[str, Any]): Additional context and processing information
    """
    
    type: IntentType = Field(
        ...,  # Required field
        description="Classified intent type of the message"
    )
    
    confidence: float = Field(
        ...,
        ge=0.0,
        le=1.0,
        description="Confidence score of the intent classification"
    )
    
    requires_human: bool = Field(
        default=False,
        description="Flag indicating if human intervention is required"
    )
    
    metadata: Dict[str, Any] = Field(
        default_factory=dict,
        description="Additional context and processing metadata"
    )

    class Config:
        """Pydantic model configuration."""
        json_schema_extra = {
            "example": {
                "type": "QUESTION",
                "confidence": 0.85,
                "requires_human": False,
                "metadata": {
                    "processing_time_ms": 150,
                    "model_version": "1.0.0"
                }
            }
        }

    def __init__(self, **data):
        """
        Initialize intent with validated parameters and metadata.
        
        Args:
            **data: Keyword arguments for intent attributes
        """
        # Add timestamp to metadata
        metadata = data.get('metadata', {})
        metadata.update({
            'created_at': datetime.utcnow().isoformat(),
            'model_version': '1.0.0'
        })
        data['metadata'] = metadata
        
        super().__init__(**data)

    def should_handoff(self, confidence_threshold: float = 0.7) -> bool:
        """
        Determine if conversation requires human intervention.
        
        Args:
            confidence_threshold (float): Minimum confidence threshold (default: 0.7)
            
        Returns:
            bool: True if human intervention is required
            
        Raises:
            ValueError: If confidence_threshold is not between 0 and 1
        """
        if not 0 <= confidence_threshold <= 1:
            raise ValueError("Confidence threshold must be between 0 and 1")

        # Check explicit human request flag
        if self.requires_human:
            return True

        # Check if confidence is below threshold
        if self.confidence < confidence_threshold:
            return True

        # Check if intent type explicitly requests human
        if self.type == IntentType.REQUEST_HUMAN:
            return True

        # Check if intent is a complaint with low confidence
        if self.type == IntentType.COMPLAINT and self.confidence < 0.9:
            return True

        return False

    def to_dict(self) -> Dict[str, Any]:
        """
        Convert intent to serializable dictionary format.
        
        Returns:
            Dict[str, Any]: Dictionary containing all intent information
        """
        return {
            'type': self.type.value,
            'confidence': round(self.confidence, 4),
            'requires_human': self.requires_human,
            'metadata': self.metadata,
            'should_handoff': self.should_handoff(),  # Include current handoff status
            'processing_info': {
                'model_version': self.metadata.get('model_version', '1.0.0'),
                'created_at': self.metadata.get('created_at'),
            }
        }

    def __str__(self) -> str:
        """String representation of the intent."""
        return (f"Intent(type={self.type.value}, "
                f"confidence={self.confidence:.2f}, "
                f"requires_human={self.requires_human})")