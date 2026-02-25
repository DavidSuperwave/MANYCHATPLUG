-- ALA LEGAL CRM Schema
-- Leads/Prospects tracking with qualification stages
-- SPECIALTY: Fallecimientos (death-related Infonavit cases)

CREATE SEQUENCE IF NOT EXISTS lead_id_seq START 1000;

-- Leads table
CREATE TABLE IF NOT EXISTS leads (
    id INTEGER PRIMARY KEY DEFAULT nextval('lead_id_seq'),
    subscriber_id VARCHAR UNIQUE NOT NULL,
    subscriber_name VARCHAR,
    facebook_name VARCHAR,
    phone VARCHAR,
    email VARCHAR,
    curp VARCHAR,
    nss VARCHAR,
    source VARCHAR DEFAULT 'messenger',
    -- Stages: inbound, qualified, document_pending, set, intake_form, closed_won, closed_lost, discarded
    stage VARCHAR DEFAULT 'inbound',
    classification VARCHAR, -- priority, engage, neutral, discard
    stage_changed_at TIMESTAMP,
    assigned_to VARCHAR,
    notes TEXT,
    tags JSON,
    custom_fields JSON,
    last_message TEXT,
    last_message_at TIMESTAMP,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Messages log (conversation history)
CREATE TABLE IF NOT EXISTS messages (
    id INTEGER PRIMARY KEY DEFAULT nextval('lead_id_seq'),
    subscriber_id VARCHAR NOT NULL,
    direction VARCHAR NOT NULL, -- 'inbound' or 'outbound'
    message_text TEXT,
    message_type VARCHAR DEFAULT 'text', -- text, image, audio
    classification VARCHAR, -- priority, engage, neutral, discard
    intent VARCHAR, -- greeting, pricing, support, appointment, qualification
    sentiment VARCHAR, -- positive, neutral, negative
    ai_suggested_response TEXT,
    human_approved BOOLEAN DEFAULT false,
    trained_response TEXT, -- what you taught me to say
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (subscriber_id) REFERENCES leads(subscriber_id)
);

-- Stage history (track movement through funnel)
CREATE TABLE IF NOT EXISTS stage_history (
    id INTEGER PRIMARY KEY DEFAULT nextval('lead_id_seq'),
    subscriber_id VARCHAR NOT NULL,
    from_stage VARCHAR,
    to_stage VARCHAR,
    changed_by VARCHAR, -- 'ai' or 'human'
    reason TEXT,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (subscriber_id) REFERENCES leads(subscriber_id)
);

-- Training memory (what you taught me)
CREATE TABLE IF NOT EXISTS training_memory (
    id INTEGER PRIMARY KEY DEFAULT nextval('lead_id_seq'),
    trigger_phrase TEXT, -- what the user said
    context VARCHAR, -- situation
    your_response TEXT, -- what you told me to say
    category VARCHAR, -- greeting, objection, pricing, etc.
    classification VARCHAR, -- priority, engage, neutral, discard
    times_used INTEGER DEFAULT 0,
    effectiveness INTEGER, -- 1-5 rating
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Classification stats view
CREATE OR REPLACE VIEW v_classification_stats AS
SELECT 
    classification,
    COUNT(*) as message_count,
    COUNT(CASE WHEN direction = 'inbound' THEN 1 END) as inbound,
    COUNT(CASE WHEN direction = 'outbound' THEN 1 END) as outbound
FROM messages
WHERE classification IS NOT NULL
GROUP BY classification;

-- Create indexes
CREATE INDEX IF NOT EXISTS idx_leads_stage ON leads(stage);
CREATE INDEX IF NOT EXISTS idx_leads_classification ON leads(classification);
CREATE INDEX IF NOT EXISTS idx_leads_subscriber ON leads(subscriber_id);
CREATE INDEX IF NOT EXISTS idx_messages_subscriber ON messages(subscriber_id);
CREATE INDEX IF NOT EXISTS idx_messages_classification ON messages(classification);
CREATE INDEX IF NOT EXISTS idx_messages_created ON messages(created_at);

-- Views for pipeline
CREATE OR REPLACE VIEW v_pipeline AS
SELECT 
    stage,
    COUNT(*) as count,
    AVG(EXTRACT(EPOCH FROM (COALESCE(stage_changed_at, created_at) - created_at))/86400) as avg_days_in_stage
FROM leads
GROUP BY stage;

CREATE OR REPLACE VIEW v_recent_leads AS
SELECT 
    l.*,
    (SELECT message_text FROM messages 
     WHERE subscriber_id = l.subscriber_id 
     ORDER BY created_at DESC LIMIT 1) as last_message_preview
FROM leads l
ORDER BY l.last_message_at DESC NULLS LAST
LIMIT 50;