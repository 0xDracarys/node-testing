'use strict';
/*
 * Corner 5, K4 — map the worker read hole precisely.
 * Inside the worker (explicit execArgv variant): permission.has()
 * with the documented scope names ('fs.read' / 'fs.write'), then
 * read attempts through several fs doors on the vault and controls.
 */
const fs = require('fs');
const path = require('path');
const { spawnSync } = require('child_process');

const LAB = __dirname;
const FIX = path.join(LAB, 'fixture');
const ALLOWED = path.join(FIX, 'allowed');
const VAULT = path.join(FIX, 'vault');
const SECRET = path.join(VAULT, 'SECRET.txt');
const HELLO = path.join(ALLOWED, 'hello.txt');
const CASES = path.join(LAB, 'fixture5-cases');
const NODE = process.execPath;

fs.mkdirSync(CASES, { recursive: true });
const workerFile = path.join(CASES, 'worker-probe2.js');
fs.writeFileSync(workerFile, `
  const fs = require('fs');
  const { parentPort } = require('worker_threads');
  const out = {};
  const has = (scope, ref) => {
    try { return process.permission.has(scope, ref); }
    catch (e) { return 'ERR:' + (e.code || e.message); }
  };
  out.has_fsread_vault = has('fs.read', ${JSON.stringify(SECRET)});
  out.has_fsread_allowed = has('fs.read', ${JSON.stringify(HELLO)});
  out.has_fsread_star = has('fs.read', '*');
  out.has_fsread_plain = has('fs.read');
  const attempt = (fn) => {
    try { const v = fn(); return 'OK ' + JSON.stringify(String(v).slice(0, 40)); }
    catch (e) { return 'DENIED ' + (e.code || e.message); }
  };
  out.read_sync_vault = attempt(() => fs.readFileSync(${JSON.stringify(SECRET)}, 'utf8'));
  out.read_sync_allowed = attempt(() => fs.readFileSync(${JSON.stringify(HELLO)}, 'utf8'));
  out.stat_vault = attempt(() => fs.statSync(${JSON.stringify(SECRET)}).size);
  out.readdir_vault = attempt(() => fs.readdirSync(${JSON.stringify(VAULT)}));
  out.realpath_vault = attempt(() => fs.realpathSync(${JSON.stringify(SECRET)}));
  fs.promises.readFile(${JSON.stringify(SECRET)}, 'utf8')
    .then((d) => { out.read_promise_vault = 'OK ' + JSON.stringify(d.slice(0, 40)); })
    .catch((e) => { out.read_promise_vault = 'DENIED ' + (e.code || e.message); })
    .finally(() => parentPort.postMessage(JSON.stringify(out)));
`);

const GRANTS = ['--allow-fs-read=' + ALLOWED,
  '--allow-fs-write=' + ALLOWED,
  '--allow-fs-read=' + CASES];

function runCase(id, execArgvExpr) {
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
  console.log(id.padEnd(14), line.trim());
}

runCase('K4_default', '');
runCase('K4_explicit', `execArgv: ['--permission', ${GRANTS.map((g) => JSON.stringify(g)).join(', ')}, '--allow-worker']`);
console.log('node:', process.version);
