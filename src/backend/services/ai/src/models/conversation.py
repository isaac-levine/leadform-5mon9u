"""
Pydantic models for conversation and message management in the AI service.
Handles conversation state, message flow, and AI confidence tracking with enhanced validation.

Version: 1.0.0
"""

from datetime import datetime
from enum import Enum
from typing import Dict, List, Optional, Any
from uuid import UUID
from pydantic import BaseModel, Field  # pydantic v2.0.0

# Constants for validation
MIN_CONFIDENCE = 0.0
MAX_CONFIDENCE = 1.0
DEFAULT_HANDOFF_THRESHOLD = 0.7
MAX_RESPONSE_TIME_SLA = 500  # milliseconds

class MessageDirection(str, Enum):
    """Message direction enumeration with string values for serialization."""
    INBOUND = "inbound"
    OUTBOUND = "outbound"

class ConversationStatus(str, Enum):
    """Conversation state enumeration with string values for serialization."""
    ACTIVE = "active"
    HUMAN_NEEDED = "human_needed"
    COMPLETED = "completed"
    ARCHIVED = "archived"

class IntentType(str, Enum):
    """Intent classification enumeration with string values for serialization."""
    GREETING = "greeting"
    QUESTION = "question"
    COMPLAINT = "complaint"
    REQUEST_HUMAN = "request_human"
    FAREWELL = "farewell"
    UNKNOWN = "unknown"

class Intent(BaseModel):
    """
    Pydantic model for intent classification with confidence tracking.
    Includes enhanced validation and human handoff logic.
    """
    type: IntentType = Field(..., description="Classified intent type")
    confidence: float = Field(
        ...,
        ge=MIN_CONFIDENCE,
        le=MAX_CONFIDENCE,
        description="Confidence score for intent classification"
    )
    requires_human: bool = Field(
        default=False,
        description="Flag indicating if human intervention is required"
    )
    metadata: Dict[str, Any] = Field(
        default_factory=dict,
        description="Additional intent metadata"
    )

    def should_handoff(self) -> bool:
        """
        Enhanced logic for determining if human handoff is needed.
        Returns True if any handoff condition is met.
        """
        # Check direct human request flag
        if self.requires_human:
            return True
            
        # Check confidence threshold
        if self.confidence < DEFAULT_HANDOFF_THRESHOLD:
            return True
            
        # Check intent type
        if self.type == IntentType.REQUEST_HUMAN:
            return True
            
        # Check metadata for additional triggers
        if self.metadata.get("sentiment_score", 1.0) < 0.3:
            return True
            
        if self.metadata.get("urgent", False):
            return True
            
        return False

class Message(BaseModel):
    """
    Pydantic model for conversation messages with enhanced validation.
    Includes confidence tracking and metadata management.
    """
    id: UUID = Field(..., description="Unique message identifier")
    conversation_id: UUID = Field(..., description="Parent conversation identifier")
    content: str = Field(..., min_length=1, description="Message content")
    direction: MessageDirection = Field(..., description="Message direction")
    ai_confidence: float = Field(
        ...,
        ge=MIN_CONFIDENCE,
        le=MAX_CONFIDENCE,
        description="AI confidence score for message processing"
    )
    intent: Optional[Intent] = Field(None, description="Classified message intent")
    metadata: Dict[str, Any] = Field(
        default_factory=dict,
        description="Additional message metadata"
    )
    created_at: datetime = Field(
        default_factory=datetime.utcnow,
        description="Message creation timestamp"
    )
    updated_at: datetime = Field(
        default_factory=datetime.utcnow,
        description="Message last update timestamp"
    )

    def to_dict(self) -> Dict[str, Any]:
        """
        Convert message to dictionary with enhanced serialization.
        Handles complex types and optional fields.
        """
        data = {
            "id": str(self.id),
            "conversation_id": str(self.conversation_id),
            "content": self.content,
            "direction": self.direction.value,
            "ai_confidence": self.ai_confidence,
            "metadata": self.metadata,
            "created_at": self.created_at.isoformat(),
            "updated_at": self.updated_at.isoformat()
        }
        
        if self.intent:
            data["intent"] = {
                "type": self.intent.type.value,
                "confidence": self.intent.confidence,
                "requires_human": self.intent.requires_human,
                "metadata": self.intent.metadata
            }
            
        return data

class Conversation(BaseModel):
    """
    Pydantic model for conversation management with performance optimizations.
    Includes state management and confidence tracking.
    """
    id: UUID = Field(..., description="Unique conversation identifier")
    lead_id: UUID = Field(..., description="Associated lead identifier")
    status: ConversationStatus = Field(
        default=ConversationStatus.ACTIVE,
        description="Current conversation status"
    )
    messages: List[Message] = Field(
        default_factory=list,
        description="List of conversation messages"
    )
    current_intent: Optional[Intent] = Field(
        None,
        description="Current conversation intent"
    )
    human_agent_id: Optional[UUID] = Field(
        None,
        description="Assigned human agent identifier"
    )
    ai_confidence_avg: float = Field(
        default=1.0,
        ge=MIN_CONFIDENCE,
        le=MAX_CONFIDENCE,
        description="Average AI confidence score"
    )
    metadata: Dict[str, Any] = Field(
        default_factory=dict,
        description="Additional conversation metadata"
    )
    created_at: datetime = Field(
        default_factory=datetime.utcnow,
        description="Conversation creation timestamp"
    )
    updated_at: datetime = Field(
        default_factory=datetime.utcnow,
        description="Conversation last update timestamp"
    )

    def add_message(self, message: Message) -> None:
        """
        Add new message with confidence recalculation and state updates.
        Updates conversation state in place.
        """
        # Validate message belongs to this conversation
        if message.conversation_id != self.id:
            raise ValueError("Message belongs to different conversation")

        # Add message to conversation
        self.messages.append(message)
        
        # Update confidence average with weighted calculation
        message_count = len(self.messages)
        self.ai_confidence_avg = (
            (self.ai_confidence_avg * (message_count - 1) + message.ai_confidence)
            / message_count
        )
        
        # Update current intent if present
        if message.intent:
            self.current_intent = message.intent
            
            # Check for status updates based on intent
            if message.intent.should_handoff():
                self.status = ConversationStatus.HUMAN_NEEDED
        
        # Update timestamp
        self.updated_at = datetime.utcnow()

    def should_handoff(self) -> bool:
        """
        Enhanced handoff decision logic considering multiple factors.
        Returns True if human handoff is needed.
        """
        # Check current intent
        if self.current_intent and self.current_intent.should_handoff():
            return True
            
        # Check average confidence
        if self.ai_confidence_avg < DEFAULT_HANDOFF_THRESHOLD:
            return True
            
        # Check current status
        if self.status == ConversationStatus.HUMAN_NEEDED:
            return True
            
        # Check response time SLA
        if self.messages:
            last_message = self.messages[-1]
            response_time = (datetime.utcnow() - last_message.created_at).total_seconds() * 1000
            if response_time > MAX_RESPONSE_TIME_SLA:
                return True
                
        return False

    def to_dict(self) -> Dict[str, Any]:
        """
        Optimized dictionary conversion with efficient handling of nested objects.
        Returns complete dictionary representation.
        """
        data = {
            "id": str(self.id),
            "lead_id": str(self.lead_id),
            "status": self.status.value,
            "messages": [msg.to_dict() for msg in self.messages],
            "ai_confidence_avg": self.ai_confidence_avg,
            "metadata": self.metadata,
            "created_at": self.created_at.isoformat(),
            "updated_at": self.updated_at.isoformat()
        }
        
        if self.current_intent:
            data["current_intent"] = {
                "type": self.current_intent.type.value,
                "confidence": self.current_intent.confidence,
                "requires_human": self.current_intent.requires_human,
                "metadata": self.current_intent.metadata
            }
            
        if self.human_agent_id:
            data["human_agent_id"] = str(self.human_agent_id)
            
        return data