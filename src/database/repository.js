import { DatabaseManager } from './connection.js';

export class TestRepository {
  constructor() {
    this.db = DatabaseManager.getInstance();
  }

  // Test Suite Operations
  async createTestSuite(suiteData) {
    const query = `
      INSERT INTO test_suites (org_id, app_id, name, description, created_at)
      VALUES ($1, $2, $3, $4, $5)
      RETURNING id
    `;

    const values = [
      suiteData.orgId || '1',
      suiteData.appId || '1',
      suiteData.name,
      suiteData.description,
      new Date()
    ];

    const result = await this.db.query(query, values);
    return result.rows[0].id;
  }

  async updateTestSuite(suiteId, updates) {
    const setClause = Object.keys(updates)
      .map((key, index) => `${this.camelToSnake(key)} = $${index + 2}`)
      .join(', ');

    const query = `UPDATE test_suites SET ${setClause}, updated_at = NOW() WHERE id = $1 RETURNING *`;
    const values = [suiteId, ...Object.values(updates)];

    const result = await this.db.query(query, values);
    return result.rows[0];
  }

  async getTestSuiteByName(name) {
    const query = `SELECT * FROM test_suites WHERE name = $1 LIMIT 1`;
    const result = await this.db.query(query, [name]);
    return result.rows[0] || null;
  }

  // Test Run Operations
  async createTestRun(runData) {
    const query = `
      INSERT INTO test_runs (org_id, app_id, suite_id, run_name, status, start_time, 
                            end_time, duration_ms, total_tests, passed_tests, failed_tests,
                            skipped_tests, browser, environment, playwright_version,
                            node_version, os_info, html_report_path)
      VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16, $17, $18)
      RETURNING id
    `;

    const values = [
      runData.orgId || '1',
      runData.appId || '1',
      runData.suiteId,
      runData.runName,
      runData.status || 'running',
      runData.startTime || new Date(),
      runData.endTime,
      runData.durationMs,
      runData.totalTests || 0,
      runData.passedTests || 0,
      runData.failedTests || 0,
      runData.skippedTests || 0,
      runData.browser,
      runData.environment,
      runData.playwrightVersion,
      runData.nodeVersion,
      runData.osInfo,
      runData.htmlReportPath
    ];

    const result = await this.db.query(query, values);
    return result.rows[0].id;
  }

  async updateTestRun(testRunId, updates) {
    const setClause = Object.keys(updates)
      .map((key, index) => `${this.camelToSnake(key)} = $${index + 2}`)
      .join(', ');

    const query = `UPDATE test_runs SET ${setClause} WHERE id = $1 RETURNING *`;
    const values = [testRunId, ...Object.values(updates)];

    const result = await this.db.query(query, values);
    return result.rows[0];
  }

  // Test Case Operations
  async createTestCase(testData) {
    const query = `
      INSERT INTO test_cases (org_id, app_id, run_id, suite_id, test_name,
                             test_title, file_path, start_time, end_time, duration_ms, 
                             status, retry_count, browser, project_name, error_message,
                             error_stack)
      VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16)
      RETURNING id
    `;

    const values = [
      testData.orgId || '1',
      testData.appId || '1',
      testData.runId,
      testData.suiteId,
      testData.testName,
      testData.testTitle,
      testData.filePath,
      testData.startTime || new Date(),
      testData.endTime,
      testData.durationMs,
      testData.status || 'running',
      testData.retryCount || 0,
      testData.browser,
      testData.projectName,
      testData.errorMessage,
      testData.errorStack
    ];

    const result = await this.db.query(query, values);
    return result.rows[0].id;
  }

  async updateTestCase(testCaseId, updates) {
    const setClause = Object.keys(updates)
      .map((key, index) => `${this.camelToSnake(key)} = $${index + 2}`)
      .join(', ');

    const query = `UPDATE test_cases SET ${setClause} WHERE id = $1 RETURNING *`;
    const values = [testCaseId, ...Object.values(updates)];

    const result = await this.db.query(query, values);
    return result.rows[0];
  }

  // Test Step Operations
  async createTestStep(stepData) {
    const query = `
      INSERT INTO test_steps (org_id, app_id, test_case_id, step_number, action_type, description,
                             selector, target_url, expected_value, actual_value,
                             start_time, end_time, duration_ms, status, 
                             screenshot_path, error_message)
      VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16)
      RETURNING id
    `;

    const values = [
      stepData.orgId || '1',
      stepData.appId || '1',
      stepData.testCaseId,
      stepData.stepNumber,
      stepData.actionType,
      stepData.description,
      stepData.selector,
      stepData.targetUrl,
      stepData.expectedValue,
      stepData.actualValue,
      stepData.startTime || new Date(),
      stepData.endTime,
      stepData.durationMs,
      stepData.status || 'passed',
      stepData.screenshotPath,
      stepData.errorMessage
    ];

    const result = await this.db.query(query, values);
    return result.rows[0].id;
  }

  async updateTestStep(stepId, updates) {
    const setClause = Object.keys(updates)
      .map((key, index) => `${this.camelToSnake(key)} = $${index + 2}`)
      .join(', ');

    const query = `UPDATE test_steps SET ${setClause} WHERE id = $1 RETURNING *`;
    const values = [stepId, ...Object.values(updates)];

    const result = await this.db.query(query, values);
    return result.rows[0];
  }

  // Test Attachment Operations
  async createTestAttachment(attachmentData) {
    const query = `
      INSERT INTO test_attachments (org_id, app_id, test_case_id, attachment_type, file_name,
                                   file_path, content_type, file_size_bytes)
      VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
      RETURNING id
    `;

    const values = [
      attachmentData.orgId || '1',
      attachmentData.appId || '1',
      attachmentData.testCaseId,
      attachmentData.attachmentType,
      attachmentData.fileName,
      attachmentData.filePath,
      attachmentData.contentType,
      attachmentData.fileSizeBytes
    ];

    const result = await this.db.query(query, values);
    return result.rows[0].id;
  }

  // Performance Metrics Operations
  async createPerformanceMetrics(metricsData) {
    const query = `
      INSERT INTO performance_metrics (org_id, app_id, test_case_id, metric_name, metric_value,
                                     metric_unit, recorded_at)
      VALUES ($1, $2, $3, $4, $5, $6, $7)
      RETURNING id
    `;

    const values = [
      metricsData.orgId || '1',
      metricsData.appId || '1',
      metricsData.testCaseId,
      metricsData.metricName,
      metricsData.metricValue,
      metricsData.metricUnit,
      metricsData.recordedAt || new Date()
    ];

    const result = await this.db.query(query, values);
    return result.rows[0].id;
  }

  // Report Metadata Operations
  async createReportMetadata(reportData) {
    const query = `
      INSERT INTO report_metadata (org_id, app_id, run_id, report_file_path,
                                  parsed_at, parsing_status, parsing_errors, additional_data)
      VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
      RETURNING id
    `;

    const values = [
      reportData.orgId || '1',
      reportData.appId || '1',
      reportData.runId,
      reportData.reportFilePath,
      reportData.parsedAt || new Date(),
      reportData.parsingStatus,
      reportData.parsingErrors,
      reportData.additionalData ? JSON.stringify(reportData.additionalData) : null
    ];

    const result = await this.db.query(query, values);
    return result.rows[0].id;
  }

  // Analytics and Query Methods
  async getTestRunsByDateRange(startDate, endDate) {
    const query = `
      SELECT tr.*, ts.name as suite_name, ts.project_name
      FROM test_runs tr
      JOIN test_suites ts ON tr.test_suite_id = ts.id
      WHERE tr.start_time >= $1 AND tr.start_time <= $2
      ORDER BY tr.start_time DESC
    `;

    const result = await this.db.query(query, [startDate, endDate]);
    return result.rows;
  }

  async getTestCaseResults(testRunId) {
    const query = `
      SELECT tc.*, 
             COUNT(ts.id) as step_count,
             SUM(ts.duration_ms) as total_step_duration
      FROM test_cases tc
      LEFT JOIN test_steps ts ON tc.id = ts.test_case_id
      WHERE tc.run_id = $1
      GROUP BY tc.id
      ORDER BY tc.start_time
    `;

    const result = await this.db.query(query, [testRunId]);
    return result.rows;
  }

  async getTestCasesForRun(testRunId) {
    const query = `
      SELECT * FROM test_cases
      WHERE run_id = $1
      ORDER BY start_time
    `;

    const result = await this.db.query(query, [testRunId]);
    return result.rows;
  }

  async getTestRunSummary(testRunId) {
    const query = `
      SELECT 
        tr.*,
        COUNT(tc.id) as total_test_cases,
        COUNT(CASE WHEN tc.status = 'passed' THEN 1 END) as passed_test_cases,
        COUNT(CASE WHEN tc.status = 'failed' THEN 1 END) as failed_test_cases,
        COUNT(CASE WHEN tc.status = 'skipped' THEN 1 END) as skipped_test_cases,
        AVG(tc.duration_ms) as avg_test_duration
      FROM test_runs tr
      LEFT JOIN test_cases tc ON tr.id = tc.run_id
      WHERE tr.id = $1
      GROUP BY tr.id
    `;

    const result = await this.db.query(query, [testRunId]);
    return result.rows[0];
  }

  async getTestSteps(testCaseId) {
    const query = `
      SELECT * FROM test_steps
      WHERE test_case_id = $1
      ORDER BY step_number
    `;

    const result = await this.db.query(query, [testCaseId]);
    return result.rows;
  }

  async getFailureAnalytics(timeRange = '7 days') {
    const query = `
      SELECT 
        tc.file_path,
        tc.title,
        COUNT(*) as failure_count,
        AVG(tc.duration_ms) as avg_duration,
        MAX(tc.start_time) as last_failure
      FROM test_cases tc
      WHERE tc.status = 'failed' 
        AND tc.start_time >= NOW() - INTERVAL '${timeRange}'
      GROUP BY tc.file_path, tc.title
      ORDER BY failure_count DESC
      LIMIT 20
    `;

    const result = await this.db.query(query);
    return result.rows;
  }

  async getPerformanceTrends(testTitle, days = 30) {
    const query = `
      SELECT 
        tc.start_time::date as test_date,
        AVG(tc.duration_ms) as avg_duration,
        MIN(tc.duration_ms) as min_duration,
        MAX(tc.duration_ms) as max_duration,
        COUNT(*) as run_count
      FROM test_cases tc
      WHERE tc.title = $1 
        AND tc.start_time >= NOW() - INTERVAL '${days} days'
        AND tc.status = 'passed'
      GROUP BY tc.start_time::date
      ORDER BY tc.start_time::date
    `;

    const result = await this.db.query(query, [testTitle]);
    return result.rows;
  }

  async getTestSummary(testRunId) {
    const query = `
      SELECT 
        tr.run_id,
        tr.status as run_status,
        tr.start_time,
        tr.duration_ms as total_duration,
        tr.total_tests,
        tr.passed_tests,
        tr.failed_tests,
        tr.skipped_tests,
        ts.name as suite_name,
        COUNT(tc.id) as actual_test_count,
        AVG(tc.duration_ms) as avg_test_duration
      FROM test_runs tr
      JOIN test_suites ts ON tr.test_suite_id = ts.id
      LEFT JOIN test_cases tc ON tr.id = tc.test_run_id
      WHERE tr.id = $1
      GROUP BY tr.id, ts.id
    `;

    const result = await this.db.query(query, [testRunId]);
    return result.rows[0];
  }

  // Utility method to convert camelCase to snake_case
  camelToSnake(str) {
    return str.replace(/[A-Z]/g, letter => `_${letter.toLowerCase()}`);
  }

  // Utility method to convert snake_case to camelCase
  snakeToCamel(str) {
    return str.replace(/_([a-z])/g, (match, letter) => letter.toUpperCase());
  }
}