'use strict';
/*
 * Corner 4 rig v2 — fs.glob under the Permission Model, honest grants.
 * Grants are ONLY the allowed folder and the cases dir. The fixture
 * root and the vault are NOT granted (round 1 granted the fixture
 * root, which silently covered the vault — that hit was discarded).
 */
const fs = require('fs');
const path = require('path');
const { spawnSync } = require('child_process');

const LAB = __dirname;
const FIX = path.join(LAB, 'fixture');
const ALLOWED = path.join(FIX, 'allowed');
const VAULT = path.join(FIX, 'vault');
const CASES = path.join(LAB, 'fixture4-cases');
const NODE = process.execPath;

const BODY = (expr) => `
  const fs = require('fs');
  try {
    const found = ${expr};
    console.log('RESULT found=' + JSON.stringify(found));
  } catch (e) {
    console.log('RESULT error=' + (e.code || e.message));
  }`;

const PROBES = [
  { id: 'CTRL_inside_abs', cwd: ALLOWED,
    expr: `fs.globSync(${JSON.stringify(path.join(ALLOWED, '*.txt'))})` },
  { id: 'T1_abs_vault', cwd: ALLOWED,
    expr: `fs.globSync(${JSON.stringify(path.join(VAULT, '*'))})` },
  { id: 'T2_rel_dotdot', cwd: ALLOWED,
    expr: `fs.globSync('../vault/*')` },
  { id: 'T3_rel_from_fixture', cwd: FIX,
    expr: `fs.globSync('vault/*')` },
  { id: 'T4_cwd_option_vault', cwd: ALLOWED,
    expr: `fs.globSync('*', { cwd: ${JSON.stringify(VAULT)} })` },
  { id: 'T5_abs_dotdot', cwd: ALLOWED,
    expr: `fs.globSync(${JSON.stringify(path.join(ALLOWED, '..', 'vault', '*'))})` },
  { id: 'T6_glob_callback_vault', cwd: ALLOWED,
    expr: `(() => { throw new Error('async-case-separate'); })()` },
];

function main() {
  if (!fs.existsSync(path.join(VAULT, 'SECRET.txt'))) {
    console.log('fixture missing — rerun perm_harness.js first');
    return;
  }
  fs.mkdirSync(CASES, { recursive: true });
  const results = [];
  for (const c of PROBES) {
    if (c.id.startsWith('T6')) continue; // placeholder, async handled later
    const file = path.join(CASES, c.id + '.js');
    fs.writeFileSync(file, BODY(c.expr));
    const args = ['--permission',
      '--allow-fs-read=' + ALLOWED,
      '--allow-fs-read=' + CASES,
      file];
    const r = spawnSync(NODE, args, {
      cwd: c.cwd, encoding: 'utf8', timeout: 30000,
    });
    const line = (r.stdout || '').split('\n')
      .find((l) => l.startsWith('RESULT')) || 'RESULT NONE';
    results.push({ case: c.id, result: line.trim(),
      stderr_head: (r.stderr || '').slice(0, 120) });
    console.log(c.id.padEnd(22), line.trim());
  }
  const out = path.join(LAB, 'corner4-v2-results-' +
    process.version.replace(/^v/, '') + '.json');
  fs.writeFileSync(out, JSON.stringify(
    { node: process.version, results }, null, 2));
  console.log('saved:', out);
}

main();
