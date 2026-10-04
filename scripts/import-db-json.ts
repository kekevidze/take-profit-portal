/**
 * One-time import: db.json → PostgreSQL (upsert, no truncate).
 * Usage: DATABASE_URL=... npm run db:import [path/to/db.json]
 */
import fs from 'fs';
import path from 'path';
import dotenv from 'dotenv';
import { db, DEFAULT_SETTINGS } from '../serverDb.ts';

dotenv.config();

async function main() {
  const dryRun = process.argv.includes('--dry-run');
  const fileArg = process.argv.find((a) => a.endsWith('.json') && !a.startsWith('--'));
  const dbPath = fileArg ? path.resolve(fileArg) : path.join(process.cwd(), 'db.json');

  if (!process.env.DATABASE_URL) {
    console.error('DATABASE_URL is required.');
    process.exit(1);
  }

  if (!fs.existsSync(dbPath)) {
    console.error(`File not found: ${dbPath}`);
    process.exit(1);
  }

  const raw = fs.readFileSync(dbPath, 'utf-8');
  const snapshot = JSON.parse(raw);
  snapshot.settings = { ...DEFAULT_SETTINGS, ...snapshot.settings };

  const sessionCount = (snapshot.sessions || []).length;
  const userCount = (snapshot.users || []).length;
  const depositCount = (snapshot.deposits || []).length;

  console.log(`Source ${dbPath}: users=${userCount}, sessions=${sessionCount}, deposits=${depositCount}`);

  if (dryRun) {
    console.log('Dry run — no writes.');
    process.exit(0);
  }

  await db.ready;
  const result = await db.importFromSnapshot(snapshot);

  const listed = await db.getSessions();
  console.log(`Import complete: upserted users=${result.users}, sessions=${result.sessions}, deposits=${result.deposits}`);
  console.log(`Postgres session count: ${listed.length} (expected ${sessionCount})`);

  if (listed.length < sessionCount) {
    console.warn('Warning: Postgres session count is lower than db.json — investigate duplicates or failed rows.');
    process.exit(1);
  }
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
