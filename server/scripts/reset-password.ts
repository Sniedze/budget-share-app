import '../src/loadEnv.js';
import { ensureSchema, migrateSchema } from '../src/db/mysql.js';
import { ensureUserAccount, verifyUserLogin } from './ensure-user.js';

const email = (process.argv[2] ?? '').trim().toLowerCase();
const password = process.argv[3] ?? 'DemoPass123!';
const fullName = process.argv[4] ?? 'User';

if (!email) {
  console.error('Usage: npm run reset-password -- <email> [password] [fullName]');
  process.exit(1);
}

await ensureSchema();
await migrateSchema();
await ensureUserAccount({ email, password, fullName });
await verifyUserLogin(email, password);

console.log(`Password updated and verified for ${email}`);
console.log(`  Password: ${password}`);
