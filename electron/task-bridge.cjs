const { execFileSync } = require('node:child_process');
const path = require('node:path');

function buildTaskArgs(prompt) {
  return ['chat', '-q', prompt, '-Q', '--source', 'tool'];
}

function resolveHermes({ platform = process.platform, run = execFileSync } = {}) {
  const configured = process.env.HERMES_BIN;
  if (configured) {
    try {
      run(configured, ['--version'], { stdio: 'ignore', shell: false });
      return configured;
    } catch {
      return null;
    }
  }

  try {
    if (platform === 'win32') {
      const output = run('where.exe', ['hermes'], { encoding: 'utf8', shell: false });
      return String(output).split(/\r?\n/).find(Boolean) || null;
    }
    run('which', ['hermes'], { stdio: 'ignore', shell: false });
    return 'hermes';
  } catch {
    return null;
  }
}

module.exports = { buildTaskArgs, resolveHermes };
