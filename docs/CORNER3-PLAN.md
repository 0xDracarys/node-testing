# Corner 3 — the environment permission system (--allow-env)

Scoped 2026-10-24 (source-first). Same target, next room.
Disclosure route: Node security team via HackerOne.

## Why this corner
- The env permission layer is NEW code: src/permission/env_permission.cc
  is 618 lines (the fs checker is 335) and still growing (audit mode,
  drop-with-scrub machinery). New security code is where bugs live.
- Same disease as Corners 1-2: several readers of one thing. The env
  block is read by the C++ matcher, by the JS process.env object, by
  child-process inheritance, and by worker permission intersection.
- Sibling history: CVE-2025-23083 (High) was a permission-model leak
  through a side door into workers. This corner hunts its family.

## What the source already shows
- EnvNameMatchesPattern(): exact or single trailing-* prefix match.
  On Windows the compare is case-insensitive (ToUpper) — the plain
  case flip is handled IN THE MATCHER. Doors that bypass the matcher
  are the question.
- EnvPatternCovers() + IntersectEnvAllowLists(): when a worker is
  created, its env grants are the INTERSECTION of lists, computed by
  pattern-cover reasoning (two-prefix cases reasoned by hand).
- There is a runtime-default allowlist (kRuntimeEnvironmentDefaults)
  and scrub/drop machinery that overwrites removed variables.

## Seams to test (lab: invented vars only, e.g. TEST_SECRET_X)
- S1 ENUMERATION DOOR: under --permission --allow-env=TEST_PUBLIC,
  can code learn TEST_SECRET's VALUE (or existence) via
  Object.keys(process.env), JSON.stringify(process.env), spread,
  for..in, process.env.hasOwnProperty, Reflect.ownKeys?
  (Checks are usually per-GET; enumeration is the classic gap.)
- S2 NAME SHAPES: read via different case on Windows (control —
  matcher claims handled), via prefix-pattern grants (TEST_*),
  via a name with trailing space or an '=' inside the key through
  process.env assignment-then-read (set is a door too).
- S3 WORKER INTERSECTION: parent grants TEST_* and SPECIFIC_ONE;
  worker created with its own env list; verify the worker can read
  exactly the intersection — no more. Especially prefix-vs-prefix
  and prefix-vs-exact cover cases.
- S4 CHILD INHERITANCE: under --permission with --allow-child-process
  and env grants on a subset, spawn a child with NO explicit env;
  dump the child's full env. Any ungranted TEST_ var present = leak.
- S5 DROP: read a granted var (control OK), permission.drop it,
  read again (must deny), enumerate (must vanish), spawn a child
  (must not inherit it).
- S6 DEFAULTS: is anything readable with NO --allow-env at all
  (runtime defaults list)? Print what is readable; grade vs docs.

## Grading
- A var's VALUE appearing where the grant says no = finding candidate.
- Names-only leakage = note, grade honestly (likely low).
- Controls first: granted var MUST read, ungranted MUST deny by the
  plain door, or the rig is lying.
