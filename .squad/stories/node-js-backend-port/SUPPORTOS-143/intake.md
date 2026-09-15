> **Fetched from jira:** [SUPPORTOS-143](https://ziadhosny007.atlassian.net/browse/SUPPORTOS-143)  
> *Fetched 2026-09-15T20:43:15.170Z. Edit the sections below as needed; the planner reads this file verbatim.*


## Source — work item (from tracker)

**Title:** (NODE-2) — Contract-Diff Harness  
**Type:** Story  
**Status:** To Do  
**Assignee:** Ziad Hosny

### Description

Dependencies: NODE-0, NODE-1.

	Task: Dual-target response diff 🔑 (the acceptance gate for every later NODE story) — Build a harness that reads the frozen contract, issues the same request to the Django and Node services against the same seeded database, and reports per-path differences in status code, envelope shape, error code and payload structure. Constraints: compare shape and semantics, not generated identifiers or timestamps — a create call produces a different row on each side; the harness must be runnable as one command and must exit non-zero on any mismatch. Outcome: "ported" becomes a measurable state instead of a judgement.

	Task: Coverage report — Emit a per-module progress summary (paths matching / mismatching / not yet implemented) against the 131-path contract. Outcome: the port's real completion percentage is always visible.

### Attachments

None.

---
# Story intake

Fill this template for each story you want planned. Keep it copy-paste-friendly: the planner reads **this file and the files in `attachments/`**, nothing else.

- Folder: `.squad/stories/node-js-backend-port/SUPPORTOS-143/intake.md`
- Binaries (screenshots, PDFs, exports): put them in `attachments/` next to this file and list them below.
- Do **not** rely on external links (tracker URLs, wiki, chat) — the planner cannot open them. Paste the content you want considered.

This is **not** an implementation prompt. It is the input to the plan-generation meta-prompt bundled with squad-kit (`generate-plan.md` in the installed package).

---

## Feature

- **Feature name (display):**
- **Feature slug (folder under `plans/`):** `node-js-backend-port`

## Tracker (metadata only)

- **Tracker type:** `jira`
- **Work item id:** `SUPPORTOS-143` *(used in filenames and plan tables; fill manually if empty)*
- **Work item type:** `Story`
- **Status:** `To Do`
- **Assignee:** `Ziad Hosny`
- **Labels:** ``

External tracker links are **not** followed by the planner. Keep the id for naming and traceability only.

---

## Title

*(Paste the work item title verbatim. Prefilled when `squad new-story` fetched from a tracker.)*

```
(NODE-2) — Contract-Diff Harness
```

---

## Description

*(Paste the full work item description. Prefilled when fetched from a tracker.)*

```
Dependencies: NODE-0, NODE-1.

	Task: Dual-target response diff 🔑 (the acceptance gate for every later NODE story) — Build a harness that reads the frozen contract, issues the same request to the Django and Node services against the same seeded database, and reports per-path differences in status code, envelope shape, error code and payload structure. Constraints: compare shape and semantics, not generated identifiers or timestamps — a create call produces a different row on each side; the harness must be runnable as one command and must exit non-zero on any mismatch. Outcome: "ported" becomes a measurable state instead of a judgement.

	Task: Coverage report — Emit a per-module progress summary (paths matching / mismatching / not yet implemented) against the 131-path contract. Outcome: the port's real completion percentage is always visible.
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
