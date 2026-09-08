const fs = require('fs');
const path = require('path');
const { Pool } = require('pg');

require('dotenv').config({ path: path.join(__dirname, '../.env') });

const MIGRATIONS_DIR = path.join(__dirname, '../database/migrations');

async function checkStatus() {
  const pool = new Pool({
    host: process.env.DB_HOST,
    port: Number(process.env.DB_PORT),
    database: process.env.DB_NAME,
    user: process.env.DB_USER,
    password: process.env.DB_PASSWORD,
  });

  try {
    const { rows: appliedRows } = await pool
      .query('SELECT name, applied_at FROM schema_migrations ORDER BY id ASC')
      .catch(() => ({ rows: [] }));

    const appliedMap = new Map(appliedRows.map((r) => [r.name, r.applied_at]));

    const files = fs
      .readdirSync(MIGRATIONS_DIR)
      .filter((f) => f.endsWith('.sql'))
      .sort();

    console.log('\n=================== MIGRATION STATUS ===================');
    console.log(`Database: ${process.env.DB_NAME}`);
    console.log('--------------------------------------------------------');

    for (const file of files) {
      if (appliedMap.has(file)) {
        console.log(`  [APPLIED]  ${file} (${appliedMap.get(file).toISOString()})`);
      } else {
        console.log(`  [PENDING]  ${file}`);
      }
    }
    console.log('========================================================\n');
  } finally {
    await pool.end();
  }
}

checkStatus().catch(console.error);
