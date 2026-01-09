#!/usr/bin/env node
import { DatabaseManager } from '../database/connection.js';
import { promises as fs } from 'fs';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

async function setupDatabase() {
  console.log('Setting up database schema...');
  
  try {
    const db = DatabaseManager.getInstance();
    
    // Test connection
    console.log('Testing database connection...');
    const connected = await db.testConnection();
    if (!connected) {
      console.error('Failed to connect to database. Please check your .env configuration.');
      process.exit(1);
    }

    // Read and execute schema
    const schemaPath = join(__dirname, '../../database/schema.sql');
    console.log('Reading schema from:', schemaPath);
    
    const schema = await fs.readFile(schemaPath, 'utf-8');
    
    // Execute the entire schema as one statement to handle functions and triggers properly
    console.log('Executing database schema...');
    
    try {
      await db.query(schema);
      console.log('Database schema executed successfully!');
    } catch (error) {
      console.error('Error executing schema:', error.message);
      
      // If that fails, try splitting by CREATE statements
      console.log('Trying to execute statements individually...');
      const statements = schema.split(/(?=CREATE\s+(?:TABLE|INDEX|TRIGGER|FUNCTION|OR\s+REPLACE\s+FUNCTION))/i)
        .filter(stmt => stmt.trim().length > 0);
      
      for (let i = 0; i < statements.length; i++) {
        const statement = statements[i].trim();
        if (statement && !statement.startsWith('--')) {
          try {
            await db.query(statement);
            console.log(`Statement ${i + 1}/${statements.length} executed`);
          } catch (error) {
            console.warn(`Statement ${i + 1} warning:`, error.message);
          }
        }
      }
    }

    console.log('Database schema setup completed!');
    
    // Create a default test suite
    try {
      await db.query(`
        INSERT INTO test_suites (org_id, app_id, name, description) 
        VALUES ('1', '1', 'Default Suite', 'Default Playwright test suite')
        ON CONFLICT DO NOTHING
      `);
      console.log('Default test suite created');
    } catch (error) {
      console.warn('Could not create default test suite:', error.message);
    }

    await db.close();
    
  } catch (error) {
    console.error('Error setting up database:', error);
    process.exit(1);
  }
}

setupDatabase();