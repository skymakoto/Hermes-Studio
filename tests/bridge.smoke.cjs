const { spawnSync } = require('node:child_process');
const { buildTaskArgs } = require('../electron/task-bridge.cjs');

const prompt = 'Reply with exactly: Hermes Studio bridge online.';
const run = spawnSync('hermes', buildTaskArgs(prompt), {
  cwd: process.cwd(),
  encoding: 'utf8',
  timeout: 120000,
});

if (run.error) throw run.error;
if (run.status !== 0) throw new Error(run.stderr || `Hermes exited with ${run.status}`);
if (!run.stdout.trim()) throw new Error('Hermes returned no final response.');
console.log(run.stdout.trim());
