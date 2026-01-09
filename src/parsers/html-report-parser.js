import { promises as fs } from 'fs';
import * as path from 'path';
import { parse } from 'node-html-parser';
import { TestRepository } from '../database/repository.js';

export class HtmlReportParser {
  constructor() {
    this.repository = new TestRepository();
  }

  /**
   * Parse Playwright HTML report and extract detailed test information
   */
  async parseReport(reportPath) {
    try {
      console.log(`Parsing HTML report: ${reportPath}`);

      // Read the main HTML report file
      const htmlContent = await fs.readFile(reportPath, 'utf-8');
      const document = parse(htmlContent);

      // Extract basic report data
      const reportData = await this.extractReportData(document, reportPath);

      // Parse detailed test information from JSON data
      const detailedData = await this.extractDetailedTestData(reportPath);
      if (detailedData) {
        reportData.testDetails = detailedData.testDetails;
        reportData.summary = { ...reportData.summary, ...detailedData.summary };
      }

      console.log(`Successfully parsed report with ${reportData.totalTests} tests`);
      return reportData;

    } catch (error) {
      console.error('Error parsing HTML report:', error);
      throw error;
    }
  }

  /**
   * Parse and store report data in database, augmenting existing test run data
   */
  async parseAndStoreReport(reportPath, runId) {
    try {
      const reportData = await this.parseReport(reportPath);
      reportData.runId = runId;

      // Store report metadata
      if (runId) {
        await this.repository.createReportMetadata({
          run_id: runId,
          report_file_path: reportPath,
          parsed_at: new Date(),
          parsing_status: 'success',
          additional_data: reportData
        });

        // Update test run with parsed data if not already present
        const existingRun = await this.repository.getTestRun(runId);
        if (existingRun && !existingRun.html_report_path) {
          await this.repository.updateTestRun(runId, {
            html_report_path: reportPath,
            total_tests: reportData.totalTests,
            passed_tests: reportData.passedTests,
            failed_tests: reportData.failedTests,
            skipped_tests: reportData.skippedTests
          });
        }

        // Enhance test cases with report data
        await this.enhanceTestCasesWithReportData(runId, reportData.testDetails);
      }

      console.log(`Report data stored successfully for run ${runId}`);

    } catch (error) {
      console.error('Error storing report data:', error);
      
      if (runId) {
        await this.repository.createReportMetadata({
          run_id: runId,
          report_file_path: reportPath,
          parsed_at: new Date(),
          parsing_status: 'failed',
          parsing_errors: error instanceof Error ? error.message : 'Unknown error'
        });
      }
      throw error;
    }
  }

  async extractReportData(document, reportPath) {
    const reportData = {
      totalTests: 0,
      passedTests: 0,
      failedTests: 0,
      skippedTests: 0,
      duration: 0,
      browserInfo: [],
      testDetails: [],
      summary: {}
    };

    try {
      // Extract summary statistics from HTML
      const summaryElements = document.querySelectorAll('.summary-tab');
      for (const element of summaryElements) {
        const text = element.text;
        if (text.includes('passed')) {
          const match = text.match(/(\d+)\s+passed/);
          if (match) reportData.passedTests = parseInt(match[1]);
        }
        if (text.includes('failed')) {
          const match = text.match(/(\d+)\s+failed/);
          if (match) reportData.failedTests = parseInt(match[1]);
        }
        if (text.includes('skipped')) {
          const match = text.match(/(\d+)\s+skipped/);
          if (match) reportData.skippedTests = parseInt(match[1]);
        }
      }

      reportData.totalTests = reportData.passedTests + reportData.failedTests + reportData.skippedTests;

      // Extract duration information
      const durationElement = document.querySelector('.duration');
      if (durationElement) {
        const durationText = durationElement.text;
        const durationMatch = durationText.match(/(\d+(?:\.\d+)?)(ms|s|m)/);
        if (durationMatch) {
          let duration = parseFloat(durationMatch[1]);
          const unit = durationMatch[2];
          if (unit === 's') duration *= 1000;
          if (unit === 'm') duration *= 60000;
          reportData.duration = duration;
        }
      }

      // Extract browser information
      const browserElements = document.querySelectorAll('.project-name');
      reportData.browserInfo = browserElements.map((el) => el.text).filter(Boolean);

    } catch (error) {
      console.warn('Error extracting basic report data:', error);
    }

    return reportData;
  }

  async extractDetailedTestData(reportPath) {
    try {
      // Look for JSON data files in the report directory
      const reportDir = path.dirname(reportPath);
      const dataDir = path.join(reportDir, 'data');

      if (await this.directoryExists(dataDir)) {
        const files = await fs.readdir(dataDir);
        const jsonFiles = files.filter(f => f.endsWith('.json'));

        for (const jsonFile of jsonFiles) {
          try {
            const jsonPath = path.join(dataDir, jsonFile);
            const jsonContent = await fs.readFile(jsonPath, 'utf-8');
            const data = JSON.parse(jsonContent);

            if (data.suites || data.tests) {
              return this.parseJsonTestData(data);
            }
          } catch (jsonError) {
            console.warn(`Could not parse JSON file ${jsonFile}:`, jsonError);
          }
        }
      }

      // Fallback: try to extract data from embedded JavaScript in HTML
      return await this.extractEmbeddedTestData(reportPath);

    } catch (error) {
      console.warn('Could not extract detailed test data:', error);
      return null;
    }
  }

  async extractEmbeddedTestData(reportPath) {
    try {
      const htmlContent = await fs.readFile(reportPath, 'utf-8');
      
      // Look for embedded JSON data in script tags
      const scriptMatch = htmlContent.match(/<script[^>]*>\s*window\.playwrightReportBase64\s*=\s*['"](.*?)['"];?\s*<\/script>/s);
      if (scriptMatch) {
        const base64Data = scriptMatch[1];
        const jsonData = Buffer.from(base64Data, 'base64').toString('utf-8');
        const data = JSON.parse(jsonData);
        return this.parseJsonTestData(data);
      }

      // Alternative: look for direct JSON assignment
      const jsonMatch = htmlContent.match(/window\.playwrightReport\s*=\s*({.*?});/s);
      if (jsonMatch) {
        const data = JSON.parse(jsonMatch[1]);
        return this.parseJsonTestData(data);
      }

    } catch (error) {
      console.warn('Could not extract embedded test data:', error);
    }

    return null;
  }

  parseJsonTestData(data) {
    const testDetails = [];
    const summary = {
      startTime: data.startTime ? new Date(data.startTime) : undefined,
      playwrightVersion: data.version
    };

    if (data.suites) {
      this.parseSuites(data.suites, testDetails);
    }

    if (data.tests) {
      for (const test of data.tests) {
        testDetails.push(this.parseTestCase(test));
      }
    }

    return { testDetails, summary };
  }

  parseSuites(suites, testDetails, parentTitle = '') {
    for (const suite of suites) {
      const suiteTitle = parentTitle ? `${parentTitle} › ${suite.title}` : suite.title;
      
      if (suite.tests) {
        for (const test of suite.tests) {
          testDetails.push(this.parseTestCase(test, suiteTitle));
        }
      }

      if (suite.suites) {
        this.parseSuites(suite.suites, testDetails, suiteTitle);
      }
    }
  }

  parseTestCase(test, suiteTitle) {
    const detail = {
      title: test.title,
      fullTitle: suiteTitle ? `${suiteTitle} › ${test.title}` : test.title,
      file: test.location?.file || test.file || '',
      duration: 0,
      status: 'unknown',
      retries: 0,
      attachments: []
    };

    if (test.results && test.results.length > 0) {
      const result = test.results[test.results.length - 1]; // Get the last result (final attempt)
      
      detail.duration = result.duration || 0;
      detail.status = result.status || 'unknown';
      detail.retries = test.results.length - 1;
      
      if (result.error) {
        detail.error = result.error.message || result.error;
      }

      if (result.attachments) {
        detail.attachments = result.attachments.map((att) => ({
          name: att.name,
          type: att.contentType || 'unknown',
          path: att.path,
          size: att.body ? att.body.length : undefined
        }));
      }
    }

    return detail;
  }

  async enhanceTestCasesWithReportData(runId, testDetails) {
    try {
      const existingTestCases = await this.repository.getTestCasesForRun(runId);
      
      for (const testCase of existingTestCases) {
        // Find matching test detail by title or file path
        const matchingDetail = testDetails.find(detail => 
          detail.title === testCase.test_name || 
          detail.fullTitle === testCase.test_title ||
          detail.file.includes(path.basename(testCase.file_path))
        );

        if (matchingDetail) {
          // Update test case with additional report data if missing
          const updates = {};
          
          if (!testCase.duration_ms && matchingDetail.duration) {
            updates.duration_ms = matchingDetail.duration;
          }

          if (matchingDetail.error && !testCase.error_message) {
            updates.error_message = matchingDetail.error;
          }

          if (Object.keys(updates).length > 0) {
            await this.repository.updateTestCase(testCase.id, updates);
          }

          // Add attachments that might be missing
          for (const attachment of matchingDetail.attachments) {
            if (attachment.path) {
              await this.repository.createTestAttachment({
                test_case_id: testCase.id,
                attachment_type: this.mapAttachmentType(attachment.type),
                file_name: path.basename(attachment.path),
                file_path: attachment.path,
                file_size_bytes: attachment.size,
                content_type: attachment.type
              });
            }
          }
        }
      }

    } catch (error) {
      console.warn('Error enhancing test cases with report data:', error);
    }
  }

  mapAttachmentType(contentType) {
    if (contentType.includes('image')) return 'screenshot';
    if (contentType.includes('video')) return 'video';
    if (contentType.includes('zip') || contentType.includes('trace')) return 'trace';
    return 'log';
  }

  async directoryExists(dirPath) {
    try {
      const stat = await fs.stat(dirPath);
      return stat.isDirectory();
    } catch {
      return false;
    }
  }

  /**
   * Utility method to parse existing HTML reports and backfill database
   */
  async backfillFromExistingReports(reportsDirectory) {
    try {
      console.log(`Backfilling data from existing reports in ${reportsDirectory}`);
      
      const files = await fs.readdir(reportsDirectory);
      const htmlFiles = files.filter(f => f === 'index.html');

      for (const htmlFile of htmlFiles) {
        const reportPath = path.join(reportsDirectory, htmlFile);
        
        try {
          // Create a new test run for this historical report
          const reportData = await this.parseReport(reportPath);
          
          const testRun = await this.repository.createTestRun({
            suite_id: 1, // You may want to create a default historical suite
            run_name: `Historical run from ${path.basename(reportsDirectory)}`,
            start_time: reportData.summary.startTime || new Date(),
            end_time: reportData.summary.endTime || new Date(),
            duration_ms: reportData.duration,
            status: reportData.failedTests > 0 ? 'failed' : 'passed',
            total_tests: reportData.totalTests,
            passed_tests: reportData.passedTests,
            failed_tests: reportData.failedTests,
            skipped_tests: reportData.skippedTests,
            html_report_path: reportPath
          });

          await this.parseAndStoreReport(reportPath, testRun.id);
          console.log(`Backfilled report: ${reportPath}`);

        } catch (error) {
          console.error(`Error processing report ${reportPath}:`, error);
        }
      }

    } catch (error) {
      console.error('Error during backfill process:', error);
      throw error;
    }
  }
}