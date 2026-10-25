# node-testing — Node.js Permission Model hunt lab

White-box security audit of the Node.js Permission Model on Windows,
run 2026-10-24 by 0xDracarys + Iggy. Versions tested: **v22.20.0**
and **v24.22.1** (both released builds, desktop lab).

## Headline result — candidate finding (Corner 5)

A worker thread created by a `--permission`-restricted process can
**read any file on disk**, while the main process is correctly
denied and while write / child-process scopes inside the same
worker are correctly denied. Reproduced on both versions, in
default, explicit-`execArgv`, and `execArgv: []` worker variants.
Full evidence: `docs/RESULTS-CORNER5.md`. The released-docs
counter-argument ("the model does not inherit to a worker thread")
is quoted and addressed there.

## HackerOne outcome — Informative on Signal, not on merits

Submitted 2026-10-24 as HackerOne report **#4142193**. Closed the
same day at 15:43 CEST as **Informative, because the reporter's
Signal score was below the Node.js project's minimum (1.0)**. It
was never triaged on its technical merits — no maintainer judged
the finding. Full wording, timeline, trial-slot impact, and the
only next step (private DM to an OpenJS security steward on Slack):
`HACKERONE-OUTCOME.md`. DM pack: `SLACK-DM-DRAFT.md`. Do not
resubmit on HackerOne.

## Corners

| Corner | Surface | Verdict |
|---|---|---|
| 1 | fs paths × Windows shapes, symlinks/junctions | Holds, except documented symlink limitation |
| 2 | child_process × batch-file guard | Holds; guard disagreement dies at CreateProcess |
| 3 | `--allow-env` | Feature unreleased — parked until it ships |
| 4 | fs.glob | Fails closed everywhere; control denial was a path-coverage quirk (`--allow-fs-read=*` makes it work) |
| 5 | hardlinks, fs.watch, **worker threads** | Hardlink/watch hold; **worker read hole — candidate** |

## Layout

- `docs/` — attack-surface map, hunt list, source notes, corner
  plans, and the graded RESULTS file for each corner.
- `lab/` — the probe harnesses (Node scripts; a parent runs
  children under `--permission` against a fixture with an
  `allowed` folder and an ungranted `vault` folder).
- `results/` — raw JSON outputs from the runs.
- `COPY-PASTE-TESTS.md` — CMD commands to rerun the key checks
  by hand, including the worker-read check.
- `HACKERONE-REPORT.md` — the report as submitted (#4142193).
- `HACKERONE-OUTCOME.md` — why it closed Informative (Signal).
- `SLACK-DM-DRAFT.md` — OpenJS Slack DM pack, the next step.
- `FINAL-TEST.md` — the exact 4-command final re-test pack.

## Note

One Corner 2 probe file (the batch-file guard family harness) is
not in this repo: the delivery layer kept blocking its content
even here. Its design, commands, and graded results live in
`docs/RESULTS-CORNER2.md`, and the family was fully tested from a
separate test-guide document and closed. Nothing about the hunt
depends on the missing file.
