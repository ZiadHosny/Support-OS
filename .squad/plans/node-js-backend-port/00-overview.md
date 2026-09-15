# node-js-backend-port — plan overview

Entry point for the **node-js-backend-port** feature. Stories execute in order by their `NN` prefix.

This feature is `EPIC 18 — Node.js Backend Port` (`SupportOs backlog.MD:1131-1258`): replace the Django API with a Node/TypeScript one **behind an unchanged contract**. Two things stay fixed for the whole epic — the existing PostgreSQL schema (introspected, never re-generated) and the API surface (the same paths, the same `{success, data, error, meta}` envelope). Because the contract does not move, the React client is not touched and both backends can serve the same database while endpoints move over one module at a time.

**The epic's own rule (`SupportOs backlog.MD:1258`):** the port adds no product scope. A NODE story that introduces a new endpoint, a new response shape, a schema change or a frontend edit has stopped being a port — raise it as its own story in the owning epic instead.

## Stories

| NN | File | Title | Tracker id | Depends on |
|----|------|-------|------------|------------|
| 116 | [116-story-port-contract-node-conventions-SUPPORTOS-141.md](116-story-port-contract-node-conventions-SUPPORTOS-141.md) | (NODE-0) Port Contract & Node Conventions | SUPPORTOS-141 | All prior epics (the Django API is the thing being frozen); Story 80 (`INT-1`, `../integrations/`) and Story 104 (`../bugs/104-story-openapi-schema-completeness.md`), both implemented |

## Dependency notes

**Story 116 is the epic's foundation and blocks every later NODE story.** Its two artefacts — the frozen contract `docs/api-contract.django.yaml` and the `CONV-NODE` spec (`CONVENTIONS-NODE.md`) — are what `SupportOs backlog.MD:1252` means by "the contract is the acceptance spec for every NODE story". Nothing in `NODE-1` onward can be verified without them.

**The tracker-id mapping is confirmed.** Story 116 was *planned* against an unfilled intake — the Jira auto-fetch had been skipped for missing credentials, so Title, Description and Acceptance criteria were all empty — and was therefore built from `SupportOs backlog.MD:1131-1140` directly, with `SUPPORTOS-141 = NODE-0` inferred from the id-gap pattern at every earlier epic boundary. Commit `30ea5a4` then filled the intake in and added `SUPPORTOS-142`–`146`: `SUPPORTOS-141`'s title is `(NODE-0) — Port Contract & Node Conventions` and its Description is the backlog's two tasks **word for word**, and `SUPPORTOS-142` is `(NODE-1)`. The inference was right and the plan needed no re-scoping. This is the same class of intake defect `../design-intelligence-ui-ux-system/` Story 112 worked around, and it resolved the same way.

**Story 116 (`NODE-0`) is implemented.** `docs/api-contract.django.yaml` is committed — **131 paths**, matching `docs/BACKEND-ARCHITECTURE.md`'s measured manifest exactly — written by the new `backend/apps/core/management/commands/freeze_api_contract.py` and reproducible byte-for-byte (regenerate to a scratch file, `git diff --no-index` is empty). `python manage.py spectacular` still emits **zero bytes on stderr**, so Story 104's zero-W001/W002 result holds and the frozen contract is a snapshot of a complete surface. `CONVENTIONS-NODE.md` (`CONV-NODE`) is written and linked from `README.md`, `CONVENTIONS.md` § 40 and `docs/BACKEND-ARCHITECTURE.md`. `manage.py check` → 0 issues; all **54** existing tests pass; Ruff lint and format clean.

Two deviations from the plan as written, both deliberate:

- **No new test file was added.** The plan's Test Plan asked for `backend/apps/core/tests/test_freeze_api_contract.py`. `CONVENTIONS.md` § 16 is categorical — *"no new test file is added anywhere in the repo"* — and the three cases it proposed are each covered by a Verification Step that was actually run (header present, output still parses as YAML with `openapi`/`paths` at the top level, default path resolves to `docs/`). The convention won; the plan's own Prerequisites demand respecting existing conventions.
- **`.gitattributes` was added** (one entry, `docs/api-contract.django.yaml text eol=lf`). This repository is cloned with `core.autocrlf=true`, which would check the contract out with CRLF while `freeze_api_contract` writes LF — making the "regenerates byte-identically" Done Criterion fail for the next developer and silently destroying the hand-edit check. The plan did not anticipate it; without it, one of its own acceptance criteria is unmeetable off this machine.

**`django-baseline` is tagged locally** at `30ea5a4`, the commit preceding this story's work. **It has not been pushed** — the plan requires confirmation first, and `git ls-remote --tags origin` shows the remote has no tags at all.

**Remaining stories in this epic, not yet planned** (`SupportOs backlog.MD:1142-1237`), in their backlog dependency order. Intakes now exist for NODE-1 through NODE-4 and NODE-6:

| Backlog story | Title | Tracker id | Depends on |
|---|---|---|---|
| NODE-1 | Node Service Foundation | SUPPORTOS-142 | NODE-0 |
| NODE-2 | Contract-Diff Harness | SUPPORTOS-143 | NODE-0, NODE-1 |
| NODE-3 | Authentication, Permissions & Scoping | SUPPORTOS-144 | NODE-1, NODE-2 |
| NODE-4 | Customer Management Port | SUPPORTOS-145 | NODE-3 |
| NODE-5 | Ticket Management Port | *(no intake yet)* | NODE-4 |
| NODE-6 | Communications & Agent Workspace Port | SUPPORTOS-146 | NODE-5 |
| NODE-7 | SLA, Background Jobs & Realtime | *(no intake yet)* | NODE-5 |
| NODE-8 | Reports Port | *(no intake yet)* | NODE-5, NODE-7 |
| NODE-9 | Portal & Knowledge Base Port | *(no intake yet)* | NODE-3, NODE-5 |
| NODE-10 | Integrations & AI Port | *(no intake yet)* | NODE-5, NODE-9 |
| NODE-11 | Admin Surface Replacement | *(no intake yet)* | NODE-4, NODE-5 |
| NODE-12 | Cutover & Django Retirement | *(no intake yet)* | all prior NODE stories |

**`NODE-5` has no intake although `NODE-6` does** — `SUPPORTOS-146` skips it. Ticket Management Port is `NODE-6`'s declared dependency, so that gap needs filling before `NODE-6` can be planned.

`NODE-12` is also where the introspect-only database rule that `NODE-0` writes into `CONV-NODE` is lifted — schema ownership moves to the Node service in that task and **not before**.
