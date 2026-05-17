import '../src/loadEnv.js';
import { ensureSchema, migrateSchema } from '../src/db/mysql.js';
import { createGroup, listGroups, upsertSplitTemplate } from '../src/modules/groups/service.js';
import { createExpense } from '../src/modules/expenses/service.js';
import { ensureUserAccount, verifyUserLogin } from './ensure-user.js';

/**
 * Usage:
 *   npm run seed-account
 *   npm run seed-account -- email@example.com Password123! "Full Name" "Household Name" "Expense Group" roommate@example.com "Roommate Name"
 */

const email = (process.argv[2] ?? 'alex@example.com').trim().toLowerCase();
const password = process.argv[3] ?? 'DemoPass123!';
const fullName = process.argv[4] ?? 'Alex Demo';
const householdName = process.argv[5] ?? 'Copenhagen Flat';
const expenseGroupName = process.argv[6] ?? 'Rent';
const partnerEmail = (process.argv[7] ?? 'roommate@example.com').trim().toLowerCase();
const partnerName = process.argv[8] ?? 'Roommate';

await ensureSchema();
await migrateSchema();

const userId = await ensureUserAccount({ email, password, fullName });
console.log(`User ready: ${email} (password synced to script value).`);
await verifyUserLogin(email, password);
console.log('Login check: OK');
const viewer = { userId, email };
const groups = await listGroups(viewer);
let household = groups.find((group) => group.name === householdName);

if (!household) {
  household = await createGroup(
    {
      name: householdName,
      description: `Household with expense group “${expenseGroupName}”`,
      members: [
        { name: fullName, email, ratio: 50 },
        { name: partnerName, email: partnerEmail, ratio: 50 },
      ],
    },
    viewer,
  );
  console.log(`Created household “${householdName}” (id ${household.id}).`);
}

const memberNames = household.members.map((member) => member.name);
const hasExpenseGroup = household.expenseGroupLabels.some(
  (label) => label.toLowerCase() === expenseGroupName.toLowerCase(),
);

if (!hasExpenseGroup) {
  await upsertSplitTemplate(
    {
      groupId: household.id,
      category: expenseGroupName,
      templateName: `${expenseGroupName} split`,
      splitDetails: memberNames.map((participant) => ({
        participant,
        ratio: memberNames.length === 2 ? 50 : Number((100 / memberNames.length).toFixed(2)),
      })),
    },
    email,
  );
  console.log(`Created expense group “${expenseGroupName}” with 50/50 split.`);
}

const today = new Date().toISOString().slice(0, 10);
const hasExpenseInGroup = household.expenses.some(
  (expense) =>
    !expense.isPrivate &&
    (expense.expenseGroup ?? expense.category).toLowerCase() === expenseGroupName.toLowerCase(),
);

if (!hasExpenseInGroup) {
  await createExpense(
    {
      title: `${expenseGroupName} — sample`,
      amount: 1000,
      transactionDate: today,
      category: expenseGroupName,
      expenseGroup: expenseGroupName,
      split: 'Shared',
      groupId: household.id,
      isPrivate: false,
    },
    { userId, email },
  );
  console.log(`Added sample shared expense in “${expenseGroupName}”.`);
}

console.log('');
console.log('Sign in at http://localhost:5173');
console.log('  Use the email address below (not the display name).');
console.log(`  Email:         ${email}`);
console.log(`  Password:      ${password}`);
console.log(`  Household:     ${householdName}`);
console.log(`  Expense group: ${expenseGroupName}`);
console.log(`  Members:       ${memberNames.join(', ')}`);
