import '../src/loadEnv.js';
import { ensureSchema, migrateSchema } from '../src/db/mysql.js';
import { listHouseholdSettlements } from '../src/modules/groups/service.js';
import { queryOne } from '../src/db/queryHelpers.js';
import type { RowDataPacket } from 'mysql2';

const email = (process.argv[2] ?? 'alex@example.com').trim().toLowerCase();

type UserRow = { id: number; email: string } & RowDataPacket;

await ensureSchema();
await migrateSchema();

const user = await queryOne<UserRow>('SELECT id, email FROM users WHERE email = ? LIMIT 1', [email]);
if (!user) {
  console.error(`No user for ${email}`);
  process.exit(1);
}

try {
  const settlements = await listHouseholdSettlements(email, String(user.id));
  console.log(JSON.stringify(settlements, null, 2));
  console.log(`\nOK: ${settlements.length} household(s)`);
} catch (error) {
  console.error('listHouseholdSettlements failed:');
  console.error(error);
  process.exit(1);
}
