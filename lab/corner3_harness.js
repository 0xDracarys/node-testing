'use strict';
/*
 * Corner 3 harness — environment permission model doors.
 * Children run with --permission and per-case --allow-env grants.
 * All variables are invented test values planted by the parent.
 * Each case prints RESULT lines; parent saves a JSON summary.
 */
const fs = require('fs');
const path = require('path');
const { spawnSync } = require('child_process');

const ROOT = path.join(__dirname, 'fixture3');
const CASES_DIR = path.join(ROOT, 'cases');
const NODE = process.execPath;

const TEST_ENV = {
  TEST_PUBLIC_X: 'public-value',
  TEST_SECRET_X: 'secret-value',
  TEST_PREFIX_A: 'prefix-a',
  TEST_PREFIX_B: 'prefix-b',
  TEST_DROP_X: 'drop-value',
  SPECIFIC_ONE: 'specific-1',
};

const CASES = [
  { id: 'CTRL_read_granted', flags: ['--allow-env=TEST_PUBLIC_X'], body: `
    console.log('RESULT value=' + process.env.TEST_PUBLIC_X);` },
  { id: 'CTRL_read_ungranted', flags: ['--allow-env=TEST_PUBLIC_X'], body: `
    console.log('RESULT value=' + process.env.TEST_SECRET_X);` },
  { id: 'S1a_enum_keys', flags: ['--allow-env=TEST_PUBLIC_X'], body: `
    const keys = Object.keys(process.env).filter(k => k.startsWith('TEST') || k.startsWith('SPECIFIC'));
    console.log('RESULT keys=' + JSON.stringify(keys));` },
  { id: 'S1b_enum_values', flags: ['--allow-env=TEST_PUBLIC_X'], body: `
    const s = JSON.stringify(process.env);
    console.log('RESULT secret_in_json=' + s.includes('secret-value'));` },
  { id: 'S1c_spread', flags: ['--allow-env=TEST_PUBLIC_X'], body: `
    const copy = { ...process.env };
    console.log('RESULT spread_secret=' + copy.TEST_SECRET_X);` },
  { id: 'S2a_case_read', flags: ['--allow-env=TEST_PUBLIC_X'], body: `
    console.log('RESULT lower=' + process.env.test_public_x);` },
  { id: 'S2b_prefix_grant', flags: ['--allow-env=TEST_PREFIX_*'], body: `
    console.log('RESULT a=' + process.env.TEST_PREFIX_A +
      ' b=' + process.env.TEST_PREFIX_B +
      ' secret=' + process.env.TEST_SECRET_X);` },
  { id: 'S2c_pattern_public', flags: ['--allow-env=TEST_PUBLIC_*'], body: `
    console.log('RESULT pub=' + process.env.TEST_PUBLIC_X +
      ' secret=' + process.env.TEST_SECRET_X);` },
  { id: 'S3_worker', flags: ['--allow-env=TEST_PUBLIC_X', '--allow-worker'], body: `
    const { Worker } = require('worker_threads');
    const code = "const { parentPort } = require('worker_threads');" +
      "parentPort.postMessage({ pub: process.env.TEST_PUBLIC_X," +
      " secret: process.env.TEST_SECRET_X });";
    const w = new Worker(code, { eval: true });
    w.on('message', (m) => console.log('RESULT worker=' + JSON.stringify(m)));
    w.on('error', (e) => console.log('RESULT worker_error=' + (e.code || e.message)));` },
  { id: 'S4_child_inherit', flags: ['--allow-env=TEST_PUBLIC_X', '--allow-child-process'], body: `
    const { spawnSync } = require('child_process');
    const r = spawnSync(process.execPath,
      ['-e', 'console.log(JSON.stringify(process.env))'], { encoding: 'utf8' });
    const out = r.stdout || '';
    console.log('RESULT child_secret=' + out.includes('secret-value') +
      ' child_public=' + out.includes('public-value'));` },
  { id: 'S5_drop', flags: ['--allow-env=TEST_PUBLIC_X,TEST_DROP_X'], body: `
    const before = process.env.TEST_DROP_X;
    let dropResult = 'no-api';
    try {
      process.permission.drop('env', 'TEST_DROP_X');
      dropResult = 'dropped';
    } catch (e) { dropResult = 'threw:' + (e.code || e.message); }
    console.log('RESULT before=' + before + ' drop=' + dropResult +
      ' after=' + process.env.TEST_DROP_X);` },
  { id: 'S6_defaults', flags: [], body: `
    const names = ['PATH', 'SystemRoot', 'USERPROFILE', 'TEMP', 'USERNAME'];
    const readable = names.filter(n => process.env[n] !== undefined);
    console.log('RESULT readable=' + JSON.stringify(readable) +
      ' total_keys=' + Object.keys(process.env).length);` },
];

function main() {
  fs.mkdirSync(CASES_DIR, { recursive: true });
  const results = [];
  for (const c of CASES) {
    const file = path.join(CASES_DIR, c.id + '.js');
    fs.writeFileSync(file, c.body);
    const args = ['--permission', ...c.flags,
      '--allow-fs-read=' + CASES_DIR, file];
    const r = spawnSync(NODE, args, {
      encoding: 'utf8', timeout: 30000,
      env: { ...process.env, ...TEST_ENV },
    });
    const lines = (r.stdout || '').split('\n')
      .filter((l) => l.startsWith('RESULT'));
    const rec = { case: c.id, results: lines,
      stderr_head: (r.stderr || '').slice(0, 140) };
    results.push(rec);
    console.log(c.id.padEnd(22), lines.join(' ; ') || '(no RESULT)',
      rec.stderr_head ? '| stderr: ' + rec.stderr_head.split('\n')[0] : '');
  }
  const out = path.join(__dirname,
    'corner3-results-' + process.version.replace(/^v/, '') + '.json');
  fs.writeFileSync(out, JSON.stringify(
    { node: process.version, results }, null, 2));
  console.log('saved:', out);
}

main();
