> **Fetched from jira:** [SUPPORTOS-146](https://ziadhosny007.atlassian.net/browse/SUPPORTOS-146)  
> *Fetched 2026-09-15T20:47:47.052Z. Edit the sections below as needed; the planner reads this file verbatim.*


## Source — work item (from tracker)

**Title:** (NODE-6) — Communications & Agent Workspace Port  
**Type:** Story  
**Status:** To Do  
**Assignee:** Ziad Hosny

### Description

Dependencies: NODE-5.

	Task: Messaging core and channel adapters — Port the message model surface and the email/SMS/WhatsApp/live-chat/web-form adapters over the existing database-stored provider configuration. Constraints: one adapter interface, as today; provider credentials are read from the database, never from code. Outcome: multi-channel parity.

	Task: Agent workspace surface — Port tasks/reminders, quick replies, internal notes and the ticket context panel endpoints. Constraints: internal notes must remain unreachable from any customer-facing route — this is the one boundary worth an explicit negative test in the harness. Outcome: the workspace runs on Node.

### Attachments

None.

---
# Story intake

Fill this template for each story you want planned. Keep it copy-paste-friendly: the planner reads **this file and the files in `attachments/`**, nothing else.

- Folder: `.squad/stories/node-js-backend-port/SUPPORTOS-146/intake.md`
- Binaries (screenshots, PDFs, exports): put them in `attachments/` next to this file and list them below.
- Do **not** rely on external links (tracker URLs, wiki, chat) — the planner cannot open them. Paste the content you want considered.

This is **not** an implementation prompt. It is the input to the plan-generation meta-prompt bundled with squad-kit (`generate-plan.md` in the installed package).

---

## Feature

- **Feature name (display):**
- **Feature slug (folder under `plans/`):** `node-js-backend-port`

## Tracker (metadata only)

- **Tracker type:** `jira`
- **Work item id:** `SUPPORTOS-146` *(used in filenames and plan tables; fill manually if empty)*
- **Work item type:** `Story`
- **Status:** `To Do`
- **Assignee:** `Ziad Hosny`
- **Labels:** ``

External tracker links are **not** followed by the planner. Keep the id for naming and traceability only.

---

## Title

*(Paste the work item title verbatim. Prefilled when `squad new-story` fetched from a tracker.)*

```
(NODE-6) — Communications & Agent Workspace Port
```

---

## Description

*(Paste the full work item description. Prefilled when fetched from a tracker.)*

```
Dependencies: NODE-5.

	Task: Messaging core and channel adapters — Port the message model surface and the email/SMS/WhatsApp/live-chat/web-form adapters over the existing database-stored provider configuration. Constraints: one adapter interface, as today; provider credentials are read from the database, never from code. Outcome: multi-channel parity.

	Task: Agent workspace surface — Port tasks/reminders, quick replies, internal notes and the ticket context panel endpoints. Constraints: internal notes must remain unreachable from any customer-facing route — this is the one boundary worth an explicit negative test in the harness. Outcome: the workspace runs on Node.
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
