const sqlite3 = require('sqlite3').verbose();
const { open } = require('sqlite');
const path = require('path');

async function getDbConnection() {
  const dbPath = path.resolve(__dirname, 'database.sqlite');
  const db = await open({
    filename: dbPath,
    driver: sqlite3.Database
  });

  // Initialize tables
  await db.exec(`
    CREATE TABLE IF NOT EXISTS leads (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      report_id TEXT UNIQUE,
      email TEXT,
      company TEXT,
      role TEXT,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP
    );
    
    CREATE TABLE IF NOT EXISTS audits (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      report_id TEXT UNIQUE,
      data TEXT,
      summary TEXT,
      recommendations TEXT,
      total_monthly_savings REAL,
      total_annual_savings REAL,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP
    );
  `);

  return db;
}

module.exports = { getDbConnection };
