import { execFileSync } from 'node:child_process';
import { rmSync } from 'node:fs';
import { resolve } from 'node:path';

/**
 * Tests run against a real database, not a mocked Prisma client. Mocking the
 * ORM would test that our mocks agree with our code; it would not catch a bad
 * `where` clause, a missing index, a Decimal that round-trips wrong, or a
 * unique-constraint violation — which is most of what can actually break here.
 *
 * A throwaway SQLite file makes that cheap: the whole database is created from
 * the migrations and deleted afterwards.
 */
const DB_FILE = resolve(import.meta.dirname, '../../prisma/test.db');

export function setup(): void {
  rmSync(DB_FILE, { force: true });
  rmSync(`${DB_FILE}-journal`, { force: true });

  execFileSync('npx', ['prisma', 'migrate', 'deploy'], {
    stdio: 'ignore',
    env: { ...process.env, DATABASE_URL: 'file:./test.db' },
  });
}

export function teardown(): void {
  rmSync(DB_FILE, { force: true });
  rmSync(`${DB_FILE}-journal`, { force: true });
}
