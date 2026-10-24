'use strict';
/*
 * Corner 5, K3 — inside the worker: is the Permission Model even on?
 * Worker reports: typeof process.permission, permission.has() for the
 * vault file and for an allowed file, a WRITE attempt into the vault,
 * and a child-process attempt (no --allow-child-process anywhere).
 * Parent variants: default execArgv, and explicit execArgv re-listing
 * --permission + grants + --allow-worker.
 */
const fs = require('fs');
const path = require('path');
const { spawnSync } = require('child_process');

const LAB = __dirname;
const FIX = path.join(LAB, 'fixture');
const ALLOWED = path.join(FIX, 'allowed');
const VAULT = path.join(FIX, 'vault');
const SECRET = path.join(VAULT, 'SECRET.txt');
const PLANT = path.join(VAULT, 'worker-plant.txt');
const CASES = path.join(LAB, 'fixture5-cases');
const NODE = process.execPath;

fs.mkdirSync(CASES, { recursive: true });
const workerFile = path.join(CASES, 'worker-probe.js');
fs.writeFileSync(workerFile, `
  const fs = require('fs');
  const { parentPort } = require('worker_threads');
  const out = {};
  out.perm_type = typeof process.permission;
  try {
    out.has_vault = process.permission.has('file-system.read',
      ${JSON.stringify(SECRET)});
    out.has_allowed = process.permission.has('file-system.read',
      ${JSON.stringify(path.join(ALLOWED, 'hello.txt'))});
  } catch (e) { out.has_error = e.code || e.message; }
  try { fs.writeFileSync(${JSON.stringify(PLANT)}, 'planted-by-worker');
    out.write = 'WRITE_OK'; }
  catch (e) { out.write = 'DENIED ' + (e.code || e.message); }
  try {
    const { spawnSync } = require('child_process');
    const r = spawnSync(process.execPath, ['-e', 'console.log(123)'],
      { encoding: 'utf8' });
    out.child = (r.stdout || '').includes('123') ? 'CHILD_RAN' :
      'DENIED ' + (r.error ? (r.error.code || r.error.message) : 'no-output');
  } catch (e) { out.child = 'THREW ' + (e.code || e.message); }
  parentPort.postMessage(JSON.stringify(out));
`);

const GRANTS = ['--allow-fs-read=' + ALLOWED,
  '--allow-fs-write=' + ALLOWED,
  '--allow-fs-read=' + CASES];

function runCase(id, execArgvExpr) {
  if (fs.existsSync(PLANT)) fs.unlinkSync(PLANT);
  const file = path.join(CASES, id + '.js');
  fs.writeFileSync(file, `
    const { Worker } = require('worker_threads');
    const w = new Worker(${JSON.stringify(workerFile)}, { ${execArgvExpr} });
    w.on('message', (m) => console.log('RESULT ' + m));
    w.on('error', (e) => console.log('RESULT WORKER_ERROR ' + (e.code || e.message)));
  `);
  const args = ['--permission', ...GRANTS, '--allow-worker', file];
  const r = spawnSync(NODE, args, { encoding: 'utf8', timeout: 30000 });
  const line = (r.stdout || '').split('\n')
    .find((l) => l.startsWith('RESULT')) || 'RESULT NONE';
  // plant check happens HERE, in the unrestricted harness process —
  // the restricted parent case must never touch the vault path itself.
  console.log(id.padEnd(14), line.trim(),
    '| plant_on_disk=' + fs.existsSync(PLANT));
}

runCase('K3_default', '');
runCase('K3_explicit', `execArgv: ['--permission', ${GRANTS.map((g) => JSON.stringify(g)).join(', ')}, '--allow-worker']`);
console.log('node:', process.version);
