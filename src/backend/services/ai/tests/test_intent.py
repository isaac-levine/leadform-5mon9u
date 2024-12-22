"""
Unit tests for intent classification models and endpoints.
Verifies accuracy, performance, and reliability of message intent analysis.

Version: 1.0.0
"""

import json
import uuid
from datetime import datetime
from unittest.mock import patch, MagicMock
import pytest  # pytest v7.0.0
from fastapi.testclient import TestClient  # fastapi v0.100.0
from ..src.models.intent import Intent, IntentType
from ..src.api.endpoints.intent import router

class TestIntentFixtures:
    """Test fixtures and utilities for intent classification testing."""
    
    @pytest.fixture
    def test_client(self) -> TestClient:
        """Configure and return FastAPI test client."""
        client = TestClient(router)
        return client

    @pytest.fixture
    def mock_llm_service(self) -> MagicMock:
        """Create mock LLM service for testing."""
        mock_service = MagicMock()
        mock_service.classify_intent.return_value = Intent(
            type=IntentType.QUESTION,
            confidence=0.85,
            requires_human=False,
            metadata={"processing_time_ms": 150}
        )
        return mock_service

    @pytest.fixture
    def test_messages(self) -> list:
        """Generate test message scenarios."""
        return [
            {
                "content": "What are your business hours?",
                "expected_intent": IntentType.QUESTION,
                "expected_confidence": 0.85
            },
            {
                "content": "I need to speak with a human now!",
                "expected_intent": IntentType.REQUEST_HUMAN,
                "expected_confidence": 0.95
            },
            {
                "content": "This service is terrible!",
                "expected_intent": IntentType.COMPLAINT,
                "expected_confidence": 0.90
            },
            {
                "content": "Hello there",
                "expected_intent": IntentType.GREETING,
                "expected_confidence": 0.95
            },
            {
                "content": "Goodbye",
                "expected_intent": IntentType.FAREWELL,
                "expected_confidence": 0.95
            }
        ]

@pytest.mark.unit
def test_intent_type_enum():
    """Test intent type enumeration values and properties."""
    # Verify all expected intent types exist
    assert hasattr(IntentType, 'GREETING')
    assert hasattr(IntentType, 'QUESTION')
    assert hasattr(IntentType, 'COMPLAINT')
    assert hasattr(IntentType, 'REQUEST_HUMAN')
    assert hasattr(IntentType, 'FAREWELL')
    assert hasattr(IntentType, 'UNKNOWN')

    # Check enum string representations
    assert IntentType.GREETING.value == "greeting"
    assert IntentType.QUESTION.value == "question"
    assert IntentType.COMPLAINT.value == "complaint"
    assert IntentType.REQUEST_HUMAN.value == "request_human"
    assert IntentType.FAREWELL.value == "farewell"
    assert IntentType.UNKNOWN.value == "unknown"

    # Validate enum value uniqueness
    values = [intent.value for intent in IntentType]
    assert len(values) == len(set(values)), "Intent type values must be unique"

    # Test enum comparison
    assert IntentType.QUESTION == IntentType.QUESTION
    assert IntentType.GREETING != IntentType.FAREWELL

@pytest.mark.unit
def test_intent_model_validation():
    """Test intent model data validation and constraints."""
    # Test valid intent creation
    valid_intent = Intent(
        type=IntentType.QUESTION,
        confidence=0.85,
        requires_human=False,
        metadata={"processing_time_ms": 150}
    )
    assert valid_intent.type == IntentType.QUESTION
    assert valid_intent.confidence == 0.85
    assert not valid_intent.requires_human

    # Test confidence score bounds
    with pytest.raises(ValueError):
        Intent(type=IntentType.QUESTION, confidence=1.5)
    
    with pytest.raises(ValueError):
        Intent(type=IntentType.QUESTION, confidence=-0.1)

    # Test required fields
    with pytest.raises(ValueError):
        Intent(confidence=0.85)  # Missing type
    
    with pytest.raises(ValueError):
        Intent(type=IntentType.QUESTION)  # Missing confidence

    # Test metadata handling
    intent_with_metadata = Intent(
        type=IntentType.COMPLAINT,
        confidence=0.9,
        metadata={"sentiment": "negative", "urgency": "high"}
    )
    assert "sentiment" in intent_with_metadata.metadata
    assert "urgency" in intent_with_metadata.metadata

    # Test serialization
    intent_dict = valid_intent.to_dict()
    assert isinstance(intent_dict, dict)
    assert "type" in intent_dict
    assert "confidence" in intent_dict
    assert "requires_human" in intent_dict
    assert "metadata" in intent_dict

@pytest.mark.benchmark
def test_intent_classification_performance(benchmark, test_client, mock_llm_service):
    """Benchmark intent classification performance."""
    test_message = "What are your business hours?"
    
    def classify_message():
        with patch('src.services.llm_service.LLMService', return_value=mock_llm_service):
            response = test_client.post(
                "/api/v1/intent/classify",
                json={"message": test_message}
            )
            assert response.status_code == 200
            return response.json()

    # Run benchmark
    result = benchmark(classify_message)
    
    # Verify performance requirements
    assert benchmark.stats['mean'] < 0.5  # Less than 500ms
    assert benchmark.stats['max'] < 1.0  # Max under 1 second
    
    # Verify response structure
    assert "type" in result
    assert "confidence" in result
    assert "requires_human" in result
    assert "processing_time" in result

@pytest.mark.unit
def test_should_handoff_decision():
    """Test human handoff decision logic comprehensively."""
    # Test low confidence triggers handoff
    low_confidence_intent = Intent(
        type=IntentType.QUESTION,
        confidence=0.65,
        requires_human=False
    )
    assert low_confidence_intent.should_handoff()

    # Test explicit human request
    human_request_intent = Intent(
        type=IntentType.REQUEST_HUMAN,
        confidence=0.95,
        requires_human=True
    )
    assert human_request_intent.should_handoff()

    # Test high confidence prevents handoff
    high_confidence_intent = Intent(
        type=IntentType.GREETING,
        confidence=0.95,
        requires_human=False
    )
    assert not high_confidence_intent.should_handoff()

    # Test complaint with low confidence
    complaint_intent = Intent(
        type=IntentType.COMPLAINT,
        confidence=0.85,
        requires_human=False,
        metadata={"sentiment": "negative"}
    )
    assert complaint_intent.should_handoff()

    # Test threshold boundary conditions
    boundary_intent = Intent(
        type=IntentType.QUESTION,
        confidence=0.7,  # Exactly at threshold
        requires_human=False
    )
    assert not boundary_intent.should_handoff()

@pytest.mark.integration
async def test_intent_classification_endpoint(test_client, mock_llm_service):
    """Test intent classification API endpoint functionality."""
    # Test successful classification
    with patch('src.services.llm_service.LLMService', return_value=mock_llm_service):
        response = test_client.post(
            "/api/v1/intent/classify",
            json={
                "message": "What are your business hours?",
                "metadata": {"source": "test"}
            }
        )
        
        assert response.status_code == 200
        data = response.json()
        assert "type" in data
        assert "confidence" in data
        assert "requires_human" in data
        assert "processing_time" in data
        assert data["processing_time"] < 0.5  # Verify 500ms requirement

    # Test invalid input
    response = test_client.post(
        "/api/v1/intent/classify",
        json={"message": ""}  # Empty message
    )
    assert response.status_code == 422

    # Test rate limiting
    responses = []
    for _ in range(10):
        responses.append(
            test_client.post(
                "/api/v1/intent/classify",
                json={"message": "Test message"}
            )
        )
    
    # Verify rate limiting behavior
    assert any(r.status_code == 429 for r in responses)

    # Test concurrent requests
    import asyncio
    async def make_request():
        return test_client.post(
            "/api/v1/intent/classify",
            json={"message": "Test message"}
        )
    
    concurrent_responses = await asyncio.gather(
        *[make_request() for _ in range(5)]
    )
    assert all(r.status_code in [200, 429] for r in concurrent_responses)