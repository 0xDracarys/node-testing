'use strict';
/* Corner 5, K1 retry — worker inheritance, worker code as a real file. */
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
fs.writeFileSync(path.join(CASES, 'worker-read.js'), `
  const fs = require('fs');
  const { parentPort } = require('worker_threads');
  try {
    const data = fs.readFileSync(${JSON.stringify(SECRET)}, 'utf8');
    parentPort.postMessage('READ ' + JSON.stringify(data.trim()));
  } catch (e) {
    parentPort.postMessage('DENIED ' + (e.code || e.message));
  }
`);
const mainFile = path.join(CASES, 'K1_main.js');
fs.writeFileSync(mainFile, `
  const { Worker } = require('worker_threads');
  const w = new Worker(${JSON.stringify(path.join(CASES, 'worker-read.js'))});
  w.on('message', (m) => console.log('RESULT WORKER ' + m));
  w.on('error', (e) => console.log('RESULT WORKER_ERROR ' + (e.code || e.message)));
`);

const args = ['--permission',
  '--allow-fs-read=' + ALLOWED,
  '--allow-fs-write=' + ALLOWED,
  '--allow-fs-read=' + CASES,
  '--allow-worker', mainFile];
const r = spawnSync(NODE, args, { encoding: 'utf8', timeout: 30000 });
console.log('K1_worker_read'.padEnd(22),
  (r.stdout || '').trim() || 'NONE',
  (r.stderr || '') ? '| ' + (r.stderr || '').split('\n')[0].slice(0, 100) : '');
