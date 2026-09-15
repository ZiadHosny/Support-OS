> **Fetched from jira:** [SUPPORTOS-145](https://ziadhosny007.atlassian.net/browse/SUPPORTOS-145)  
> *Fetched 2026-09-15T20:47:37.815Z. Edit the sections below as needed; the planner reads this file verbatim.*


## Source — work item (from tracker)

**Title:** (NODE-4) — Customer Management Port  
**Type:** Story  
**Status:** To Do  
**Assignee:** Ziad Hosny

### Description

Dependencies: NODE-3.

	Task: Customer CRUD, contacts, notes and attachments — Port the customer module module-for-module against the contract. Constraints: file upload and download behaviour, including content types and size limits, must match. Outcome: the first complete business module on Node.

	Task: Timeline, export and erasure — Port the interaction timeline and the data-subject export/erasure paths. Constraints: erasure must preserve ticket integrity exactly as the Django implementation does under the protected customer reference. Outcome: PDPL/GDPR behaviour parity.

STORY (NODE-5) — Ticket Management Port

Dependencies: NODE-4.

	Task: Ticket CRUD, categories and saved views — Port the ticket surface, including filtering, sorting and pagination semantics. Constraints: query-parameter names and filter behaviour come from the contract, not from preference. Outcome: the queue works on Node.

	Task: Lifecycle services — status, assignment, escalation, history 🔑 — Port each business concern as its own service, with the transition rules and the activity record they write. Constraints: a status or assignment change must never be a bare field write; every transition writes its activity row inside one transaction, exactly as the Django services do. Outcome: the ticket lifecycle keeps its audit trail.

	Task: Merge, duplicates and bulk actions — Port duplicate detection, merge, and the bulk status/priority/assignment paths. Constraints: bulk operations stay transactional and permission-checked per ticket. Outcome: agent throughput features preserved.

### Attachments

None.

---
# Story intake

Fill this template for each story you want planned. Keep it copy-paste-friendly: the planner reads **this file and the files in `attachments/`**, nothing else.

- Folder: `.squad/stories/node-js-backend-port/SUPPORTOS-145/intake.md`
- Binaries (screenshots, PDFs, exports): put them in `attachments/` next to this file and list them below.
- Do **not** rely on external links (tracker URLs, wiki, chat) — the planner cannot open them. Paste the content you want considered.

This is **not** an implementation prompt. It is the input to the plan-generation meta-prompt bundled with squad-kit (`generate-plan.md` in the installed package).

---

## Feature

- **Feature name (display):**
- **Feature slug (folder under `plans/`):** `node-js-backend-port`

## Tracker (metadata only)

- **Tracker type:** `jira`
- **Work item id:** `SUPPORTOS-145` *(used in filenames and plan tables; fill manually if empty)*
- **Work item type:** `Story`
- **Status:** `To Do`
- **Assignee:** `Ziad Hosny`
- **Labels:** ``

External tracker links are **not** followed by the planner. Keep the id for naming and traceability only.

---

## Title

*(Paste the work item title verbatim. Prefilled when `squad new-story` fetched from a tracker.)*

```
(NODE-4) — Customer Management Port
```

---

## Description

*(Paste the full work item description. Prefilled when fetched from a tracker.)*

```
Dependencies: NODE-3.

	Task: Customer CRUD, contacts, notes and attachments — Port the customer module module-for-module against the contract. Constraints: file upload and download behaviour, including content types and size limits, must match. Outcome: the first complete business module on Node.

	Task: Timeline, export and erasure — Port the interaction timeline and the data-subject export/erasure paths. Constraints: erasure must preserve ticket integrity exactly as the Django implementation does under the protected customer reference. Outcome: PDPL/GDPR behaviour parity.

STORY (NODE-5) — Ticket Management Port

Dependencies: NODE-4.

	Task: Ticket CRUD, categories and saved views — Port the ticket surface, including filtering, sorting and pagination semantics. Constraints: query-parameter names and filter behaviour come from the contract, not from preference. Outcome: the queue works on Node.

	Task: Lifecycle services — status, assignment, escalation, history 🔑 — Port each business concern as its own service, with the transition rules and the activity record they write. Constraints: a status or assignment change must never be a bare field write; every transition writes its activity row inside one transaction, exactly as the Django services do. Outcome: the ticket lifecycle keeps its audit trail.

	Task: Merge, duplicates and bulk actions — Port duplicate detection, merge, and the bulk status/priority/assignment paths. Constraints: bulk operations stay transactional and permission-checked per ticket. Outcome: agent throughput features preserved.
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
