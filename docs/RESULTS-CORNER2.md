# Corner 2 — child_process on Windows: results (2026-10-24)

Lab: desktop Node v22.20.0. Raw outputs: corner2-results-22.20.0.json,
corner2-doors-22.20.0.json. Guard probe F1 run by Sam (screenshot).

## G1 direct batch spawn — closed BY DESIGN
- spawn/spawnSync of helper.bat / helper.cmd: EINVAL for every
  argument set, including none. Node's own test
  (test-child-process-spawn-windows-batch-file.js) states the design:
  batch files may only run via shell, because Win32 direct batch
  execution "does not sanitize arguments". The BatBadBut road is
  closed by refusal, not by escaping.

## The guard — source analysis
- IsWindowsBatchFile() (src/util-inl.h), called from process_wrap.cc
  and spawn_sync.cc: regex `\.([a-zA-Z0-9]+)\s*[\.\s]*$` reads the
  LAST extension; blocks iff it is bat/cmd (trailing dots/spaces
  tolerated). ADS suffixes (name.bat::$DATA, name.bat:stream) break
  the pattern -> guard reads them as "not a batch file".

## F1 probe (helper.bat::$DATA, Sam's run, 2026-10-24 02:37)
- Result: err ENOENT. The guard did NOT block the name (no EINVAL),
  but process creation failed: Windows/libuv will not execute an
  image named with an ADS suffix. No new line in args-log.txt
  (the two "hello" lines are from earlier shell/cmdwrap probes).
- Verdict: the two-reader disagreement is real but harmless here —
  the OS reader refuses the name too. Chain breaks at process
  creation. F2/F3/F4 go through the same image-name resolution;
  family closed on this evidence.

## Full colon family — run by Sam from the Word guide (2026-10-24 03:10)
Control (plain helper.bat, arg "control"): EINVAL — setup honest.
Every colon form returned ENOENT with NO new line in args-log.txt:
- helper.bat::$DATA (F1 repeat, arg hello): ENOENT
- helper.bat: (t1colon): ENOENT
- helper.bat:evil (t2evil): ENOENT
- helper.cmd::$DATA (t3cmd): ENOENT
- helper.cmd: (t4colon): ENOENT
- helper.cmd:evil (t4evil): ENOENT
Final log still only the two old "hello" lines from the shell/cmdwrap
probes. FAMILY CLOSED on complete evidence: the guard regex is fooled
by every colon form, but Windows process creation refuses every one
of those names. No form executes, so no argument handling is ever
reached. The async spawn() variant was not run — spawnSync and spawn
share the same guard (process_wrap.cc / spawn_sync.cc) and the same
CreateProcess image-name resolution that produced ENOENT, so the
verdict covers it.

## G4 permission gate — HOLDS
- Under --permission with no --allow-child-process: spawn, spawnSync,
  exec, execFileSync, fork all denied (ERR_ACCESS_DENIED or the
  restricted-API throw). Control door with the grant: OPEN.

## G5 cwd — by design
- With --allow-child-process, a spawned child's cwd is not checked
  against fs grants; spawned children are unsandboxed by design.

## G2 / G3
- G2 extensionless resolution: ENOENT (CreateProcess does not apply
  PATHEXT here) — as designed.
- G3 env shaping (=C: key, newline key): both attempts returned
  EINVAL but were confounded by the .bat spawn refusal; not cleanly
  graded. Low value; parked.

## Corner 2 verdict
No finding. Node's post-BatBadBut posture (refuse, don't escape) plus
CreateProcess image-name strictness closes this family on 22.20.0.
