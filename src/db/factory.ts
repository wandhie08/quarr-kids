import { config } from '../config.js';
import { InMemoryRepository } from './in-memory-repository.js';
import { PostgresRepository } from './postgres-repository.js';
import type { Repository } from './repository.js';

/** Pilih implementasi repository berdasarkan konfigurasi. */
export async function createRepository(): Promise<Repository> {
  const repo: Repository = config.useInMemory
    ? new InMemoryRepository()
    : new PostgresRepository(config.databaseUrl);
  await repo.init();
  return repo;
}
