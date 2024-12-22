"""
Enhanced Redis-based context management service for AI conversation processing.
Implements efficient storage, compression, and retrieval with comprehensive monitoring.

Version: 1.0.0
"""

import json
import zlib
import asyncio
from typing import Dict, Any, Optional
from uuid import UUID
from datetime import datetime
from redis import Redis  # redis v4.5.0
from redis.connection import ConnectionPool
from redis.exceptions import RedisError
from prometheus_client import Counter, Histogram  # prometheus-client v0.16.0

from ..config import Settings
from ..models.conversation import Conversation

# Monitoring metrics
CONTEXT_RETRIEVAL_TIME = Histogram(
    'context_retrieval_seconds',
    'Time spent retrieving context',
    buckets=[.005, .01, .025, .05, .075, .1, .25, .5]
)
CONTEXT_UPDATE_TIME = Histogram(
    'context_update_seconds',
    'Time spent updating context'
)
COMPRESSION_RATIO = Histogram(
    'context_compression_ratio',
    'Compression ratio for context data'
)
CONTEXT_SIZE = Histogram(
    'context_size_bytes',
    'Size of context data in bytes'
)
ERROR_COUNTER = Counter(
    'context_errors_total',
    'Total number of context operation errors'
)

class ContextService:
    """
    Enhanced service for managing conversation context with Redis.
    Implements compression, connection pooling, and comprehensive monitoring.
    """

    def __init__(self, settings: Settings):
        """
        Initialize context service with optimized Redis connection and monitoring.
        
        Args:
            settings: Application configuration settings
        """
        redis_config = settings.get_redis_config()
        
        # Initialize connection pool for better performance
        self.connection_pool = ConnectionPool(
            host=redis_config['host'],
            port=redis_config['port'],
            password=redis_config['password'],
            db=redis_config['db'],
            max_connections=redis_config['max_connections'],
            socket_timeout=redis_config['socket_timeout'],
            socket_keepalive=redis_config['socket_keepalive'],
            socket_keepalive_options=redis_config['socket_keepalive_options'],
            health_check_interval=redis_config['health_check_interval']
        )
        
        # Initialize Redis client with connection pool
        self.redis_client = Redis(
            connection_pool=self.connection_pool,
            decode_responses=True,
            retry_on_timeout=True
        )
        
        # Service configuration
        self.context_ttl = redis_config['context_ttl']
        self.compression_threshold = 1024  # Compress data larger than 1KB
        self.version = "1.0"  # Context version for compatibility
        
        # Initialize circuit breaker state
        self.circuit_breaker = {
            'failures': 0,
            'last_failure': None,
            'threshold': 3,
            'reset_timeout': 30
        }

    async def get_conversation_context(self, conversation_id: UUID) -> Dict[str, Any]:
        """
        Retrieve and decompress conversation context from Redis.
        
        Args:
            conversation_id: Unique identifier of the conversation
            
        Returns:
            Dict containing conversation context and metadata
            
        Raises:
            RedisError: If Redis operation fails
            ValueError: If context data is invalid
        """
        key = f"context:{self.version}:{conversation_id}"
        
        try:
            with CONTEXT_RETRIEVAL_TIME.time():
                # Check circuit breaker
                if self._is_circuit_open():
                    raise RedisError("Circuit breaker is open")
                
                # Retrieve context from Redis
                raw_data = await asyncio.to_thread(
                    self.redis_client.get,
                    key
                )
                
                if not raw_data:
                    return {
                        'messages': [],
                        'metadata': {},
                        'created_at': datetime.utcnow().isoformat()
                    }
                
                # Handle compression if needed
                try:
                    if raw_data.startswith('compressed:'):
                        compressed_data = raw_data[10:]  # Remove prefix
                        context_data = zlib.decompress(compressed_data.encode())
                        context = json.loads(context_data)
                    else:
                        context = json.loads(raw_data)
                except (json.JSONDecodeError, zlib.error) as e:
                    ERROR_COUNTER.inc()
                    raise ValueError(f"Invalid context data: {str(e)}")
                
                # Update metrics
                CONTEXT_SIZE.observe(len(raw_data))
                
                return context
                
        except RedisError as e:
            ERROR_COUNTER.inc()
            self._record_failure()
            raise RedisError(f"Failed to retrieve context: {str(e)}")

    async def update_context(self, conversation_id: UUID, context: Dict[str, Any]) -> bool:
        """
        Update and compress conversation context in Redis.
        
        Args:
            conversation_id: Unique identifier of the conversation
            context: Updated context data
            
        Returns:
            bool indicating success of operation
            
        Raises:
            RedisError: If Redis operation fails
            ValueError: If context data is invalid
        """
        key = f"context:{self.version}:{conversation_id}"
        
        try:
            with CONTEXT_UPDATE_TIME.time():
                # Validate context structure
                if not isinstance(context, dict):
                    raise ValueError("Context must be a dictionary")
                
                # Add metadata
                context['updated_at'] = datetime.utcnow().isoformat()
                context['version'] = self.version
                
                # Serialize context
                context_data = json.dumps(context)
                data_size = len(context_data)
                
                # Apply compression if needed
                if data_size > self.compression_threshold:
                    compressed_data = zlib.compress(context_data.encode())
                    compression_ratio = len(compressed_data) / data_size
                    COMPRESSION_RATIO.observe(compression_ratio)
                    
                    if compression_ratio < 0.9:  # Only use compression if beneficial
                        context_data = f"compressed:{compressed_data.decode()}"
                
                # Store in Redis with TTL
                success = await asyncio.to_thread(
                    self.redis_client.setex,
                    key,
                    self.context_ttl,
                    context_data
                )
                
                # Update metrics
                CONTEXT_SIZE.observe(data_size)
                
                return bool(success)
                
        except RedisError as e:
            ERROR_COUNTER.inc()
            self._record_failure()
            raise RedisError(f"Failed to update context: {str(e)}")

    async def clear_context(self, conversation_id: UUID) -> bool:
        """
        Remove conversation context from Redis.
        
        Args:
            conversation_id: Unique identifier of the conversation
            
        Returns:
            bool indicating success of operation
            
        Raises:
            RedisError: If Redis operation fails
        """
        key = f"context:{self.version}:{conversation_id}"
        
        try:
            success = await asyncio.to_thread(
                self.redis_client.delete,
                key
            )
            return bool(success)
            
        except RedisError as e:
            ERROR_COUNTER.inc()
            self._record_failure()
            raise RedisError(f"Failed to clear context: {str(e)}")

    def build_context(self, conversation: Conversation) -> Dict[str, Any]:
        """
        Build optimized context object from conversation history.
        
        Args:
            conversation: Conversation object containing message history
            
        Returns:
            Dict containing optimized context for AI processing
        """
        # Extract relevant conversation data
        context = {
            'messages': [
                {
                    'content': msg.content,
                    'direction': msg.direction.value,
                    'created_at': msg.created_at.isoformat(),
                    'ai_confidence': msg.ai_confidence
                }
                for msg in conversation.messages[-10:]  # Keep last 10 messages for context
            ],
            'metadata': {
                'lead_id': str(conversation.lead_id),
                'status': conversation.status.value,
                'ai_confidence_avg': conversation.ai_confidence_avg,
                'message_count': len(conversation.messages)
            },
            'created_at': datetime.utcnow().isoformat()
        }
        
        # Add current intent if available
        if conversation.current_intent:
            context['metadata']['current_intent'] = {
                'type': conversation.current_intent.type.value,
                'confidence': conversation.current_intent.confidence
            }
        
        return context

    def _is_circuit_open(self) -> bool:
        """Check if circuit breaker is open."""
        if (
            self.circuit_breaker['failures'] >= self.circuit_breaker['threshold']
            and self.circuit_breaker['last_failure']
        ):
            # Check if enough time has passed to reset
            elapsed = (datetime.utcnow() - self.circuit_breaker['last_failure']).seconds
            if elapsed < self.circuit_breaker['reset_timeout']:
                return True
            
            # Reset circuit breaker
            self.circuit_breaker['failures'] = 0
            self.circuit_breaker['last_failure'] = None
            
        return False

    def _record_failure(self) -> None:
        """Record a failure for circuit breaker."""
        self.circuit_breaker['failures'] += 1
        self.circuit_breaker['last_failure'] = datetime.utcnow()