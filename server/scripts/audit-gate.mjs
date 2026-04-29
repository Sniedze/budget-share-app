import process from 'node:process';

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

const counts = report?.metadata?.vulnerabilities;
if (!counts) {
  console.error('Unexpected npm audit JSON format.');
  process.exit(1);
}

const highOrCritical = Number(counts.high ?? 0) + Number(counts.critical ?? 0);
if (highOrCritical > 0) {
  console.error(
    `Security gate failed: high=${counts.high ?? 0}, critical=${counts.critical ?? 0}.`,
  );
  process.exit(1);
}

console.log(
  `Security gate passed (info=${counts.info ?? 0}, low=${counts.low ?? 0}, moderate=${counts.moderate ?? 0}, high=${counts.high ?? 0}, critical=${counts.critical ?? 0}).`,
);
