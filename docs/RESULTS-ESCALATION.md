# Escalation — worker read hole, end effect (2026-10-24)

Purpose: close the Akaunting gap. Proving "the worker reads a file"
is a step, not an impact. This run proves the private value actually
crosses the boundary intact and lands in space outside the vault.

## Method (worker-boundary-poc.js, fresh fixture each run)
- Private folder holds a test value split across two files; the
  combined value exists only if BOTH files are read.
- Restricted child: read on allowed only, write on allowed only,
  --allow-worker. Private folder never granted.
- Child (a) tries the private file on the main thread (control),
  (b) has the worker read both parts and combine them,
  (c) writes the combined value to allowed/output.txt,
  (d) the worker itself tries writing allowed/worker-output.txt.
- Unrestricted parent reads the allowed folder and compares.

## Results — identical on v22.20.0 and v24.22.1
- MAIN-DENIED ERR_ACCESS_DENIED (control holds).
- WORKER-COMBINED = exact expected value (both private files read
  and combined by the worker).
- WORKER-DIRECT-WRITE OK — new datum: the worker CAN write into a
  granted folder. Its write scope enforces ungranted paths but
  permits granted ones, so the worker places the value directly.
- MAIN-WRITE-ALLOWED OK — second, independent path via the main
  thread writing what the worker returned.
- VERIFY output.txt match=true, worker-output.txt match=true —
  checked from the unrestricted parent: the private value now sits
  in the allowed folder, byte-identical, readable by anyone with
  access to that folder.

## Verdict
End effect proven, not just the read step: a value that existed
only inside the private folder ends up intact outside it, through
two independent paths. The split-value design is the usability
proof — a single file read could be dismissed as a listing, but
a combined value requires both private files to have been read
and their contents used. (A crypto-sealed-blob variant would show
the same point with encryption; the split value already proves
the usable-material claim, so the crypto variant is optional.)
