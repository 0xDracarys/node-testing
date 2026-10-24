'use strict';
/* Corner 5, K5 — breadth check: execArgv:[] worker, and reads
 * outside the fixture tree (system file header, home dir listing). */
const fs = require('fs');
const path = require('path');
const { spawnSync } = require('child_process');

const LAB = __dirname;
const FIX = path.join(LAB, 'fixture');
const ALLOWED = path.join(FIX, 'allowed');
const CASES = path.join(LAB, 'fixture5-cases');
const NODE = process.execPath;

fs.mkdirSync(CASES, { recursive: true });
const workerFile = path.join(CASES, 'worker-probe3.js');
fs.writeFileSync(workerFile, `
  const fs = require('fs');
  const { parentPort } = require('worker_threads');
  const attempt = (fn) => {
    try { return 'OK ' + JSON.stringify(String(fn()).slice(0, 50)); }
    catch (e) { return 'DENIED ' + (e.code || e.message); }
  };
  const out = {};
  out.win_ini = attempt(() =>
    fs.readFileSync('C:\\\\Windows\\\\win.ini', 'utf8').slice(0, 30));
  out.desktop_list = attempt(() =>
    fs.readdirSync('C:\\\\Users\\\\Chintu\\\\Desktop').slice(0, 5).join(','));
  parentPort.postMessage(JSON.stringify(out));
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
  console.log(id.padEnd(16), line.trim());
}

runCase('K5_execargv_empty', 'execArgv: []');
console.log('node:', process.version);
