#!/usr/bin/env node
import { HtmlReportParser } from '../parsers/html-report-parser.js';
import { TestRepository } from '../database/repository.js';
import path from 'path';

async function parseReport() {
  const reportPath = process.argv[2];
  const runId = process.argv[3] ? parseInt(process.argv[3]) : undefined;
  
  if (!reportPath) {
    console.error('Usage: node parse-report.js <report-path> [run-id]');
    console.error('Example: node parse-report.js ./playwright-report/index.html 123');
    process.exit(1);
  }

  console.log('Parsing Playwright HTML report...');
  console.log('Report path:', reportPath);
  if (runId) {
    console.log('Run ID:', runId);
  }

  try {
    const parser = new HtmlReportParser();
    
    if (runId) {
      // Parse and store in database with specific run ID
      await parser.parseAndStoreReport(reportPath, runId);
      console.log(`Report parsed and data stored for run ${runId}`);
    } else {
      // Just parse and display the data
      const reportData = await parser.parseReport(reportPath);
      
      console.log('\nReport Summary:');
      console.log(`Total Tests: ${reportData.totalTests}`);
      console.log(`Passed: ${reportData.passedTests}`);
      console.log(`Failed: ${reportData.failedTests}`);
      console.log(`Skipped: ${reportData.skippedTests}`);
      console.log(`Duration: ${reportData.duration}ms`);
      console.log(`Browsers: ${reportData.browserInfo.join(', ')}`);
      
      if (reportData.testDetails.length > 0) {
        console.log('\nTest Details:');
        reportData.testDetails.forEach((test, index) => {
          console.log(`  ${index + 1}. ${test.title}`);
          console.log(`     Status: ${test.status}`);
          console.log(`     Duration: ${test.duration}ms`);
          console.log(`     File: ${test.file}`);
          if (test.error) {
            console.log(`     Error: ${test.error.substring(0, 100)}...`);
          }
          if (test.attachments.length > 0) {
            console.log(`     Attachments: ${test.attachments.length}`);
          }
          console.log('');
        });
      }
    }
    
  } catch (error) {
    console.error('Error parsing report:', error);
    process.exit(1);
  }
}

parseReport();