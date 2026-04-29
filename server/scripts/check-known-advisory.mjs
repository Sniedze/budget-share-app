import process from 'node:process';

const TARGET_ADVISORY = 'GHSA-w5hq-g745-h8pq';

let input = '';
for await (const chunk of process.stdin) {
  input += chunk;
}

if (!input.trim()) {
  console.error('No audit JSON input received.');
  process.exit(1);
}

let report;
try {
  report = JSON.parse(input);
} catch (error) {
  console.error('Failed to parse npm audit JSON:', error);
  process.exit(1);
}

const vulnerabilities = report?.vulnerabilities ?? {};
let found = false;

for (const entry of Object.values(vulnerabilities)) {
  if (!entry || typeof entry !== 'object' || !Array.isArray(entry.via)) {
    continue;
  }

  for (const viaItem of entry.via) {
    if (
      viaItem &&
      typeof viaItem === 'object' &&
      'url' in viaItem &&
      typeof viaItem.url === 'string' &&
      viaItem.url.includes(TARGET_ADVISORY)
    ) {
      found = true;
      break;
    }
  }

  if (found) {
    break;
  }
}

if (found) {
  console.log(
    `Known advisory still present: ${TARGET_ADVISORY}. Keep monitoring upstream package updates.`,
  );
  process.exit(0);
}

console.log(
  `Known advisory resolved: ${TARGET_ADVISORY} not found in current audit output.`,
);
process.exit(0);
