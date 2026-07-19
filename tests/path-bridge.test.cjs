const fs = require('node:fs');
const path = require('node:path');
const test = require('node:test');
const assert = require('node:assert/strict');
const { toWslPath } = require('../electron/path-bridge.cjs');

test('converts a Windows project path to the WSL mount path', () => {
  assert.equal(toWslPath('C:\\Users\\A\\Desktop\\project'), '/mnt/c/Users/A/Desktop/project');
});

test('leaves a WSL project path unchanged', () => {
  assert.equal(toWslPath('/home/example-user/project'), '/home/example-user/project');
});

test('preload exposes only a file-picker entrypoint, not project selection', () => {
  const preload = fs.readFileSync(path.join(__dirname, '..', 'electron', 'preload.cjs'), 'utf8');
  assert.match(preload, /chooseFiles/);
  assert.doesNotMatch(preload, /chooseProject/);
});
