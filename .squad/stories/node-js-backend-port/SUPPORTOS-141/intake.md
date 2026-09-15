> **Fetched from jira:** [SUPPORTOS-141](https://ziadhosny007.atlassian.net/browse/SUPPORTOS-141)  
> *Fetched 2026-09-15T20:43:49.381Z. Edit the sections below as needed; the planner reads this file verbatim.*


## Source — work item (from tracker)

**Title:** (NODE-0) — Port Contract & Node Conventions  
**Type:** Story  
**Status:** To Do  
**Assignee:** Ziad Hosny

### Description

Task: Freeze the Django API contract 🔑 (consumed by every NODE story) — Generate the OpenAPI document from the live Django URLConf and commit it as a frozen reference snapshot (docs/api-contract.django.yaml), stating in the file header that it is a port contract, not the live schema. Constraints: this is a deliberate, documented exception to the "schema is generated, never committed" rule — the snapshot must be regenerated only when the Django reference itself changes. Outcome: an executable definition of what the Node service must answer.

	Task: Node conventions spec 🔑 (CONV-NODE, reused by every NODE story) — Write the Node counterpart of CONV: module layout, the single envelope interceptor, the exception filter and error-code mapping, DTO validation, guard placement, config validation, logging and correlation-id propagation. Constraints: one page, reference-based, no restating of CONV; must state the introspect-only database rule and the "no controller builds its own response shape" rule explicitly. Outcome: the architecture is decided before any feature code exists.

### Attachments

None.

---
# Story intake

Fill this template for each story you want planned. Keep it copy-paste-friendly: the planner reads **this file and the files in `attachments/`**, nothing else.

- Folder: `.squad/stories/node-js-backend-port/SUPPORTOS-141/intake.md`
- Binaries (screenshots, PDFs, exports): put them in `attachments/` next to this file and list them below.
- Do **not** rely on external links (tracker URLs, wiki, chat) — the planner cannot open them. Paste the content you want considered.

This is **not** an implementation prompt. It is the input to the plan-generation meta-prompt bundled with squad-kit (`generate-plan.md` in the installed package).

---

## Feature

- **Feature name (display):**
- **Feature slug (folder under `plans/`):** `node-js-backend-port`

## Tracker (metadata only)

- **Tracker type:** `jira`
- **Work item id:** `SUPPORTOS-141` *(used in filenames and plan tables; fill manually if empty)*
- **Work item type:** `Story`
- **Status:** `To Do`
- **Assignee:** `Ziad Hosny`
- **Labels:** ``

External tracker links are **not** followed by the planner. Keep the id for naming and traceability only.

---

## Title

*(Paste the work item title verbatim. Prefilled when `squad new-story` fetched from a tracker.)*

```
(NODE-0) — Port Contract & Node Conventions
```

---

## Description

*(Paste the full work item description. Prefilled when fetched from a tracker.)*

```
Task: Freeze the Django API contract 🔑 (consumed by every NODE story) — Generate the OpenAPI document from the live Django URLConf and commit it as a frozen reference snapshot (docs/api-contract.django.yaml), stating in the file header that it is a port contract, not the live schema. Constraints: this is a deliberate, documented exception to the "schema is generated, never committed" rule — the snapshot must be regenerated only when the Django reference itself changes. Outcome: an executable definition of what the Node service must answer.

	Task: Node conventions spec 🔑 (CONV-NODE, reused by every NODE story) — Write the Node counterpart of CONV: module layout, the single envelope interceptor, the exception filter and error-code mapping, DTO validation, guard placement, config validation, logging and correlation-id propagation. Constraints: one page, reference-based, no restating of CONV; must state the introspect-only database rule and the "no controller builds its own response shape" rule explicitly. Outcome: the architecture is decided before any feature code exists.
```

---

## Acceptance criteria

*(Checklist, bullets, Gherkin, etc. Prefilled for Azure DevOps when the work item has acceptance criteria.)*

```

```

---

## Attachments

Place files in `attachments/` next to this `intake.md`, then list them here so the planner knows what to open.

| File (relative to this folder) | What it is |
| ------------------------------ | ---------- |
| *(e.g. `attachments/flow.png`)* | *(e.g. UX flow)* |

*(Add rows per file. If none, write "None.")*

---

## Dependencies

- **Blocked by / related ids:** (tracker ids only; optional short note)
- **Depends on code areas or other stories:**

## Extra notes (optional)

- Anything not captured above (e.g. chat context) — keep short.

## Technical hints (optional)

- APIs, screens, services already discussed. Repos/roots: `.`. Primary language: `typescript`.

## Out of scope

- What this story explicitly does **not** cover:
