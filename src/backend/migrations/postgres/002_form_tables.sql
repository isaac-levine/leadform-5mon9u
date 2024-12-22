-- Migration file for form management tables
-- Dependencies: 001_initial_schema.sql (organizations and leads tables)
-- Version: 1.0.0

-- Ensure we're using the uuid-ossp extension
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- Create function for updating timestamps if not exists
CREATE OR REPLACE FUNCTION set_updated_at()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = CURRENT_TIMESTAMP;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Forms table for storing form templates and configurations
CREATE TABLE forms (
    id uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
    organization_id uuid NOT NULL REFERENCES organizations(id),
    name varchar(255) NOT NULL,
    description text DEFAULT NULL,
    styling jsonb NOT NULL DEFAULT '{}'::jsonb,
    settings jsonb NOT NULL DEFAULT '{}'::jsonb,
    active boolean NOT NULL DEFAULT true,
    created_at timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- Create indexes for forms table
CREATE INDEX idx_forms_org ON forms(organization_id);
CREATE INDEX idx_forms_active ON forms(active);

-- Form fields table for storing field configurations
CREATE TABLE form_fields (
    id uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
    form_id uuid NOT NULL REFERENCES forms(id) ON DELETE CASCADE,
    label varchar(255) NOT NULL,
    type varchar(50) NOT NULL,
    placeholder varchar(255) DEFAULT NULL,
    default_value text DEFAULT NULL,
    validation jsonb NOT NULL DEFAULT '[]'::jsonb,
    required boolean NOT NULL DEFAULT false,
    options jsonb NOT NULL DEFAULT '{}'::jsonb,
    "order" integer NOT NULL DEFAULT 0,
    created_at timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT valid_field_type CHECK (
        type IN ('TEXT', 'EMAIL', 'PHONE', 'NUMBER', 'DATE', 'SELECT', 'CHECKBOX', 'RADIO', 'FILE')
    )
);

-- Create indexes for form_fields table
CREATE INDEX idx_form_fields_form ON form_fields(form_id);
CREATE INDEX idx_form_fields_type ON form_fields(type);
CREATE INDEX idx_form_fields_order ON form_fields(form_id, "order");

-- Form submissions table for storing submission data
CREATE TABLE form_submissions (
    id uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
    form_id uuid NOT NULL REFERENCES forms(id),
    lead_id uuid NOT NULL REFERENCES leads(id),
    data jsonb NOT NULL DEFAULT '{}'::jsonb,
    source varchar(255) DEFAULT NULL,
    metadata jsonb NOT NULL DEFAULT '{}'::jsonb,
    created_at timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- Create indexes for form_submissions table
CREATE INDEX idx_form_submissions_form ON form_submissions(form_id);
CREATE INDEX idx_form_submissions_lead ON form_submissions(lead_id);
CREATE INDEX idx_form_submissions_source ON form_submissions(source);

-- Create GIN indexes for JSONB columns to enable efficient searching
CREATE INDEX idx_forms_settings_gin ON forms USING gin (settings jsonb_path_ops);
CREATE INDEX idx_forms_styling_gin ON forms USING gin (styling jsonb_path_ops);
CREATE INDEX idx_form_fields_validation_gin ON form_fields USING gin (validation jsonb_path_ops);
CREATE INDEX idx_form_fields_options_gin ON form_fields USING gin (options jsonb_path_ops);
CREATE INDEX idx_form_submissions_data_gin ON form_submissions USING gin (data jsonb_path_ops);
CREATE INDEX idx_form_submissions_metadata_gin ON form_submissions USING gin (metadata jsonb_path_ops);

-- Create triggers for updating timestamps
CREATE TRIGGER update_forms_timestamp
    BEFORE UPDATE ON forms
    FOR EACH ROW
    EXECUTE FUNCTION set_updated_at();

CREATE TRIGGER update_form_fields_timestamp
    BEFORE UPDATE ON form_fields
    FOR EACH ROW
    EXECUTE FUNCTION set_updated_at();

CREATE TRIGGER update_form_submissions_timestamp
    BEFORE UPDATE ON form_submissions
    FOR EACH ROW
    EXECUTE FUNCTION set_updated_at();

-- Add comments for documentation
COMMENT ON TABLE forms IS 'Stores form templates and configurations with flexible JSONB storage for styling and settings';
COMMENT ON TABLE form_fields IS 'Stores individual form field configurations with validation rules and display options';
COMMENT ON TABLE form_submissions IS 'Stores form submission data with metadata and source tracking';

-- Add comments on JSONB columns
COMMENT ON COLUMN forms.styling IS 'Stores form styling configuration including CSS, themes, and layout settings';
COMMENT ON COLUMN forms.settings IS 'Stores form behavior settings, notifications, and integration configurations';
COMMENT ON COLUMN form_fields.validation IS 'Array of validation rules with type, parameters, and error messages';
COMMENT ON COLUMN form_fields.options IS 'Configuration for field-specific options like select choices or file upload settings';
COMMENT ON COLUMN form_submissions.data IS 'Submitted form data with field values';
COMMENT ON COLUMN form_submissions.metadata IS 'Submission metadata including browser info, timestamps, and tracking data';

-- Create function to validate form field order
CREATE OR REPLACE FUNCTION validate_field_order()
RETURNS TRIGGER AS $$
BEGIN
    -- Ensure order values are consecutive within a form
    IF EXISTS (
        SELECT 1
        FROM (
            SELECT "order", lag("order") OVER (ORDER BY "order") as prev_order
            FROM form_fields
            WHERE form_id = NEW.form_id
        ) t
        WHERE t.order - t.prev_order > 1
    ) THEN
        RAISE EXCEPTION 'Field order must be consecutive within a form';
    END IF;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Create trigger for field order validation
CREATE TRIGGER validate_field_order_trigger
    AFTER INSERT OR UPDATE ON form_fields
    FOR EACH ROW
    EXECUTE FUNCTION validate_field_order();