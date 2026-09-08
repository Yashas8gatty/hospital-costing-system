const fs = require('fs');
const path = require('path');
const { Pool } = require('pg');

require('dotenv').config({ path: path.join(__dirname, '../.env') });

const MIGRATIONS_DIR = path.join(__dirname, '../database/migrations');

async function runMigrations() {
  const pool = new Pool({
    host: process.env.DB_HOST,
    port: Number(process.env.DB_PORT),
    database: process.env.DB_NAME,
    user: process.env.DB_USER,
    password: process.env.DB_PASSWORD,
  });

  const client = await pool.connect();

  try {
    console.log(`Connecting to database '${process.env.DB_NAME}' on host '${process.env.DB_HOST}:${process.env.DB_PORT}'...`);

    // 1. Ensure schema_migrations table exists
    await client.query(`
      CREATE TABLE IF NOT EXISTS schema_migrations (
        id SERIAL PRIMARY KEY,
        name VARCHAR(255) NOT NULL UNIQUE,
        applied_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP
      );
    `);

    // 2. Fetch applied migrations
    const { rows: appliedRows } = await client.query('SELECT name FROM schema_migrations');
    const appliedNames = new Set(appliedRows.map((r) => r.name));

    // 3. Read migration files from directory
    if (!fs.existsSync(MIGRATIONS_DIR)) {
      throw new Error(`Migrations directory not found: ${MIGRATIONS_DIR}`);
    }

    const files = fs
      .readdirSync(MIGRATIONS_DIR)
      .filter((f) => f.endsWith('.sql'))
      .sort();

    console.log(`Found ${files.length} migration file(s) in '${MIGRATIONS_DIR}'`);

    let appliedCount = 0;

    for (const file of files) {
      if (appliedNames.has(file)) {
        console.log(`- [SKIP] ${file} (already applied)`);
        continue;
      }

      console.log(`- [APPLYING] ${file}...`);
      const filePath = path.join(MIGRATIONS_DIR, file);
      const sql = fs.readFileSync(filePath, 'utf8');

      await client.query('BEGIN');
      try {
        await client.query(sql);
        await client.query('INSERT INTO schema_migrations (name) VALUES ($1)', [file]);
        await client.query('COMMIT');
        console.log(`  ✓ [SUCCESS] ${file}`);
        appliedCount++;
      } catch (err) {
        await client.query('ROLLBACK');
        console.error(`  ✗ [FAILED] ${file}: ${err.message}`);
        throw err;
      }
    }

    if (appliedCount === 0) {
      console.log('Database schema is already up to date.');
    } else {
      console.log(`\nSuccessfully applied ${appliedCount} migration(s).`);
    }
  } finally {
    client.release();
    await pool.end();
  }
}

runMigrations().catch((err) => {
  console.error('\nMigration run failed with error:', err.message);
  process.exit(1);
});
