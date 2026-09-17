import { readFile } from 'node:fs/promises';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import pg from 'pg';
const { Pool } = pg;
import { config } from '../config.js';

/** Jalankan schema.sql terhadap PostgreSQL. */
async function migrate(): Promise<void> {
  if (config.useInMemory) {
    console.log('USE_IN_MEMORY=true → tidak ada migrasi DB yang perlu dijalankan.');
    return;
  }

  const here = dirname(fileURLToPath(import.meta.url));
  const schemaPath = join(here, 'schema.sql');
  const sql = await readFile(schemaPath, 'utf8');

  const pool = new Pool({ connectionString: config.databaseUrl });
  try {
    await pool.query(sql);
    console.log('Migrasi selesai. Tabel sudah siap.');
  } finally {
    await pool.end();
  }
}

migrate().catch((err) => {
  console.error('Migrasi gagal:', err);
  process.exit(1);
});
