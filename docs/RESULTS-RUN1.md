# Node Permission Model — Lab Run 1 results (2026-10-24)

Rig: perm_harness.js on the desktop (Windows 10, NTFS), Node v22.20.0.
Fixture: granted folder `allowed`, ungranted `vault` with witness file,
links from allowed into vault. Raw output: perm-results-22.20.0.json.

## Controls — honest
- CTRL_in_read: READ_OK (inside file readable)
- CTRL_out_read: DENIED ERR_ACCESS_DENIED (plain outside path blocked)

## Killed (checker held)
- A1 drive-relative, A2 forward-slash absolute, A3 ".." escape: DENIED
- C1 "\\?\" prefix, C2 "\\.\" device prefix: DENIED
- C6 case-flipped granted path: DENIED (fail-closed, as predicted)
- D5 sibling-prefix folder (allowed-evil without wildcard): DENIED
- E1b promises, E1c stream, E2 stat, E3 require, E4 copyFile,
  E5 readdir: all DENIED
- W1 plain outside write: DENIED, no file created
- W3 "\\?\" outside write: DENIED, no file created

## Hits — real behaviour, but DOCUMENTED (killed as findings)
- D1 symlink FILE inside allowed -> vault file: READ the witness.
- D2 JUNCTION inside allowed -> vault dir: READ the witness.
- W2 write through the junction: file PLANTED in the vault
  (parent-verified on disk). Read AND write escape both reproduce.
- D5b user wildcard grant (allowed*) reading allowed-evil: READ —
  documented prefix-wildcard semantics, by design, not a hit at all.

Why D1/D2/W2 are NOT reportable: doc/api/permissions.md,
"Limitations and Known Issues" (current main, same text family as the
released docs): "Symbolic links will be followed even to locations
outside of the set of paths that access has been granted to... you must
ensure that no paths to which access has been granted contain relative
symbolic links." The Node team has this exact behaviour in writing as
a known limitation. Reporting it would be the Espo mistake in reverse:
the exclusion here is real and explicit. Killed honestly, 2026-10-24.

## What Run 1 actually proved
- The end-to-end rig works (fixtures, per-case children, side-effect
  verification) — reusable for every later corner.
- On 22.20.0 the grant checker itself is well hardened against the
  Windows path-shape family (drive, prefix, case, sibling shapes all
  fail closed). The 23084/27210 flaw family does NOT repeat inside
  fs_permission.cc's own PathResolve path.
- Remaining micro-leads (low expectation): S1 grant-side prefix
  asymmetry, S4 grant-time stat TOCTOU (swap path type after launch).

## Next corner
Corner 2: child_process on Windows (BatBadBut family: CVE-2024-27980,
CVE-2024-36138) — spawn/shell/env argument handling, plus the
permission model's --allow-child-process gate itself.
