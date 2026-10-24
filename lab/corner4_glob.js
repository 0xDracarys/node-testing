'use strict';
/*
 * Corner 4 quick probes — fs.glob under the Permission Model.
 * Parent runs unrestricted; children run with --permission and grants
 * only on the Corner 1 fixture's allowed folder (+ this cases dir).
 * Patterns are aimed at the vault: absolute, dotdot, and plain.
 */
const fs = require('fs');
const path = require('path');
const { spawnSync } = require('child_process');

const LAB = __dirname;
const FIX = path.join(LAB, 'fixture');           // Corner 1 fixture
const ALLOWED = path.join(FIX, 'allowed');
const VAULT = path.join(FIX, 'vault');
const CASES = path.join(LAB, 'fixture4-cases');
const NODE = process.execPath;

const GLOB_BODY = (pattern) => `
  const fs = require('fs');
  try {
    const found = fs.globSync(${JSON.stringify(pattern)});
    console.log('RESULT found=' + JSON.stringify(found));
  } catch (e) {
    console.log('RESULT error=' + (e.code || e.message));
  }`;

const PROBES = [
  { id: 'CTRL_glob_inside', pattern: path.join(ALLOWED, '*.txt') },
  { id: 'GLOB_abs_vault', pattern: path.join(VAULT, '*') },
  { id: 'GLOB_abs_vault_txt', pattern: path.join(VAULT, '*.txt') },
  { id: 'GLOB_dotdot', pattern: path.join(ALLOWED, '..', 'vault', '*'), cwd: FIX },
  { id: 'GLOB_rel_vault', pattern: 'vault/*', cwd: FIX },
];

function main() {
  if (!fs.existsSync(path.join(VAULT, 'SECRET.txt'))) {
    console.log('fixture missing — rerun perm_harness.js first');
    return;
  }
  fs.mkdirSync(CASES, { recursive: true });
  const results = [];
  for (const c of PROBES) {
    const file = path.join(CASES, c.id + '.js');
    fs.writeFileSync(file, GLOB_BODY(c.pattern));
    const args = ['--permission',
      '--allow-fs-read=' + ALLOWED,
      '--allow-fs-read=' + CASES,
      '--allow-fs-read=' + FIX, // pattern resolution may stat parents
      file];
    const r = spawnSync(NODE, args, {
      cwd: c.cwd || FIX, encoding: 'utf8', timeout: 30000,
    });
    const line = (r.stdout || '').split('\n')
      .find((l) => l.startsWith('RESULT')) || 'RESULT NONE';
    results.push({ case: c.id, pattern: c.pattern, result: line.trim(),
      stderr_head: (r.stderr || '').slice(0, 120) });
    console.log(c.id.padEnd(20), line.trim());
  }
  const out = path.join(LAB, 'corner4-results-' +
    process.version.replace(/^v/, '') + '.json');
  fs.writeFileSync(out, JSON.stringify(
    { node: process.version, results }, null, 2));
  console.log('saved:', out);
}

main();
