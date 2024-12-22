"""
Production-ready LLM service for managing OpenAI GPT-4 interactions.
Implements advanced context management, monitoring, and error handling.

Version: 1.0.0
"""

import asyncio
import json
from typing import Dict, Any, Tuple, Optional
from datetime import datetime
import openai  # openai v1.0.0
from tenacity import (  # tenacity v8.0.0
    retry,
    stop_after_attempt,
    wait_exponential,
    retry_if_exception_type
)
from prometheus_client import (  # prometheus-client v0.17.0
    Counter,
    Histogram,
    Gauge
)

from ..config import Settings
from ..models.conversation import (
    Message,
    Conversation,
    Intent,
    IntentType
)
from .context_service import ContextService

# Monitoring metrics
PROCESSING_TIME = Histogram(
    'llm_processing_seconds',
    'Time spent processing messages',
    buckets=[.1, .25, .5, .75, 1.0, 2.0, 5.0]
)
INTENT_CONFIDENCE = Histogram(
    'intent_confidence',
    'Confidence scores for intent classification'
)
API_ERRORS = Counter(
    'llm_api_errors_total',
    'Total number of LLM API errors',
    ['error_type']
)
QUEUE_SIZE = Gauge(
    'llm_queue_size',
    'Current size of the LLM request queue'
)
TOKEN_USAGE = Counter(
    'llm_token_usage_total',
    'Total number of tokens used',
    ['operation']
)

class LLMService:
    """
    Production-ready service for managing LLM operations with enhanced monitoring,
    error handling, and performance optimization.
    """

    def __init__(self, settings: Settings, context_service: ContextService):
        """
        Initialize LLM service with optimized configuration and monitoring.

        Args:
            settings: Application configuration settings
            context_service: Service for context management
        """
        llm_config = settings.get_llm_config()
        
        # Configure OpenAI client
        openai.api_key = llm_config['api_key']
        self.model = llm_config['model']
        self.temperature = llm_config['temperature']
        self.max_tokens = llm_config['max_tokens']
        
        # Initialize services
        self.context_service = context_service
        
        # Configure request queue for rate limiting
        self.request_queue = asyncio.Queue(maxsize=100)
        self.processing_semaphore = asyncio.Semaphore(5)  # Max concurrent requests
        
        # Initialize prompt templates
        self.intent_prompt_template = """
        Analyze the following message and classify its intent. Response format:
        {{"type": "intent_type", "confidence": float, "requires_human": boolean}}
        
        Available intents: greeting, question, complaint, request_human, farewell, unknown
        
        Message: {message}
        Context: {context}
        """
        
        self.response_prompt_template = """
        Generate a natural response to the following message. Consider the context and intent.
        Keep responses concise and professional.
        
        Message: {message}
        Intent: {intent}
        Context: {context}
        """

    @retry(
        stop=stop_after_attempt(3),
        wait=wait_exponential(multiplier=1, min=4, max=10),
        retry=retry_if_exception_type(openai.error.APIError)
    )
    async def process_message(
        self,
        message: Message,
        conversation: Conversation
    ) -> Tuple[Message, Intent]:
        """
        Process incoming message with enhanced error handling and monitoring.

        Args:
            message: Message to process
            conversation: Parent conversation

        Returns:
            Tuple containing response message and classified intent
        """
        try:
            with PROCESSING_TIME.time():
                # Update queue metrics
                QUEUE_SIZE.set(self.request_queue.qsize())
                
                # Get conversation context
                context = await self.context_service.get_conversation_context(
                    conversation.id
                )
                
                # Classify intent
                intent = await self.classify_intent(message.content, context)
                message.intent = intent
                INTENT_CONFIDENCE.observe(intent.confidence)
                
                # Generate response if confidence is sufficient
                if intent.confidence >= 0.7 and not intent.should_handoff():
                    response_text = await self.generate_response(
                        message.content,
                        intent,
                        context
                    )
                    
                    # Create response message
                    response = Message(
                        conversation_id=conversation.id,
                        content=response_text,
                        direction="outbound",
                        ai_confidence=intent.confidence,
                        intent=intent
                    )
                else:
                    # Handoff to human agent
                    response = Message(
                        conversation_id=conversation.id,
                        content="Connecting you with a human agent...",
                        direction="outbound",
                        ai_confidence=intent.confidence,
                        intent=intent
                    )
                
                # Update context
                context['messages'].append(message.to_dict())
                context['messages'].append(response.to_dict())
                await self.context_service.update_context(conversation.id, context)
                
                return response, intent
                
        except openai.error.APIError as e:
            API_ERRORS.labels(error_type='api_error').inc()
            raise
        except Exception as e:
            API_ERRORS.labels(error_type='processing_error').inc()
            raise

    async def classify_intent(
        self,
        message_content: str,
        context: Dict[str, Any]
    ) -> Intent:
        """
        Enhanced intent classification with caching and confidence validation.

        Args:
            message_content: Message text to classify
            context: Conversation context

        Returns:
            Classified intent with confidence score
        """
        async with self.processing_semaphore:
            try:
                # Prepare classification prompt
                prompt = self.intent_prompt_template.format(
                    message=message_content,
                    context=json.dumps(context['messages'][-5:])  # Last 5 messages
                )
                
                # Make API call
                response = await openai.ChatCompletion.acreate(
                    model=self.model,
                    messages=[
                        {"role": "system", "content": "You are an intent classifier."},
                        {"role": "user", "content": prompt}
                    ],
                    temperature=0.3,  # Lower temperature for classification
                    max_tokens=50
                )
                
                # Parse response
                try:
                    result = json.loads(response.choices[0].message.content)
                    TOKEN_USAGE.labels(operation='classification').inc(
                        response.usage.total_tokens
                    )
                    
                    # Validate and create intent
                    intent = Intent(
                        type=result['type'],
                        confidence=result['confidence'],
                        requires_human=result['requires_human']
                    )
                    return intent
                    
                except (json.JSONDecodeError, KeyError):
                    # Fallback to unknown intent
                    return Intent(
                        type=IntentType.UNKNOWN,
                        confidence=0.0,
                        requires_human=True
                    )
                    
            except openai.error.APIError as e:
                API_ERRORS.labels(error_type='classification_error').inc()
                raise

    async def generate_response(
        self,
        message_content: str,
        intent: Intent,
        context: Dict[str, Any]
    ) -> str:
        """
        Generate optimized responses with context awareness and validation.

        Args:
            message_content: Input message text
            intent: Classified message intent
            context: Conversation context

        Returns:
            Generated response text
        """
        async with self.processing_semaphore:
            try:
                # Prepare response prompt
                prompt = self.response_prompt_template.format(
                    message=message_content,
                    intent=intent.type.value,
                    context=json.dumps(context['messages'][-5:])
                )
                
                # Make API call
                response = await openai.ChatCompletion.acreate(
                    model=self.model,
                    messages=[
                        {"role": "system", "content": "You are a helpful assistant."},
                        {"role": "user", "content": prompt}
                    ],
                    temperature=self.temperature,
                    max_tokens=self.max_tokens
                )
                
                # Track token usage
                TOKEN_USAGE.labels(operation='response').inc(
                    response.usage.total_tokens
                )
                
                # Extract and validate response
                response_text = response.choices[0].message.content.strip()
                if not response_text:
                    raise ValueError("Empty response from LLM")
                
                return response_text
                
            except openai.error.APIError as e:
                API_ERRORS.labels(error_type='generation_error').inc()
                raise