import { execSync } from 'node:child_process';
import { readFileSync } from 'node:fs';

function run(cmd) {
  execSync(cmd, { stdio: 'inherit' });
}

function assertIncludes(content, token, message) {
  if (!content.includes(token)) {
    throw new Error(message);
  }
}

try {
  // Compile-time validation
  run('npx tsc --noEmit --pretty false');

  // Targeted integration assertions for adaptive engine orchestration
  const engine = readFileSync('supabase/functions/learning-engine/index.ts', 'utf8');
  assertIncludes(engine, "case 'process-learning-event'", 'Missing process-learning-event action route');
  assertIncludes(engine, 'async function processLearningEvent', 'Missing processLearningEvent orchestration');
  assertIncludes(engine, 'dependency_edges', 'Missing dependency edge output in knowledge graph');
  assertIncludes(engine, 'buildStructuredMemoryValue', 'Missing structured memory builder usage');

  console.log('\nAll local test checks passed.');
} catch (error) {
  console.error('\nTest runner failed:', error instanceof Error ? error.message : error);
  process.exit(1);
}
