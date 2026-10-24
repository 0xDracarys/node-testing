# Node.js — Source Notes 1: the FS permission checker (main @ ca277a62)

Checker: src/permission/fs_permission.cc (335 lines). Grants and checks
both go through node::PathResolve (src/path.cc) — lexical normalization
only. NO realpath / symlink resolution anywhere in the check path.

## How a check works (is_tree_granted)
1. resolved = PathResolve(param)
2. Windows only, string surgery AFTER resolve, in this order:
   - strip leading "\\?\" (4 chars)
   - strip leading "UNC\"
   - strip leading "//"
3. RadixTree::Lookup(resolved) — byte-wise string matching. Wildcard
   nodes match by prefix length (path_len >= prefix_len - 2 for "/*").

## How a grant works (Apply -> GrantAccess)
1. resolved = PathResolve(grant)
2. WildcardIfDir: stat()s the path AT GRANT TIME; if it is a directory,
   appends "\*" (or "*" if already separator-terminated).
3. Inserted into the radix tree as a literal string.

## Asymmetries / observations (hunt fuel, not findings)
- S1 PREFIX ASYMMETRY: checks strip \\?\ / UNC\ / // after resolving;
  grants never strip. A grant written with a prefix likely just fails
  to match (fail-closed) — but the reverse combinations must be tested,
  especially \\.\ (device namespace), which the checker does NOT strip.
- S2 NO CASE FOLDING: tree compare is byte-wise; NTFS is case
  insensitive. Expected fail-closed (deny), verify empirically (C6).
- S3 SYMLINKS/JUNCTIONS UNRESOLVED: the check is purely lexical, so a
  link inside a granted folder pointing outside is the classic gap.
  Whether it is exploitable depends on per-API behaviour in lib/fs —
  D1/D2 are the make-or-break empirical cases.
- S4 GRANT-TIME STAT: WildcardIfDir snapshots the filesystem at
  startup. Non-existent dir grant = exact-path only (documented).
  File-replaced-by-dir and dir-replaced-by-symlink between grant and
  use are TOCTOU-shaped edges worth one case each (D-group add).
- S5 USER WILDCARDS ARE PREFIX WILDCARDS: --allow-fs-read=/x/allowed*
  also matches /x/allowed-evil (documented in Node docs — NOT a vuln).
  Only undocumented widening counts.
- S6 DRIVE-RELATIVE: PathResolve honours per-drive CWD (=X: env).
  Checker and opener should agree; CVE-2025-23084 was in the JS path
  tools, not this C++ resolver — A-group tests decide if the checker
  shares the family flaw.

## Repo house rules (node-src/AGENTS.md) — for later
No unsupervised interaction with the Node project; any report/PR text
must be human-reviewed (Sam reviews and sends, as with PSRT); security
reports go through the Node security process (HackerOne), not issues.
