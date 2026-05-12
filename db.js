const { Pool } = require('pg');

let pool;

async function getDbConnection() {
  if (!pool) {
    pool = new Pool({
      connectionString: process.env.DATABASE_URL,
      // Render requires SSL for external connections, but often internal connections don't.
      // Usually, deploying on Render with a Render Postgres DB requires ssl: true if connecting from outside,
      // but ssl: { rejectUnauthorized: false } is a safe default for many cloud providers.
      ssl: process.env.NODE_ENV === 'production' ? { rejectUnauthorized: false } : false
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
