> **Fetched from jira:** [SUPPORTOS-144](https://ziadhosny007.atlassian.net/browse/SUPPORTOS-144)  
> *Fetched 2026-09-15T20:43:23.153Z. Edit the sections below as needed; the planner reads this file verbatim.*


## Source — work item (from tracker)

**Title:** (NODE-3) — Authentication, Permissions & Scoping  
**Type:** Story  
**Status:** To Do  
**Assignee:** Ziad Hosny

### Description

Dependencies: NODE-1, NODE-2.

	Task: JWT issuance, refresh and logout — Port the token endpoints and the me endpoint, matching the existing token lifetimes, claims and error codes. Constraints: existing tokens and the frontend's silent-refresh interceptor must keep working unchanged. Outcome: sign-in parity.

	Task: Django password-hash verification 🔑 — Implement a verifier for the stored pbkdf2_sha256$iterations$salt$hash format, plus rehash-on-login if the hashing strategy later changes. Constraints: every existing account must sign in with its current password — a forced password reset is not an acceptable outcome. Outcome: no credential migration.

	Task: Permission guard over the existing catalogue 🔑 — Enforce the same permission strings, read from the same Role.permissions rows, as a framework-level guard. Constraints: the permission catalogue endpoint must return exactly what the frontend gates already expect; a route without a declared permission must fail closed. Outcome: authorization parity, verified by the denials as much as by the grants.

	Task: Scope enforcement layer 🔑 — Reimplement department/branch scoping as a query layer that cannot be bypassed. Constraints: it must be structurally impossible for a handler to issue an unscoped query for a scoped model — an opt-in helper is not sufficient. Outcome: the visibility boundary survives the port.

	Task: Rate limiting and MFA — Port login throttling and the TOTP/recovery-code challenge. Outcome: the hardening from SEC-9 and PROD-3 is not silently dropped.

### Attachments

None.

---
# Story intake

Fill this template for each story you want planned. Keep it copy-paste-friendly: the planner reads **this file and the files in `attachments/`**, nothing else.

- Folder: `.squad/stories/node-js-backend-port/SUPPORTOS-144/intake.md`
- Binaries (screenshots, PDFs, exports): put them in `attachments/` next to this file and list them below.
- Do **not** rely on external links (tracker URLs, wiki, chat) — the planner cannot open them. Paste the content you want considered.

This is **not** an implementation prompt. It is the input to the plan-generation meta-prompt bundled with squad-kit (`generate-plan.md` in the installed package).

---

## Feature

- **Feature name (display):**
- **Feature slug (folder under `plans/`):** `node-js-backend-port`

## Tracker (metadata only)

- **Tracker type:** `jira`
- **Work item id:** `SUPPORTOS-144` *(used in filenames and plan tables; fill manually if empty)*
- **Work item type:** `Story`
- **Status:** `To Do`
- **Assignee:** `Ziad Hosny`
- **Labels:** ``

External tracker links are **not** followed by the planner. Keep the id for naming and traceability only.

---

## Title

*(Paste the work item title verbatim. Prefilled when `squad new-story` fetched from a tracker.)*

```
(NODE-3) — Authentication, Permissions & Scoping
```

---

## Description

*(Paste the full work item description. Prefilled when fetched from a tracker.)*

```
Dependencies: NODE-1, NODE-2.

	Task: JWT issuance, refresh and logout — Port the token endpoints and the me endpoint, matching the existing token lifetimes, claims and error codes. Constraints: existing tokens and the frontend's silent-refresh interceptor must keep working unchanged. Outcome: sign-in parity.

	Task: Django password-hash verification 🔑 — Implement a verifier for the stored pbkdf2_sha256$iterations$salt$hash format, plus rehash-on-login if the hashing strategy later changes. Constraints: every existing account must sign in with its current password — a forced password reset is not an acceptable outcome. Outcome: no credential migration.

	Task: Permission guard over the existing catalogue 🔑 — Enforce the same permission strings, read from the same Role.permissions rows, as a framework-level guard. Constraints: the permission catalogue endpoint must return exactly what the frontend gates already expect; a route without a declared permission must fail closed. Outcome: authorization parity, verified by the denials as much as by the grants.

	Task: Scope enforcement layer 🔑 — Reimplement department/branch scoping as a query layer that cannot be bypassed. Constraints: it must be structurally impossible for a handler to issue an unscoped query for a scoped model — an opt-in helper is not sufficient. Outcome: the visibility boundary survives the port.

	Task: Rate limiting and MFA — Port login throttling and the TOTP/recovery-code challenge. Outcome: the hardening from SEC-9 and PROD-3 is not silently dropped.
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
