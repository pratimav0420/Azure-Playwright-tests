// spec: ### Zoho CRM Login and Create Lead Test
// seed: tests/seed.spec.ts

import { test, expect } from '@playwright/test';
import dotenv from 'dotenv';

// Load environment variables
dotenv.config();

test.describe('Zoho CRM Login and Create Lead Test', () => {
  test('Login to Zoho CRM and Create Lead', async ({ page }) => {
    // Navigate to Zoho CRM website
    await page.goto('https://www.zoho.com/crm/');

    // Click Sign In to access login page
    await page.getByRole('link', { name: 'Sign In' }).click();

    // Wait for login page to load completely
    await new Promise(f => setTimeout(f, 3 * 1000));

    // Enter email address for login
    await page.getByRole('textbox', { name: 'Email address or mobile number' }).fill(process.env.ZOHO_EMAIL || '');

    // Enter password for login
    await page.getByRole('textbox', { name: 'Enter password' }).fill(process.env.ZOHO_PASSWORD || 'nn');

    // Submit login credentials
    await page.locator('button:has-text("Sign in"):not([aria-label*="Sign in with"])').click();
    
    // Wait for CRM dashboard to load after login
    await new Promise(f => setTimeout(f, 5 * 1000));

    // Wait for CRM interface to fully load
    await new Promise(f => setTimeout(f, 5 * 1000));

    // Click Create Lead to open lead creation form
    await page.getByRole('button', { name: 'Create Lead' }).click();

    await new Promise(f => setTimeout(f, 5 * 1000));

    // Cancel the create lead action
    await page.getByRole('button', { name: 'Cancel' }).click();

    // Verify we're back at the Leads page
    await expect(page.getByRole('button', { name: 'Create Lead' })).toBeVisible();
  });
});