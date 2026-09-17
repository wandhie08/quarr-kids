import { createRepository } from './factory.js';
import { seed } from './seed-data.js';

/** Isi database dengan data contoh (npm run db:seed). */
async function main(): Promise<void> {
  const repo = await createRepository();
  try {
    await seed(repo);
    console.log('Seed data selesai.');
  } finally {
    await repo.close();
  }
}

main().catch((err) => {
  console.error('Seed gagal:', err);
  process.exit(1);
});
