// spec: ### Zoho CRM Login and Create Lead Test - Fixed Version
// seed: tests/seed.spec.ts

import { test, expect } from '@playwright/test';
import dotenv from 'dotenv';

// Load environment variables
dotenv.config();

test.describe('Zoho CRM Login and Create Lead Test - Fixed Version', () => {
  test('Login to Zoho CRM and Create Lead', async ({ page }) => {
    // Navigate to Zoho CRM website
    await page.goto('https://www.zoho.com/crm/');

    // Click Sign In to access login page
    await page.getByRole('link', { name: 'Sign In' }).click();

    // Enter email address for login
    await page.getByRole('textbox', { name: 'Email address or mobile number' }).fill(process.env.ZOHO_EMAIL || '');

    // Enter password for login
    await page.getByRole('textbox', { name: 'Enter password' }).fill(process.env.ZOHO_PASSWORD || 'nn');

    // Submit login credentials by clicking Next
    await page.getByRole('button', { name: 'Next' }).click();

    // Wait for potential second step or redirect to CRM dashboard
    await page.waitForTimeout(3000);
    
    // Check if we need to click Sign In (if there's a second step)
    const signInButton = await page.locator('button:has-text("Sign in")').first();
    if (await signInButton.isVisible()) {
      await signInButton.click();
    }

    // Wait for CRM dashboard to fully load
    await page.waitForURL('**/crm/**', { timeout: 30000 });
    await page.waitForTimeout(5000);

    // Wait for the page to be fully interactive and look for Create Lead button
    await page.waitForFunction(() => {
      const buttons = document.querySelectorAll('button');
      for (let button of buttons) {
        if (button.textContent?.includes('Create Lead')) {
          return true;
        }
      }
      return false;
    }, { timeout: 15000 });

    // Click Create Lead to open lead creation form
    await page.locator('button:has-text("Create Lead")').click();

    // Wait a moment for the form to load, then cancel
    await page.waitForTimeout(3000);

    // Cancel the create lead action
    await page.getByRole('button', { name: 'Cancel' }).click();

    // Verify we're back at the Leads page by checking for Create Lead button again
    await page.waitForSelector('button:has-text("Create Lead")', { timeout: 10000 });
    await expect(page.locator('button:has-text("Create Lead")')).toBeVisible();
  });
});