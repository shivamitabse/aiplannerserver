const { Pool } = require('pg');

let pool;

async function getDbConnection() {
  if (!pool) {
    pool = new Pool({
      connectionString: process.env.DATABASE_URL,
      // Enable SSL for remote connections (like Render) even in development
      ssl: process.env.DATABASE_URL && !process.env.DATABASE_URL.includes('localhost') && !process.env.DATABASE_URL.includes('127.0.0.1')
        ? { rejectUnauthorized: false }
        : false
    });

    // Initialize tables
    const client = await pool.connect();
    try {
      await client.query(`
        CREATE TABLE IF NOT EXISTS leads (
          id SERIAL PRIMARY KEY,
          report_id TEXT UNIQUE,
          email TEXT,
          company TEXT,
          role TEXT,
          is_consultation BOOLEAN DEFAULT FALSE,
          created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
        );
        
        CREATE TABLE IF NOT EXISTS audits (
          id SERIAL PRIMARY KEY,
          report_id TEXT UNIQUE,
          data TEXT,
          summary TEXT,
          recommendations TEXT,
          total_monthly_savings REAL,
          total_annual_savings REAL,
          created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
        );
      `);
    } finally {
      client.release();
    }
  }

  return pool;
}

module.exports = { getDbConnection };
