# Corner 4 — fs.glob × Permission Model (2026-10-24)

Lab: desktop Node v22.20.0, Corner 1 fixture (allowed / vault).

## Round 1 — DISCARDED (rig error, mine)
corner4_glob.js granted the fixture ROOT "for pattern resolution".
Directory grants widen to root\* (WildcardIfDir), which covers the
vault. The one "hit" (relative pattern listed vault contents) was my
own grant, not a bypass. Control (glob inside allowed) also DENIED,
which was the first sign the rig was off. Lesson promoted to the
language_cve_hunter skill learnings (grant-design trap).

## Round 2 — honest grants (allowed + cases only), corner4_glob2.js
- CTRL_inside_abs (glob inside the granted folder): DENIED
- T1 absolute vault pattern: DENIED
- T2 relative ../vault/*: DENIED
- T3 relative vault/* from fixture cwd: DENIED
- T4 glob with {cwd: vault} option: DENIED
- T5 absolute pattern with .. into vault: DENIED

## Ancestor probe
Granting every ancestor directory of allowed (up to the drive root)
did NOT un-deny the control. Source check: lib/internal/fs/glob.js
contains no permission code of its own — it rides on the fs
primitives it calls.

## Star-grant probe (2026-10-24, decisive)
With `--allow-fs-read=*`, glob WORKS (returns hello.txt and
link-file.txt). So the control denial is a path-coverage problem:
the glob walker touches some path the grant set does not cover
(it is not the ancestors — those were granted and it still
denied). Security verdict unchanged: glob fails CLOSED, never
open. The anomaly is now a usability note (glob under the model
needs broader grants than a plain read of the same folder), not
a mystery. Optional refinement: --permission-audit + the
node:permission-model:fs diagnostics channel would name the exact
path the walker checks, if anyone wants to pin it down.

## Verdict
No fail-open anywhere: glob under --permission fails CLOSED in every
configuration tried — if anything it over-denies, to the point of
being unusable without research. No security finding. The round-1
self-correction (discarding my own fake hit) is the run's real value,
plus the anomaly note for a future fresh-eyes pass.

## Corner 3 status (for the record)
--allow-env does not exist in any released line (bad option on
22.20.0 and on a freshly installed Windows 24.22.1; cli.md on main
says "added: REPLACEME"). Corner 3 is PARKED until the env permission
model ships in a release — the released-only rule forbids hunting it
on main. Re-check at each new Node release.
