import { readFileSync, writeFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = path.join(path.dirname(fileURLToPath(import.meta.url)), '..');
const schemaTs = readFileSync(path.join(root, 'src/graphql/schema.ts'), 'utf8');
const match = schemaTs.match(/export const typeDefs = `#graphql\n([\s\S]*)\n`;/);
if (!match) {
  console.error('Could not extract GraphQL schema from schema.ts');
  process.exit(1);
}
const outPath = path.join(root, 'src/graphql/schema.graphql');
writeFileSync(outPath, `${match[1].trim()}\n`);
console.log(`Wrote ${outPath}`);
