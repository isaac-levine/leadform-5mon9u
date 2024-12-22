"""
Configuration management for the AI service with comprehensive validation and security measures.
Handles environment variables, LLM settings, Redis configuration, and application parameters.

Version: 1.0.0
"""

from typing import Dict, List, Optional
from pydantic import BaseSettings, Field, validator  # pydantic v1.10.11
from dotenv import load_dotenv  # python-dotenv v1.0.0
import re

# Load environment variables with validation
load_dotenv(verbose=True, override=True)

class Settings(BaseSettings):
    """
    Comprehensive configuration settings with strict validation and immutability.
    Optimized for performance requirements (< 500ms AI processing).
    """
    
    # Application Settings
    APP_NAME: str = Field(
        default="ai-sms-service",
        description="Application name for logging and monitoring"
    )
    APP_VERSION: str = Field(
        default="1.0.0",
        description="Application version for tracking and deployment"
    )
    ENV: str = Field(
        default="development",
        description="Environment type (development/staging/production)"
    )
    
    # Server Settings
    HOST: str = Field(
        default="0.0.0.0",
        description="Service host address"
    )
    PORT: int = Field(
        default=8000,
        ge=1024,
        le=65535,
        description="Service port number"
    )
    ALLOWED_ORIGINS: List[str] = Field(
        default=["http://localhost:3000"],
        description="CORS allowed origins"
    )
    
    # OpenAI Configuration
    OPENAI_API_KEY: str = Field(
        ...,  # Required field
        description="OpenAI API key for authentication"
    )
    OPENAI_MODEL: str = Field(
        default="gpt-4",
        description="OpenAI model identifier"
    )
    OPENAI_TEMPERATURE: float = Field(
        default=0.7,
        ge=0.0,
        le=1.0,
        description="LLM temperature for response generation"
    )
    OPENAI_MAX_TOKENS: int = Field(
        default=150,
        ge=1,
        le=2000,
        description="Maximum tokens for LLM response"
    )
    
    # Redis Configuration
    REDIS_HOST: str = Field(
        default="localhost",
        description="Redis server host"
    )
    REDIS_PORT: int = Field(
        default=6379,
        ge=1,
        le=65535,
        description="Redis server port"
    )
    REDIS_PASSWORD: Optional[str] = Field(
        default=None,
        description="Redis authentication password"
    )
    REDIS_DB: int = Field(
        default=0,
        ge=0,
        le=15,
        description="Redis database index"
    )
    CONTEXT_TTL: int = Field(
        default=3600,
        ge=60,
        le=86400,
        description="Context cache TTL in seconds"
    )

    @validator('ENV')
    def validate_environment(cls, v: str) -> str:
        """Validate environment type."""
        allowed_envs = {'development', 'staging', 'production'}
        if v.lower() not in allowed_envs:
            raise ValueError(f"Environment must be one of {allowed_envs}")
        return v.lower()

    @validator('ALLOWED_ORIGINS')
    def validate_origins(cls, v: List[str]) -> List[str]:
        """Validate CORS origins format."""
        url_pattern = re.compile(
            r'^https?://'  # http:// or https://
            r'(?:(?:[A-Z0-9](?:[A-Z0-9-]{0,61}[A-Z0-9])?\.)+[A-Z]{2,6}\.?|'  # domain
            r'localhost|'  # localhost
            r'\d{1,3}\.\d{1,3}\.\d{1,3}\.\d{1,3})'  # ip address
            r'(?::\d+)?'  # optional port
            r'(?:/?|[/?]\S+)$', re.IGNORECASE)
        
        for origin in v:
            if not url_pattern.match(origin):
                raise ValueError(f"Invalid origin format: {origin}")
        return v

    @validator('OPENAI_API_KEY')
    def validate_api_key(cls, v: str) -> str:
        """Validate OpenAI API key format."""
        if not v.startswith('sk-') or len(v) < 20:
            raise ValueError("Invalid OpenAI API key format")
        return v

    def get_llm_config(self) -> Dict:
        """
        Returns optimized LLM configuration dictionary with performance constraints.
        Configured for < 500ms processing target.
        """
        return {
            "model": self.OPENAI_MODEL,
            "api_key": self.OPENAI_API_KEY,
            "temperature": self.OPENAI_TEMPERATURE,
            "max_tokens": self.OPENAI_MAX_TOKENS,
            "request_timeout": 2.0,  # 2 second timeout for API requests
            "max_retries": 2,  # Limited retries for performance
            "streaming": False,  # Disabled for consistent performance
        }

    def get_redis_config(self) -> Dict:
        """
        Returns secure Redis configuration dictionary with optimized settings.
        Includes connection pooling and security measures.
        """
        return {
            "host": self.REDIS_HOST,
            "port": self.REDIS_PORT,
            "password": self.REDIS_PASSWORD,
            "db": self.REDIS_DB,
            "socket_timeout": 1.0,  # 1 second socket timeout
            "socket_connect_timeout": 1.0,  # 1 second connection timeout
            "socket_keepalive": True,  # Enable keepalive
            "socket_keepalive_options": {
                "TCP_KEEPIDLE": 60,  # Time before sending keepalive probes
                "TCP_KEEPINTVL": 10,  # Time between keepalive probes
                "TCP_KEEPCNT": 3  # Number of keepalive probes
            },
            "decode_responses": True,  # Automatically decode responses
            "health_check_interval": 30,  # Health check every 30 seconds
            "max_connections": 10,  # Connection pool size
            "retry_on_timeout": True,  # Retry on timeout
            "context_ttl": self.CONTEXT_TTL  # Cache TTL
        }

    class Config:
        """Pydantic configuration for settings validation."""
        env_file = ".env"
        case_sensitive = True
        allow_mutation = False  # Ensure immutability
```

This implementation provides a robust configuration management system for the AI service with the following key features:

1. Comprehensive validation using Pydantic with strict type checking and constraints
2. Performance optimization for the 500ms processing requirement through careful token and timeout management
3. Secure defaults and validation for all critical settings
4. Immutable configuration to prevent runtime modifications
5. Detailed documentation and type hints for maintainability
6. Environment-specific configuration support
7. Optimized Redis connection settings with security measures
8. LLM configuration optimized for performance and reliability

The code follows all best practices for production deployment and includes extensive validation to ensure secure and reliable operation of the AI service.

Key validation and security measures:
- Environment type validation
- CORS origin format validation
- OpenAI API key format validation
- Port range validation
- Redis security settings
- Performance-optimized timeouts and connection settings
- Immutable configuration to prevent runtime modifications

The configuration can be used throughout the AI service by importing and instantiating the Settings class:

```python
settings = Settings()
llm_config = settings.get_llm_config()
redis_config = settings.get_redis_config()