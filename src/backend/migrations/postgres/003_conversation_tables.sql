-- Migration file for SMS conversation and message tables
-- Version: 1.0.0
-- Description: Creates tables and relationships for SMS conversations and messages
--              with support for AI-powered routing and human oversight

-- Ensure we're using a transaction for atomic updates
BEGIN;

-- Enable UUID extension if not already enabled
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- Create function to update last_activity timestamp for conversations
CREATE OR REPLACE FUNCTION update_conversation_activity()
RETURNS TRIGGER AS $$
BEGIN
    UPDATE conversations 
    SET last_activity = CURRENT_TIMESTAMP 
    WHERE id = NEW.conversation_id;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Create conversations table
CREATE TABLE conversations (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    organization_id UUID NOT NULL REFERENCES organizations(id),
    lead_id UUID NOT NULL REFERENCES leads(id),
    assigned_agent UUID REFERENCES users(id) DEFAULT NULL,
    status VARCHAR(50) NOT NULL DEFAULT 'ACTIVE',
    phone_number VARCHAR(50) NOT NULL,
    last_activity TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    metadata JSONB NOT NULL DEFAULT '{}'::jsonb,
    created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    
    -- Add constraint to validate conversation status
    CONSTRAINT valid_conversation_status CHECK (
        status IN ('ACTIVE', 'PAUSED', 'CLOSED', 'HUMAN_TAKEOVER')
    ),
    
    -- Add constraint to validate phone number format
    CONSTRAINT valid_phone_number CHECK (
        phone_number ~* '^\+?[1-9]\d{1,14}$'
    )
);

-- Create messages table
CREATE TABLE messages (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    conversation_id UUID NOT NULL REFERENCES conversations(id),
    content TEXT NOT NULL,
    direction VARCHAR(50) NOT NULL,
    status VARCHAR(50) NOT NULL DEFAULT 'QUEUED',
    provider VARCHAR(50) NOT NULL,
    provider_message_id VARCHAR(255) DEFAULT NULL,
    ai_confidence FLOAT DEFAULT NULL,
    metadata JSONB NOT NULL DEFAULT '{}'::jsonb,
    sent_at TIMESTAMP DEFAULT NULL,
    delivered_at TIMESTAMP DEFAULT NULL,
    created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    
    -- Add constraints for message properties
    CONSTRAINT valid_message_direction CHECK (
        direction IN ('INBOUND', 'OUTBOUND')
    ),
    CONSTRAINT valid_message_status CHECK (
        status IN ('QUEUED', 'SENT', 'DELIVERED', 'FAILED')
    ),
    CONSTRAINT valid_message_provider CHECK (
        provider IN ('TWILIO', 'MESSAGEBIRD')
    )
);

-- Create indexes for conversations table
CREATE INDEX idx_conversations_org ON conversations(organization_id);
CREATE INDEX idx_conversations_lead ON conversations(lead_id);
CREATE INDEX idx_conversations_agent ON conversations(assigned_agent);
CREATE INDEX idx_conversations_status ON conversations(status);
CREATE INDEX idx_conversations_phone ON conversations(phone_number);
CREATE INDEX idx_conversations_activity ON conversations(last_activity);

-- Create indexes for messages table
CREATE INDEX idx_messages_conversation ON messages(conversation_id);
CREATE INDEX idx_messages_direction ON messages(direction);
CREATE INDEX idx_messages_status ON messages(status);
CREATE INDEX idx_messages_provider ON messages(provider, provider_message_id);
CREATE INDEX idx_messages_confidence ON messages(ai_confidence);

-- Create trigger for updating conversations timestamp
CREATE TRIGGER update_conversations_timestamp
    BEFORE UPDATE ON conversations
    FOR EACH ROW
    EXECUTE FUNCTION set_updated_at();

-- Create trigger for updating messages timestamp
CREATE TRIGGER update_messages_timestamp
    BEFORE UPDATE ON messages
    FOR EACH ROW
    EXECUTE FUNCTION set_updated_at();

-- Create trigger for updating conversation last_activity
CREATE TRIGGER update_conversation_last_activity
    AFTER INSERT ON messages
    FOR EACH ROW
    EXECUTE FUNCTION update_conversation_activity();

-- Add comments for documentation
COMMENT ON TABLE conversations IS 'Stores SMS conversation threads between leads and the system with support for AI routing and human oversight';
COMMENT ON TABLE messages IS 'Stores individual SMS messages with AI confidence tracking and delivery status';

COMMENT ON COLUMN conversations.status IS 'Current status of the conversation (ACTIVE, PAUSED, CLOSED, HUMAN_TAKEOVER)';
COMMENT ON COLUMN conversations.metadata IS 'Additional conversation metadata stored as JSON';
COMMENT ON COLUMN messages.direction IS 'Direction of message (INBOUND from lead, OUTBOUND to lead)';
COMMENT ON COLUMN messages.ai_confidence IS 'AI confidence score for automated responses (0.0 to 1.0)';
COMMENT ON COLUMN messages.provider IS 'SMS provider used for message delivery (TWILIO, MESSAGEBIRD)';

-- Commit the transaction
COMMIT;