'use strict';
/*
 * Corner 2 harness, part 1 (G1 argument handling, G2 resolution,
 * G3 environment). A fixture helper.bat/helper.cmd records the
 * arguments it receives. Every injection-shaped payload names a
 * unique marker file: the marker appearing on disk means the payload
 * escaped argument position and executed as its own command.
 * Runs unrestricted (it grades Node's argument handling itself);
 * part 2 (corner2_doors.js) covers the permission-model gate.
 */
const fs = require('fs');
const path = require('path');
const { spawnSync } = require('child_process');

const ROOT = path.join(__dirname, 'fixture2');
const LOG = path.join(ROOT, 'args-log.txt');

function buildFixtures() {
  fs.rmSync(ROOT, { recursive: true, force: true });
  fs.mkdirSync(ROOT, { recursive: true });
  const bat = '@echo off\r\n>>"%~dp0args-log.txt" echo %*\r\nexit /b 0\r\n';
  fs.writeFileSync(path.join(ROOT, 'helper.bat'), bat);
  fs.writeFileSync(path.join(ROOT, 'helper.cmd'), bat);
}

function runCase(id, fn) {
  const marker = path.join(ROOT, 'PWNED-' + id + '.txt');
  const logBefore = fs.existsSync(LOG) ? fs.readFileSync(LOG, 'utf8') : '';
  let out = { case: id };
  try {
    const r = fn(marker);
    out.status = r.status;
    out.error = r.error ? (r.error.code || r.error.message) : null;
    out.stderr = (r.stderr || '').toString().slice(0, 120);
  } catch (e) {
    out.thrown = e.code || e.message;
  }
  out.marker_created = fs.existsSync(marker);
  const logAfter = fs.existsSync(LOG) ? fs.readFileSync(LOG, 'utf8') : '';
  out.bat_received = logAfter.slice(logBefore.length).trim().slice(0, 200);
  console.log(id.padEnd(26),
    'marker:', out.marker_created,
    '| thrown:', out.thrown || '-',
    '| error:', out.error || '-');
  return out;
}

const inj = (marker) => `& echo PWNED > "${marker}" & rem `;

const PAYLOADS = (marker) => ({
  P1_control: ['hello world'],
  P2_quote_amp: [`a"${inj(marker)}"b`],
  P3_caret: [`a^"${inj(marker)}b`],
  P4_trail_bs: [`a\\"${inj(marker)}b`],
  P5_newline: [`a"\n${inj(marker)}b`],
  P6_only_quote: [`"${inj(marker)}`],
  P7_empty_first: ['', `a"${inj(marker)}"b`],
  P8_percent_amp: [`%CD%${inj(marker)}b`],
});

function main() {
  buildFixtures();
  const results = [];
  const files = {
    bat: path.join(ROOT, 'helper.bat'),
    cmd: path.join(ROOT, 'helper.cmd'),
  };
  for (const kind of ['bat', 'cmd']) {
    for (const pid of Object.keys(PAYLOADS('x'))) {
      results.push(runCase(`G1_${kind}_${pid}`, (marker) =>
        spawnSync(files[kind], PAYLOADS(marker)[pid],
          { encoding: 'utf8', timeout: 20000 })));
    }
  }
  // execFileSync on the sharpest two payloads
  const { execFileSync } = require('child_process');
  for (const pid of ['P2_quote_amp', 'P5_newline']) {
    results.push(runCase(`G1_execfile_${pid}`, (marker) => {
      try {
        execFileSync(files.bat, PAYLOADS(marker)[pid],
          { encoding: 'utf8', timeout: 20000 });
        return { status: 0, error: null };
      } catch (e) { return { status: e.status, error: e }; }
    }));
  }
  // G2: extensionless resolution through PATH (fixture dir first)
  for (const pid of ['P1_control', 'P2_quote_amp']) {
    results.push(runCase(`G2_extless_${pid}`, (marker) =>
      spawnSync('helper', PAYLOADS(marker)[pid], {
        encoding: 'utf8', timeout: 20000,
        env: { ...process.env, PATH: ROOT + ';' + process.env.PATH },
      })));
  }
  // G3: environment shaping
  results.push(runCase('G3_drive_cwd_env', () =>
    spawnSync(files.bat, ['showcwd'], {
      encoding: 'utf8', timeout: 20000,
      env: { ...process.env, '=C:': ROOT },
    })));
  results.push(runCase('G3_newline_key', () => {
    const env = { ...process.env };
    env['BAD\nKEY'] = 'x';
    return spawnSync(files.bat, ['hi'], { encoding: 'utf8', timeout: 20000, env });
  }));
  const out = path.join(__dirname,
    'corner2-results-' + process.version.replace(/^v/, '') + '.json');
  fs.writeFileSync(out, JSON.stringify({ node: process.version, results }, null, 2));
  console.log('saved:', out);
}

main();
