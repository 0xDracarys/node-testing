# HackerOne outcome — report #4142193 (Informative, on Signal — not on merits)

## In one line

The Node.js worker-read report was **closed as Informative on 2026-10-24 at 15:43 CEST, the same day it was submitted — because the reporter's HackerOne Signal score was below the Node.js project's minimum threshold. It was never triaged on its technical merits.**

That is the whole story. Nothing in the closure says the finding is wrong, expected behaviour, a duplicate, or not a vulnerability. No Node maintainer judged the code, the PoCs, or the docs argument.

## The report

- **HackerOne report:** #4142193
- **Title:** "Worker threads bypass --permission read restrictions in Node.js v22.20.0 and v24.22.1"
- **Reporter:** Shubham Bhasker (HackerOne: dracarysroxxx, GitHub: 0xDracarys)
- **Submitted:** 2026-10-24, by Sam on HackerOne (Report Intent #402203)
- **Full report text in this repo:** `HACKERONE-REPORT.md` (pre-submission draft) and `HACKERONE-REPORT-AS-SUBMITTED.md` (text as submitted, PoCs embedded)
- **Proofs in this repo:** `lab/worker-read-poc.js` (minimum proof), `lab/worker-boundary-poc.js` (escalation / end-effect proof)
- **Evidence in this repo:** `docs/RESULTS-CORNER5.md`, `docs/RESULTS-ESCALATION.md`

## The closure — exact wording

Email from HackerOne (`no-reply@hackerone.com`, message `1a16e27348d86b48`), sent **Sat 2026-10-24 15:43:43 CEST (13:43:43 UTC)**, subject `[nodejs] #4142193: Worker threads bypass --permission read restrictions in Node.js v22.20.0 and v24.22.1`:

> auto-xa5uvohlajwhi9ii closed your report #4142193 Worker threads bypass --permission read restrictions in Node.js v22.20.0 and v24.22.1 as Informative.
>
> Thank you for your submission. Unfortunately, we are unable to process this report because your HackerOne signal score does not meet the minimum threshold required by the Node.js project.
>
> To learn more about this requirement, please refer to our announcement: https://nodejs.org/en/blog/announcements/hackerone-signal-requirement
>
> If you believe this was applied in error or have further questions, please ONLY reach out to us via the OpenJS Foundation Slack (see: https://github.com/nodejs/node/blob/main/README.md#security-release-stewards for individual Slack Handlers to establish a private DM).

No technical reason is given anywhere in the email. No mention of the docs line ("The model does not inherit to a worker thread"), no mention of the explicit-`execArgv` variant, no mention of `permission.has('fs.read')` returning `true`, no CVE or severity judgement.

## Why Signal closed it — how the gate works

- **What Signal is:** HackerOne's reputation score for a reporter, built from past reports that were triaged / resolved. A new reporter starts with no Signal.
- **Node's rule:** the Node.js project requires a **minimum Signal score of 1.0** to file on HackerOne. Below that, the program page directs reporters to the security stewards via the OpenJS Foundation Slack instead. Announcement: https://nodejs.org/en/blog/announcements/hackerone-signal-requirement
- **New-user waiver:** new users are waived in with **3 trial reports per program**. Sam's account showed "Trial Reports Remaining: 3" before filing (Report Intent #402203 screenshot, 2026-10-24).
- **What happens to a trial slot:** a trial slot is freed only when the report is triaged, resolved, or closed as duplicate. A report closed as **Informative / Not Applicable / Spam without reaching Triaged, self-closed, or withdrawn does NOT return the slot.**
- **So for this report:** #4142193 was closed as Informative without reaching Triaged, so **one trial slot is very likely burned — probably 2 trial reports left for the Node.js program.** Running out is not a ban; it only pauses submissions to that program.
- **ID verification is separate:** Sam's HackerOne ID verification was approved the same day (emails 14:33 and 14:34 CEST, 2026-10-24). That proves identity; it does not change the Signal / trial limit.

## Timeline

| When (2026-10-24, CEST) | What happened |
|---|---|
| ~03:29 UTC / morning | Repo `0xDracarys/node-testing` created; hunt write-up staged |
| daytime | Worker-read PoC built and re-verified on a clean fixture on v22.20.0 and v24.22.1; boundary/escalation PoC verified end-to-end |
| daytime | HackerOne report drafted in `HACKERONE-REPORT.md`, Sam reviewed it |
| 14:33 / 14:34 | HackerOne ID verification approved (separate from Signal) |
| (submission) | Sam submitted report #4142193 on HackerOne |
| **15:43** | **Closed as Informative — Signal grounds only (email above)** |

## What this outcome does NOT mean

- **Not a technical rejection.** The finding was never triaged, so no maintainer said "intended behaviour", "duplicate", "not a vulnerability", or "won't fix".
- **Not a verdict on the docs argument.** The report disclosed the released-docs line itself ("The model does not inherit to a worker thread") and argued the observed half-enforced state is not what that line describes. That argument was never answered.
- **Not a CVE decision.** No CVE was assigned, and none was refused — a CVE can only come after a maintainer triages the issue.
- **Not a comment on severity.** The report suggested Medium (seat belt, not sandbox; read-side only; needs `--allow-worker`). No severity was assigned or disputed.

## What the finding still is

Unchanged from `docs/RESULTS-CORNER5.md` and `docs/RESULTS-ESCALATION.md`:

- A worker spawned by a `--permission`-restricted parent reads any file (default worker, explicit-`execArgv` re-listing all grants, and `execArgv: []` — all three variants).
- `process.permission.has('fs.read', <ungranted path>)` returns `true` inside the worker, while write and child-process scopes in the same worker correctly deny.
- The private value crosses the boundary intact into a granted folder, verified from the unrestricted parent on both v22.20.0 and v24.22.1 (`worker-boundary-poc.js`, `VERIFY … match=true` on both output paths).
- Precedent the report cited: CVE-2025-23083 (worker-adjacent permission leak, High) shows the Node team has treated worker permission inconsistencies as vulnerabilities before.

## Next step — the only route the closure gives

**Do NOT resubmit on HackerOne.** That risks a duplicate closure and burns another trial slot.

**Contact a Node.js security release steward by private DM on OpenJS Foundation Slack only.** Full pack in this repo: `SLACK-DM-DRAFT.md` (steward handles, join link, copy-paste DM text, what to attach, escalation timing).

- Join: https://slack-invite.openjsf.org
- DM one steward privately (do not post in a public channel): `juanarbol`, `Marco Ippolito`, `RafaelGSS`, `mcollina` (others listed in the draft).
- Attach in order: `HACKERONE-REPORT.md`, `lab/worker-read-poc.js`, `lab/worker-boundary-poc.js`.
- If no reply in a few business days, try one more steward. If no acknowledgement within 6 business days, or no further response within 14 days, escalate to the OpenJS Foundation CNA at `security@lists.openjsf.org`, as Node.js `SECURITY.md` directs.
- Do not send it to VulnCheck (Node has its own channel — same own-CNA logic as CPython / PSRT) and do not disclose it publicly before a fix.

## Repo status after this outcome

This repo already holds the complete hunt: all five corners, graded results, all harnesses, both PoCs, the HackerOne report as submitted, the final re-test pack (`FINAL-TEST.md`), the Slack DM pack (`SLACK-DM-DRAFT.md`), and this outcome file. The only thing that changed on 2026-10-24 after submission is the status recorded here — the evidence itself did not change.
