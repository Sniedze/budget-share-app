import '../src/loadEnv.js';
import { ensureSchema, migrateSchema } from '../src/db/mysql.js';
import { createGroup, listGroups } from '../src/modules/groups/service.js';
import { createExpense } from '../src/modules/expenses/service.js';
import { ensureUserAccount, verifyUserLogin } from './ensure-user.js';

const DEMO_HOUSEHOLD_NAME = 'Demo Household';
const PARTNER_EMAIL = 'partner-demo@example.com';
const PARTNER_NAME = 'Partner Demo';

const email = (process.argv[2] ?? 'demo@example.com').trim().toLowerCase();
const password = process.argv[3] ?? 'DemoPass123!';
const fullName = process.argv[4] ?? 'Demo User';

await ensureSchema();
await migrateSchema();

const userId = await ensureUserAccount({ email, password, fullName });
console.log(`User ready: ${email}`);
await verifyUserLogin(email, password);
console.log('Login check: OK');

const today = new Date().toISOString().slice(0, 10);
let groups = await listGroups(email, userId);
let household = groups.find((group) => group.name === DEMO_HOUSEHOLD_NAME);

if (!household) {
  const created = await createGroup(
    {
      name: DEMO_HOUSEHOLD_NAME,
      description: 'Sample household for trying Settlements',
      members: [
        { name: fullName, email, ratio: 50 },
        { name: PARTNER_NAME, email: PARTNER_EMAIL, ratio: 50 },
      ],
    },
    email,
  );
  household = created;
  console.log(`Created household "${DEMO_HOUSEHOLD_NAME}" (id ${created.id}).`);
}

const hasSampleExpenses = household.expenses.some((expense) => !expense.isPrivate);
if (!hasSampleExpenses) {
  await createExpense(
    {
      title: 'Weekly groceries',
      amount: 240,
      transactionDate: today,
      category: 'Groceries',
      expenseGroup: 'Groceries',
      split: 'Shared',
      groupId: household.id,
      isPrivate: false,
    },
    { userId, email },
  );
  await createExpense(
    {
      title: 'Electric bill',
      amount: 120,
      transactionDate: today,
      category: 'Utilities',
      expenseGroup: 'Utilities',
      split: 'Shared',
      groupId: household.id,
      isPrivate: false,
    },
    { userId, email },
  );
  console.log('Added sample shared expenses (Groceries, Utilities).');
  groups = await listGroups(email, userId);
  household = groups.find((group) => group.id === household?.id) ?? household;
}

console.log('');
console.log('Sign in at http://localhost:5173');
console.log(`  Email:    ${email}`);
console.log(`  Password: ${password}`);
console.log(`  Household: ${DEMO_HOUSEHOLD_NAME} (${household?.members.length ?? 0} members)`);
