import { describe, it } from 'node:test';
import * as assert from 'node:assert/strict';
import { parseArgs } from '../../../src/internal/args.js';

describe('parseArgs', () => {
  it('parses cicurity install <pkg>', () => {
    const result = parseArgs(['install', 'express']);
    assert.equal(result.command, 'install');
    if (result.command !== 'install') return;
    assert.equal(result.tool, 'npm');
    assert.deepEqual(result.packages, ['express']);
  });

  it('parses cicurity npm install <pkg>', () => {
    const result = parseArgs(['npm', 'install', 'express']);
    assert.equal(result.command, 'install');
    if (result.command !== 'install') return;
    assert.equal(result.tool, 'npm');
    assert.deepEqual(result.packages, ['express']);
  });

  it('parses cicurity pnpm add <pkg>', () => {
    const result = parseArgs(['pnpm', 'add', 'express']);
    assert.equal(result.command, 'install');
    if (result.command !== 'install') return;
    assert.equal(result.tool, 'pnpm');
    assert.deepEqual(result.packages, ['express']);
  });

  it('parses cicurity npx <pkg>', () => {
    const result = parseArgs(['npx', 'create-react-app', 'myapp']);
    assert.equal(result.command, 'install');
    if (result.command !== 'install') return;
    assert.equal(result.tool, 'npx');
    assert.ok(result.packages.includes('create-react-app'));
  });

  it('parses multiple packages', () => {
    const result = parseArgs(['install', 'express', 'lodash', '@types/node']);
    assert.equal(result.command, 'install');
    if (result.command !== 'install') return;
    assert.deepEqual(result.packages, ['express', 'lodash', '@types/node']);
  });

  it('parses flags', () => {
    const result = parseArgs(['install', '--save-dev', 'typescript']);
    assert.equal(result.command, 'install');
    if (result.command !== 'install') return;
    assert.equal(result.flags.saveDev, true);
    assert.deepEqual(result.packages, ['typescript']);
  });

  it('returns unknown for unrecognised commands', () => {
    const result = parseArgs(['audit']);
    assert.equal(result.command, 'unknown');
  });

  it('returns unknown for empty argv', () => {
    const result = parseArgs([]);
    assert.equal(result.command, 'unknown');
  });

  it('handles npm install without packages', () => {
    const result = parseArgs(['npm', 'install']);
    assert.equal(result.command, 'install');
    if (result.command !== 'install') return;
    assert.deepEqual(result.packages, []);
  });
});
