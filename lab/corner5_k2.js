'use strict';
/*
 * Corner 5, K2 — worker inheritance discriminator.
 * Same restricted parent grants for every variant:
 *   read+write ALLOWED, read CASES, --allow-worker.
 * Variants: MAIN process read (control), worker default (no execArgv),
 * worker with execArgv re-listing the parent flags explicitly.
 */
const fs = require('fs');
const path = require('path');
const { spawnSync } = require('child_process');

const LAB = __dirname;
const FIX = path.join(LAB, 'fixture');
const ALLOWED = path.join(FIX, 'allowed');
const VAULT = path.join(FIX, 'vault');
const SECRET = path.join(VAULT, 'SECRET.txt');
const CASES = path.join(LAB, 'fixture5-cases');
const NODE = process.execPath;

fs.mkdirSync(CASES, { recursive: true });
const workerFile = path.join(CASES, 'worker-read.js');
fs.writeFileSync(workerFile, `
  const fs = require('fs');
  const { parentPort } = require('worker_threads');
  try {
    const data = fs.readFileSync(${JSON.stringify(SECRET)}, 'utf8');
    parentPort.postMessage('READ ' + JSON.stringify(data.trim().slice(0, 30)));
  } catch (e) {
    parentPort.postMessage('DENIED ' + (e.code || e.message));
  }
`);

const GRANTS = ['--allow-fs-read=' + ALLOWED,
  '--allow-fs-write=' + ALLOWED,
  '--allow-fs-read=' + CASES];

function runCase(id, mainBody, extraParentFlags = []) {
  const file = path.join(CASES, id + '.js');
  fs.writeFileSync(file, mainBody);
  const args = ['--permission', ...GRANTS, '--allow-worker',
    ...extraParentFlags, file];
  const r = spawnSync(NODE, args, { encoding: 'utf8', timeout: 30000 });
  const line = (r.stdout || '').split('\n')
    .find((l) => l.startsWith('RESULT')) || 'RESULT NONE';
  console.log(id.padEnd(26), line.trim());
  return line;
}

const workerMain = (execArgvExpr) => `
  const { Worker } = require('worker_threads');
  const opts = { ${execArgvExpr} };
  const w = new Worker(${JSON.stringify(workerFile)}, opts);
  w.on('message', (m) => console.log('RESULT WORKER ' + m));
  w.on('error', (e) => console.log('RESULT WORKER_ERROR ' + (e.code || e.message)));
`;

runCase('MAIN_control', `
  const fs = require('fs');
  try { console.log('RESULT MAIN READ ' +
    JSON.stringify(fs.readFileSync(${JSON.stringify(SECRET)}, 'utf8').trim().slice(0, 30))); }
  catch (e) { console.log('RESULT MAIN DENIED ' + (e.code || e.message)); }`);

runCase('W_a_default', workerMain(''));

runCase('W_c_explicit_flags', workerMain(
  `execArgv: ['--permission', ${GRANTS.map((g) => JSON.stringify(g)).join(', ')}, '--allow-worker']`));

console.log('node:', process.version);
