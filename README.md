# Playwright Database Reporter

Store and analyze your Playwright test results in Azure PostgreSQL with comprehensive metrics, step-by-step logging, and powerful analytics.

## Features

- **Complete Test Tracking**: Captures test runs, individual test results, detailed steps, and performance metrics
- **Azure PostgreSQL Integration**: Scalable database storage with optimized schema
- **Rich Analytics**: Pre-built queries for test reliability, performance trends, and failure analysis
- **HTML Report Parser**: Extract and augment data from existing Playwright HTML reports
- **Performance Monitoring**: Track page load times, action durations, and custom metrics
- **Attachment Management**: Store metadata for screenshots, videos, and traces

## Quick Start

### 1. Setup Database

```bash
# Install dependencies
npm install

# Configure Azure PostgreSQL connection
cp .env.example .env
# Edit .env with your database credentials

# Initialize database schema
npm run setup-db
```

### 2. Run Tests with Database Logging

```bash
# Run all tests with database reporting
npm run test:db

# Run specific test files
npx playwright test tests/your-test.spec.js --reporter=./src/reporters/database-reporter.js
```

### 3. Analyze Results

Use the pre-built queries in `database/queries.sql` or query directly:

```sql
-- Recent test results with performance
SELECT 
    tc.test_name,
    tc.duration_ms / 1000.0 as duration_seconds,
    tc.status,
    tr.browser,
    tr.start_time
FROM test_cases tc
JOIN test_runs tr ON tc.run_id = tr.id
WHERE tr.start_time >= NOW() - INTERVAL '24 hours'
ORDER BY tc.start_time DESC;
```

## Database Schema

| Table | Purpose |
|-------|---------|
| `test_suites` | Group related tests |
| `test_runs` | Test execution sessions |
| `test_cases` | Individual test results |
| `test_steps` | Detailed action logging |
| `test_attachments` | File metadata (screenshots, videos) |
| `performance_metrics` | Custom performance measurements |

## Configuration

### Environment Variables (.env)

```env
DB_HOST=your-server.postgres.database.azure.com
DB_PORT=5432
DB_NAME=playwright_test_results
DB_USER=your_username
DB_PASSWORD=your_password
DB_SSL=true
TEST_ENVIRONMENT=development
```

### Playwright Configuration

```javascript
// playwright.config.js
export default defineConfig({
  reporter: [
    ['html'],
    ['./src/reporters/database-reporter.js'],
    ['list']
  ],
  projects: [
    { name: 'chromium', use: devices['Desktop Chrome'] },
    { name: 'firefox', use: devices['Desktop Firefox'] },
    { name: 'webkit', use: devices['Desktop Safari'] }
  ]
});
```

## Playwright Workspaces

For teams managing multiple test suites or projects:

### Multi-Project Setup

```javascript
// playwright.config.js - Configure multiple browser projects
export default defineConfig({
  projects: [
    {
      name: 'desktop-chrome',
      use: { ...devices['Desktop Chrome'] }
    },
    {
      name: 'desktop-firefox', 
      use: { ...devices['Desktop Firefox'] }
    },
    {
      name: 'mobile-safari',
      use: { ...devices['iPhone 12'] }
    }
  ]
});
```

### Workspace Organization

```
your-workspace/
├── tests/
│   ├── auth/          # Authentication tests
│   ├── e2e/           # End-to-end user flows  
│   ├── api/           # API integration tests
│   └── mobile/        # Mobile-specific tests
├── src/
│   └── reporters/     # Custom reporters
└── playwright.config.js
```

### Running Specific Workspaces

```bash
# Run specific project
npx playwright test --project=desktop-chrome

# Run tests by directory
npx playwright test tests/auth/

# Run with specific reporter for CI/CD
npx playwright test --reporter=./src/reporters/database-reporter.js
```

## Advanced Usage

### Custom Test Metrics

```typescript
// Add custom performance tracking in tests
test('example test', async ({ page }) => {
  const startTime = Date.now();
  await page.goto('https://example.com');
  const loadTime = Date.now() - startTime;
  
  // Logged automatically by database reporter
  console.log(`Page load time: ${loadTime}ms`);
});
```

### HTML Report Integration

```bash
# Parse existing HTML reports into database
npm run parse-report ./playwright-report/index.html

# Backfill historical reports
npm run backfill-reports ./old-reports-directory
```

### Common Queries

```bash
# Test reliability over last 30 days
psql -c "
SELECT 
  test_name,
  COUNT(*) as runs,
  ROUND(COUNT(CASE WHEN status='passed' THEN 1 END)*100.0/COUNT(*), 2) as pass_rate
FROM test_cases tc
JOIN test_runs tr ON tc.run_id = tr.id  
WHERE tr.start_time >= NOW() - INTERVAL '30 days'
GROUP BY test_name
HAVING COUNT(*) > 5
ORDER BY pass_rate ASC;
"
```

## Azure Setup

See [AZURE_SETUP.md](AZURE_SETUP.md) for detailed Azure PostgreSQL setup instructions.

## Scripts

| Command | Description |
|---------|-------------|
| `npm run test` | Run tests with standard reporters |
| `npm run test:db` | Run tests with database logging |
| `npm run setup-db` | Initialize database schema |
| `npm run parse-report` | Parse HTML report into database |
| `npm run backfill-reports` | Import historical test data |

## Contributing

1. Database schema changes go in `database/schema.sql`
2. Add new queries to `database/queries.sql`
3. Extend the reporter in `src/reporters/database-reporter.js`
4. Update repository methods in `src/database/repository.js`

---

Transform your Playwright test data into actionable insights with comprehensive database storage and analytics.