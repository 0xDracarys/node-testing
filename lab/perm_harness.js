'use strict';
/*
 * Permission Model conformance harness (Windows desktop lab).
 * Builds a fixture tree (an allowed folder, an ungranted vault folder
 * with a witness file, links between them), then runs one small case
 * script per case in a child node process started with --permission
 * and grants limited to the allowed folder (+ read on the cases dir).
 * Each case prints one RESULT line; the parent also verifies write
 * side effects on disk and saves a JSON summary next to this file.
 */
const fs = require('fs');
const path = require('path');
const { spawnSync } = require('child_process');

const ROOT = path.join(__dirname, 'fixture');
const ALLOWED = path.join(ROOT, 'allowed');
const ALLOWED_EVIL = path.join(ROOT, 'allowed-evil');
const VAULT = path.join(ROOT, 'vault');
const CASES_DIR = path.join(ROOT, 'cases');
const SECRET = 'VAULT-WITNESS-7f3a9';
const NODE = process.execPath;

function buildFixtures() {
  fs.rmSync(ROOT, { recursive: true, force: true });
  fs.mkdirSync(ALLOWED, { recursive: true });
  fs.mkdirSync(ALLOWED_EVIL, { recursive: true });
  fs.mkdirSync(VAULT, { recursive: true });
  fs.mkdirSync(CASES_DIR, { recursive: true });
  fs.writeFileSync(path.join(ALLOWED, 'hello.txt'), 'hello inside\n');
  fs.writeFileSync(path.join(ALLOWED_EVIL, 'loot.txt'), 'sibling loot\n');
  fs.writeFileSync(path.join(VAULT, 'SECRET.txt'), SECRET + '\n');
  fs.writeFileSync(path.join(VAULT, 'mod.js'),
    'module.exports = ' + JSON.stringify(SECRET) + ';\n');
  const links = {};
  try {
    fs.symlinkSync(path.join(VAULT, 'SECRET.txt'),
                   path.join(ALLOWED, 'link-file.txt'), 'file');
    links.file = true;
  } catch { links.file = false; }
  try {
    fs.symlinkSync(VAULT, path.join(ALLOWED, 'link-dir'), 'junction');
    links.dir = true;
  } catch { links.dir = false; }
  return links;
}

// Each case body runs inside the restricted child. It must print
// exactly one line starting with RESULT.
const READ = (expr) => `
  const fs = require('fs');
  try { const d = fs.readFileSync(${expr}, 'utf8');
        console.log('RESULT READ_OK ' + JSON.stringify(d.trim())); }
  catch (e) { console.log('RESULT DENIED ' + (e.code || e.message)); }`;
const P = (p) => JSON.stringify(p);

const CASES = [
  { id: 'CTRL_in_read', body: READ(P(path.join(ALLOWED, 'hello.txt'))) },
  { id: 'CTRL_out_read', body: READ(P(path.join(VAULT, 'SECRET.txt'))) },
  { id: 'A1_drive_relative', cwd: ALLOWED,
    body: READ(`'C:' + ${P('\\\\..\\\\vault\\\\SECRET.txt')}`) },
  { id: 'A2_fwd_slash_abs', body: READ(P(path.join(VAULT, 'SECRET.txt').replace(/\\/g, '/'))) },
  { id: 'A3_dotdot', body: READ(P(path.join(ALLOWED, '..', 'vault', 'SECRET.txt'))) },
  { id: 'C1_prefix_q', body: READ(P('\\\\?\\' + path.join(VAULT, 'SECRET.txt'))) },
  { id: 'C2_prefix_device', body: READ(P('\\\\.\\' + path.join(VAULT, 'SECRET.txt'))) },
  { id: 'C6_case_flip', body: READ(P(path.join(ROOT, 'ALLOWED', 'HELLO.TXT'))) },
  { id: 'D1_link_file', body: READ(P(path.join(ALLOWED, 'link-file.txt'))) },
  { id: 'D2_link_dir', body: READ(P(path.join(ALLOWED, 'link-dir', 'SECRET.txt'))) },
  { id: 'D5_prefix_sibling', body: READ(P(path.join(ALLOWED_EVIL, 'loot.txt'))) },
  { id: 'D5b_user_wildcard', grants: 'wildcard',
    body: READ(P(path.join(ALLOWED_EVIL, 'loot.txt'))) },
  { id: 'E1b_promises', body: `
      const fs = require('fs/promises');
      fs.readFile(${P(path.join(VAULT, 'SECRET.txt'))}, 'utf8')
        .then(d => console.log('RESULT READ_OK ' + JSON.stringify(d.trim())))
        .catch(e => console.log('RESULT DENIED ' + (e.code || e.message)));` },
  { id: 'E1c_stream', body: `
      const fs = require('fs');
      const s = fs.createReadStream(${P(path.join(VAULT, 'SECRET.txt'))}, 'utf8');
      let out = '';
      s.on('data', c => out += c);
      s.on('error', e => console.log('RESULT DENIED ' + (e.code || e.message)));
      s.on('end', () => console.log('RESULT READ_OK ' + JSON.stringify(out.trim())));` },
  { id: 'E2_stat', body: `
      const fs = require('fs');
      try { const st = fs.statSync(${P(path.join(VAULT, 'SECRET.txt'))});
            console.log('RESULT STAT_OK size=' + st.size); }
      catch (e) { console.log('RESULT DENIED ' + (e.code || e.message)); }` },
  { id: 'E3_require', body: `
      try { const m = require(${P(path.join(VAULT, 'mod.js'))});
            console.log('RESULT READ_OK ' + JSON.stringify(m)); }
      catch (e) { console.log('RESULT DENIED ' + (e.code || e.message)); }` },
  { id: 'E4_copyfile', body: `
      const fs = require('fs');
      try { fs.copyFileSync(${P(path.join(VAULT, 'SECRET.txt'))},
                            ${P(path.join(ALLOWED, 'copy.txt'))});
            console.log('RESULT COPY_OK'); }
      catch (e) { console.log('RESULT DENIED ' + (e.code || e.message)); }` },
  { id: 'E5_readdir', body: `
      const fs = require('fs');
      try { const names = fs.readdirSync(${P(VAULT)});
            console.log('RESULT LIST_OK ' + JSON.stringify(names)); }
      catch (e) { console.log('RESULT DENIED ' + (e.code || e.message)); }` },
  { id: 'W1_plain_write', body: `
      const fs = require('fs');
      try { fs.writeFileSync(${P(path.join(VAULT, 'planted.txt'))}, 'x');
            console.log('RESULT WRITE_OK'); }
      catch (e) { console.log('RESULT DENIED ' + (e.code || e.message)); }`,
    verify: () => !fs.existsSync(path.join(VAULT, 'planted.txt')) },
  { id: 'W2_link_dir_write', body: `
      const fs = require('fs');
      try { fs.writeFileSync(${P(path.join(ALLOWED, 'link-dir', 'planted2.txt'))}, 'x');
            console.log('RESULT WRITE_OK'); }
      catch (e) { console.log('RESULT DENIED ' + (e.code || e.message)); }`,
    verify: () => !fs.existsSync(path.join(VAULT, 'planted2.txt')) },
  { id: 'W3_prefix_write', body: `
      const fs = require('fs');
      try { fs.writeFileSync(${P('\\\\?\\' + path.join(VAULT, 'planted3.txt'))}, 'x');
            console.log('RESULT WRITE_OK'); }
      catch (e) { console.log('RESULT DENIED ' + (e.code || e.message)); }`,
    verify: () => !fs.existsSync(path.join(VAULT, 'planted3.txt')) },
];

function grantsFor(c) {
  if (c.grants === 'wildcard') {
    return ['--allow-fs-read=' + ALLOWED + '*',
            '--allow-fs-read=' + CASES_DIR,
            '--allow-fs-write=' + ALLOWED];
  }
  return ['--allow-fs-read=' + ALLOWED,
          '--allow-fs-read=' + CASES_DIR,
          '--allow-fs-write=' + ALLOWED];
}

function main() {
  const links = buildFixtures();
  const results = [];
  for (const c of CASES) {
    const file = path.join(CASES_DIR, c.id + '.js');
    fs.writeFileSync(file, c.body);
    const args = ['--permission', ...grantsFor(c), file];
    const r = spawnSync(NODE, args, {
      cwd: c.cwd || ROOT, encoding: 'utf8', timeout: 30000,
    });
    const line = (r.stdout || '').split('\n')
      .find((l) => l.startsWith('RESULT')) || 'RESULT NONE';
    const rec = { case: c.id, result: line.trim(),
                  stderr_head: (r.stderr || '').slice(0, 160) };
    if (c.verify) rec.side_effect_absent = c.verify();
    results.push(rec);
    console.log(c.id.padEnd(20), line.trim(),
                c.verify ? ('| side-effect-absent: ' + rec.side_effect_absent) : '');
  }
  const out = path.join(__dirname,
    'perm-results-' + process.version.replace(/^v/, '') + '.json');
  fs.writeFileSync(out, JSON.stringify(
    { node: process.version, links, results }, null, 2));
  console.log('links:', JSON.stringify(links));
  console.log('saved:', out);
}

main();
