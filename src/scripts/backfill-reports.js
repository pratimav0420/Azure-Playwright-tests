#!/usr/bin/env node
import { HtmlReportParser } from '../parsers/html-report-parser.js';
import { TestRepository } from '../database/repository.js';
import path from 'path';

async function backfillReports() {
  const reportsDir = process.argv[2] || './playwright-report';
  
  console.log('Backfilling historical test reports...');
  console.log('Reports directory:', reportsDir);

  try {
    const parser = new HtmlReportParser();
    const repository = new TestRepository();
    
    // Ensure we have a default suite for historical data
    let defaultSuite = await repository.getTestSuiteByName('Historical Reports');
    if (!defaultSuite) {
      const suiteId = await repository.createTestSuite({
        orgId: process.env.ORG_ID || '1',
        appId: process.env.APP_ID || '1',
        name: 'Historical Reports',
        description: 'Test suite for historical report backfill'
      });
      defaultSuite = { id: suiteId };
      console.log('Created historical reports suite');
    }

    await parser.backfillFromExistingReports(reportsDir);
    console.log('Backfill completed successfully!');
    
  } catch (error) {
    console.error('Error during backfill:', error);
    process.exit(1);
  }
}

backfillReports();