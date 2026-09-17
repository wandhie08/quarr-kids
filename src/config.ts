import 'dotenv/config';

export interface AppConfig {
  databaseUrl: string;
  useInMemory: boolean;
  llmProvider: string;
  llmApiKey: string;
}

export const config: AppConfig = {
  databaseUrl:
    process.env.DATABASE_URL ??
    'postgresql://postgres:postgres@localhost:5432/kids_brand_ai',
  useInMemory: (process.env.USE_IN_MEMORY ?? 'false').toLowerCase() === 'true',
  llmProvider: process.env.LLM_PROVIDER ?? 'openai',
  llmApiKey: process.env.LLM_API_KEY ?? '',
};
