const test = require('node:test');
const assert = require('node:assert/strict');
const { buildTaskArgs, resolveHermes } = require('../electron/task-bridge.cjs');

const originalHermesBin = process.env.HERMES_BIN;

test('buildTaskArgs uses the non-interactive Hermes bridge contract', () => {
  assert.deepEqual(buildTaskArgs('Inspect this project'), [
    'chat',
    '-q',
    'Inspect this project',
    '-Q',
    '--source',
    'tool',
  ]);
});

test('resolveHermes finds the installed CLI', () => {
  assert.equal(resolveHermes(), 'hermes');
});

test('resolveHermes finds a Windows binary through where.exe', () => {
  const resolved = resolveHermes({
    platform: 'win32',
    run: (file, args) => {
      assert.equal(file, 'where.exe');
      assert.deepEqual(args, ['hermes']);
      return 'C:\\Users\\A\\AppData\\Roaming\\Python\\Scripts\\hermes.exe\r\n';
    },
  });
  assert.equal(resolved, 'C:\\Users\\A\\AppData\\Roaming\\Python\\Scripts\\hermes.exe');
});

test('an explicit HERMES_BIN is verified without platform lookup', () => {
  process.env.HERMES_BIN = 'C:\\Tools\\hermes.exe';
  const resolved = resolveHermes({
    platform: 'win32',
    run: (file, args) => {
      assert.equal(file, 'C:\\Tools\\hermes.exe');
      assert.deepEqual(args, ['--version']);
    },
  });
  assert.equal(resolved, 'C:\\Tools\\hermes.exe');
  process.env.HERMES_BIN = originalHermesBin;
});
