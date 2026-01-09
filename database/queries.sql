-- Useful SQL queries for analyzing Playwright test results
-- Compatible with PostgreSQL and Azure PostgreSQL

-- 1. Get overview of all test runs
SELECT 
    tr.id,
    ts.name as suite_name,
    tr.run_name,
    tr.start_time,
    ROUND(tr.duration_ms / 1000.0, 2) as duration_seconds,
    tr.status,
    tr.total_tests,
    tr.passed_tests,
    tr.failed_tests,
    tr.skipped_tests,
    tr.browser,
    tr.environment
FROM test_runs tr
LEFT JOIN test_suites ts ON tr.suite_id = ts.id
WHERE tr.org_id = COALESCE($1, '1') 
  AND tr.app_id = COALESCE($2, '1')
ORDER BY tr.start_time DESC;

-- 2. Get detailed test results for a specific run
SELECT 
    tc.test_name,
    tc.test_title,
    ROUND(tc.duration_ms / 1000.0, 2) as duration_seconds,
    tc.status,
    tc.retry_count,
    tc.error_message
FROM test_cases tc
WHERE tc.run_id = $1 -- Replace with actual run ID
  AND tc.org_id = COALESCE($2, '1') 
  AND tc.app_id = COALESCE($3, '1')
ORDER BY tc.start_time;

-- 3. Find slowest tests across all runs
SELECT 
    tc.test_name,
    tc.file_path,
    ROUND(AVG(tc.duration_ms)::NUMERIC, 2) as avg_duration_ms,
    MAX(tc.duration_ms) as max_duration_ms,
    MIN(tc.duration_ms) as min_duration_ms,
    COUNT(*) as execution_count
FROM test_cases tc
WHERE tc.status = 'passed'
  AND tc.org_id = COALESCE($1, '1') 
  AND tc.app_id = COALESCE($2, '1')
GROUP BY tc.test_name, tc.file_path
HAVING COUNT(*) > 1
ORDER BY avg_duration_ms DESC
LIMIT 10;

-- 4. Get test reliability (pass rate) by test name
SELECT 
    tc.test_name,
    COUNT(*) as total_executions,
    COUNT(CASE WHEN tc.status = 'passed' THEN 1 END) as passed_executions,
    COUNT(CASE WHEN tc.status = 'failed' THEN 1 END) as failed_executions,
    ROUND(
        COUNT(CASE WHEN tc.status = 'passed' THEN 1 END)::DECIMAL / NULLIF(COUNT(*), 0) * 100, 
        2
    ) as pass_rate_percent
FROM test_cases tc
WHERE tc.org_id = COALESCE($1, '1') 
  AND tc.app_id = COALESCE($2, '1')
GROUP BY tc.test_name
HAVING COUNT(*) > 2
ORDER BY pass_rate_percent ASC;

-- 5. Analyze test step performance
SELECT 
    ts.action_type,
    COUNT(*) as step_count,
    ROUND(AVG(ts.duration_ms)::NUMERIC, 2) as avg_duration_ms,
    MAX(ts.duration_ms) as max_duration_ms,
    PERCENTILE_CONT(0.95) WITHIN GROUP (ORDER BY ts.duration_ms) as p95_duration_ms
FROM test_steps ts
WHERE ts.duration_ms IS NOT NULL
  AND ts.org_id = COALESCE($1, '1') 
  AND ts.app_id = COALESCE($2, '1')
GROUP BY ts.action_type
ORDER BY avg_duration_ms DESC;

-- 6. Find tests with frequent failures
SELECT 
    tc.test_name,
    tc.file_path,
    COUNT(*) as total_runs,
    COUNT(CASE WHEN tc.status = 'failed' THEN 1 END) as failed_runs,
    STRING_AGG(DISTINCT tc.error_message, ' | ') as common_errors
FROM test_cases tc
WHERE tc.created_at >= NOW() - INTERVAL '30 days'
  AND tc.org_id = COALESCE($1, '1') 
  AND tc.app_id = COALESCE($2, '1')
GROUP BY tc.test_name, tc.file_path
HAVING COUNT(CASE WHEN tc.status = 'failed' THEN 1 END) > 0
ORDER BY failed_runs DESC;

-- 7. Performance metrics analysis
SELECT 
    pm.metric_name,
    pm.metric_unit,
    COUNT(*) as measurement_count,
    ROUND(AVG(pm.metric_value)::NUMERIC, 2) as avg_value,
    MIN(pm.metric_value) as min_value,
    MAX(pm.metric_value) as max_value,
    PERCENTILE_CONT(0.50) WITHIN GROUP (ORDER BY pm.metric_value) as median_value,
    PERCENTILE_CONT(0.95) WITHIN GROUP (ORDER BY pm.metric_value) as p95_value
FROM performance_metrics pm
WHERE pm.org_id = COALESCE($1, '1') 
  AND pm.app_id = COALESCE($2, '1')
GROUP BY pm.metric_name, pm.metric_unit
ORDER BY pm.metric_name;

-- 8. Daily test execution trends
SELECT 
    DATE(tr.start_time) as test_date,
    COUNT(*) as total_runs,
    COUNT(CASE WHEN tr.status = 'passed' THEN 1 END) as passed_runs,
    COUNT(CASE WHEN tr.status = 'failed' THEN 1 END) as failed_runs,
    SUM(tr.total_tests) as total_test_cases,
    ROUND(AVG(tr.duration_ms / 1000.0)::NUMERIC, 2) as avg_run_duration_seconds
FROM test_runs tr
WHERE tr.start_time >= NOW() - INTERVAL '30 days'
  AND tr.org_id = COALESCE($1, '1') 
  AND tr.app_id = COALESCE($2, '1')
GROUP BY DATE(tr.start_time)
ORDER BY test_date DESC;

-- 9. Browser-specific test results
SELECT 
    tr.browser,
    COUNT(*) as total_runs,
    ROUND(AVG(tr.duration_ms / 1000.0)::NUMERIC, 2) as avg_duration_seconds,
    ROUND(
        COUNT(CASE WHEN tr.status = 'passed' THEN 1 END)::DECIMAL / NULLIF(COUNT(*), 0) * 100, 
        2
    ) as success_rate_percent
FROM test_runs tr
WHERE tr.browser IS NOT NULL
  AND tr.org_id = COALESCE($1, '1') 
  AND tr.app_id = COALESCE($2, '1')
GROUP BY tr.browser
ORDER BY success_rate_percent DESC;

-- 10. Test attachments summary
SELECT 
    ta.attachment_type,
    COUNT(*) as total_attachments,
    ROUND(AVG(ta.file_size_bytes / 1024.0)::NUMERIC, 2) as avg_size_kb,
    ROUND(SUM(ta.file_size_bytes / 1024.0)::NUMERIC, 2) as total_size_kb
FROM test_attachments ta
WHERE ta.file_size_bytes IS NOT NULL
  AND ta.org_id = COALESCE($1, '1') 
  AND ta.app_id = COALESCE($2, '1')
GROUP BY ta.attachment_type
ORDER BY total_size_kb DESC;

-- 11. Recent failing tests with details
SELECT 
    tc.test_name,
    tc.file_path,
    tc.start_time,
    ROUND(tc.duration_ms / 1000.0, 2) as duration_seconds,
    tc.retry_count,
    tc.error_message,
    tr.browser,
    tr.environment
FROM test_cases tc
JOIN test_runs tr ON tc.run_id = tr.id
WHERE tc.status = 'failed' 
  AND tc.start_time >= NOW() - INTERVAL '7 days'
  AND tc.org_id = COALESCE($1, '1') 
  AND tc.app_id = COALESCE($2, '1')
ORDER BY tc.start_time DESC;

-- 12. Test suite performance comparison
SELECT 
    ts.name as suite_name,
    COUNT(DISTINCT tr.id) as total_runs,
    ROUND(AVG(tr.duration_ms / 1000.0)::NUMERIC, 2) as avg_run_duration_seconds,
    ROUND(AVG(tr.total_tests)::NUMERIC, 2) as avg_tests_per_run,
    ROUND(
        AVG(tr.passed_tests::DECIMAL / NULLIF(tr.total_tests, 0)) * 100, 
        2
    ) as avg_pass_rate_percent
FROM test_suites ts
LEFT JOIN test_runs tr ON ts.id = tr.suite_id
WHERE tr.id IS NOT NULL
  AND ts.org_id = COALESCE($1, '1') 
  AND ts.app_id = COALESCE($2, '1')
GROUP BY ts.name
ORDER BY avg_pass_rate_percent DESC;

-- 13. Test execution summary for dashboard
SELECT 
    'Total Test Runs' as metric,
    COUNT(*)::TEXT as value
FROM test_runs tr
WHERE tr.org_id = COALESCE($1, '1') AND tr.app_id = COALESCE($2, '1')
UNION ALL
SELECT 
    'Total Test Cases' as metric,
    COUNT(*)::TEXT as value
FROM test_cases tc
WHERE tc.org_id = COALESCE($1, '1') AND tc.app_id = COALESCE($2, '1')
UNION ALL
SELECT 
    'Overall Pass Rate' as metric,
    ROUND(
        COUNT(CASE WHEN tc.status = 'passed' THEN 1 END)::DECIMAL / NULLIF(COUNT(*), 0) * 100, 
        2
    )::TEXT || '%' as value
FROM test_cases tc
WHERE tc.org_id = COALESCE($1, '1') AND tc.app_id = COALESCE($2, '1')
UNION ALL
SELECT 
    'Last 7 Days Runs' as metric,
    COUNT(*)::TEXT as value
FROM test_runs tr
WHERE tr.start_time >= NOW() - INTERVAL '7 days'
  AND tr.org_id = COALESCE($1, '1') AND tr.app_id = COALESCE($2, '1');

-- 14. Get test run by ID with all related data
SELECT 
    tr.*,
    ts.name as suite_name,
    ts.description as suite_description
FROM test_runs tr
LEFT JOIN test_suites ts ON tr.suite_id = ts.id
WHERE tr.id = $1
  AND tr.org_id = COALESCE($2, '1') 
  AND tr.app_id = COALESCE($3, '1');