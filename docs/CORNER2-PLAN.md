# Corner 2 — child_process on Windows (BatBadBut family)

Scoped 2026-10-24. Disclosure route: Node security team via HackerOne.
Lab: desktop Node v22.20.0 (Windows), VM for source only.

## Why this corner
- CVE-2024-27980 (High, "BatBadBut", RyotaK): spawning .bat/.cmd files
  with crafted arguments let the arguments escape into the cmd.exe
  command line — command injection without shell:true.
- CVE-2024-36138: bypass of the INCOMPLETE fix for CVE-2024-27980.
  A fix family that has leaked twice.
- CVE-2025-23083 (High): permission-model escape via a side door —
  the --allow-child-process gate is part of this corner too.
- Same disease as TF-04 and Corner 1: two readers (Node/libuv quoting
  vs cmd.exe parsing) disagreeing about one string.

## Architecture (from source, main @ ca277a62)
- JS layer: lib/child_process.js normalizeSpawnArguments() — validation,
  shell handling (shell:true concatenates args UNESCAPED; DEP0190 warns;
  documented unsafe, so shell:true alone is NOT finding material).
- Native layer: deps/uv/src/win/process.c — quote_cmd_arg() and
  make_program_args() build the CreateProcess command line; the file
  also re-implements cmd.exe's program SEARCH (PATH/PATHEXT, quoted
  paths, ~lines 295-448) for extensionless spawns.
- Permission gate: src/permission/permission.cc kChildProcess scope;
  --allow-child-process flag (lib/internal/process/permission.js).

## Test design
Fixture: a work dir with (a) helper.bat / helper.cmd that echo their
arguments into args.txt, (b) a witness protocol: injected commands
would create PWNED.txt in the work dir; the case is a FINDING only if
PWNED.txt appears, a KILL if spawn errors or the bat receives the
payload as inert argument text (verified in args.txt).
Run matrix: each payload x {explicit .bat path, explicit .cmd path,
extensionless name resolved via PATH} x {spawn, spawnSync, execFile}.

### G1 — BatBadBut siblings (argument injection into .bat/.cmd)
Payload classes: embedded double quote; quote+ampersand; percent
expansion (%VAR% and %1-style); caret escapes; trailing backslash
before quote; newline/CR in argument; argument that is only a quote;
empty argument next to hostile argument; very long argument.
Expectation today: Node throws or args pass through inert.

### G2 — shell resolution (documented-unsafe edges excluded)
- comspec env var pointing at a fixture "shell" (does spawn with
  shell:true honour an attacker-shaped comspec? by design it does —
  grade as by-design unless it fires WITHOUT shell:true).
- Extensionless spawn where PATH contains the fixture dir first and a
  same-named .bat shadows an .exe (search-order emulation in libuv).

### G3 — environment block handling
- env keys beginning "=" (per-drive CWD entries, e.g. "=C:") — can a
  spawned .bat inherit a drive CWD that changes relative resolution?
- Duplicate keys differing only by case (Path vs PATH) — which wins
  in the child env block, and does it change program resolution?
- env value containing newline shaping the NEXT key (env block is a
  flat buffer built by libuv; check for key smuggling).

### G4 — permission-model gate doors (under --permission, NO
--allow-child-process; every door must throw ERR_ACCESS_DENIED)
spawn, spawnSync, exec, execFile, execFileSync, fork, and fork with
execPath pointed at a fixture copy of node.exe. (Workers are a
separate scope, kWorker — one control case only.)

### G5 — cwd option
Spawn with options.cwd outside any fs grant under --permission with
--allow-child-process granted: is cwd checked against fs grants at
all? (Expected: not checked — grade against docs before claiming.)

## Kill / keep rules
- PWNED.txt on disk = candidate finding; freeze, screenshot, record
  exact payload + API + Node version, re-verify on newest 24.x.
- Documented-unsafe (shell:true concatenation, verbatim arguments)
  never counts alone.
- Errors and inert pass-throughs are kills; record the error code.
