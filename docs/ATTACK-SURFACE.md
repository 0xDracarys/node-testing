# Node.js — Attack Surface Map (Hunt 1: Permission Model on Windows)

Started 2026-10-24. Method: language_cve_hunter skill (corner picking,
patch-sibling mapping, released-version-only verification, honest kills).
Disclosure route: DIRECT to the Node.js security team via their HackerOne
program. Never VulnCheck, never a public issue first.

## Lab inventory (verified 2026-10-24)

- Desktop (Windows 10, NTFS): Node v22.20.0 (nvm, C:\nvm4w\nodejs\node.exe)
- VM: Node v24.22.1 (/usr/bin/node)
- Both are released versions AFTER the CVE-2025-27210 fix (22.17.1 / 24.4.1),
  so anything found here is a live sibling, not the already-fixed bug.
- Source: shallow clone of nodejs/node (main) in ./node-src — hunting map
  only; findings must reproduce on the released binaries above.

## The corner

The Permission Model (`--permission`, stable since v22.13.0 / v23.5.0) is
an allow-list enforced when code uses node:fs, child processes, workers.
File grants come from `--allow-fs-read` / `--allow-fs-write` (paths and
wildcards). The security question is the TF-04 question, one level up:

  Does the permission checker interpret a Windows path the same way the
  filesystem (via libuv) actually resolves it?

The checker lives in src/node_permission.cc (+ lib/internal/permission);
the actual opens go through libuv to Win32. Any shape the checker
normalises one way and Win32 resolves another way is a candidate bypass.

## Patch-sibling map (why this corner, why now)

- CVE-2025-23084 (Jan 2025, Medium, CWE-22): path.join on Windows did not
  treat drive names as special — a "relative" path actually landed at a
  drive root. Fixed in path handling.
- CVE-2025-27210 (Jul 2025): INCOMPLETE FIX for CVE-2025-23084 — Windows
  device names (CON, PRN, AUX) still bypassed path.join/normalize
  traversal handling. Fixed in 20.19.4 / 22.17.1 / 24.4.1.
- CVE-2025-23083 (Jan 2025, High): Permission Model bypass via worker
  leak through diagnostics_channel — proves the Node team treats
  permission-model escapes as real CVEs.
- CVE-2024-27980 / CVE-2024-36138 (2024): child_process on Windows
  (.bat/.cmd argument handling) — Corner 2, later.

Pattern: Windows path semantics keep leaking through Node's checks, and
at least one fix in this exact family was incomplete. We hunt the next
sibling: shapes the two fixes did not cover, tested against the
Permission Model's own grant matching (not just path.join), because the
grant check is the actual security boundary.

## Name/path shapes under test (Windows semantics checklist)

Drive family: C:\abs, C:drive-relative, C:\, bare "C:", mixed "C:/",
"C:..", drive + wildcard grants. Device family: CON/PRN/AUX/NUL/COM1
with extensions, with trailing dot/space, inside subfolders, as grant
and as target. Prefix family: \\?\C:\..., \\.\..., UNC \\server\share.
Name-tail family: trailing dot, trailing space, ADS colon
(file.txt:stream), 8.3 short names (PROGRA~1), case variants.
Structure family: .. after grant prefix, symlink/junction inside an
allowed folder pointing outside, relative paths from a different CWD.

## Out of scope for Hunt 1

- V8/engine memory bugs (fuzzer territory).
- Anything requiring a pre-release build to reproduce.
- --allow-net / --allow-ffi (not present on the 22 line; later corner).
