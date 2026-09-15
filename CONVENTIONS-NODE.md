# SupportOS Node port conventions (`CONV-NODE`)

`CONV-NODE` is the Node/TypeScript counterpart of [`CONVENTIONS.md`](CONVENTIONS.md) (`CONV`),
for `EPIC 18`'s port of the Django API. It **does not restate `CONV`** — naming, wire format,
i18n, logging policy, auth model and permission vocabulary are unchanged, and are cited by
section number rather than copied. It records only what is genuinely new because the runtime is
different.

Read [`CONVENTIONS.md`](CONVENTIONS.md) first. If a rule is not here, `CONV` still governs it.

---

## 1. The port rule

**The port adds no product scope.** A NODE story that introduces a new endpoint, a new response
shape, a schema change or a frontend edit has stopped being a port — raise it as its own story in
the owning epic instead.

[`docs/api-contract.django.yaml`](docs/api-contract.django.yaml) is the acceptance spec: a frozen
snapshot of the Django API surface, generated from the live URLConf. `NODE-2`'s contract-diff
harness is what enforces it — "ported" is a measured state, not a judgement.

**Regenerating the snapshot.** Whoever changes the Django API surface regenerates it, in the same
change, with `python manage.py freeze_api_contract` from `backend/`. Never by hand: the file's own
header is written by that command, and a hand-edited snapshot is indistinguishable from a stale
one. A snapshot that drifts from Django surfaces as harness mismatches on the *Node* side, which
is the wrong place to discover it.

---

## 2. The database is introspect-only

The Prisma client is generated from the live database with `prisma db pull`. **No migration
command may ever run from the Node service.** The 91 Django migrations under
`backend/apps/*/migrations/` remain the single source of schema truth for the whole epic, across
all 43 models.

`docs/BACKEND-ARCHITECTURE.md` gates the Django side with `makemigrations --check --dry-run` — a
command, not reviewer memory. The Node side's equivalent gate is structural: **the service
contains no migration directory and no `prisma migrate` script in `package.json`.** Check for
their absence; do not rely on nobody typing the command.

This rule is lifted **only** by `NODE-12`'s retirement task, which is where schema ownership moves
to the Node service and is replaced by a stated migration strategy. Not before, and not by any
intermediate story that finds it inconvenient.

---

## 3. Module layout

The service root is **`backend-node/`**, a sibling of `backend/` and `frontend/`. This is what
`NODE-1`'s "scaffold the NestJS project beside the Django one" means concretely; `NODE-1` does not
re-decide it.

One NestJS module per business area, mirroring `backend/apps/` one-for-one — 15 modules:

`accounts` · `agents` · `ai` · `communications` · `compliance` · `core` · `customers` ·
`integrations` · `knowledge_base` · `notifications` · `organization` · `portal` · `reports` ·
`sla` · `tickets`

See [`backend/apps/README.md`](backend/apps/README.md) for the decision list that answers "where
does new code go" — it applies unchanged, because the question it answers is about business areas,
not about Django. Its one hard rule carries over: **no top-level `services/`, `controllers/` or
`utils/` package.** A business area owns its own files; that shape is what keeps one feature out
of five directories.

`core` holds the cross-cutting machinery every module depends on — the envelope interceptor, the
exception filter, pagination, the correlation-id middleware — exactly as `apps/core` does today.

---

## 4. The envelope is an interceptor, and there is exactly one

A single global interceptor produces `{success, data, error, meta}`. **No controller builds its
own response shape.** `CONV` § 11 makes this structural on the Django side — `EnvelopeJSONRenderer`
is a renderer precisely so a view author *cannot* forget it — and the Node side must keep it
structural rather than demoting it to a convention.

Three behaviours from `backend/apps/core/renderers.py` carry over exactly, and each is a live
endpoint if you get it wrong:

- **A body that is already an envelope passes through untouched.** Pagination produces one
  directly. An interceptor without this check buries `meta.pagination` inside `data` on every list
  endpoint — most of the contract's 131 paths.
- **`204` and `304` carry an empty body.** Not `{"success":true,"data":null,…}`. This is every
  delete endpoint in the contract.
- **The WhatsApp handshake is not enveloped.** Meta's webhook verification (`GET`) requires the
  `hub.challenge` value echoed back as a raw string. `PlainTextRenderer` is the Django-side
  exception; the Node interceptor needs the same narrow opt-out, or the channel silently stops
  verifying. A generic "wrap everything" rule is wrong here.

`meta.pagination` has exactly six keys, fixed by the contract: `count`, `page`, `page_size`,
`num_pages`, `next`, `previous`.

---

## 5. The exception filter and the error-code map

One global filter, one error shape. Taken from `backend/apps/core/exceptions.py`:

| Source condition | HTTP | `error.code` | `error.fields` |
|---|---|---|---|
| DTO / validation failure | 400 | `validation_error` | `{field: [message]}`; non-field errors under `non_field_errors` |
| FK-protected delete | 400 | `validation_error` | single non-field message |
| Missing, malformed, expired or revoked credentials | 401 | framework default code | `{}` |
| Authenticated, but lacking the required permission | 403 | framework default code | `{}` |
| No such resource, or one outside the caller's scope | 404 | framework default code | `{}` |
| Anything unrecognised | 500 | `internal_error` | `{}` |

A protected delete is a **400**, not a 500 — Django's `ProtectedError` is translated, not allowed
to escape. Getting this wrong turns a user-correctable message into an incident.

`error.request_id` is present whenever the failure happened inside a request; `error.debug` only
when debug mode is on. **Neither is a top-level key** — the four top-level keys (`success`,
`data`, `error`, `meta`) are always present and are the whole of the top level, so a client can
discriminate on `success` without probing.

---

## 6. DTO validation

Validation is declared on the DTO and applied by a global pipe. It is never hand-rolled in a
handler, and a handler never re-checks what the pipe already enforced.

Wire keys stay `snake_case` end to end (`CONV` § 12: "Wire format is `snake_case` end to end. Do
not camelCase it on the way in or out"). **DTO property names are therefore `snake_case` too.**
Renaming at the boundary — the reflex a TypeScript codebase invites — is exactly what would break
the frozen contract, and it would break it silently, field by field, rather than loudly.

---

## 7. Guard placement

Guards are global and **fail closed**. `CONV` § 22 holds the permission vocabulary: the same 25
permission strings, read from the same `Role.permissions` rows, with the same "vocabulary is code,
mapping is data" split. Do not introduce a second permission source, and do not add a scope list to
an API key — `CONV` § 29 explains why an API key is an identity, not a permission set.

**Every route declares its permission. An undeclared route is denied, not allowed.** This is the
rule `CONV` § 23 already enforces on the Django side through a fully-populated `permission_map`,
where an unmapped action grants rather than denies — the failure mode this inversion exists to
prevent.

Scoping (department/branch, and the portal's owner-scoping) is a **query-layer** concern, not a
handler concern. `NODE-3` builds it. What this document fixes is the bar it must clear: it must be
structurally impossible for a handler to issue an unscoped query against a scoped model. An opt-in
helper that a handler can forget to call does not meet that bar.

---

## 8. Config validation

The environment is parsed and schema-validated **once, at boot**; the process refuses to start on a
missing or malformed required variable rather than failing at the first request that needs it.

See `CONV` § 9 and `README.md` § Environment variables for the variables themselves — they are not
re-listed here. The Node service reads the **same variable names** as Django. A second naming
scheme for the same values is a drift source and a deployment trap, not a tidier namespace.

---

## 9. Logging and correlation id

The Node middleware reproduces `backend/apps/core/middleware.py`:

- Read an incoming **`X-Request-ID`**; accept it only if it matches the same bound the Django side
  applies (8–64 characters of `[A-Za-z0-9._-]`, so a client cannot inject a newline into the logs).
- Generate one when absent or rejected.
- Make it available for the whole request without a handler passing it anywhere.
- **Echo it on the response header**, always.
- Reset it when the request ends. A leaked correlation id mislabels the *next* request's logs,
  which is worse than no id, because the log then looks correct.

Two rules from `CONV` § 34 carry over as-is:

- **Log the path, never the full path with its query string.** The inbound-email webhook
  authenticates with `?token=…`, so logging full paths writes a shared secret to stdout on every
  delivery.
- **Scrub by key name, not by value.** `password`, `secret`, `token`, `api_key`, `authorization`,
  `credential`, `cookie`, `session` — matched case-insensitively as a substring of the **key**,
  recursively. A scrubber that guesses at value shapes both over- and under-redacts.

---

## 10. What this document does not cover

Named so a later reader does not mistake an omission for a decision:

| Not covered here | Owned by |
|---|---|
| Testing strategy for the Node service | Not yet decided. `CONV` § 16 governs this repo today: no new test file is added anywhere. |
| Deployment and containerization | `PROD-4` for the Django side; the Node equivalent is `NODE-12`'s cutover. |
| The internal administration surface replacing Django admin | `NODE-11`, which decides per model whether it belongs in an admin surface or in the product's own screens. |
| Realtime gateway and background-job topology | `NODE-7`. |

---

## Related documents

- [`CONVENTIONS.md`](CONVENTIONS.md) — the full `CONV` spec; everything not in this file
- [`docs/api-contract.django.yaml`](docs/api-contract.django.yaml) — the frozen port contract
- [`docs/BACKEND-ARCHITECTURE.md`](docs/BACKEND-ARCHITECTURE.md) — the Django implementation being ported, and its measured manifest
- [`backend/apps/README.md`](backend/apps/README.md) — why the module layout is this shape
- Root [`README.md`](README.md) § API conventions — the response envelope contract
