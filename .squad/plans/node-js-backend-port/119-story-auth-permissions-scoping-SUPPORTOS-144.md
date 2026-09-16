# Story 119 — (NODE-3) Authentication, Permissions & Scoping (Story: SUPPORTOS-144)

## Prerequisites

- **Stories 116, 117 and 118 implemented** — `NODE-0`'s frozen contract and `CONV-NODE`, `NODE-1`'s service (config, envelope interceptor, exception filter, pagination, correlation id, Prisma), and `NODE-2`'s contract-diff harness. This story is the first to move `implemented.json` off `[]`.
- **This is the largest story in the epic.** Five tasks, three of them 🔑, and every later NODE story depends on all five. Suggested execution order, because each step is verifiable on its own: (1) password verification, (2) JWT issuance/refresh/logout + `me`, (3) the permission guard, (4) the owner-scope layer, (5) throttling + MFA. Do not start (3) before (2) passes the harness.
- **13 contract operations are in scope** — the 12 `auth`-tagged operations plus `permissions_retrieve`. Nothing else. Verified against the contract:
  `auth_token_create`, `auth_token_refresh_create`, `auth_token_verify_mfa_create`, `auth_logout_create`, `auth_me_retrieve`, `auth_change_password_create`, `auth_invite_confirm_create`, `auth_password_reset_request_create`, `auth_password_reset_confirm_create`, `auth_2fa_enroll_create`, `auth_2fa_confirm_create`, `auth_2fa_disable_create`, `permissions_retrieve`.
- **The database is shared and already holds every credential.** No migration, no re-hash, no credential export. `accounts_user`, `accounts_role`, `accounts_twofactorrecoverycode`, `token_blacklist_outstandingtoken` and `token_blacklist_blacklistedtoken` are all already in `backend-node/prisma/schema.prisma` from `NODE-1`'s introspection (verified — lines 39, 57, 71, 1029, 1037).
- **No change to `backend/` or `frontend/` source.** The frontend is the acceptance test for this story and must keep working untouched.

---

## Story Goal

Give the Node service the identity, authorization and visibility rules the Django one already enforces — with no credential migration and no frontend change.

1. **Sign-in parity.** The 13 operations above answer as Django does, including token lifetimes, claims and **error codes**.
2. **No credential migration.** Every existing account signs in with its current password, verified against the stored `pbkdf2_sha256$…` hash.
3. **Authorization parity, proven by the denials.** The same 25 permission strings, read from the same `Role.permissions` rows, enforced by a framework-level guard.
4. **The visibility boundary survives.** Portal owner-scoping is structurally un-bypassable; department/branch filtering keeps being the opt-in convenience it already is (read task 4 before assuming otherwise).
5. **The hardening is not silently dropped.** Login throttling and the TOTP/recovery-code challenge come across.

**Not in scope:** any domain module (`NODE-4` onward), the Django admin replacement (`NODE-11`), and API-key authentication (`NODE-10` ports `ApiKeyAuthentication`). The guard must leave a seam for the API-key identity, not implement it.

---

## Context — Read These Files First

1. `backend/apps/core/permissions.py` (152 lines, **whole file**) — `Permissions` (25 constants), `ALL_PERMISSIONS`, `permissions_for()`, and `HasPermission`. Three behaviours to port exactly, each of which is load-bearing:
   - **The superuser short-circuit** (`permissions_for`, lines 62–74): `is_superuser` returns **all 25**, bypassing `role` entirely.
   - **Grant on omission** (lines 80–97): an action with no `permission_map` entry is **authenticated-only, not denied** — read task 3 before "fixing" this.
   - **`has_object_permission`** (lines 99–130): a no-op unless the view declares `customer_field` *and* the caller has a `customer_profile`. The comment records a live false-403 this shape was introduced to fix.
2. `CONVENTIONS.md` **§ 33** (lines 2629–2700) — **read the table at the top before task 4.** It states, as project law, that there are two scoping primitives answering different questions: `CustomerScopedModelViewSet` scopes by *who is calling* and is **"a security boundary"** the caller cannot opt out of; `apps.core.scoping` scopes by *what the caller asked for* and is opt-in. Verbatim: *"Never reach for the second where the first is meant. A `?department=` filter is a convenience; **it authorizes nothing**."*
3. `backend/apps/core/scoping.py` (108 lines, whole file) — `ScopeFilter`, `apply_scope_filters`, `ScopedQuerysetMixin`. The param contract: absent/empty → **no filter at all**; numeric → `filter(field_id=…)`; the literal `"none"` → `filter(field__isnull=True)`; anything else → **400, never a silent no-op**. Only `list` is scoped.
4. `backend/apps/core/views.py` **lines 14–60** — `BaseModelViewSet` (`permission_classes = [IsAuthenticated, HasPermission]`) and `CustomerScopedModelViewSet` (`customer_field = "customer"`). **This second class is the un-bypassable layer task 4 is really about.** `CONVENTIONS.md` § 26 (lines 2209–2292) is its full specification.
5. `backend/apps/accounts/throttled_token_views.py` (68 lines, whole file) — `MfaAwareTokenObtainPairSerializer`. Note the deliberate grandparent call (`TokenObtainSerializer.validate`, not `super()`) so a 2FA account is authenticated **without** being issued a token pair, and the copied non-2FA tail that avoids re-checking the password.
6. `backend/apps/accounts/views.py` — `LogoutView` (**no `Authorization` header**; the refresh token in the body *is* the credential; already-blacklisted is still a 200, idempotent by design), `MeView`, and `MfaVerifyView` (`authentication_classes = []`, throttled, mints the pair only after the second factor).
7. `backend/apps/accounts/tokens.py` (93 lines, whole file) — `signing.dumps`/`loads` with three salts and three max-ages: `INVITE_SALT` (3 days), `RESET_SALT` (1 hour, payload `[user_id, password_fingerprint(user)]`), `MFA_CHALLENGE_SALT` (**5 minutes**, bare user id). `password_fingerprint` is `sha256(user.password)[:16]` — the mechanism that makes a reset token single-use with no stored "used" flag.
8. `backend/apps/accounts/mfa.py` (88 lines, whole file) — Fernet-encrypted TOTP secret (the one credential in the codebase that must be decrypted again), `pyotp` with **`valid_window=1`**, and recovery codes as **plain sha256 + constant-time compare** (deliberately not a KDF — 40 bits of `secrets.token_hex` has no low-entropy guess space).
9. `backend/apps/core/throttling.py` (103 lines, whole file) — `_FailOpenMixin`. **A cache outage must allow the request and log at WARNING**, never 500. The module docstring explains why this is the opposite posture from a permission check.
10. `backend/config/settings/base.py` **lines 202–213** (`SIMPLE_JWT`: `ROTATE_REFRESH_TOKENS=True`, `BLACKLIST_AFTER_ROTATION=True`, `UPDATE_LAST_LOGIN=True`) and **lines 361–385** (`DEFAULT_THROTTLE_RATES`). Note `auth_credentials` is **`10/minute`, shared across all five credential endpoints** — the budgets are explicitly *not* independent.
11. `frontend/src/shared/lib/api/client.ts` **lines 80–115** — the silent-refresh interceptor. **It fires only on `response.status === 401 && error.code === 'token_not_valid'`.** This one string is the contract between the two services and the browser; see the first Edge Case.
12. `backend/apps/accounts/models.py` **lines 41–72** (`Role`: `slug`, `permissions` JSON, `requires_two_factor`, `is_system`) and **lines 97–140** (`User`: email-as-identifier, `role` FK `PROTECT`, `department`/`branch`, `is_active`, `is_staff`).
13. `backend-node/scripts/contract-diff/implemented.json` and `fixtures.json` — both `[]`/`{}` today. `CONVENTIONS-NODE.md` § 1 makes updating them part of this change, not a follow-up.
14. `backend-node/src/core/filters/error-codes.ts` — `STATUS_TO_CODE` maps 401 → `not_authenticated`. Task 2 must add the second 401 code (`token_not_valid`) without disturbing the first.

---

## Product rules (from story)

Three places where the backlog's wording and the shipped code disagree. In every case **the shipped behaviour wins** — this is a port, and `SupportOs backlog.MD:1258` says a NODE story that changes behaviour has stopped being a port.

| Backlog says | The code actually does | Resolution |
|---|---|---|
| "a route without a declared permission must **fail closed**" | `HasPermission` **grants** on omission — an action with no `permission_map` entry is authenticated-only. The class docstring argues the case at length: *"a missing entry is far more often an unfinished map than an intent to forbid, and a silent 403 on a working endpoint is the harder bug to find."* | Port the **runtime behaviour unchanged** (grant on omission), and satisfy the constraint **at declaration time** instead — a startup check that fails the process when a route carries no explicit permission decision. See task 3. |
| "Reimplement **department/branch** scoping as a query layer that cannot be bypassed" | `apps.core.scoping` is opt-in by design and `CONVENTIONS.md` § 33 says it **"authorizes nothing"**. An absent `?department=` means *no filter* — that is the required behaviour, not a bug. | Build the un-bypassable layer for **portal owner-scoping** (`CustomerScopedModelViewSet`), which is the real security boundary and the one `NODE-9` explicitly depends on. Port department/branch as the opt-in filter it is. See task 4. |
| "matching the existing token lifetimes, claims and error codes" | The `user_id` claim is the **string** `"150"`, not the integer `150`. | Emit a string. See task 2. |

---

## Implementation tasks

### 1 — Django password verification (🔑)

**Create file: `backend-node/src/accounts/password/django-hasher.ts`**

The stored format, read from a live row this session:

```
pbkdf2_sha256$1000000$d17LRk0TM3gfUCD5wTY0HQ$GZHI5CbRhR4pwjj7Sn//yF4KvzJOpmA+mOs2ULmGpCI=
└─ algorithm ┘└ iters ┘└─────── salt ───────┘└──────────── base64(hash) ────────────────┘
```

**The algorithm is verified, not inferred.** Run against that exact row this session, the following reproduces the stored hash **byte for byte**, and fails for a wrong password:

```ts
const [algorithm, iterations, salt, expected] = stored.split('$');
// salt is used as a RAW ASCII string — it is NOT base64-decoded first.
// dklen = 32 (sha256 digest size, which is what Django's dklen=0 default resolves to).
crypto.pbkdf2(password, salt, Number(iterations), 32, 'sha256')  // → base64 === expected
```

- **Use the async `crypto.pbkdf2`, never `pbkdf2Sync`.** Measured this session: **~180 ms per verification at 1,000,000 iterations** (Django 5.2's default, and the value actually stored). `pbkdf2Sync` would block the event loop for that whole time, serialising the entire service behind one login. The async form runs on the libuv threadpool, whose **default size is 4** — so at most four logins verify concurrently. Note that in `backend-node/README.md`; do not raise `UV_THREADPOOL_SIZE` in this story.
- **Compare with `crypto.timingSafeEqual`** over the decoded buffers, not `===`.
- **Reject any algorithm prefix other than `pbkdf2_sha256`** with a clear error rather than a silent `false`. `PASSWORD_HASHERS` also lists PBKDF2SHA1, Argon2, BCryptSHA256 and Scrypt as *fallbacks* (verified in settings); no stored hash uses them today, and a wrong-but-silent `false` would read as "bad password" forever.
- **An unusable password** — Django writes `!` followed by random characters for a pending invite (`SEC-5`) — must never verify. Any stored value not matching `algorithm$iterations$salt$hash` returns `false`.

**Rehash on login.** After a successful verification, if the stored `iterations` differs from the service's configured default, re-encode the password with the current parameters and write it back — the same thing Django's `check_password` does via `setter`. This is the backlog's "rehash-on-login if the hashing strategy later changes"; with both services on 1,000,000 iterations it is a no-op today, which is exactly why it must be written now rather than discovered later.

**Encoding** (needed for rehash, `change-password`, `invite/confirm` and `password-reset/confirm`): generate a fresh salt the way Django does — **22 characters** from its alphanumeric alphabet — and emit `pbkdf2_sha256$<iterations>$<salt>$<base64>`. A password set by the Node service must be verifiable by Django, which is the only test that matters here (Verification Step 4).

---

### 2 — JWT issuance, refresh, logout, and `me`

**Create files under `backend-node/src/accounts/`**: `jwt.service.ts`, `auth.controller.ts`, `jwt.guard.ts`, `accounts.module.ts`.

**Claims — reproduce exactly.** Read from a live token this session:

```json
{"token_type":"access","exp":1789510617,"iat":1789509717,"jti":"260fb32cdda04c6bbdd8d684d8adcf01","user_id":"150"}
```

HS256, signed with `JWT_SIGNING_KEY` (falling back to `DJANGO_SECRET_KEY`, as `base.py` already does). No `aud`, no `iss`. `jti` is 32 hex characters. **`user_id` is a string.** Lifetimes come from the same env vars (`JWT_ACCESS_TOKEN_LIFETIME_MINUTES`, default 15; `JWT_REFRESH_TOKEN_LIFETIME_DAYS`, default 7) — add them to `env.schema.ts`.

**A token issued by either service must be accepted by the other.** That is the single acceptance test for this task, and it is what "existing tokens must keep working" means concretely (Verification Step 5).

**Refresh rotates and blacklists.** `ROTATE_REFRESH_TOKENS` and `BLACKLIST_AFTER_ROTATION` are both on, so `POST /api/auth/token/refresh/` must: validate the incoming refresh token, write its `jti` to `token_blacklist_blacklistedtoken` (via the `token_blacklist_outstandingtoken` row keyed on `jti`), issue a **new pair**, and record the new refresh token as outstanding. Both tables are already in the Prisma schema. A refresh token replayed after rotation must fail — with `token_not_valid`.

**`UPDATE_LAST_LOGIN` is on**: set `accounts_user.last_login` on successful token issue and on successful MFA verification, matching `MfaVerifyView`.

#### The two 401 codes, and why this is the highest-stakes detail in the story

Probed live this session against Django:

| Request | Status | `error.code` |
|---|---|---|
| No `Authorization` header | 401 | **`not_authenticated`** |
| Present but malformed / expired / bad signature | 401 | **`token_not_valid`** |

The frontend's interceptor (`client.ts:96-98`) retries **only** on `token_not_valid`. Get this wrong in either direction and the failure is silent and severe:

- Returning `not_authenticated` for an expired token → **the silent refresh never fires, and every user is hard-logged-out every 15 minutes.**
- Returning `token_not_valid` for a missing token → the browser attempts a pointless refresh on every anonymous request.

Add `token_not_valid` to `error-codes.ts` as a second 401 code. The status-code table cannot express two codes for one status, so the JWT guard must throw an exception carrying an explicit `code` — the extension seam `NODE-1`'s filter already built (`resolveHttpException` reads `record.code` preferentially).

**`me`** returns exactly this shape (probed live):

```json
{"id":150,"email":"…","first_name":"…","last_name":"…","is_staff":true,
 "role":{"slug":"super_admin","name":"Super Admin"},
 "department":null,"branch":{"id":6,"name":"Cairo HQ"},
 "permissions":[…sorted…],"mfa_enabled":false,"mfa_required":false}
```

`permissions` is the sorted output of the same `permissions_for` logic as task 3. `mfa_required` derives from the user's `Role.requires_two_factor` (all four seeded roles have it `false` today).

**`logout`** takes **no `Authorization` header** — the refresh token in the body is the credential, so a client whose access token already expired can still revoke. An already-blacklisted, expired or malformed token still returns **200**: idempotent by design.

---

### 3 — The permission guard (🔑)

**Create files: `backend-node/src/core/auth/permissions.ts`, `permission.guard.ts`, `require-permission.decorator.ts`.**

**Port the vocabulary, not a copy of the data.** The 25 strings live in code (`permissions.ts`); the role→permission mapping stays in `accounts_role.permissions`, read through Prisma. `CONV` § 22's "the vocabulary is code, the mapping is data" split is unchanged.

`permissionsFor(user)` reproduces `permissions_for` exactly, including **the superuser short-circuit**: `is_superuser` → all 25, without reading `role`. This is live behaviour, not theoretical — `ziad@email.com` is a real superuser in this database, and skipping the short-circuit silently strips that account's access to everything.

**Register the guard globally** (`APP_GUARD`), alongside `NODE-1`'s `AcceptNegotiationGuard`. Per-route permissions are declared with a decorator (`@RequirePermission(Permissions.CUSTOMERS_VIEW)`) that the guard reads via `Reflector`.

**Runtime semantics: grant on omission** — a route with no declared permission is authenticated-only, matching `HasPermission`. Do **not** invert this (see Product rules).

**The fail-closed guarantee, relocated.** The backlog's constraint is real; it is just aimed at the wrong layer. Satisfy it **at startup**: enumerate every registered route and fail the boot with a named list if any route carries neither `@RequirePermission(...)` nor an explicit `@PublicRoute()` / `@AuthenticatedOnly()` marker. An undeclared route then cannot reach production at all, while a declared-as-open route still behaves exactly as Django does. This gives the constraint its actual intent — "no route slips through undeclared" — without changing a single response.

**Leave a seam for API keys.** `NODE-10` ports `ApiKeyAuthentication`, which resolves a key to a real `User` so every permission check applies unchanged. The guard must read the authenticated user from the request context, never from the JWT directly, so that story adds an authenticator and touches nothing here.

**The permission catalogue.** `GET /api/permissions/` returns the 25 strings **sorted**, gated on `roles.manage` (verified live). It is what the frontend's role editor renders, so the list must be exactly `ALL_PERMISSIONS`, not what any particular role holds.

---

### 4 — The scope layer (🔑) — read the Product rules table first

Two mechanisms, and the constraint applies to only one of them.

#### 4a — Owner scoping: un-bypassable (this is what the constraint means)

**Create file: `backend-node/src/core/scoping/owner-scope.ts`**

Port `CustomerScopedModelViewSet`: a caller with a linked `Customer` row sees only their own rows; a caller with no linked `Customer` sees an **empty** result, never another customer's data and never a 500.

"Structurally impossible for a handler to issue an unscoped query" is the requirement, and an opt-in helper is explicitly not sufficient. Implement it as a **Prisma client extension** that intercepts queries on owner-scoped models and injects the `customer_id` filter from the request context — so a handler that writes a raw `prisma.tickets_ticket.findMany()` still gets a scoped query, because there is no unscoped path to call. A model is registered as owner-scoped in one place, with its owning field named there (the `customer_field` equivalent).

Carry over the two hard-won details from `CONVENTIONS.md` § 26:
- **A model with no owner relation must be left completely alone.** Defaulting every model to a `customer` field caused a live false-403 on `Article.retrieve` for portal callers (Story 46). Registration is explicit and per-model; unregistered models are untouched.
- **Keep the defence-in-depth object check.** Primary scoping covers list/retrieve/update/destroy; the object-level check exists for a custom action that fetches a row directly.

`NODE-9` states that portal owner-scoping must be enforced by this layer rather than per-handler filtering — that story is the consumer this task is built for.

#### 4b — Department/branch: the opt-in filter it actually is

**Create file: `backend-node/src/core/scoping/scope-filter.ts`**

Port `apply_scope_filters` with its param contract **unchanged**: absent or empty → **no filtering at all**; a numeric id → filter by that id; the literal `"none"` → filter for rows with no value; anything else → **400 `validation_error`**, never a silent no-op. Multiple scopes compose with **AND**. Only `list` is scoped by default.

**Do not make this un-bypassable.** An unfiltered staff list is the correct, required behaviour — `CONVENTIONS.md` § 33 is explicit that this filter "authorizes nothing". Making it mandatory would return empty lists across every staff screen, and would be a product change, not a port.

No domain module uses either mechanism in this story (`NODE-4` is the first consumer). Build both, register neither.

---

### 5 — Throttling and MFA

**Throttling** — `backend-node/src/core/throttling/`:

- Scope `auth_credentials` at **10/minute**, **shared across all five credential endpoints** (`token`, `token/refresh`, `token/verify-mfa`, `invite/confirm`, `password-reset/confirm`) — the budgets are deliberately not independent. `password_reset_request` is its own **5/hour** scope.
- **Keyed per IP** for these, because the caller has no identity yet. Honour `DJANGO_NUM_PROXIES` (default `0` = trust the socket address and ignore `X-Forwarded-For`) — `CONVENTIONS.md` § 36 records that trusting a client-supplied `X-Forwarded-For` makes every IP-keyed limit bypassable.
- **Fail open.** Back it with the same Redis the Django cache uses (`REDIS_CACHE_URL`), and on any cache error **log at WARNING and allow the request**. A throttle that turns a Redis blip into a 500 on every credential endpoint is strictly worse than no throttle — `throttling.py`'s docstring makes this argument, and it is the opposite posture from the permission guard, deliberately.
- Note that login now costs ~180 ms of CPU (task 1), which makes the throttle a real availability control here, not just an anti-guessing one.

**MFA** — `backend-node/src/accounts/mfa/`:

- **Login is two steps.** A 2FA-enabled account's `POST /api/auth/token/` returns `{"mfa_required": true, "mfa_token": "<signed>"}` and **no token pair**. The pair is issued only by `POST /api/auth/token/verify-mfa/`.
- **The challenge token** is Django's `signing.dumps` format under salt `apps.accounts.mfa_challenge` with a **5-minute** max-age, carrying a bare user id. Port the signer to be byte-compatible: Django's signing is `base64(payload):timestamp:hmac_sha1(key, …)` with a salted key derived from `SECRET_KEY`. **A challenge token issued by one service must be readable by the other** — the same interop bar as the JWT.
- **TOTP**: the secret is **Fernet-encrypted at rest** with `MFA_ENCRYPTION_KEY` (which, when unset, is derived as `urlsafe_b64encode(sha256(SECRET_KEY))` — reproduce that derivation exactly, or every enrolled secret becomes undecryptable). Verify with a **±1 step (30 s) window**. A decryption failure is treated as "no working secret", not a 500.
- **Recovery codes**: plain `sha256` + constant-time compare against `accounts_twofactorrecoverycode`, single-use. Not a KDF — the code is already 40 bits of randomness, and `mfa.py` documents why a slow hash defends nothing here.
- Enrol/confirm/disable port as-is; a successful recovery-code use writes the same `AuditLog` row.

---

### 6 — Close the loop with the harness

**File: `backend-node/scripts/contract-diff/implemented.json`** — add all **13** operation ids listed in Prerequisites.

**File: `backend-node/scripts/contract-diff/fixtures.json`** — add request bodies for the **11 POST** operations, keyed by `operationId`, so `--mutating` can exercise them. `auth_me_retrieve` and `permissions_retrieve` are GETs and need none.

Both updates belong in this change, not a follow-up — `CONVENTIONS-NODE.md` § 1 makes that a standing obligation, and `NODE-2`'s `UNDECLARED` outcome will fail the run if a route answers while unlisted.

**File: `CONVENTIONS-NODE.md`** — extend § 7 (Guard placement) with the two decisions this story makes that later stories must not re-litigate: runtime grant-on-omission with a **startup** declaration check, and the owner-scope layer being a Prisma extension rather than an opt-in helper.

---

### Frontend

**No frontend changes required — and that is this story's sharpest test.** If any frontend file needs to change, an endpoint has diverged from the contract (`SupportOs backlog.MD:1132`, and `NODE-12`'s own constraint).

---

## Edge Cases & Failure Modes

- **`token_not_valid` vs `not_authenticated`.** Verified live: missing header → `not_authenticated`; present-but-invalid → `token_not_valid`. The frontend retries only on the latter (`client.ts:96-98`). Getting it backwards logs every user out every 15 minutes, and no test in this repo would catch it — only the browser would.
- **`pbkdf2Sync` blocks the event loop for ~180 ms per login.** Measured this session at the real 1,000,000 iterations. Use the async form; the libuv threadpool default of **4** caps concurrent logins, which is the honest limit to document rather than tune away.
- **The `user_id` claim is a string.** `"150"`, not `150`. A token minted with an integer claim may still validate on the Node side and fail on the Django side — the asymmetry is the dangerous part, because it would pass a Node-only test.
- **The superuser short-circuit is live, not hypothetical.** `ziad@email.com` is a real superuser in this database. Omitting the short-circuit strips that account's access to everything while leaving role-based accounts working — a bug that only one account would report.
- **`super_admin` is missing 4 of the 25 permissions.** Verified: `calendars.manage`, `calendars.view`, `customers.export_data`, `customers.erase_data`. The seeded admin therefore gets a **403 on both services** for those endpoints — a `MATCH` for the harness, and a recorded product gap (`HOW_TO_USE.md` § 10). Do not grant permissions to make them 200.
- **Inverting grant-on-omission would 403 working endpoints.** The rule is deliberate and documented; the fail-closed guarantee belongs at startup (task 3), not at request time.
- **Making department/branch scoping mandatory would empty every staff list.** `CONVENTIONS.md` § 33: the filter "authorizes nothing". This is the single most likely way to implement task 4 wrongly, because the backlog's own wording invites it.
- **Owner-scoping registered for a model with no owner FK causes a false 403**, exactly as it did live in Story 46 for `Article.retrieve`. Registration is explicit per model; unregistered models must be untouched.
- **`MFA_ENCRYPTION_KEY` derivation must match exactly.** When unset it is `urlsafe_b64encode(sha256(SECRET_KEY).digest())` — not `SECRET_KEY` itself, unlike `JWT_SIGNING_KEY`. Derive it differently and every enrolled TOTP secret becomes undecryptable, with no error until a user tries to log in.
- **Django's `signing.dumps` uses HMAC-SHA1**, not SHA-256, and a salted key derivation. The MFA challenge, invite and reset tokens all depend on it. A "modernised" signer breaks every token in flight.
- **Refresh-token replay after rotation must fail.** `BLACKLIST_AFTER_ROTATION` is on. A Node refresh that issues a new pair without writing the blacklist row leaves the old token valid — a silent downgrade of a security control that no response shape would reveal.
- **The throttle must fail open; the guard must fail closed.** Same codebase, opposite postures, both deliberate. Copying one posture to the other is a real risk when both are written in the same story.
- **`auth_credentials` is one shared 10/minute budget across five endpoints.** Implementing five independent buckets quintuples the real limit while looking correct.
- **`logout` must not require an `Authorization` header.** A client whose access token has already expired must still be able to revoke its refresh token — which is precisely the state a logging-out user is often in.
- **A mutating harness run against `--mutating` will blacklist real refresh tokens and consume recovery codes.** Both are one-way. Re-seed before and after, per `NODE-2`'s warning.

---

## Test Plan

**No test file is added.** `CONVENTIONS.md` § 16 is repo-wide. This story's verification is the harness plus direct probes — and unusually, it also has a real end-to-end test available: **the existing frontend**, unchanged, pointed at the Node service.

1. **`NODE-2`'s harness is the primary gate.** After task 6, `npm run contract:diff -- --only auth --only permissions` must report all 13 operations `MATCH`.
2. **Cross-service token interop** (Verification Step 5) is the test the harness cannot express, because it compares two responses rather than crossing credentials between them.
3. **The frontend is the acceptance test** (Verification Step 10): sign in, let the access token expire, confirm the silent refresh fires and the session survives.
4. **Regression:** Django's **54** tests still pass; this story adds no Python file.

---

## Verification Steps

1. **Both services running**, Django on 8000 and Node on 8002, sharing `backend/.env`.
2. **Password verification against a real row:** sign in to the **Node** service as `admin@supportos.local` / `Passw0rd!2026` and receive a token pair. No password was changed, reset, or migrated to get there.
3. **A wrong password is rejected** with the same status and `error.code` Django returns for the same input.
4. **A password set by Node is accepted by Django:** change the password through the Node service, then sign in through **Django** with the new one. This is the only test that proves the encoder, not just the verifier.
5. **Cross-service token interop, both directions:**
   ```bash
   # Django-issued token → Node
   TOKEN=$(curl -s -X POST -H 'Content-Type: application/json' \
     -d '{"email":"admin@supportos.local","password":"Passw0rd!2026"}' \
     http://127.0.0.1:8000/api/auth/token/ | sed -E 's/.*"access":"([^"]+)".*/\1/')
   curl -s -H "Authorization: Bearer $TOKEN" http://127.0.0.1:8002/api/auth/me/
   # Node-issued token → Django (same two commands with the ports swapped)
   ```
   Both must return the same `me` payload. Compare with `git diff --no-index`.
6. **The two 401 codes:** against **both** services, `GET /api/auth/me/` with no header → `not_authenticated`; with `Bearer garbage.token.here` → `token_not_valid`. Four probes, two codes, no exceptions.
7. **Refresh rotates and blacklists:** refresh once against Node, confirm a new pair; replay the original refresh token → rejected. Confirm a `token_blacklist_blacklistedtoken` row was written.
8. **Authorization is proven by denials, not grants.** Against both services with the seeded admin's token: `GET /api/customers/export-data/`-style endpoints → **403 on both** (the recorded 4-permission gap). Then, as an `agent` account, confirm the same endpoint set denies identically. A story that only tests grants has tested nothing.
9. **The declaration check fires:** temporarily remove the permission decorator from one route, start the service → **boot fails naming that route**. Restore.
10. **The frontend, unchanged, against Node:** set `VITE_API_BASE_URL=http://localhost:8002/api`, sign in, and confirm the app loads with the correct permission-gated navigation. Then wait out the access-token lifetime (or shorten `JWT_ACCESS_TOKEN_LIFETIME_MINUTES` to 1 for the test) and confirm **the session survives** — the silent refresh fired. Revert the env change. `git status --short frontend/` must be empty.
11. **Throttle:** 11 rapid failed logins against Node → the 11th is throttled, matching Django's `10/minute`. Then confirm the shared budget: spend the login budget and confirm `password-reset/confirm` is also throttled.
12. **Throttle fails open:** stop Redis, issue a login → it **succeeds**, with a WARNING logged. Restart Redis.
13. **MFA end to end:** with `agent.mfa@supportos.local` (TOTP secret `JBSWY3DPEHPK3PXPJBSWY3DPEHPK3PXP`, `HOW_TO_USE.md` § 9), sign in against Node → `{"mfa_required":true,"mfa_token":…}` and **no token pair**; exchange a live TOTP code for a pair. Then confirm a recovery code works once and is refused the second time.
14. **MFA challenge-token interop:** an `mfa_token` issued by Django is accepted by Node's `verify-mfa`, and the reverse.
15. **Harness:** `npm run contract:diff -- --only auth --only permissions` → **13/13 MATCH**, exit 0. Then the full `npm run contract:diff` → 13 matched, **0 mismatched, 0 undeclared**, exit 0.
16. **Regression:** `python manage.py test` from `backend/` → **54 tests, OK**; Ruff clean. `npm run lint`, `format:check` and `build` clean from `backend-node/`. `git diff --stat backend/ frontend/` → **empty**.

---

## Done Criteria

- [ ] All **13** contract operations are listed in `implemented.json` and report **MATCH** in the harness, with the full run at **0 mismatched, 0 undeclared**.
- [ ] `fixtures.json` carries bodies for the **11 POST** operations.
- [ ] Every existing account signs in with its **current** password; no hash was rewritten to make it work (Steps 2–3).
- [ ] A password **set by Node** is accepted by **Django** (Step 4).
- [ ] Password verification uses **async `crypto.pbkdf2`** and `timingSafeEqual`; the ~180 ms cost and the 4-thread concurrency cap are recorded in `backend-node/README.md`.
- [ ] Rehash-on-login exists and is a verified no-op at today's matching iteration counts.
- [ ] A token issued by either service is accepted by the other, **both directions** (Step 5).
- [ ] The `user_id` claim is the **string** form; `jti` is 32 hex characters; no `aud`/`iss`.
- [ ] **Missing header → `not_authenticated`; invalid token → `token_not_valid`**, on both services (Step 6).
- [ ] Refresh **rotates and blacklists**; a replayed refresh token is rejected (Step 7).
- [ ] `logout` works with **no `Authorization` header** and is idempotent for an already-blacklisted token.
- [ ] `me` returns the exact 11-key payload, with `permissions` sorted.
- [ ] `permissionsFor` reproduces the **superuser short-circuit**; the real superuser account retains all 25 permissions.
- [ ] `GET /api/permissions/` returns all **25** strings, sorted, gated on `roles.manage`.
- [ ] The guard **grants on omission at runtime** (matching Django) and the service **refuses to boot** when a route declares no permission decision (Step 9).
- [ ] Denials are verified, not just grants — including the recorded 4-permission `super_admin` gap 403ing identically on both services (Step 8).
- [ ] Owner-scoping is a **Prisma extension** a handler cannot bypass with a raw query; models without an owner relation are untouched.
- [ ] Department/branch filtering stays **opt-in**: absent means unfiltered, `"none"` means null, malformed means **400**.
- [ ] Throttling matches `10/minute` on one **shared** `auth_credentials` budget and `5/hour` for `password_reset_request`; it **fails open** on a cache outage (Steps 11–12).
- [ ] MFA is a two-step exchange; TOTP uses a ±1 step window; recovery codes are single-use; challenge tokens interoperate with Django (Steps 13–14).
- [ ] `MFA_ENCRYPTION_KEY`'s unset-derivation matches Django's exactly.
- [ ] **The frontend works unchanged against the Node service, including the silent refresh** (Step 10).
- [ ] `CONVENTIONS-NODE.md` § 7 records the grant-on-omission-plus-startup-check decision and the Prisma-extension scope layer.
- [ ] Django's **54** tests pass; `backend/` and `frontend/` diffs are empty.

---

**STOP HERE. Report to the user and wait for confirmation before proceeding to Story 120 (NODE-4, Customer Management Port).**
