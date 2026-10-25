# Final test — run this one last time (desktop lab, CMD)

Folder on the desktop: `C:\Users\Chintu\Desktop\CVE-HUNT\node-perm-lab`
Files needed (already there, also in this repo under `lab/`):
`worker-read-poc.js`, `worker-boundary-poc.js`

## Commands (paste in order)

```bat
cd /d C:\Users\Chintu\Desktop\CVE-HUNT\node-perm-lab
C:\nvm4w\nodejs\node.exe worker-read-poc.js
C:\Users\Chintu\AppData\Local\nvm\v24.22.1\node.exe worker-read-poc.js
C:\nvm4w\nodejs\node.exe worker-boundary-poc.js
C:\Users\Chintu\AppData\Local\nvm\v24.22.1\node.exe worker-boundary-poc.js
```

## Expected output (witness values change every run — that is the point)

Worker-read PoC, on BOTH versions:
```
node: v22.20.0 / v24.22.1
witness: POC-WITNESS-<fresh value>
MAIN-DENIED ERR_ACCESS_DENIED
WORKER-READ POC-WITNESS-<same fresh value>
```

Boundary PoC, on BOTH versions:
```
node: v22.20.0 / v24.22.1
expected: BOUNDARY-TEST-A-BOUNDARY-TEST-B-<fresh value>
MAIN-DENIED ERR_ACCESS_DENIED
WORKER-COMBINED BOUNDARY-TEST-A-BOUNDARY-TEST-B-<same fresh value>
WORKER-DIRECT-WRITE OK
MAIN-WRITE-ALLOWED OK
VERIFY output.txt match=true
VERIFY worker-output.txt match=true
```

## What each line proves

- `MAIN-DENIED` — the control: the restricted main thread cannot read
  the private file. The lock works on the main thread.
- `WORKER-READ` / `WORKER-COMBINED` — the worker thread reads the
  private file(s) the main thread cannot, and returns the exact value.
- `WORKER-DIRECT-WRITE OK` — the worker can also write into a
  granted folder, so it places the value there itself.
- `VERIFY ... match=true` — checked from the unrestricted parent:
  the private value now sits in the allowed folder, byte-identical.

## Last verified run (2026-10-24)

- worker-read-poc: 22.20.0 witness `POC-WITNESS-mvmecrze` matched;
  24.22.1 witness `POC-WITNESS-mvmecs2l` matched.
- worker-boundary-poc: 22.20.0 expected `...-mvmecs5u`, both verifies
  true; 24.22.1 expected `...-mvmecs97`, both verifies true.
- Both PoCs use only Node.js itself, fresh test-only values, and
  their own fixture folders (`poc-clean/`, `esc-clean/`). No real
  secrets, no production systems, no other users' data.
