import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    environment: 'node',
    globalSetup: ['./src/test/global-setup.ts'],
    // The suite shares one SQLite file, so files run sequentially rather than
    // racing each other through the same tables.
    fileParallelism: false,
    env: {
      NODE_ENV: 'test',
      DATABASE_URL: 'file:./test.db',
      LOG_LEVEL: 'silent',
      RATE_LIMIT_PER_MINUTE: '0',
    },
  },
});
