/**
 * Wipe demo users, sessions, deposits, and audit logs.
 * Keeps only manager@portal.com (hidden system account).
 */
import dotenv from 'dotenv';
import { db } from '../serverDb.ts';

dotenv.config();

async function main() {
  await db.ready;
  await db.resetToSystemOnly();
  console.log('Database reset to system manager only (no sessions, deposits, or audit logs).');
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
