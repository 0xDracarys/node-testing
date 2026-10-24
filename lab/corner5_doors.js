'use strict';
/*
 * Corner 5 — new-angle doors under the Permission Model.
 * H: hard links (fs.link) — a second NAME for the vault file created
 *    inside the allowed folder; not a symbolic link.
 * W: fs.watch / fs.watchFile on the ungranted vault file — the
 *    metadata/event door (cf. CVE-2023-30582 family).
 * K: worker threads — does a worker inherit the fs grants exactly?
 * Parent sequences H1 then H2 and touches the vault file during W.
 */
const fs = require('fs');
const path = require('path');
const { spawn, spawnSync } = require('child_process');

const LAB = __dirname;
const FIX = path.join(LAB, 'fixture');
const ALLOWED = path.join(FIX, 'allowed');
const VAULT = path.join(FIX, 'vault');
const SECRET = path.join(VAULT, 'SECRET.txt');
const HARD = path.join(ALLOWED, 'hard.txt');
const CASES = path.join(LAB, 'fixture5-cases');
const NODE = process.execPath;

function runSync(id, body, extraFlags = []) {
  const file = path.join(CASES, id + '.js');
  fs.writeFileSync(file, body);
  const args = ['--permission',
    '--allow-fs-read=' + ALLOWED,
    '--allow-fs-write=' + ALLOWED,
    '--allow-fs-read=' + CASES,
    ...extraFlags, file];
  const r = spawnSync(NODE, args, { encoding: 'utf8', timeout: 30000 });
  const line = (r.stdout || '').split('\n')
    .find((l) => l.startsWith('RESULT')) || 'RESULT NONE';
  console.log(id.padEnd(22), line.trim(),
    (r.stderr || '') ? '| ' + (r.stderr || '').split('\n')[0].slice(0, 80) : '');
  return line;
}

function runWatch(id, body) {
  return new Promise((resolve) => {
    const file = path.join(CASES, id + '.js');
    fs.writeFileSync(file, body);
    const args = ['--permission',
      '--allow-fs-read=' + ALLOWED,
      '--allow-fs-write=' + ALLOWED,
      '--allow-fs-read=' + CASES, file];
    const child = spawn(NODE, args, { encoding: 'utf8' });
    let out = '';
    child.stdout.on('data', (d) => { out += d; });
    setTimeout(() => {
      try { fs.appendFileSync(SECRET, 'touch\n'); } catch { /* fixture */ }
    }, 900);
    setTimeout(() => {
      child.kill();
      const line = out.split('\n').find((l) => l.startsWith('RESULT')) ||
        'RESULT NONE';
      console.log(id.padEnd(22), line.trim());
      resolve(line);
    }, 4000);
  });
}

async function main() {
  fs.mkdirSync(CASES, { recursive: true });
  if (fs.existsSync(HARD)) fs.unlinkSync(HARD);

  runSync('H1_hardlink_create', `
    const fs = require('fs');
    try { fs.linkSync(${JSON.stringify(SECRET)}, ${JSON.stringify(HARD)});
      console.log('RESULT LINK_OK'); }
    catch (e) { console.log('RESULT DENIED ' + (e.code || e.message)); }`);

  const linkExists = fs.existsSync(HARD);
  console.log('   hard.txt exists after H1:', linkExists);
  if (linkExists) {
    runSync('H2_hardlink_read', `
      const fs = require('fs');
      try { console.log('RESULT READ ' +
        JSON.stringify(fs.readFileSync(${JSON.stringify(HARD)}, 'utf8').trim())); }
      catch (e) { console.log('RESULT DENIED ' + (e.code || e.message)); }`);
  }

  await runWatch('W1_watch_vault', `
    const fs = require('fs');
    try {
      const w = fs.watch(${JSON.stringify(SECRET)}, (ev, name) => {
        console.log('RESULT EVENT ' + ev + ' ' + name);
        process.exit(0);
      });
      w.on('error', (e) => console.log('RESULT WATCH_ERROR ' + (e.code || e.message)));
    } catch (e) { console.log('RESULT DENIED ' + (e.code || e.message)); }`);

  await runWatch('W2_watchfile_vault', `
    const fs = require('fs');
    try {
      fs.watchFile(${JSON.stringify(SECRET)}, { interval: 300 }, (curr, prev) => {
        console.log('RESULT STAT_EVENT size=' + curr.size);
        process.exit(0);
      });
    } catch (e) { console.log('RESULT DENIED ' + (e.code || e.message)); }`);

  runSync('K1_worker_read', `
    const { Worker } = require('worker_threads');
    const code = "const fs = require('fs');" +
      "const { parentPort } = require('worker_threads');" +
      "try { parentPort.postMessage('READ ' +" +
      " JSON.stringify(fs.readFileSync(${JSON.stringify(SECRET)}, 'utf8').trim())); }" +
      "catch (e) { parentPort.postMessage('DENIED ' + (e.code || e.message)); }";
    try {
      const w = new Worker(code, { eval: true });
      w.on('message', (m) => console.log('RESULT WORKER ' + m));
      w.on('error', (e) => console.log('RESULT WORKER_ERROR ' + (e.code || e.message)));
    } catch (e) { console.log('RESULT DENIED ' + (e.code || e.message)); }`,
    ['--allow-worker']);

  runSync('K2_worker_no_flag', `
    const { Worker } = require('worker_threads');
    try { const w = new Worker('1', { eval: true });
      console.log('RESULT WORKER_CREATED'); }
    catch (e) { console.log('RESULT DENIED ' + (e.code || e.message)); }`);

  const out = path.join(LAB, 'corner5-done-' +
    process.version.replace(/^v/, '') + '.txt');
  fs.writeFileSync(out, 'done ' + new Date().toISOString() + '\n');
  console.log('saved marker:', out);
}

main();
