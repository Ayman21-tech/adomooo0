import { execSync } from 'node:child_process';
import { readFileSync } from 'node:fs';

function run(cmd) {
  execSync(cmd, { stdio: 'inherit' });
}

try {
  // Type correctness as baseline lint gate
  run('npx tsc --noEmit --pretty false');

  // Lightweight source hygiene checks for critical edge function
  const engine = readFileSync('supabase/functions/learning-engine/index.ts', 'utf8');
  const banned = ['debugger;', 'console.log('];

  const violations = banned.filter((token) => engine.includes(token));
  if (violations.length > 0) {
    throw new Error(`Lint violations found: ${violations.join(', ')}`);
  }

  console.log('\nLocal lint checks passed.');
} catch (error) {
  console.error('\nLint runner failed:', error instanceof Error ? error.message : error);
  process.exit(1);
}
