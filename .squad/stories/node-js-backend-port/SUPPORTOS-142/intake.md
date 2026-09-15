> **Fetched from jira:** [SUPPORTOS-142](https://ziadhosny007.atlassian.net/browse/SUPPORTOS-142)  
> *Fetched 2026-09-15T20:43:04.952Z. Edit the sections below as needed; the planner reads this file verbatim.*


## Source — work item (from tracker)

**Title:** (NODE-1) — Node Service Foundation  
**Type:** Story  
**Status:** To Do  
**Assignee:** Ziad Hosny

### Description

Dependencies: NODE-0.

	Task: Service skeleton + config + envelope 🔑 (reused by every later module) — Scaffold the NestJS project beside the Django one, wire schema-validated environment config, the response-envelope interceptor, the exception filter, pagination, and the correlation-id middleware. Constraints: no domain feature in this story; the envelope and error shapes must match the frozen contract byte-for-byte. Outcome: an empty service that already answers in the product's own API shape.

	Task: Prisma introspection of the existing schema 🔑 — Generate the Prisma client from the live database (db pull) and commit the generated schema. Constraints: introspection only — no migration command may ever run from the Node service; the Django migrations remain the single source of schema truth for the whole epic. Outcome: typed database access over the 43 existing models without touching the schema.

	Task: Health endpoint — Port /api/health/ as the first end-to-end proof that routing, config, database access and the envelope all work together. Outcome: one verifiable live endpoint.

### Attachments

None.

---
# Story intake

Fill this template for each story you want planned. Keep it copy-paste-friendly: the planner reads **this file and the files in `attachments/`**, nothing else.

- Folder: `.squad/stories/node-js-backend-port/SUPPORTOS-142/intake.md`
- Binaries (screenshots, PDFs, exports): put them in `attachments/` next to this file and list them below.
- Do **not** rely on external links (tracker URLs, wiki, chat) — the planner cannot open them. Paste the content you want considered.

This is **not** an implementation prompt. It is the input to the plan-generation meta-prompt bundled with squad-kit (`generate-plan.md` in the installed package).

---

## Feature

- **Feature name (display):**
- **Feature slug (folder under `plans/`):** `node-js-backend-port`

## Tracker (metadata only)

- **Tracker type:** `jira`
- **Work item id:** `SUPPORTOS-142` *(used in filenames and plan tables; fill manually if empty)*
- **Work item type:** `Story`
- **Status:** `To Do`
- **Assignee:** `Ziad Hosny`
- **Labels:** ``

External tracker links are **not** followed by the planner. Keep the id for naming and traceability only.

---

## Title

*(Paste the work item title verbatim. Prefilled when `squad new-story` fetched from a tracker.)*

```
(NODE-1) — Node Service Foundation
```

---

## Description

*(Paste the full work item description. Prefilled when fetched from a tracker.)*

```
Dependencies: NODE-0.

	Task: Service skeleton + config + envelope 🔑 (reused by every later module) — Scaffold the NestJS project beside the Django one, wire schema-validated environment config, the response-envelope interceptor, the exception filter, pagination, and the correlation-id middleware. Constraints: no domain feature in this story; the envelope and error shapes must match the frozen contract byte-for-byte. Outcome: an empty service that already answers in the product's own API shape.

	Task: Prisma introspection of the existing schema 🔑 — Generate the Prisma client from the live database (db pull) and commit the generated schema. Constraints: introspection only — no migration command may ever run from the Node service; the Django migrations remain the single source of schema truth for the whole epic. Outcome: typed database access over the 43 existing models without touching the schema.

	Task: Health endpoint — Port /api/health/ as the first end-to-end proof that routing, config, database access and the envelope all work together. Outcome: one verifiable live endpoint.
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
