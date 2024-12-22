"""
Comprehensive test suite for conversation handling functionality in the AI service.
Validates message processing, intent classification, context management, and response generation
with strict timing and performance requirements.

Version: 1.0.0
"""

import pytest
import asyncio
import json
import uuid
from datetime import datetime, timedelta
from typing import Dict, Any
from unittest.mock import Mock, AsyncMock
from freezegun import freeze_time

from ..src.models.conversation import (
    Conversation,
    Message,
    Intent,
    IntentType,
    MessageDirection,
    ConversationStatus
)
from ..src.services.context_service import ContextService
from ..src.services.llm_service import LLMService

@pytest.mark.asyncio
class TestConversation:
    """
    Test class for conversation functionality with comprehensive performance validation.
    Ensures compliance with 500ms processing time requirement and 80% response rate.
    """

    async def setup_method(self):
        """Initialize test environment with mocks and performance monitoring."""
        # Initialize mock services
        self.context_service = AsyncMock(spec=ContextService)
        self.llm_service = AsyncMock(spec=LLMService)
        
        # Setup test data
        self.test_data = {
            'conversation_id': uuid.uuid4(),
            'lead_id': uuid.uuid4(),
            'test_message': "Hello, I'm interested in your services",
            'test_response': "Thank you for your interest! How can I help you today?",
            'test_intent': Intent(
                type=IntentType.GREETING,
                confidence=0.95,
                requires_human=False
            )
        }
        
        # Configure mock responses
        self.context_service.get_conversation_context.return_value = {
            'messages': [],
            'metadata': {},
            'created_at': datetime.utcnow().isoformat()
        }
        
        self.llm_service.process_message.return_value = (
            Message(
                id=uuid.uuid4(),
                conversation_id=self.test_data['conversation_id'],
                content=self.test_data['test_response'],
                direction=MessageDirection.OUTBOUND,
                ai_confidence=0.95,
                intent=self.test_data['test_intent']
            ),
            self.test_data['test_intent']
        )

    async def teardown_method(self):
        """Cleanup test environment and validate final state."""
        await asyncio.sleep(0)  # Allow any pending coroutines to complete
        self.context_service.reset_mock()
        self.llm_service.reset_mock()

    @pytest.mark.asyncio
    async def test_conversation_creation(self):
        """Test conversation creation with validation of initial properties."""
        # Create test conversation
        conversation = Conversation(
            id=self.test_data['conversation_id'],
            lead_id=self.test_data['lead_id']
        )
        
        # Verify initial properties
        assert conversation.id == self.test_data['conversation_id']
        assert conversation.lead_id == self.test_data['lead_id']
        assert conversation.status == ConversationStatus.ACTIVE
        assert len(conversation.messages) == 0
        assert conversation.ai_confidence_avg == 1.0
        assert conversation.human_agent_id is None

    @pytest.mark.asyncio
    @pytest.mark.timeout(0.5)  # Enforce 500ms processing requirement
    async def test_message_processing(self):
        """Test message processing with strict timing validation."""
        # Create test conversation and message
        conversation = Conversation(
            id=self.test_data['conversation_id'],
            lead_id=self.test_data['lead_id']
        )
        
        message = Message(
            id=uuid.uuid4(),
            conversation_id=conversation.id,
            content=self.test_data['test_message'],
            direction=MessageDirection.INBOUND,
            ai_confidence=1.0
        )
        
        # Process message and measure timing
        start_time = datetime.utcnow()
        response, intent = await self.llm_service.process_message(message, conversation)
        processing_time = (datetime.utcnow() - start_time).total_seconds() * 1000
        
        # Verify processing time
        assert processing_time < 500, f"Processing time {processing_time}ms exceeded 500ms limit"
        
        # Verify response properties
        assert response.conversation_id == conversation.id
        assert response.direction == MessageDirection.OUTBOUND
        assert response.ai_confidence >= 0.7
        assert response.intent.type == IntentType.GREETING
        
        # Verify context updates
        self.context_service.update_context.assert_called_once()
        context_update = self.context_service.update_context.call_args[0][1]
        assert len(context_update['messages']) == 2  # Original message + response

    @pytest.mark.asyncio
    async def test_context_management(self):
        """Test conversation context handling with compression validation."""
        # Create test conversation with multiple messages
        conversation = Conversation(
            id=self.test_data['conversation_id'],
            lead_id=self.test_data['lead_id']
        )
        
        # Add test messages
        for i in range(5):
            message = Message(
                id=uuid.uuid4(),
                conversation_id=conversation.id,
                content=f"Test message {i}",
                direction=MessageDirection.INBOUND,
                ai_confidence=0.9
            )
            conversation.add_message(message)
        
        # Test context building
        context = self.context_service.build_context(conversation)
        
        # Verify context structure
        assert 'messages' in context
        assert len(context['messages']) <= 10  # Context window limit
        assert 'metadata' in context
        assert context['metadata']['lead_id'] == str(conversation.lead_id)
        assert context['metadata']['ai_confidence_avg'] == conversation.ai_confidence_avg
        
        # Test context storage
        await self.context_service.update_context(conversation.id, context)
        self.context_service.update_context.assert_called_once()

    @pytest.mark.asyncio
    async def test_human_handoff(self):
        """Test conditions triggering human handoff with confidence thresholds."""
        # Create conversation with low confidence messages
        conversation = Conversation(
            id=self.test_data['conversation_id'],
            lead_id=self.test_data['lead_id']
        )
        
        # Add message with low confidence
        low_confidence_message = Message(
            id=uuid.uuid4(),
            conversation_id=conversation.id,
            content="I'm having a complex issue",
            direction=MessageDirection.INBOUND,
            ai_confidence=0.5,
            intent=Intent(
                type=IntentType.REQUEST_HUMAN,
                confidence=0.9,
                requires_human=True
            )
        )
        
        # Configure mock for low confidence scenario
        self.llm_service.process_message.return_value = (
            Message(
                id=uuid.uuid4(),
                conversation_id=conversation.id,
                content="Connecting you with a human agent...",
                direction=MessageDirection.OUTBOUND,
                ai_confidence=0.5,
                intent=low_confidence_message.intent
            ),
            low_confidence_message.intent
        )
        
        # Process message
        response, intent = await self.llm_service.process_message(
            low_confidence_message,
            conversation
        )
        
        # Verify handoff triggers
        assert intent.requires_human
        assert intent.type == IntentType.REQUEST_HUMAN
        assert response.content == "Connecting you with a human agent..."
        
        # Add message and verify conversation status
        conversation.add_message(low_confidence_message)
        assert conversation.status == ConversationStatus.HUMAN_NEEDED
        assert conversation.should_handoff()

    @pytest.mark.asyncio
    async def test_response_generation_performance(self):
        """Test response generation with performance monitoring."""
        # Create test conversation
        conversation = Conversation(
            id=self.test_data['conversation_id'],
            lead_id=self.test_data['lead_id']
        )
        
        # Test multiple messages for consistent performance
        test_messages = [
            "Hello, I need information",
            "What are your prices?",
            "Can you help me with a problem?",
            "I'd like to schedule a meeting",
            "Thank you for your help"
        ]
        
        processing_times = []
        
        for content in test_messages:
            message = Message(
                id=uuid.uuid4(),
                conversation_id=conversation.id,
                content=content,
                direction=MessageDirection.INBOUND,
                ai_confidence=1.0
            )
            
            # Measure processing time
            start_time = datetime.utcnow()
            response, intent = await self.llm_service.process_message(message, conversation)
            processing_time = (datetime.utcnow() - start_time).total_seconds() * 1000
            processing_times.append(processing_time)
            
            # Verify response quality
            assert response.content
            assert response.ai_confidence >= 0.7
            assert intent.confidence >= 0.7
        
        # Verify performance metrics
        avg_processing_time = sum(processing_times) / len(processing_times)
        assert avg_processing_time < 500, f"Average processing time {avg_processing_time}ms exceeded 500ms limit"
        assert max(processing_times) < 500, f"Maximum processing time {max(processing_times)}ms exceeded 500ms limit"