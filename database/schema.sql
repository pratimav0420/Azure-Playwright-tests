-- Playwright Test Results Database Schema for Azure PostgreSQL
-- This schema stores comprehensive test execution data and metrics

-- Test Suites Table
CREATE TABLE test_suites (
    id SERIAL PRIMARY KEY,
    org_id VARCHAR(100),
    app_id VARCHAR(100),
    name VARCHAR(255) NOT NULL,
    description TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- Test Runs Table (Each test execution session)
CREATE TABLE test_runs (
    id SERIAL PRIMARY KEY,
    org_id VARCHAR(100),
    app_id VARCHAR(100),
    suite_id INTEGER REFERENCES test_suites(id),
    run_name VARCHAR(255),
    start_time TIMESTAMP WITH TIME ZONE NOT NULL,
    end_time TIMESTAMP WITH TIME ZONE,
    duration_ms BIGINT,
    status VARCHAR(50) NOT NULL, -- 'running', 'passed', 'failed', 'interrupted'
    total_tests INTEGER DEFAULT 0,
    passed_tests INTEGER DEFAULT 0,
    failed_tests INTEGER DEFAULT 0,
    skipped_tests INTEGER DEFAULT 0,
    browser VARCHAR(50),
    environment VARCHAR(100),
    playwright_version VARCHAR(50),
    node_version VARCHAR(50),
    os_info VARCHAR(100),
    html_report_path TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- Individual Test Cases
CREATE TABLE test_cases (
    id SERIAL PRIMARY KEY,
    org_id VARCHAR(100),
    app_id VARCHAR(100),
    run_id INTEGER REFERENCES test_runs(id),
    suite_id INTEGER REFERENCES test_suites(id),
    test_name VARCHAR(500) NOT NULL,
    test_title VARCHAR(500),
    file_path TEXT NOT NULL,
    start_time TIMESTAMP WITH TIME ZONE NOT NULL,
    end_time TIMESTAMP WITH TIME ZONE,
    duration_ms BIGINT,
    status VARCHAR(50) NOT NULL, -- 'passed', 'failed', 'skipped', 'timedout'
    retry_count INTEGER DEFAULT 0,
    browser VARCHAR(50),
    project_name VARCHAR(100),
    error_message TEXT,
    error_stack TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- Test Steps (Detailed action logging)
CREATE TABLE test_steps (
    id SERIAL PRIMARY KEY,
    org_id VARCHAR(100),
    app_id VARCHAR(100),
    test_case_id INTEGER REFERENCES test_cases(id),
    step_number INTEGER NOT NULL,
    action_type VARCHAR(100), -- 'click', 'fill', 'navigate', 'wait', 'expect', etc.
    description TEXT NOT NULL,
    selector VARCHAR(500),
    target_url TEXT,
    expected_value TEXT, -- Expected result or value for validation steps
    actual_value TEXT, -- Actual result or value obtained
    start_time TIMESTAMP WITH TIME ZONE NOT NULL,
    end_time TIMESTAMP WITH TIME ZONE,
    duration_ms BIGINT,
    status VARCHAR(50), -- 'passed', 'failed', 'warning'
    screenshot_path TEXT,
    error_message TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- Test Attachments (Screenshots, Videos, Traces)
CREATE TABLE test_attachments (
    id SERIAL PRIMARY KEY,
    org_id VARCHAR(100),
    app_id VARCHAR(100),
    test_case_id INTEGER REFERENCES test_cases(id),
    attachment_type VARCHAR(50) NOT NULL, -- 'screenshot', 'video', 'trace', 'log'
    file_name VARCHAR(255) NOT NULL,
    file_path TEXT NOT NULL,
    file_size_bytes BIGINT,
    content_type VARCHAR(100),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- Performance Metrics
CREATE TABLE performance_metrics (
    id SERIAL PRIMARY KEY,
    org_id VARCHAR(100),
    app_id VARCHAR(100),
    test_case_id INTEGER REFERENCES test_cases(id),
    metric_name VARCHAR(100) NOT NULL, -- 'page_load_time', 'dom_content_loaded', 'first_paint', etc.
    metric_value DECIMAL(10,2) NOT NULL,
    metric_unit VARCHAR(20) NOT NULL, -- 'ms', 'seconds', 'bytes', etc.
    recorded_at TIMESTAMP WITH TIME ZONE NOT NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- HTML Report Parsing Results
CREATE TABLE report_metadata (
    id SERIAL PRIMARY KEY,
    org_id VARCHAR(100),
    app_id VARCHAR(100),
    run_id INTEGER REFERENCES test_runs(id),
    report_file_path TEXT NOT NULL,
    parsed_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    parsing_status VARCHAR(50), -- 'success', 'failed', 'partial'
    parsing_errors TEXT,
    additional_data JSONB, -- Store any additional parsed data as JSON
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- Create Indexes for Better Performance
CREATE INDEX idx_test_runs_suite_id ON test_runs(suite_id);
CREATE INDEX idx_test_runs_start_time ON test_runs(start_time);
CREATE INDEX idx_test_runs_status ON test_runs(status);
CREATE INDEX idx_test_runs_org_id ON test_runs(org_id);
CREATE INDEX idx_test_runs_app_id ON test_runs(app_id);

CREATE INDEX idx_test_cases_run_id ON test_cases(run_id);
CREATE INDEX idx_test_cases_suite_id ON test_cases(suite_id);
CREATE INDEX idx_test_cases_status ON test_cases(status);
CREATE INDEX idx_test_cases_start_time ON test_cases(start_time);
CREATE INDEX idx_test_cases_org_id ON test_cases(org_id);
CREATE INDEX idx_test_cases_app_id ON test_cases(app_id);

CREATE INDEX idx_test_steps_test_case_id ON test_steps(test_case_id);
CREATE INDEX idx_test_steps_step_number ON test_steps(step_number);
CREATE INDEX idx_test_steps_org_id ON test_steps(org_id);
CREATE INDEX idx_test_steps_app_id ON test_steps(app_id);

CREATE INDEX idx_test_attachments_test_case_id ON test_attachments(test_case_id);
CREATE INDEX idx_test_attachments_type ON test_attachments(attachment_type);
CREATE INDEX idx_test_attachments_org_id ON test_attachments(org_id);
CREATE INDEX idx_test_attachments_app_id ON test_attachments(app_id);

CREATE INDEX idx_performance_metrics_test_case_id ON performance_metrics(test_case_id);
CREATE INDEX idx_performance_metrics_name ON performance_metrics(metric_name);
CREATE INDEX idx_performance_metrics_org_id ON performance_metrics(org_id);
CREATE INDEX idx_performance_metrics_app_id ON performance_metrics(app_id);

CREATE INDEX idx_test_suites_org_id ON test_suites(org_id);
CREATE INDEX idx_test_suites_app_id ON test_suites(app_id);

CREATE INDEX idx_report_metadata_org_id ON report_metadata(org_id);
CREATE INDEX idx_report_metadata_app_id ON report_metadata(app_id);

-- Create update timestamp function
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = CURRENT_TIMESTAMP;
    RETURN NEW;
END;
$$ language 'plpgsql';

-- Create triggers for updated_at
CREATE TRIGGER update_test_suites_updated_at BEFORE UPDATE ON test_suites 
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- Sample INSERT statements for reference
-- Use these as templates in your application code

-- Insert test step with all fields
/*
INSERT INTO test_steps 
    (test_case_id, step_number, action_type, description, selector, expected_value, actual_value, status)
VALUES ($1, $2, $3, $4, $5, $6, $7, $8);

-- Alternative mapping for compatibility with test_id parameter:
-- INSERT INTO test_steps 
--     (test_case_id, step_number, action_type, description, selector, expected_value, actual_value, status)
-- VALUES (?, ?, ?, ?, ?, ?, ?, ?) 
-- WHERE test_case_id corresponds to your test_id parameter
*/