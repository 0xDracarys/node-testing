'use strict';
/*
 * Corner 2 harness, part 2 (G4 permission-gate doors, G5 cwd).
 * Each door runs in its own restricted child:
 *   node --permission [--allow-child-process] --allow-fs-read=<cases>
 * The child tries one way of starting another program and prints
 * DOOR OPEN (with what the grandchild printed) or DOOR DENIED.
 */
const fs = require('fs');
const path = require('path');
const { spawnSync } = require('child_process');

const ROOT = path.join(__dirname, 'fixture2');
const DOORS_DIR = path.join(ROOT, 'doors');
const NODE = process.execPath;
const GRANDCHILD = `console.log('GRANDCHILD_RAN')`;

const DOORS = {
  spawn: `
    const { spawn } = require('child_process');
    const c = spawn(process.execPath, ['-e', ${JSON.stringify(GRANDCHILD)}]);
    let out = '';
    c.stdout.on('data', d => out += d);
    c.on('error', e => console.log('DOOR DENIED ' + (e.code || e.message)));
    c.on('close', () => console.log(out.includes('GRANDCHILD_RAN')
      ? 'DOOR OPEN' : 'DOOR DENIED no-output'));`,
  spawnSync: `
    const { spawnSync } = require('child_process');
    try { const r = spawnSync(process.execPath, ['-e', ${JSON.stringify(GRANDCHILD)}], { encoding: 'utf8' });
      console.log((r.stdout || '').includes('GRANDCHILD_RAN')
        ? 'DOOR OPEN' : 'DOOR DENIED ' + (r.error ? (r.error.code || r.error.message) : 'no-output'));
    } catch (e) { console.log('DOOR DENIED ' + (e.code || e.message)); }`,
  execFileSync: `
    const { execFileSync } = require('child_process');
    try { const out = execFileSync(process.execPath, ['-e', ${JSON.stringify(GRANDCHILD)}], { encoding: 'utf8' });
      console.log(out.includes('GRANDCHILD_RAN') ? 'DOOR OPEN' : 'DOOR DENIED no-output');
    } catch (e) { console.log('DOOR DENIED ' + (e.code || e.message)); }`,
  exec: `
    const { exec } = require('child_process');
    exec(process.execPath + ' -e ' + ${JSON.stringify(JSON.stringify(GRANDCHILD))},
      (err, stdout) => {
        if (err) console.log('DOOR DENIED ' + (err.code || err.message));
        else console.log(stdout.includes('GRANDCHILD_RAN') ? 'DOOR OPEN' : 'DOOR DENIED no-output');
      });`,
  fork: `
    const { fork } = require('child_process');
    const path = require('path');
    require('fs').writeFileSync(path.join(__dirname, 'gc.js'), ${JSON.stringify(GRANDCHILD)});
    try { const c = fork(path.join(__dirname, 'gc.js'), [], { silent: true });
      let out = '';
      c.stdout.on('data', d => out += d);
      c.on('error', e => console.log('DOOR DENIED ' + (e.code || e.message)));
      c.on('close', () => console.log(out.includes('GRANDCHILD_RAN')
        ? 'DOOR OPEN' : 'DOOR DENIED no-output'));
    } catch (e) { console.log('DOOR DENIED ' + (e.code || e.message)); }`,
};

function runDoor(id, allowChild) {
  const file = path.join(DOORS_DIR, id + '.js');
  fs.writeFileSync(file, DOORS[id]);
  const args = ['--permission'];
  if (allowChild) args.push('--allow-child-process');
  args.push('--allow-fs-read=' + DOORS_DIR, file);
  const r = spawnSync(NODE, args, { encoding: 'utf8', timeout: 30000 });
  const line = (r.stdout || '').split('\n')
    .find((l) => l.startsWith('DOOR')) || 'DOOR NONE ' +
    ((r.stderr || '').slice(0, 140));
  console.log((allowChild ? 'G4_gate_open_' : 'G4_') + id.padEnd(16), line.trim());
  return { door: id, allowChild, result: line.trim() };
}

function runCwdCase() {
  // G5: child-process allowed, fs grants only for the doors dir;
  // the grandchild reports its working directory.
  const file = path.join(DOORS_DIR, 'cwdcase.js');
  fs.writeFileSync(file, `
    const { spawnSync } = require('child_process');
    try { const r = spawnSync(process.execPath,
        ['-e', 'console.log(process.cwd())'],
        { encoding: 'utf8', cwd: ${JSON.stringify(ROOT)} });
      console.log('CWD_RESULT ' + (r.stdout || '').trim() + ' err=' +
        (r.error ? (r.error.code || r.error.message) : 'none'));
    } catch (e) { console.log('CWD_RESULT DENIED ' + (e.code || e.message)); }`);
  const args = ['--permission', '--allow-child-process',
    '--allow-fs-read=' + DOORS_DIR, file];
  const r = spawnSync(NODE, args, { encoding: 'utf8', timeout: 30000 });
  const line = (r.stdout || '').split('\n')
    .find((l) => l.startsWith('CWD_RESULT')) || 'CWD_RESULT NONE';
  console.log('G5_cwd_outside_grants   ', line.trim(),
    '(cwd target was the fixture root, not fs-granted)');
  return { door: 'cwd', result: line.trim() };
}

function main() {
  fs.mkdirSync(DOORS_DIR, { recursive: true });
  const results = [];
  for (const id of Object.keys(DOORS)) results.push(runDoor(id, false));
  // control: one door with the grant present must open
  results.push(runDoor('spawnSync', true));
  results.push(runCwdCase());
  const out = path.join(__dirname,
    'corner2-doors-' + process.version.replace(/^v/, '') + '.json');
  fs.writeFileSync(out, JSON.stringify({ node: process.version, results }, null, 2));
  console.log('saved:', out);
}

main();
