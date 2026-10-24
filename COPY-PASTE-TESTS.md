# Copy-paste tests — rerun the key checks in CMD

All harnesses live in `lab/` on the desktop at
`C:\Users\Chintu\Desktop\CVE-HUNT\node-perm-lab\`.
Open CMD there and paste the commands. Node 22 is
`C:\nvm4w\nodejs\node.exe`; Node 24 is
`C:\Users\Chintu\AppData\Local\nvm\v24.22.1\node.exe`.

## 1. Worker read check (Corner 5 candidate)

```bat
C:\nvm4w\nodejs\node.exe corner5_k2.js
C:\Users\Chintu\AppData\Local\nvm\v24.22.1\node.exe corner5_k2.js
```

Expected on BOTH versions:

```
MAIN_control          RESULT MAIN DENIED ERR_ACCESS_DENIED
W_a_default           RESULT WORKER READ "VAULT-WITNESS-..."
W_c_explicit_flags    RESULT WORKER READ "VAULT-WITNESS-..."
```

The main process is denied (the lock works); the worker reads
the secret file anyway — even when explicitly handed the same
permission flags and grant list. Breadth probes (what the
worker's own permission checker answers, more read doors,
system-file and Desktop reads):

```bat
C:\nvm4w\nodejs\node.exe corner5_k4.js
C:\nvm4w\nodejs\node.exe corner5_k5.js
```

## 2. Corner 5 doors that held

```bat
C:\nvm4w\nodejs\node.exe corner5_doors.js
```

Expected: H1 DENIED (hardlink), W1 DENIED (watch),
W2 DENIED (watchFile), K2 DENIED (worker without the flag).

## 3. Corner 1 rerun (fs permission fixture)

```bat
C:\nvm4w\nodejs\node.exe perm_harness.js
```

Expected: controls pass; classic escapes denied; D1/D2/W2 pass
through the junction (documented limitation, not a finding).

## 4. Corner 4 glob rerun (honest grants)

```bat
C:\nvm4w\nodejs\node.exe corner4_glob2.js
```

Expected: every case DENIED, including the control — glob fails
closed under the model (anomaly in docs/RESULTS-CORNER4.md).

## 5. Corner 2 batch guard family

Use the Batch Guard Test Guide document (Word file, already
delivered): control case + Tests 1–4, each with its own test
word. Graded 2026-10-24: control EINVAL; all six colon forms
ENOENT; witness log never gained a test word. Family closed —
see docs/RESULTS-CORNER2.md.
