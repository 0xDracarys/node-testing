# Corner 5 — worker threads × Permission Model (2026-10-24)

Lab: desktop Windows, Node v22.20.0 AND v24.22.1 (both released).
Parent grants in every case: --permission, read+write on fixture
`allowed`, read on the cases dir, --allow-worker. The vault is never
granted. Controls and results are identical on both versions unless
noted.

## Controls (rig honest)
- MAIN process read of vault/SECRET.txt: DENIED ERR_ACCESS_DENIED.
- Hardlink door (fs.link of the vault file into allowed): DENIED.
- fs.watch / fs.watchFile on the vault file: DENIED.
- Worker creation WITHOUT --allow-worker: DENIED.

## The worker read hole (K1/K2/K4/K5)
A worker created by the restricted parent reads ANY file:
- fixture vault SECRET.txt — content returned (all variants).
- C:\Windows\win.ini — content returned.
- C:\Users\Chintu\Desktop — directory listing returned.
Doors that all worked inside the worker: fs.readFileSync,
fs.promises.readFile, fs.statSync, fs.readdirSync, fs.realpathSync.
Variants that ALL read: (a) default worker (no execArgv),
(b) execArgv explicitly re-listing --permission + every grant,
(c) execArgv: [].

Inside the worker, process.permission exists and answers:
  has('fs.read', <vault file>)  -> true
  has('fs.read', <allowed file>) -> true
  has('fs.read', '*')            -> true
  has('fs.read')                 -> false
But sibling scopes ARE enforced in the same worker:
  fs.writeFileSync into the vault -> DENIED ERR_ACCESS_DENIED
  child_process spawn             -> DENIED ERR_ACCESS_DENIED

## Mechanism (source, main @ ca277a62)
- src/permission/fs_permission.h: deny_all_in_ and deny_all_out_
  both default to true; grants are applied per-Environment in
  src/env.cc (line ~1111) from that environment's own options.
- is_tree_granted() calls RadixTree::Lookup(path, true): an EMPTY
  grant tree returns TRUE for every path.
- Observed worker state matches a Permission object whose read side
  was switched on (deny_all_in_ false) without any grants being
  applied: read checks consult a tree that answers yes to
  everything, while the write and child scopes sit in their
  deny-by-default state. The exact line that flips the read side in
  worker bootstrap is the remaining source question.

## The docs counter-argument (stated honestly)
- Released v24.22.1 docs, Permission Model constraints, in full:
  "The model does not inherit to a worker thread."
- Main-branch docs expand this: default workers receive the parent
  CLI flags; setting execArgv replaces them; "That difference is
  intended, not a bypass."
- Why this may still be reportable: neither text describes the
  observed state. "Does not inherit" predicts no model in the
  worker; instead the worker HAS a permission object, enforces
  write and child scopes, and affirmatively reports fs.read as
  granted for arbitrary paths (has() -> true) — including in
  variant (b), where the worker was explicitly handed --permission
  and the grant list and still reads outside them. Precedent:
  CVE-2025-23083 — a worker-adjacent Permission Model leak was
  treated as a High-severity vulnerability by the Node team.
- Framing for the report: lead with the internal inconsistency
  (has() contract + selective enforcement + explicit-flags
  variant), disclose the docs sentence ourselves, let HackerOne
  triage decide. Sam's format: SUMMARY / STEPS / IMPACT + honest
  scope notes.

## Status
SUBMITTED, then closed Informative on Signal — NOT on merits.
HackerOne report #4142193, submitted 2026-10-24, closed the same
day 15:43 CEST as Informative because the reporter's Signal score
did not meet the Node.js project's 1.0 minimum. Never triaged on
substance; one trial report likely burned (2 left). Full outcome,
exact closure wording, and next step (OpenJS Slack DM only):
`HACKERONE-OUTCOME.md` in the repo root. Do not resubmit on
HackerOne.
