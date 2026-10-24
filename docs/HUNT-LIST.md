# Node.js — Hunt List 1: Permission Model × Windows paths

Setup for every case: a "vault" folder OUTSIDE the grant containing a
witness file (SECRET.txt), an "allowed" folder inside the grant, and a
test script run as:
  node --permission --allow-fs-read=<allowed> --allow-fs-write=<allowed> case.js
PASS (safe) = the read/write of the vault file is denied (ERR_ACCESS_DENIED)
or lands inside the allowed folder.
FINDING = the vault file is read or written, or a file appears outside
the allowed tree. Controls first: a plain outside path MUST be denied,
and a plain inside path MUST work (proves the rig is honest).

All cases run on the DESKTOP (Windows/NTFS): Node v22.20.0 first, any
hit re-verified on the newest 24.x Windows build before reporting.
POSIX results do not count for this hunt.

## Group A — drive-name shapes (siblings of CVE-2025-23084)
- A1: read vault via drive-relative form of the vault path (X:file style)
- A2: read vault via "X:" + ".." combinations from an allowed CWD
- A3: grant expressed drive-relative; does the grant accidentally widen?
- A4: mixed separators C:/ and C:\ for the same target — check both

## Group B — device names (siblings of CVE-2025-27210)
- B1: vault read via path that passes through a device-named folder
- B2: write to device-name targets under --allow-fs-write on allowed dir
- B3: device name + extension / trailing dot / trailing space variants
- B4: does a grant on an allowed folder match a device-named lookalike?

## Group C — prefix and tail shapes
- C1: \\?\ prefixed vault path (checker strips prefix? Win32 doesn't)
- C2: \\.\ device-prefix path to the vault file
- C3: vault path with trailing dot / trailing space on last component
- C4: vault path with ADS colon (vault.txt:stream read/write)
- C5: 8.3 short-name form of the vault path (needs short names enabled)
- C6: case-flipped vault path (expected same on NTFS — control case)

## Group D — structure shapes
- D1: symlink inside allowed folder -> vault file (read through link)
- D2: junction inside allowed folder -> vault folder (read through it)
- D3: ".." that only escapes AFTER the checker's normalization
- D4: relative path resolved from a CWD inside the grant to vault file
- D5: wildcard grant (allowed*) — sibling-prefix folder with same start
      (e.g. grant on C:\lab\allowed* vs folder C:\lab\allowed-evil)

## Group E — API surface differences (same path, different door)
- E1: fs.readFileSync vs fs.promises vs fs.createReadStream
- E2: fs.stat / fs.watchFile on the vault (metadata-only leak class,
      cf. CVE-2023-30582)
- E3: require() of a file in the vault (module loading path checks)
- E4: fs.cp / fs.copyFile into the allowed folder from the vault

## Kill / keep rules
- A case is KILLED only when the denial is observed (error captured),
  not when the script errors for an unrelated reason.
- Any FINDING gets: minimal PoC script, exact node version, the grant
  command line, witness-file proof, and a screenshot — Sam's bar.
- If A–E all die on 22.20.0, re-run the survivors' shapes on the path
  APIs directly (path.win32.join/normalize/resolve) as Corner 1b before
  moving to child_process (Corner 2).
