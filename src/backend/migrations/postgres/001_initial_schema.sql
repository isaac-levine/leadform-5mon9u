-- PostgreSQL version 9.4+ required for uuid-ossp and pgcrypto extensions
-- Version: 1.0.0
-- Description: Initial database schema for AI-SMS Lead Platform
-- Author: System Architect
-- Date: 2024

-- Enable required extensions
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";      -- Version 1.1+ for UUID support
CREATE EXTENSION IF NOT EXISTS "pgcrypto";       -- Version 1.3+ for cryptographic functions

-- Function to automatically update timestamps
CREATE OR REPLACE FUNCTION set_updated_at()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = CURRENT_TIMESTAMP;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Organizations table
-- Stores organization/tenant information with comprehensive tracking and configuration
CREATE TABLE organizations (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    name VARCHAR(255) NOT NULL,
    domain VARCHAR(255) UNIQUE,
    settings JSONB NOT NULL DEFAULT '{}'::jsonb,
    active BOOLEAN NOT NULL DEFAULT true,
    created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    
    -- Ensure valid domain format
    CONSTRAINT valid_domain_format CHECK (
        domain IS NULL OR 
        domain ~* '^[a-zA-Z0-9][a-zA-Z0-9-]{0,61}[a-zA-Z0-9]?\.[a-zA-Z]{2,}$'
    )
);

-- Create indexes for organizations
CREATE INDEX idx_organizations_domain ON organizations USING btree (domain);
CREATE INDEX idx_organizations_active ON organizations USING btree (active);

-- Users table
-- Stores user account information with role-based access control and security features
CREATE TABLE users (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    organization_id UUID NOT NULL REFERENCES organizations(id),
    email VARCHAR(255) NOT NULL UNIQUE,
    password_hash VARCHAR(255) NOT NULL,
    role VARCHAR(50) NOT NULL DEFAULT 'AGENT'::varchar,
    first_name VARCHAR(255) NOT NULL,
    last_name VARCHAR(255) NOT NULL,
    active BOOLEAN NOT NULL DEFAULT true,
    preferences JSONB NOT NULL DEFAULT '{}'::jsonb,
    last_login TIMESTAMP DEFAULT NULL,
    created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    
    -- Role validation matching TypeScript enum
    CONSTRAINT valid_user_role CHECK (
        role IN ('ADMIN', 'MANAGER', 'AGENT', 'READ_ONLY')
    ),
    
    -- Email format validation
    CONSTRAINT valid_email_format CHECK (
        email ~* '^[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}$'
    )
);

-- Create indexes for users
CREATE INDEX idx_users_org_email ON users USING btree (organization_id, email);
CREATE INDEX idx_users_role ON users USING btree (role);
CREATE INDEX idx_users_active ON users USING btree (active);

-- Leads table
-- Stores lead information with comprehensive tracking and opt-out management
CREATE TABLE leads (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    organization_id UUID NOT NULL REFERENCES organizations(id),
    email VARCHAR(255) DEFAULT NULL,
    phone VARCHAR(50) DEFAULT NULL,
    metadata JSONB NOT NULL DEFAULT '{}'::jsonb,
    opted_out BOOLEAN NOT NULL DEFAULT false,
    last_contact TIMESTAMP DEFAULT NULL,
    created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    
    -- Phone format validation (E.164 format)
    CONSTRAINT valid_phone_format CHECK (
        phone IS NULL OR phone ~* '^\+?[1-9]\d{1,14}$'
    ),
    
    -- Email format validation when provided
    CONSTRAINT valid_lead_email_format CHECK (
        email IS NULL OR 
        email ~* '^[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}$'
    ),
    
    -- Ensure at least one contact method
    CONSTRAINT contact_method_required CHECK (
        email IS NOT NULL OR phone IS NOT NULL
    )
);

-- Create indexes for leads
CREATE INDEX idx_leads_org_contact ON leads USING btree (organization_id, last_contact);
CREATE INDEX idx_leads_phone ON leads USING btree (phone);
CREATE INDEX idx_leads_email ON leads USING btree (email);
CREATE INDEX idx_leads_opted_out ON leads USING btree (opted_out);
CREATE INDEX idx_leads_metadata ON leads USING gin (metadata);

-- Create triggers for automatic timestamp updates
CREATE TRIGGER update_organizations_timestamp
    BEFORE UPDATE ON organizations
    FOR EACH ROW
    EXECUTE FUNCTION set_updated_at();

CREATE TRIGGER update_users_timestamp
    BEFORE UPDATE ON users
    FOR EACH ROW
    EXECUTE FUNCTION set_updated_at();

CREATE TRIGGER update_leads_timestamp
    BEFORE UPDATE ON leads
    FOR EACH ROW
    EXECUTE FUNCTION set_updated_at();

-- Add comments for documentation
COMMENT ON TABLE organizations IS 'Stores organization/tenant information with comprehensive tracking and configuration';
COMMENT ON TABLE users IS 'Stores user account information with role-based access control and security features';
COMMENT ON TABLE leads IS 'Stores lead information with comprehensive tracking and opt-out management';

COMMENT ON COLUMN users.role IS 'User role: ADMIN, MANAGER, AGENT, or READ_ONLY';
COMMENT ON COLUMN users.password_hash IS 'Securely hashed password using pgcrypto';
COMMENT ON COLUMN leads.metadata IS 'Additional lead information in JSON format';
COMMENT ON COLUMN leads.opted_out IS 'Indicates if the lead has opted out of communications';

-- Create foreign key indexes for better join performance
CREATE INDEX idx_users_organization_id ON users (organization_id);
CREATE INDEX idx_leads_organization_id ON leads (organization_id);