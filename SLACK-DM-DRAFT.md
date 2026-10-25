# OpenJS Slack DM draft — Node.js worker-read report (report #4142193)

## Who to contact (from nodejs/node README, "Security release stewards")

DM one steward privately. Do not post in a public channel — the finding stays embargoed.

- `juanarbol` — Juan José Arboleda
- `Marco Ippolito` — Marco Ippolito
- `RafaelGSS` — Rafael Gonzaga
- `mcollina` — Matteo Collina
- Bryan English, Beth Griggs, Stewart X Addison are also stewards but have no Slack handle listed in the README.

If the first steward does not reply in a few days, try one more. Do not message all of them at once.

## How to join

OpenJS Slack invite: https://slack-invite.openjsf.org — sign up with your own email, then search for the steward's handle above and open a direct message.

## DM text (copy-paste)

> Hi, I'm Shubham Bhasker (HackerOne: dracarysroxxx). I'm writing privately about a Node.js Permission Model issue I reported on HackerOne as report #4142193, "Worker threads bypass --permission read restrictions in Node.js v22.20.0 and v24.22.1".
>
> The report was closed as Informative the same day, not on its technical merits, but because my HackerOne Signal score does not meet the Node.js project's minimum threshold. The closure email directed me to reach out only via OpenJS Slack, so I'm contacting you here.
>
> In short: a worker thread created by a --permission-restricted process can read any file on the filesystem, even though the main thread is correctly denied the same file, and even though write and child-process scopes inside the same worker are correctly denied. The worker's own process.permission.has('fs.read', <path>) returns true for ungranted paths. The private value does not just get read — it crosses the boundary intact into a granted folder, verified end-to-end. It affects released Node.js v22.20.0 and v24.22.1 on Windows, and the mechanism is in platform-independent code.
>
> I have the full report and two proof-of-concept files ready to share privately. Would you be willing to review them, or point me to the right private channel for this?
>
> Thank you for your time,
> Shubham

## What to attach to the DM (in this order)

1. HACKERONE-REPORT.md (full report: Summary, Description, Steps, Impact, Documentation Review, References)
2. worker-read-poc.js (minimum proof)
3. worker-boundary-poc.js (escalation proof)

File locations:

- Report: ~/workspace/node-testing/HACKERONE-REPORT.md
- PoCs: ~/workspace/node-testing/lab/worker-read-poc.js and ~/workspace/node-testing/lab/worker-boundary-poc.js
- Desktop copies: C:\Users\Chintu\Desktop\CVE-HUNT\node-perm-lab\worker-read-poc.js and worker-boundary-poc.js
- Full write-up: https://github.com/0xDracarys/node-testing (docs/RESULTS-CORNER5.md, docs/RESULTS-ESCALATION.md)

## If there is no reply

- Wait a few business days, then try one other steward from the list above.
- If there is no acknowledgement within 6 business days, or no further response within 14 days, escalate to the OpenJS Foundation CNA at security@lists.openjsf.org, as Node.js SECURITY.md directs.

## What NOT to do

- Do not post the report or the PoCs in a public Slack channel.
- Do not resubmit on HackerOne (duplicate risk, and another trial report would be burned).
- Do not send it to VulnCheck or disclose it publicly before a fix.
