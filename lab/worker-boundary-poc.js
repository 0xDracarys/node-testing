'use strict';
/*
 * Boundary-crossing check — Node.js Permission Model, worker threads.
 *
 * Usage: node worker-boundary-poc.js
 *
 * Parent builds a fresh fixture: esc-clean/allowed and esc-clean/private.
 * The private folder holds a test value split across two files; the
 * combined value only exists if both files are read.
 * A restricted child (read on allowed only, plus worker use) then:
 *  (a) tries to read a private file on the main thread (control),
 *  (b) asks a worker to read both private files and combine them,
 *  (c) writes the combined value to allowed/output.txt,
 *  (d) the worker also tries writing allowed/worker-output.txt itself.
 * The unrestricted parent then reads the allowed folder and checks
 * whether the combined value arrived there intact.
 */
const fs = require('fs');
const path = require('path');
const { spawnSync } = require('child_process');

const BASE = path.join(__dirname, 'esc-clean');
const ALLOWED = path.join(BASE, 'allowed');
const PRIVATE = path.join(BASE, 'private');
const PART_A = path.join(PRIVATE, 'part-a.txt');
const PART_B = path.join(PRIVATE, 'part-b.txt');

fs.rmSync(BASE, { recursive: true, force: true });
fs.mkdirSync(ALLOWED, { recursive: true });
fs.mkdirSync(PRIVATE, { recursive: true });
const suffix = Date.now().toString(36);
const partA = 'BOUNDARY-TEST-A-';
const partB = 'BOUNDARY-TEST-B-' + suffix;
const expected = partA + partB;
fs.writeFileSync(PART_A, partA);
fs.writeFileSync(PART_B, partB);

const workerFile = path.join(ALLOWED, 'worker.js');
fs.writeFileSync(workerFile, `
  const fs = require('fs');
  const { parentPort, workerData } = require('worker_threads');
  const out = {};
  try { out.a = fs.readFileSync(workerData.a, 'utf8'); }
  catch (e) { out.a = 'DENIED ' + (e.code || e.message); }
  try { out.b = fs.readFileSync(workerData.b, 'utf8'); }
  catch (e) { out.b = 'DENIED ' + (e.code || e.message); }
  try { fs.writeFileSync(workerData.out, out.a + out.b);
    out.directWrite = 'OK'; }
  catch (e) { out.directWrite = 'DENIED ' + (e.code || e.message); }
  parentPort.postMessage(JSON.stringify(out));
`);

const childFile = path.join(ALLOWED, 'child.js');
fs.writeFileSync(childFile, `
  const fs = require('fs');
  const { Worker } = require('worker_threads');
  try { fs.readFileSync(${JSON.stringify(PART_A)}, 'utf8');
    console.log('MAIN-READ-UNEXPECTED'); }
  catch (e) { console.log('MAIN-DENIED ' + (e.code || e.message)); }
  const w = new Worker(${JSON.stringify(workerFile)}, { workerData: {
    a: ${JSON.stringify(PART_A)},
    b: ${JSON.stringify(PART_B)},
    out: ${JSON.stringify(path.join(ALLOWED, 'worker-output.txt'))},
  } });
  w.on('message', (m) => {
    const o = JSON.parse(m);
    console.log('WORKER-COMBINED ' + (o.a + o.b));
    console.log('WORKER-DIRECT-WRITE ' + o.directWrite);
    try { fs.writeFileSync(${JSON.stringify(path.join(ALLOWED, 'output.txt'))}, o.a + o.b);
      console.log('MAIN-WRITE-ALLOWED OK'); }
    catch (e) { console.log('MAIN-WRITE-ALLOWED DENIED ' + (e.code || e.message)); }
  });
  w.on('error', (e) => console.log('WORKER-ERROR ' + (e.code || e.message)));
`);

const r = spawnSync(process.execPath, [
  '--permission',
  '--allow-fs-read=' + ALLOWED,
  '--allow-fs-write=' + ALLOWED,
  '--allow-worker',
  childFile,
], { encoding: 'utf8', timeout: 30000 });
console.log('node:', process.version);
console.log('expected:', expected);
console.log((r.stdout || '').trim());
if (r.stderr) console.log('stderr:', r.stderr.split('\n')[0].slice(0, 120));

// Unrestricted parent verification: what actually landed in allowed?
for (const f of ['output.txt', 'worker-output.txt']) {
  const p = path.join(ALLOWED, f);
  const got = fs.existsSync(p) ? fs.readFileSync(p, 'utf8') : '(missing)';
  console.log('VERIFY ' + f + ' match=' + (got === expected) + ' value=' + got);
}
