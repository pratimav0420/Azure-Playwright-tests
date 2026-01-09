import { TestRepository } from '../database/repository.js';
import { DatabaseManager } from '../database/connection.js';
import * as os from 'os';
import * as path from 'path';
import { promises as fs } from 'fs';

export class DatabaseReporter {
  constructor() {
    this.repository = new TestRepository();
    this.currentRun = null;
    this.currentSuite = null;
    this.testCaseMap = new Map();
    this.stepCounter = new Map();
  }

  async onBegin(config, suite) {
    console.log('Starting test run, connecting to database...');
    
    // Test database connection
    const db = DatabaseManager.getInstance();
    const connectionTest = await db.testConnection();
    if (!connectionTest) {
      console.error('Failed to connect to database');
      return;
    }

    // Create or get test suite
    const suiteName = config.projects[0]?.name || 'Default Suite';
    this.currentSuite = await this.repository.getTestSuiteByName(suiteName);
    if (!this.currentSuite) {
      const suiteId = await this.repository.createTestSuite({
        orgId: process.env.ORG_ID || '1',
        appId: process.env.APP_ID || '1',
        name: suiteName,
        description: `Playwright test suite - ${suiteName}`
      });
      this.currentSuite = { id: suiteId };
    }

    // Create test run
    const runId = await this.repository.createTestRun({
      orgId: process.env.ORG_ID || '1',
      appId: process.env.APP_ID || '1',
      suiteId: this.currentSuite.id,
      runName: `Run ${new Date().toISOString()}`,
      startTime: new Date(),
      status: 'running',
      browser: config.projects[0]?.use?.browserName || 'unknown',
      environment: process.env.TEST_ENVIRONMENT || process.env.NODE_ENV || 'unknown',
      playwrightVersion: config.version,
      nodeVersion: process.version,
      osInfo: `${os.type()} ${os.release()} ${os.arch()}`,
      htmlReportPath: config.reporter?.find((r) => r[0] === 'html')?.[1]?.outputFolder
    });
    this.currentRun = { id: runId, start_time: new Date() };

    console.log(`Created test run ${this.currentRun.id} for suite "${suiteName}"`);
  }

  async onTestBegin(test, result) {
    if (!this.currentRun || !this.currentSuite) return;

    const testCase = {
      orgId: process.env.ORG_ID || '1',
      appId: process.env.APP_ID || '1',
      runId: this.currentRun.id,
      suiteId: this.currentSuite.id,
      testName: test.title,
      testTitle: test.titlePath().join(' › '),
      filePath: path.relative(process.cwd(), test.location.file),
      startTime: new Date(result.startTime),
      status: 'running',
      retryCount: result.retry,
      browser: result.workerIndex ? `worker-${result.workerIndex}` : undefined,
      projectName: test.parent?.project()?.name
    };

    const savedTestCaseId = await this.repository.createTestCase(testCase);
    this.testCaseMap.set(test.id, { id: savedTestCaseId });
    this.stepCounter.set(test.id, 0);

    console.log(`Started test: ${test.title}`);
  }

  async onStepBegin(test, result, step) {
    if (!this.testCaseMap.has(test.id)) return;

    const testCase = this.testCaseMap.get(test.id);
    const stepNumber = this.stepCounter.get(test.id) + 1;
    this.stepCounter.set(test.id, stepNumber);

    const dbStep = {
      orgId: process.env.ORG_ID || '1',
      appId: process.env.APP_ID || '1',
      testCaseId: testCase.id,
      stepNumber: stepNumber,
      actionType: step.category,
      description: step.title,
      startTime: new Date(step.startTime),
      status: 'passed' // Will be updated if step fails
    };

    // Extract additional info from step
    if (step.title.includes('goto')) {
      const urlMatch = step.title.match(/goto\s+(.+)/);
      if (urlMatch) {
        dbStep.targetUrl = urlMatch[1];
      }
    }

    // Extract selector if present
    const selectorMatch = step.title.match(/locator\('([^']+)'\)|getByRole\('([^']+)'/);
    if (selectorMatch) {
      dbStep.selector = selectorMatch[1] || selectorMatch[2];
    }

    // Extract expected/actual values for assertions
    if (step.category === 'expect') {
      const expectMatch = step.title.match(/expect\((.+?)\)\.(.+?)\((.+?)\)/);
      if (expectMatch) {
        dbStep.selector = expectMatch[1];
        dbStep.expectedValue = expectMatch[3];
        // Actual value will be determined in onStepEnd
      }
    }

    await this.repository.createTestStep(dbStep);
    console.log(`  Step ${stepNumber}: ${step.title}`);
  }

  async onStepEnd(test, result, step) {
    if (!this.testCaseMap.has(test.id)) return;

    const testCase = this.testCaseMap.get(test.id);
    const stepNumber = this.stepCounter.get(test.id);
    
    const duration = step.duration;
    const endTime = new Date(step.startTime + duration);
    const status = step.error ? 'failed' : 'passed';

    // Update step with completion info
    await this.repository.updateTestRun(testCase.run_id, {
      end_time: endTime,
      duration_ms: duration,
      status: status
    });

    if (step.error) {
      console.log(`  Step ${stepNumber} failed: ${step.error.message}`);
    }
  }

  async onTestEnd(test, result) {
    if (!this.testCaseMap.has(test.id)) return;

    const testCase = this.testCaseMap.get(test.id);
    const endTime = new Date(result.startTime + result.duration);

    // Update test case with final results
    await this.repository.updateTestCase(testCase.id, {
      end_time: endTime,
      duration_ms: result.duration,
      status: this.mapTestStatus(result.status),
      error_message: result.error?.message,
      error_stack: result.error?.stack
    });

    // Save attachments (screenshots, videos, traces)
    for (const attachment of result.attachments) {
      if (attachment.path) {
        try {
          const stats = await fs.stat(attachment.path);
          await this.repository.createTestAttachment({
            testCaseId: testCase.id,
            attachmentType: this.mapAttachmentType(attachment.name, attachment.contentType),
            fileName: path.basename(attachment.path),
            filePath: attachment.path,
            fileSizeBytes: stats.size,
            contentType: attachment.contentType
          });
        } catch (error) {
          console.warn(`Could not save attachment ${attachment.path}:`, error);
        }
      }
    }

    // Capture performance metrics if available
    if (result.steps) {
      let totalActionTime = 0;
      let navigationTime = 0;
      
      for (const step of result.steps) {
        totalActionTime += step.duration;
        if (step.title.includes('goto') || step.title.includes('navigate')) {
          navigationTime += step.duration;
        }
      }

      // Save performance metrics
      if (totalActionTime > 0) {
        await this.repository.createPerformanceMetrics({
          testCaseId: testCase.id,
          metricName: 'total_action_time',
          metricValue: totalActionTime,
          metricUnit: 'ms',
          recordedAt: endTime
        });
      }

      if (navigationTime > 0) {
        await this.repository.createPerformanceMetrics({
          testCaseId: testCase.id,
          metricName: 'navigation_time',
          metricValue: navigationTime,
          metricUnit: 'ms',
          recordedAt: endTime
        });
      }

      await this.repository.createPerformanceMetrics({
        testCaseId: testCase.id,
        metricName: 'test_duration',
        metricValue: result.duration,
        metricUnit: 'ms',
        recordedAt: endTime
      });
    }

    const status = result.status === 'passed' ? 'PASS' : result.status === 'failed' ? 'FAIL' : 'SKIP';
    console.log(`${status}: ${test.title} (${result.duration}ms)`);
  }

  async onEnd(result) {
    if (!this.currentRun) return;

    const endTime = new Date();
    const duration = endTime.getTime() - this.currentRun.start_time.getTime();

    // Calculate test statistics
    const testCases = await this.repository.getTestCasesForRun(this.currentRun.id);
    const stats = {
      total_tests: testCases.length,
      passed_tests: testCases.filter(tc => tc.status === 'passed').length,
      failed_tests: testCases.filter(tc => tc.status === 'failed').length,
      skipped_tests: testCases.filter(tc => tc.status === 'skipped').length
    };

    // Update test run with final results
    await this.repository.updateTestRun(this.currentRun.id, {
      end_time: endTime,
      duration_ms: duration,
      status: result.status === 'passed' ? 'passed' : 'failed',
      ...stats
    });

    // Generate summary
    const summary = await this.repository.getTestRunSummary(this.currentRun.id);
    
    console.log('Test run completed!');
    console.log(`   Total: ${stats.total_tests}`);
    console.log(`   Passed: ${stats.passed_tests}`);
    console.log(`   Failed: ${stats.failed_tests}`);
    console.log(`   Skipped: ${stats.skipped_tests}`);
    console.log(`   Duration: ${duration}ms`);
    console.log(`   Database record ID: ${this.currentRun.id}`);

    // Close database connection
    const db = DatabaseManager.getInstance();
    await db.close();
  }

  mapTestStatus(status) {
    switch (status) {
      case 'passed': return 'passed';
      case 'failed': return 'failed';
      case 'skipped': return 'skipped';
      case 'timedOut': return 'timedout';
      default: return 'failed';
    }
  }

  mapAttachmentType(name, contentType) {
    const attachmentName = name || '';
    const attachmentContentType = contentType || '';
    
    if (attachmentName.includes('screenshot') || attachmentContentType.includes('image')) return 'screenshot';
    if (attachmentName.includes('video') || attachmentContentType.includes('video')) return 'video';
    if (attachmentName.includes('trace') || attachmentName.includes('.zip')) return 'trace';
    return 'other';
  }
}

export default DatabaseReporter;