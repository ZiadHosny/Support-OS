# SupportOS conventions (`CONV`)

This is the single source of truth every later task cites instead of re-deriving a
standard. It is deliberately **reference-based** — where a rule is already written
down elsewhere in the repo, this document links to it rather than repeating it.

**If the code and this document disagree, the code wins.** Fix this document in the
same PR that changes the code.

---

## 0. Before you write new code

1. Search for an existing implementation before adding a new one — `grep` the symbol
   or concept you need, and check the two shared homes first:
   - Backend: `backend/apps/core/`
   - Frontend: `frontend/src/shared/`
2. Read the relevant placement doc (`backend/apps/README.md` or
   `frontend/src/README.md`) and the shared spec it points to.
3. Extend what exists rather than duplicating it.
4. Only then write new code.

---

## 1. Folder structure & file placement

Backend: organised by domain app, one per business area, never by technical layer.
Frontend: organised by feature, never by technical layer. Both are decision records,
not tutorials — read them for the actual placement rule.

- Backend: [`backend/apps/README.md`](backend/apps/README.md)
- Frontend: [`frontend/src/README.md`](frontend/src/README.md)

---

## 2. Naming conventions

- **Python:** `snake_case` modules and functions, `PascalCase` classes,
  `UPPER_SNAKE` constants. App labels match the domain word already chosen in
  [`backend/apps/README.md`](backend/apps/README.md) § The apps.
- **TypeScript:** `PascalCase` for components and types, `camelCase` for
  functions/variables, `UPPER_SNAKE` for module-level constants.
- **Files:** React components `PascalCase.tsx`; everything else `camelCase.ts`.
  Hooks start with `use`. Backend modules `snake_case.py`. **One scoped
  exception:** files under `frontend/src/shared/ui/primitives/` keep the
  shadcn registry's own lowercase-kebab names (`dropdown-menu.tsx`), because
  renaming them breaks `shadcn add` and `shadcn diff`. Everything we author —
  including everything else in `shared/ui/` — is `PascalCase.tsx`.
- **No abbreviations** that are not already in the domain vocabulary — `sla` is
  fine (it is a domain term), `cust` is not.

---

## 3. TypeScript conventions

Three `frontend/tsconfig.app.json` settings are non-obvious and will bite if you
forget them:

- **`strict` is on.** Every new file must satisfy it.
- **`erasableSyntaxOnly` forbids `enum`, parameter properties, and namespaces.**
  Use an `as const` array plus indexed access instead. See
  `frontend/src/shared/lib/api/types.ts` for the worked example
  (`API_ERROR_CODES`).
- **`verbatimModuleSyntax` requires `import type` for type-only imports.** A value
  used with `instanceof` (e.g. `AxiosError`) is **not** type-only and must stay a
  normal import — mixing this up is the most common build break.

**Named exports only.** No default exports, so a symbol has exactly one name
everywhere it is imported.

---

## 4. API communication

The full contract — envelope shape, error codes, retries, query keys — is
documented once, in [`README.md`](README.md) § API conventions and §
Consuming the API from the frontend. Two rules that are easy to break:

- Backend views **return plain payloads** and never build an envelope
  themselves — the renderer and exception handler do that.
- Frontend features call `api.*` from `@/shared/lib/api/client` and never
  `httpClient` directly, `fetch`, or a second `axios.create`.

---

## 5. Error, loading & empty states

`QueryBoundary` for a single-resource query; `DataTable`
(`shared/ui/data-table/`) for a paginated list. `DataTable` does not wrap
`QueryBoundary` because `QueryBoundary`'s branches return a `<div>`, which is
not a valid child of `<tbody>` — it renders the same `Loading`/`Empty`/
`ErrorState` inside a `<TableCell colSpan>` instead. Either way, **never
hand-roll an `isPending`/`isError` branch in a feature.**

---

## 6. Validation

`FORM` is React Hook Form + Zod, established by story 07 and specified in
§ 20. `useAppForm` (`frontend/src/shared/ui/form/useAppForm.ts`) is the
**only** entry point — a feature never calls `useForm` or imports
`@hookform/resolvers` itself. Validation messages come from the i18next
`validation` namespace via a Zod error map, never from a literal string in a
schema. Compose the shared field components in `shared/ui/form/` with a
schema built from the helpers in `shared/validation/schemas.ts`.

---

## 7. Reusable components

`UI` is Tailwind CSS v4 + shadcn/ui, established by story 06 and specified in
§ 19. `frontend/src/shared/ui/` is the reuse-first home: `primitives/` is the
CLI-managed shadcn set, everything above it is ours. Features compose these;
they never restyle a primitive or hand-build a button, dialog, or table. The
props of `Loading`, `Empty`, `ErrorState`, and `QueryBoundary` are a **stable
contract** — story 06 restyled all four without changing one.

---

## 8. Shared utilities

Same stop-at-first-match placement rule as folder structure (§1): used by one
feature/app → keep it there; used by two or more → move it to `shared`.

The asymmetry that makes this cheap to follow: moving code **into** `shared`
later is easy. Untangling `shared` after it becomes a dumping ground is not.
Default to keeping code in its feature or app until a second consumer
actually appears.

---

## 9. Environment & config

Full variable reference: [`README.md`](README.md) § Environment variables.

- A new environment variable lands in the app's `.env.example` **and** the
  README table, in the same commit.
- The frontend reads `import.meta.env` in exactly these files — nowhere else:
  `frontend/src/config/env.ts`, `frontend/src/main.tsx`,
  `frontend/src/app/providers.tsx`, `frontend/src/shared/lib/logger.ts`.

---

## 10. Logging

**Backend:** `logging.getLogger(__name__)` at module scope. Never `print()`.

**Frontend:** `logger` from `@/shared/lib/logger`. Never a bare `console.*`
call — `debug`/`info` are stripped outside dev; `warn`/`error` always emit.

**Levels** (both apps, same meanings):

| Level | Meaning |
|---|---|
| DEBUG | Local detail, useful only while developing this exact code path. |
| INFO | Normal lifecycle events. |
| WARNING | Recoverable, but worth noticing. |
| ERROR | Needs attention — something failed. |
| CRITICAL | Data loss or the app cannot continue. |

**Never log secrets.** No request bodies, tokens, passwords, or
`POSTGRES_PASSWORD` in a log call, ever — including inside an exception
traceback you're about to log.

---

## 11. API response conventions

The envelope shape (`{success, data, error, meta}`) is documented once, in
[`README.md`](README.md) § API conventions. It is the **only** response
shape in this API. Wire keys are `snake_case` deliberately — they are not
renamed in transit.

---

## 12. Frontend/backend boundaries

- The backend owns validation and authorization. A frontend-side check is UX
  only — it is never the enforcement point, and the backend must reject
  anything the frontend's check would have caught.
- Wire format is `snake_case` end to end. Do not camelCase it on the way in
  or out.
- The frontend never hardcodes a host. It builds every URL from
  `env.apiBaseUrl` (`frontend/src/config/env.ts`).
- A new endpoint is registered once, in `backend/config/api_urls.py`, and
  consumed through a feature's `api/` folder — never called inline from a
  component.

---

## 13. Auth conventions

`AUTHZ` is complete. Both halves have landed:

- **Authentication** — AUTH-1. Who are you? See **§ 21**.
- **Authorization** — AUTH-2. What may you do? See **§ 22**.

Auth lives in `frontend/src/shared/auth/` and `backend/apps/accounts/`, with
the permission vocabulary and the one DRF permission class in
`backend/apps/core/permissions.py`. Never build a second auth flow, a second
token store, a second `useAuth()`-shaped hook, or a second permission check
— extend what is there.

**The project-wide default is `IsAuthenticated`. It fails closed.**
`DEFAULT_PERMISSION_CLASSES` was `AllowAny` until Story 99 (F-4,
`qa-report-1`), which means the rule has inverted: **an `APIView` that must
be PUBLIC is now the one that says so explicitly**, with
`permission_classes = [AllowAny]` on itself. A view that declares nothing at
all is authenticated-only, not public — so a forgotten `permission_classes`
is now a 401, not an open endpoint.

Fourteen views opt out deliberately and must keep their explicit `AllowAny`:
`HealthView` and `ApiNotFoundView` (`apps/core`), the four unauthenticated
account flows (logout, invite confirm, password-reset request/confirm), the
six inbound/public communications endpoints (email, WhatsApp, SMS webhooks,
live-chat start, web-form categories and submission), and `BrandingView` +
`LandingContentView` (`apps/organization`), which additionally set
`authentication_classes = []`.

Two groups resolve permissions on their own and are unaffected by the
default in either direction — do not "fix" them by adding `AllowAny`:

- `SchemaView`, Swagger and Redoc inherit
  `SpectacularAPIView.permission_classes = spectacular_settings.SERVE_PERMISSIONS`,
  driven by the `API_DOCS_PUBLIC` env flag (`config/settings/base.py`,
  `default=True` in dev; `prod.py` flips it to `False`).
- `ThrottledTokenObtainPairView`/`ThrottledTokenRefreshView` declare
  `throttle_classes` and nothing else, inheriting simplejwt's
  `TokenViewBase.permission_classes = ()` — an empty tuple that
  short-circuits the default. **This is load-bearing:** were it not empty,
  a fail-closed default would mean you need a token to obtain a token, and
  every user is locked out.

`BaseModelViewSet` remains the authorization half — the global default only
guarantees a caller is signed in; `HasPermission` plus `permission_map` is
what makes a domain endpoint closed by *permission*.

---

## 14. Linting & formatting

| | Backend | Frontend |
|---|---|---|
| Format | `ruff format .` | `npm run format` (Prettier) |
| Lint | `ruff check .` | `npm run lint` (oxlint) |
| Line length | 100 | 100 |

Run from `backend/` or `frontend/` respectively, with the backend venv
active. Both numbers are 100 by measurement, not convention — see
`backend/pyproject.toml` and `frontend/.prettierrc.json` for why.

**Formatting is never a review comment.** If the pre-commit hook or CI
passed, the formatting is correct by definition — do not request a manual
style change on top of it.

---

## 15. Import conventions

- **Frontend:** `@/` for any import crossing out of the current
  feature/shared folder; relative (`./`, `../`) for imports within the same
  feature. No deep import into another feature's internals — go through
  `shared/` instead. Enforced by `no-restricted-imports` in
  `frontend/.oxlintrc.json`.
- **Backend:** import order is stdlib → third-party → first-party
  (`apps`, `config`) → relative, enforced by ruff's `I` (isort) rules.
- **No circular imports** between `shared/` modules in either app.

---

## 16. Verification (this project does not author automated tests)

This project does not write automated tests. Changes are verified by running
the commands in [`README.md`](README.md) and driving the app directly.

The 54 backend tests under `backend/apps/core/tests/` and
`backend/config/tests/` predate this policy and are kept, but they are not
extended and no new test file is added anywhere in the repo.

---

## 17. Dependencies

- **Backend:** range pins (`>=x,<y`) in `backend/requirements.txt`
  (runtime) and `backend/requirements-dev.txt` (tooling). No lockfile.
- **Frontend:** `frontend/package-lock.json` is committed.
- Before adding a dependency, check whether an existing one already does the
  job (§0).

---

## 18. Internationalization & RTL

**No hardcoded user-facing strings.** Every one goes in an i18next namespace.
`react/jsx-no-literals` in `frontend/.oxlintrc.json` only catches **direct
JSX text children** — verified against the real tree, it flagged 1 of 4
patterns:

| Pattern | Flagged? |
|---|---|
| `<p>text</p>` | **yes** |
| `{cond ? <p>text</p> : null}` | no |
| `{cond && <p>text</p>}` | no |
| `<span>{'text'}</span>` | no |

Do not assume lint catches everything — conditional rendering is ubiquitous
and this rule misses all of it. Grep by hand when in doubt.

**Namespaces.** `common` and `errors` are shared, at
`frontend/src/shared/i18n/locales/{en,ar}/`. Each feature owns
`src/features/<feature>/locales/{en,ar}.json` and registers them in
`src/shared/i18n/resources.ts`. Adding a feature = adding its namespace
files plus one line per language in `resources.ts`.

**Every key in `en` must exist in `ar`.** `en` is the typed source of
truth — `CustomTypeOptions.resources` in `i18next.d.ts` is derived from the
`en` map, so a key that exists only in `ar` typechecks fine and is simply
unreachable. A missing `ar` key falls back silently to English with no
warning; compare key sets by hand (see the plan's Verification Step 3) when
adding a namespace.

**What stays in English:** logs (`shared/lib/logger.ts`), programmer errors
thrown at development time (e.g. `useToast()` used outside its provider),
and pre-i18n setup failures (`config/env.ts` — thrown before i18next can
even initialise). Nobody but a developer reads these.

**Errors translate by `code`, never by message.** The API layer
(`shared/lib/api/{errors,client,queryClient}.ts`) is not React and its
modules are evaluated once, so translating a message at module scope would
freeze it at import time and never update on a language switch.
`ApiRequestError` keeps an English `message` as a fallback; the UI looks up
copy against the `errors` namespace by `code`:

```ts
const message = t(`errors:${error.code}`, { defaultValue: error.message })
```

Apply this in a component with `useTranslation()` — never inside the API
layer itself.

**Direction:** `dir` and `lang` on `<html>` are written by exactly one
module, `frontend/src/shared/i18n/direction.ts`. No component sets
`direction` or writes `document.documentElement` itself — including
`LanguageSwitcher`, which only calls `i18n.changeLanguage()` and lets the
detector persist the choice and `direction.ts` react to it.

**Logical properties only.** No `left`, `right`, `margin-left`,
`padding-right`, `text-align: left`, or `text-align: right` anywhere in
CSS. **The class mapping UI-1 must follow once Tailwind lands:**

| Use | Never use |
|---|---|
| `ms-*` / `me-*` | `ml-*` / `mr-*` |
| `ps-*` / `pe-*` | `pl-*` / `pr-*` |
| `start-*` / `end-*` | `left-*` / `right-*` |
| `text-start` / `text-end` | `text-left` / `text-right` |
| `border-s-*` / `border-e-*` | `border-l-*` / `border-r-*` |

This rule predates Tailwind deliberately — I18N-1 had to land before UI-1
could, so the constraint is written down here rather than in a Tailwind
config that does not exist yet.

**Bidirectional text.** An Arabic string containing a Latin run (a product
name, an email, a ticket ID) can render with confusing punctuation
placement — this is the Unicode bidi algorithm, not a bug to fix in CSS.
Where it matters, wrap the Latin run in an element with `dir="ltr"`.

**Formatting:** use `useFormatters()` (`shared/hooks/useFormatters.ts`) in
components, or the pure functions in `shared/lib/format.ts` elsewhere. Never
call `Intl` or `toLocaleString` directly in a feature.

Both `numberingSystem` (`latn`) and `calendar` (`gregory`) are pinned
explicitly on every call for Arabic. Verified: bare `ar` resolves to Western
digits and the Gregorian calendar, but `ar-EG` and `ar-SA` resolve to
Arabic-Indic digits — relying on resolution makes output depend on the tag
and on the browser's ICU build. **This is a product decision, not a
technical one**, made for a support CRM where Arabic screens mix ticket
IDs, timestamps, and amounts with Latin-script data. To reverse it: change
`INTL_LOCALE.ar` in `shared/i18n/config.ts` to `'ar-EG'` and drop
`numberingSystem` from `format.ts`.

**Backend.** User-facing strings in `apps/core/exceptions.py` use
`gettext_lazy` (`from django.utils.translation import gettext_lazy as _`),
never plain `gettext` — a non-lazy call at module scope binds at import
time and freezes the language. The frontend sends `Accept-Language` from
the active language on every request (`shared/lib/api/client.ts`).

DRF's and Django's own messages (`NotFound`, `PermissionDenied`, etc.)
ship pre-compiled Arabic `.mo` files already — verified working. Our own
custom messages need `python manage.py compilemessages`, which needs GNU
gettext installed; the committed `.po` at `backend/locale/ar/LC_MESSAGES/`
is the source of record until then.

**Forward constraint:** TanStack Query keys do not include the language.
The moment an API response carries user-facing prose (not just machine
codes like `health.status`), `language` must join that query's key, or a
cached response keeps showing stale-language text after a switch.

---

## 19. Design system, theming & data tables

**Tailwind v4 is CSS-first.** Tokens live in `@theme inline` in
`frontend/src/index.css`; there is no `tailwind.config.js` and adding one
creates a second source of truth. Every colour, radius, and font stack comes
from a token — no hex, `rgb()`, `oklch()`, or bare `px` in a component.

**Where a component goes:** `shared/ui/primitives/` is CLI-managed
(`npx shadcn@latest add <name>`), lowercase-kebab, and locally patched — see
below. `shared/ui/` is ours, `PascalCase.tsx`. `components.json` redirects the
CLI's `@/components/ui` and `@/lib/utils` defaults; **do not** let a
`shadcn add` recreate a top-level `components/` or `lib/`.

**Registry output is not RTL-clean, and every patched file says so in a
header comment.** Verified against the live registry: 9 of 12 components
shipped physical direction classes, 3 shipped `"use client"`, and
`dialog.tsx` shipped two hardcoded English strings. **After every
`shadcn add`, run `npm run check:rtl` and re-read the new file for JSX
literals.** `shadcn diff` will always report the patched files as changed.

**The one sanctioned physical idiom:** `left-[50%]` + `translate-x-[-50%]`
overlay centring, because it is symmetric. `start-[50%]` would break it —
`start` flips with direction, `translate-x` does not.
`scripts/check-rtl.mjs` allowlists exactly this, and nothing else.

**Radix reads direction from a React context, never from `<html dir>`.**
Verified: `useDirection()` in `@radix-ui/react-direction` falls back to the
literal `'ltr'`. `Direction.DirectionProvider` in `app/providers.tsx`, fed by
`shared/i18n/useDirection.ts`, is what makes Select/DropdownMenu/Tabs behave
in Arabic. **Remove it and every primitive silently reverts to LTR keyboard
and placement behaviour with no error and no visual clue in English.**

**Directional icons mirror; non-directional icons do not.** Chevrons and
arrows flip (`rtl:rotate-180`, or swap the icon). Checkmarks, spinners, and
X's do not. There is no blanket `[dir=rtl] svg { transform: scaleX(-1) }` and
there must not be.

**Two document-level writers, one attribute each.**
`shared/i18n/direction.ts` owns `<html dir>` and `<html lang>`.
`shared/theme/theme.ts` owns `<html class="dark">`. No component writes
either. Both are mirrored by the inline anti-FOUC script in `index.html`, and
**all four copies of the two storage keys are commented as needing to stay in
sync**.

**Toast stays ours, and why.** `sonner` is not installed:
`shared/ui/toast/toastSink.ts` is how `createQueryClient`'s `onError` reaches
a toast from outside React, and it has no sonner equivalent. `useToast()` and
`pushToast()` are the API; the renderer behind them may change.

**`useConfirm()`** returns `Promise<boolean>` and resolves `false` on cancel,
`Escape`, and overlay dismiss. Copy is passed in already translated — the
module never guesses. Same Context/Provider/hook/types shape as
`shared/ui/toast/`.

**`DataTable` is the only table pattern.** Sorting and pagination are
**server-side**: `?page=`, `?page_size=`, and `?ordering=field` / `-field`
(DRF's `OrderingFilter`, enabled in `REST_FRAMEWORK.DEFAULT_FILTER_BACKENDS`).
A `ColumnDef<T>`'s `id` doubles as the ordering field name and must match the
serializer field. `@tanstack/react-table` is **not** installed and must not
be added to get client-side models we would bypass — pagination and sorting
here are server-side, and `@tanstack/react-table@9.1.2` is a rewrite
(`useTable` + `tableFeatures()`, plus a `@tanstack/react-store` runtime
dependency).

Worked example:

```tsx
const { page, sort, params, setPage, setSort } = useServerTable({ pageSize: 25 })
const query = useQuery({
  queryKey: ticketKeys.resource('list', params),
  queryFn: () => api.getPage<Ticket>('/tickets/', { params }),
})

const columns: ColumnDef<Ticket>[] = [
  { id: 'subject', header: t('tickets:subject'), cell: (row) => row.subject, sortable: true },
  {
    id: 'created_at',
    header: t('tickets:createdAt'),
    cell: (row) => date(row.created_at),
    sortable: true,
    align: 'end',
  },
]

<DataTable
  columns={columns}
  query={query}
  rowKey={(row) => String(row.id)}
  sort={sort}
  onSortChange={setSort}
  onPageChange={setPage}
  caption={t('tickets:listCaption')}
/>
```

**Changing the sort resets to page 1.** Page 2 of a re-ordered result set is
a different set of rows — `useServerTable.setSort` does this automatically.

**A stack trace or any Latin-only code run inside an RTL document needs
`dir="ltr"`** on its element. `ErrorState`'s `<pre>` is the worked example,
and it is the first real instance of § 18's bidi rule.

**Cross-reference forward:** `Select`, `Input`, and `Label` ship as
primitives here. FORM-1 binds them to React Hook Form + Zod; **`Select` is
not a native form control** and integrates through `Controller`, not
`register()`.

**An equality filter on a list screen is local component state merged into
the query params at the call site, exactly like free-text `search`** — not a
`useServerTable` feature. `TicketListPage`'s category/priority filters
(Story 18, `TKT-2`) are the worked example: each filter is a plain `Select`
(the `LanguageSwitcher` pattern — controlled `value`/`onValueChange`, not
React Hook Form's `Controller`, since a filter is not a form field) with a
non-empty sentinel value (`"all"`) standing in for "no filter," because
Radix's `Select.Item` requires a non-empty `value`. **Changing a filter
resets the page** the same way changing `search` already does — a filtered
result set can be narrower than the page the user was on.

**Bulk selection is an opt-in prop on `DataTable`, never a second table
component.** `DataTableSelection` (Story 106, `TKT-7`) adds a leading
checkbox column — per-row plus select-all-on-page — only when a consumer
passes `selection`; every other `DataTable` call site is unaffected, both
at compile time (the prop is optional) and at runtime (no `selection`
means no checkbox column is rendered at all). Selection is **page-scoped
only**: it holds row keys for whatever page/sort/filter state produced
them, and the owning page is responsible for clearing it on every sort,
filter, or page change — `DataTable` itself never clears it, and never
tries to reconcile a stale selection against a new result set.
`TicketListPage` clears `selectedIds` in the same effect that already
resets `page` to 1 on a filter change, plus in its
`onSortChange`/`onPageChange` wrappers — always cleared, never silently
carried across a result-set change that could no longer contain the same
rows. **The bulk-action bar itself is not part of `DataTable`.**
`SelectionActionBar` (`shared/ui/data-table/`) is a reusable,
content-agnostic shell — a count, a clear button, a slot — and the
buttons inside it are entirely feature-specific (`TicketBulkActionBar`,
ticket-only today). This mirrors the same "shared mechanism,
feature-specific content" split `ColumnDef`/`columns` already establish
between `DataTable` and its callers.

**Runtime branding is the one exception, and it is bounded (ORG-3).**
`src/shared/branding/` is the only module allowed to write a colour at
runtime, it writes exactly two custom properties — `--primary` and
`--primary-foreground` — and it writes them as an inline style on
`<html>`, which beats both `:root` and `.dark`. No component gains a
colour literal and no utility class changes: `@theme inline`'s
`--color-primary: var(--primary)` mapping is what carries the override
to every `bg-primary`/`text-primary` in the app.

`--primary-foreground` is **derived**, never configured
(`contrast.ts`, WCAG relative luminance, 0.179 crossover), so every
brand colour an admin can enter yields a legible pair. `--background`,
`--foreground`, `--card`, `--muted`, `--border`, and `--ring` are not
brandable — Story 51 derived them as a set with verified contrast
ratios, and `--ring` in particular carries a WCAG 2.4.11 floor.

**Branding is read publicly** (`GET /api/branding/`, `AllowAny`) because
the login and landing pages have no session and a non-admin agent has no
`settings.manage`. That endpoint serves a **separate three-field
serializer**, never `OrganizationSettingsSerializer` — which carries the
org's SLA defaults. Do not widen it, and do not make the public view
inherit from the private one.

Values are cached in `localStorage` and re-applied by `index.html`'s
inline script before first paint, the same anti-FOUC contract the theme
and language already use. The cache holds **resolved** CSS values so that
script needs no colour maths.

---

## 20. Forms & validation

**React Hook Form + Zod is the only approach.** `useAppForm`
(`frontend/src/shared/ui/form/useAppForm.ts`) is the **only** entry point —
no feature calls `useForm` directly, and `@hookform/resolvers` is imported
in exactly one file, `shared/validation/resolver.ts`. Compose the shared
field components in `shared/ui/form/` (`TextField`, `TextareaField`,
`SelectField`, `CheckboxField`, `SwitchField`, `RadioGroupField`) with a
schema built from `shared/validation/schemas.ts`'s helpers
(`requiredString`, `optionalString`, `email`, `optionalEmail`,
`positiveInt`, `choice`, `requiredBoolean`).

**Why Zod's own copy is unusable for forms.** Verified against `zod@4.4.3`:
a blank required field renders `Too small: expected string to have >=1
characters` (Arabic: `أصغر من اللازم: يفترض لـ string أن يكون >= 1 حرف`),
and a missing key renders `Invalid input: expected string, received
undefined` — leaking the literal token `undefined` to an Arabic user. Those
are the two most common messages in any form.

**The error-map-plus-locale-fallback design.** `shared/validation/config.ts`
calls `z.config({ ...locale(), customError: zodErrorMap })` exactly once.
`zodErrorMap` (`shared/validation/errorMap.ts`) returns a translated string
for the issue codes a form actually produces (via the `validation` i18next
namespace, keyed on Zod's own issue codes the way `errors` is keyed on
`ApiRequestError.code`) and `undefined` for everything else, which **falls
through** to Zod's own locale underneath. Never call `z.config()` a second
time anywhere — it replaces the map and the locale together, silently
disabling every translation.

**Messages resolve at parse time, not at render time.** `zodResolver`
reduces a Zod issue to `{ message, type }` for React Hook Form — `minimum`,
`origin`, and `input` are dropped. So a message must be a finished,
interpolated string by the time the map returns it, and a language switch
cannot retranslate an error already on screen on its own. `useAppForm`
calls `trigger()` on `languageChanged`, **guarded on `isSubmitted`** so a
switch never paints a pristine form red.

**A `custom` issue keeps its own message.** `z.string().refine(fn, { error:
'...' })` sets `issue.message` before the map runs; returning `undefined`
for `code === 'custom'` preserves it. That is how a feature adds a one-off
rule with its own copy.

**Field names are `snake_case`, matching the DRF serializer — no mapping
layer.** § 12's "wire format is snake_case end to end" means a schema key,
an RHF field path, and a serializer field are the same string, so
`applyServerErrors` (`shared/validation/serverErrors.ts`) can call
`form.setError(field, …)` directly from a `validation_error` envelope's
`fields` map.

**Server errors are applied untranslated.** The backend already localised
them via `Accept-Language` (§ 18); running them through `t()` would look up
a full sentence as a translation key. They are also **not** retranslated on
a language switch — `trigger()` clears them instead, which is correct: only
the server can re-issue a server error.

**The nested-serializer limitation.** `_as_message_list`
(`backend/apps/core/exceptions.py`) flattens a nested serializer one level
into `"child: message"` strings under the **parent** key, so a path like
`address.city` never exists on the wire. `applyServerErrors` does not parse
that string apart — a message can itself contain `": "` — and surfaces such
errors at form level instead. True nested field errors need the backend to
emit dotted paths.

**A `validation_error` toasts *and* fills the fields — a known rough edge.**
`MutationCache.onError` (`shared/lib/api/queryClient.ts`) toasts every
mutation failure, so a rejected submit shows a generic toast on top of the
inline field errors. Accepted for now; suppressing it means changing the
shared `queryClient`.

**Radix-backed controls are not native form controls.** `Select`,
`Checkbox`, `Switch`, and `RadioGroup` report changes via
`onValueChange`/`onCheckedChange`, not `onChange`, and have no DOM `ref`.
Their field components wire `field.value`/`field.onChange` explicitly inside
`FormField`'s `Controller` — spreading `{...field}` onto one of these
silently does nothing.

**The `translate-x` RTL trap.** A physical `translate-x` does not flip with
direction, so a thumb, slider, or drawer animated with it moves the wrong
way in RTL — verified in `primitives/switch.tsx`'s checked-state thumb
position, which shipped this way from the shadcn registry. `check-rtl.mjs`
(§ 19) has a `translate-x` pattern for exactly this, with two sanctioned
exemptions: a line carrying its own `rtl:` counterpart, and Radix's
`data-[side=left|right]:translate-x-*` popper-positioning idiom, which is
anchor-relative screen-space positioning, not text direction.

**Worked example**, from a schema to a submitted form with server-error
handling:

```tsx
const schema = z.object({
  subject: requiredString(),
  priority: choice(['low', 'medium', 'high']),
})

function TicketForm() {
  const { t } = useTranslation(['tickets', 'validation'])
  const form = useAppForm({
    schema,
    defaultValues: { subject: '', priority: 'medium' },
  })
  const [formErrors, setFormErrors] = useState<string[]>([])

  const { mutate } = useMutation({
    mutationFn: (values: z.output<typeof schema>) => api.post('/tickets/', values),
    onError: (error) => {
      if (isValidationError(error)) {
        setFormErrors(applyServerErrors(form, error))
      }
    },
  })

  return (
    <Form {...form}>
      <form onSubmit={form.handleSubmit((values) => mutate(values))}>
        <TextField control={form.control} name="subject" label={t('tickets:subject')} />
        <SelectField
          control={form.control}
          name="priority"
          label={t('tickets:priority')}
          options={[
            { value: 'low', label: t('tickets:priorityLow') },
            { value: 'medium', label: t('tickets:priorityMedium') },
            { value: 'high', label: t('tickets:priorityHigh') },
          ]}
        />
        {formErrors.length > 0 ? (
          <Alert variant="destructive">
            <AlertDescription>
              {t('validation:form.submitFailed')}
              {formErrors.map((message, i) => (
                <p key={i}>{message}</p>
              ))}
            </AlertDescription>
          </Alert>
        ) : null}
        <Button type="submit">{t('tickets:submit')}</Button>
      </form>
    </Form>
  )
}
```

**`nullablePositiveInt(max?)`** (Story 53) is `positiveInt`'s coerced-number
validator combined with `nullableEmail`/`nullableString`'s `'' -> null`
transform — for a nullable numeric database column edited through a text
input, the same shape `OrganizationSettings.default_response_target_minutes`/
`default_resolution_target_minutes` need.

---

## 21. Authentication (JWT)

AUTH-1 (Story 08). `backend/apps/accounts/` and `frontend/src/shared/auth/`
are the only places auth logic lives — no feature reimplements login, token
storage, or a guard.

**The stock `djangorestframework-simplejwt` views need no subclassing.**
`EnvelopeJSONRenderer` wraps *any* non-`Envelope` response body in
`success_envelope(data)`. `TokenObtainPairView`/`TokenRefreshView` return a
plain `{access, refresh}` dict, so the envelope contract holds with zero
custom serializers or views — `apps/accounts/urls.py` wires the library's
views directly.

**The exception handler's error `code` comes from the exception *class*, not
the raised instance.** Verified against the real endpoints:

| Case | `code` |
|---|---|
| Wrong login credentials | `authentication_failed` |
| Missing/blank login field | `validation_error`, `fields: {"password": [...]}` |
| Bad/expired refresh token | `token_not_valid` |
| Bad/expired access token on any protected endpoint | `token_not_valid` |
| No token at all | `not_authenticated` |

A bad login and an expired session are **different, already-meaningful**
codes. The login serializer's dynamic field name (`get_user_model().USERNAME_FIELD`,
which is `"email"`) is why a missing-password validation error lands on the
frontend with field name `email`/`password` — the same strings the Zod login
schema uses — with zero name-mapping. This is § 12's snake_case-end-to-end
rule paying off a second time (the first was FORM-1's `applyServerErrors`).

**Token storage: in-memory access token, `localStorage` refresh token — a
deliberate trade-off, not an oversight.** The access token is never
persisted, so it is not readable by an XSS payload that survives a reload.
The refresh token must survive a reload to keep the user signed in, so it is
the one piece of auth state in `localStorage['supportos.refreshToken']`. An
httpOnly-cookie refresh token would be more XSS-resistant but needs no
client-side "token storage" logic at all — the intake explicitly asked for
storage and refresh *in the Axios interceptor*, which only makes sense for a
client-held token. If a future story moves to a cookie-based refresh flow,
`shared/auth/tokenStorage.ts` and `refresh.ts` are the two files to replace;
nothing else should need to change.

**Two seams on `httpClient`, not one.** `client.ts` exposes
`setAuthTokenProvider` (reads the current access token for every outgoing
request) and `setUnauthorizedHandler` (attempts one silent refresh on a
`token_not_valid` 401, retries the original request once). Both are wired in
`shared/auth/index.ts`'s side-effect import — never call `httpClient`'s
interceptors directly from a feature. The refresh-retry interceptor is
registered **before** the existing error-normalising one, so it still sees
the raw envelope's `error.code` rather than an already-wrapped
`ApiRequestError`. It exempts the refresh endpoint itself from retrying (a
`token_not_valid` from `/auth/token/refresh/` must not trigger another
refresh — that is the infinite-recursion case).

**`refreshAccessToken()` is a single-flight promise, verified necessary.**
`SIMPLE_JWT` sets `ROTATE_REFRESH_TOKENS` and `BLACKLIST_AFTER_ROTATION`
together: every successful refresh issues a new refresh token and blacklists
the one it consumed. Confirmed with real requests — reusing an
already-rotated-away refresh token fails with `token_not_valid` /
`"Token is blacklisted"`, not a generic error. If two 401s fired two
independent refresh calls, the second would present a token the first had
already spent, logging the user out for no real security reason.
`shared/auth/refresh.ts` holds one in-flight promise; every caller —
`AuthProvider`'s boot sequence and the interceptor's `unauthorizedHandler`
alike — awaits the same call.

**`LogoutView` takes no `Authorization` header on purpose.** The refresh
token in the request body *is* the credential being revoked; requiring a
still-valid access token would make logout impossible in exactly the case it
exists for (the access token already expired). It swallows `TokenError` so a
second logout call with an already-blacklisted token is a no-op 200, not an
error.

**AUTH-1 fills in *authentication* only** (does this token identify a real
user?). *Authorization* — what that user may then do — is § 22. `MeView`
sets `permission_classes = [IsAuthenticated]` explicitly, which is still how
a plain `APIView` gets protected; a **viewset** inherits its defaults from
`BaseModelViewSet` instead. See § 13 for the standing note on the global
`AllowAny` default.

**A known rough edge, accepted rather than engineered around:** a failed
login also fires the shared `MutationCache.onError` toast (the same
translated `authentication_failed` copy `LoginPage` would otherwise have had
to render itself) — this is a feature, not a duplicate, and is why
`LoginPage`'s own `onError` only handles `validation_error` field errors and
does nothing else.

**A single-use, expiring token is `is_active` plus a password-state check,
not a nonce.** `InviteConfirmSerializer` (Story 70, `SEC-5`) signs only a
user id and an expiry (`apps.accounts.tokens`, the same
`django.core.signing.dumps`/`loads(..., max_age=...)` shape
`live_chat_adapter`'s session token already established) — what makes it
single-use is requiring `not user.has_usable_password()` in `validate`,
never `is_active=False` alone. `is_active` is a general-purpose field any
`BaseModelViewSet.update` can flip for unrelated reasons; gating only on it
would let a stale-but-still-valid token reactivate an account an admin
disabled for cause after the original invite was already spent.
`has_usable_password()` only flips back to `True` through the one endpoint
that calls `set_password`, so it is the actual "has this token already been
used" signal. Reach for this pattern whenever a token grants a one-time
state transition on a field a normal admin action can also independently
flip.

**When a token's account has no natural "already used" state to gate on,
bake a digest of that state into the token's own payload instead.**
SEC-5's invite token (the entry directly above) is single-use because the
account itself transitions from pending to active. SEC-7's password-reset
token has no such transition available — the account is already active,
with a usable password, throughout. `password_fingerprint`
(`apps/accounts/tokens.py`) closes this by embedding a one-way digest of
`user.password` in the signed payload: once `set_password()` changes that
value, every previously-issued token's baked-in digest silently stops
matching, with no second stored "used" flag anywhere. The digest, never
the hash (or a slice of it) directly — `signing.dumps` signs, it does not
encrypt, so anything in the payload is visible to whoever holds the
token. This is the same technique Django's own `default_token_generator`
uses; reach for it whenever this project needs a single-use token for a
resource with no natural pending→active transition to check instead.

**A plain `APIView` that needs `request` inside its serializer must pass
`context={"request": request}` explicitly — a `ModelViewSet`'s
`get_serializer()` does this for free, a bare `APIView` does not.**
`ChangePasswordView` (Story 73, `SEC-8`) is the first plain `APIView` in
this codebase whose serializer reads `self.context["request"].user`
(`apps.portal.serializers.FeedbackSerializer.validate_ticket` did this
earlier, but only ever through a `ModelViewSet`'s auto-injected context).
Instantiating the serializer as
`Serializer(data=request.data, context={"request": request})` is the whole
fix — easy to forget once, since every existing `APIView` in
`apps/accounts/views.py` before this story happened to resolve its target
user from a signed token instead of from `request.user` directly, so
none of them needed to.

**A 2FA challenge reuses the existing signed-token idiom rather than
inventing a session-scoped "pending" state.** `MfaAwareTokenObtainPairSerializer`
(SEC-9, Story 107) returns `{mfa_required: true, mfa_token: ...}` instead of
a token pair when `user.mfa_enabled` is true — `mfa_token` is the same
`signing.dumps`/`loads(..., max_age=...)` mechanism `INVITE_SALT`/`RESET_SALT`
already established, under a third salt (`MFA_CHALLENGE_SALT`, 5 minutes).
`POST /api/auth/token/verify-mfa/` exchanges it, plus a TOTP or recovery
code, for a real token pair — no Authorization header, the same "the token
IS the credential" reasoning `LogoutView`/`PasswordResetConfirmView` already
document for their own signed tokens. The actual `authenticate()` password
check still only ever happens once, inside `TokenObtainSerializer.validate`
— this is not a second auth flow, it is the existing one with one more
step gated behind it.

**A TOTP secret is the one stored credential in this codebase that must be
decrypted again later, not just checked by comparison — this is why it is
the first to use real encryption at rest.** Every other stored secret
(`EmailProviderConfig.host_password`, `ErpConnection.auth_token`,
`ApiKey.hashed_key`) is either write-only-plaintext or a one-way digest,
because the app never needs the original value back (§36). Verifying a
live TOTP code needs the raw secret every time, so `apps.accounts.mfa`
adds `cryptography`'s `Fernet` — this codebase's first encryption
dependency, declared directly in `requirements.txt` rather than relying on
it being present transitively (it already was, via `channels`/`daphne`'s
websocket stack) — rather than stretching either existing pattern to fit.

**Org-level "require 2FA for this role" is a plain `BooleanField` directly
on `Role`, not a new list on `OrganizationSettings`.** §33 already settled
this shape question twice (ORG-1/ORG-2 promoting `departments`/`branches`
from `JSONField` lists to real models): a fact about one role belongs on
that `Role` row, not in a parallel list keyed by slug on a different
model. `Role.requires_two_factor` is enforced client-side only
(`RequireAuth` redirects an under-enrolled, role-mandated account to
`/preferences`) — a known, deliberate gap, not silently papered over. See
Story 107's `## Edge Cases`.

---

## 22. Authorization (roles & permissions)

AUTH-2 (Story 09). `backend/apps/core/permissions.py` is the vocabulary and
the one permission class; `accounts.Role` and `User.role` are the data;
`frontend/src/shared/auth/` gates the UI. Nothing else checks a role.

**The vocabulary is code; the mapping is data.** Three pieces, and where each
lives is forced, not chosen:

| Thing | Lives in | Why not the other place |
|---|---|---|
| Permission **strings** (`users.view`, …) | Code — `apps/core/permissions.py` | Code enforces a permission. A DB-defined string no view checks grants nothing — it would be a lie in the admin UI. |
| Role → permission **mapping** | Data — `Role.permissions` (JSON) | SEC-2 builds a UI over it. A Python dict has no UI. |
| User → role **assignment** | Data — `User.role` (FK) | Operational; an admin assigns it, and SEC-1 builds that screen. |

`Role.clean()` validates the mapping against the code registry, so the two
halves cannot drift.

**Views declare permissions, never roles.** A view names `customers.manage`;
only a `Role` row names permissions in bulk. This is what lets the org chart
be re-cut without editing a single view — `allowed_roles = ["admin"]` in a
view would have to change every time a role is added or renamed.

**The `permission_map` convention.** Subclass `BaseModelViewSet` and declare
action → permission:

```python
class CustomerViewSet(BaseModelViewSet):
    queryset = Customer.objects.all()
    serializer_class = CustomerSerializer
    permission_map = {
        "list": Permissions.CUSTOMERS_VIEW,
        "retrieve": Permissions.CUSTOMERS_VIEW,
        "create": Permissions.CUSTOMERS_MANAGE,
        "update": Permissions.CUSTOMERS_MANAGE,
        "partial_update": Permissions.CUSTOMERS_MANAGE,
        "destroy": Permissions.CUSTOMERS_MANAGE,
    }
```

Add the permission constants to `Permissions` in the same change as the
viewset that declares them — never a string literal at the call site. A plain
`APIView` has no `self.action`, so for those `permission_map` may be keyed by
lowercased HTTP method instead.

**An unmapped action grants; it does not deny.** An action absent from
`permission_map` falls through to `IsAuthenticated`-only. This is deliberate:
a missing entry is far more often an unfinished map than an intent to forbid,
and a silent 403 on a working endpoint is the harder bug to find. **Never
rely on omission as a deny** — write the entry.

**Superuser is the one bypass, and `/auth/me/` mirrors it.** `is_superuser`
short-circuits Django's `has_perm` to `True` for any string (verified,
including a made-up one), and `permissions_for` keeps that behaviour.
`UserSerializer.get_permissions` therefore returns the **entire registry**
for a superuser, through that same function. If it returned only
role-derived permissions, the API would permit actions the UI hides — for a
superuser, who has every permission and no role at all.

**`Role.clean()` guards forms, not programmatic writes.** Django runs
`clean()` from `full_clean()`, which `ModelForm` (and so the admin) calls. A
bare `Role.objects.create(permissions=["bogus"])` in a shell or a migration
bypasses it entirely, and DRF serializers do not call model `clean()`
either. `RoleAdminSerializer.validate_permissions` (Story 49, `SEC-2`) is
that independent check for the API path — it repeats `Role.clean()`'s
logic rather than calling it, because the two paths (admin form, API
serializer) have no shared validation entry point in DRF.

**Renaming a permission's string value is a data migration, not a
refactor.** `Role.permissions` stores the strings. Changing
`Permissions.USERS_MANAGE`'s *value* leaves every role row pointing at the
old string — which grants nothing, and then fails `clean()` on the next admin
save. Migrate the stored rows in the same change.

**Row-level rules are the named extension point.** `HasPermission`
implements `has_permission` only. The first feature that needs "an agent may
edit *their own* ticket" adds `has_object_permission` to that same class —
not a second permission class, and not a check inside a view.

**Frontend: `can()` and nothing else.** `useAuth().can(permission)`, the
`<Can permission=…>` component, and the `RequirePermission` route guard are
the only sanctioned ways to gate UI. They read `user.permissions` — the flat
list the backend already resolved — and **never** derive from `user.role`.
Hiding a control is UX; the endpoint behind it enforces the same permission
independently (§ 12).

`ApiRequestError.isForbidden` (403) is **separate from** `isAuth` (401). A
forbidden action must not send the user to the login screen: signing in again
does not grant a permission, and treating the two alike produces an infinite
login loop for an under-privileged user.

**Forward constraint: the query cache is not permission-aware.** TanStack
Query keys include neither the user nor their role, so if an account's role
— or a role's own permission set — changes while the app is open, cached
results computed under the old permissions persist until refetched — the
same class of constraint § 18 records for language. `queryClient.clear()`
on such an event is the fix; it is not built. A role's permission content
can now change through `RoleFormPage` (Story 49, `SEC-2`) with no Django
admin involved, which makes the "plus a reload" half of this constraint the
only thing still standing between an edit and a stale in-session user.

**A row that must reference one of several target types uses one nullable
FK per type, not a `GenericForeignKey`.** `AuditLog` (Story 52, `SEC-3`)
needs to point at either a `User` or a `Role`. `apps/notifications
/models.py`'s own precedent already established "a plain FK to the one
target type that exists today, not a `GenericForeignKey`" for a
single-target case (`Notification.ticket`); `AuditLog.target_user`/
`target_role` is the direct generalization of that same reasoning to two
target types — two plain, independently nullable FKs, exactly one
populated per row, rather than introducing the one `GenericForeignKey`/
`ContentType` relation this codebase has never used. A `target_label`
snapshot field (mirroring `TicketActivity`'s own from/to snapshot
rationale) keeps the row meaningful after `SET_NULL` fires on either FK.

### Keeping the mapping honest (Story 100)

Four rules, each written from a defect that actually shipped. `python
manage.py sync_role_permissions` is the command that enforces them.

**A grant migration must fail loudly when its target role is absent.**
`accounts/0006` and `0008`-`0011` all ended with:

```python
role = Role.objects.filter(slug=slug).first()
if role is None:
    continue          # BANNED
```

Every one of those five migrations reported as applied and granted nothing,
for five releases, because the slug they targeted (`admin`) did not exist in
the database they ran against — it had been renamed to `super_admin` outside
the API. **A no-op permission migration is indistinguishable from a
successful one.** Raise instead; see
`accounts/0015_repair_admin_role_grants.py`.

**A story that adds a permission string ships its grant migration in the
same change.** `ORG-1`/`ORG-2` added `departments.*` and `branches.*` to
`Permissions` and built the viewsets that enforce them, but never granted
them to any role — so on a freshly-migrated database those four permissions
were enforced-but-ungrantable, and the screens behind them were unreachable
by every account. A permission no role can hold is a permission that does
not work.

**A superuser proves nothing about role correctness.** `permissions_for`
short-circuits to `ALL_PERMISSIONS` for `is_superuser`, before it ever reads
`role`. The project owner's own account is a superuser with `role = None`,
which is exactly why six broken admin areas went unnoticed: the one person
driving the app could reach all of them. **Verify permission changes with a
role-bearing, non-superuser account.**

**`sync_role_permissions --check` is the gate.** It exits non-zero when any
of three invariants fails, and belongs in CI:

| # | Invariant | The defect it catches |
|---|---|---|
| 1 | Every role's permissions ⊆ `ALL_PERMISSIONS` | a string left behind after a permission is renamed or removed |
| 2 | The administrative role == `ALL_PERMISSIONS` | the silent no-op grant migration |
| 3 | Every permission is held by ≥ 1 role | a permission added and enforced but never granted |

`--fix` repairs invariant 2 only. Invariants 1 and 3 are reported and never
auto-repaired: an unknown string may be a typo or a rename in flight, and an
ungranted permission needs a human to decide *which* role should hold it.
Guessing either is how the mapping drifts in the first place.

---

## 23. Feature module conventions

Story 10 (Customer Profiles, `CUST-1`) is the first feature story — the first
consumer of `BaseModelViewSet`, `DataTable`, `useAppForm`, and `can()`/`<Can>`
all at once. What it established is the template every later feature copies.

**The backend shape of a feature.** One Django app under `apps/`, with:

- `models.py` — extends `apps.core.models.TimeStampedModel`.
- `serializers.py` — extends `apps.core.serializers.BaseModelSerializer`, with
  `class Meta(BaseModelSerializer.Meta)` (inheriting, not just naming the same
  class) so `read_only_fields` applies.
- `views.py` — extends `apps.core.views.BaseModelViewSet` with a **fully
  populated** `permission_map` (§ 22 — every action mapped, because an
  unmapped one grants rather than denies).
- `urls.py` — a `DefaultRouter` (or `SimpleRouter`, if the router's
  auto-generated API-root view at the include's prefix is unwanted — see the
  worked example below).
- One `include()` line in `config/api_urls.py`, added **above** the catch-all
  `re_path`, which must stay last.

**A feature story grants its own permissions.** The permission constants go
into `apps/core/permissions.py` in the same change as the viewset that
declares them (§ 22). The role grant itself is a **cross-app data migration
in the feature app**, depending on `("accounts", "0003_seed_roles")`:

```python
# apps/<feature>/migrations/000N_grant_<feature>_permissions.py
dependencies = [
    ("<feature>", "000{N-1}_initial"),
    ("accounts", "0003_seed_roles"),
]
```

It grants by **set union**, never assignment — `role.permissions =
sorted(set(role.permissions) | set(new_permissions))` — so it never wipes a
grant made by another story, and is safe to re-run. The reverse migration
uses set *difference* for the same reason. Story 10's
`apps/customers/migrations/0002_grant_customer_permissions.py` is the worked
example.

**`ordering_fields`/`search_fields` are the contract with `DataTable`.** A
`ColumnDef.id` marked `sortable: true` must appear in the viewset's
`ordering_fields`, or the header toggles `aria-sort` and changes nothing else
— `OrderingFilter` silently drops a field it does not recognise. The same
`id` is also what a column's data comes from, so it must match the
serializer's field name exactly. `search_fields` needs no such pairing — it
is server-only, reached through `DataTable`'s consumer wiring a `search` query
param, not through `ColumnDef`.

**The frontend shape of a feature**, under `src/features/<feature>/`:

- `types/` — the TypeScript mirror of the serializer (§ 12, `snake_case`
  verbatim), plus a `<Thing>Input` write shape when create/update differ from
  the read shape (e.g. omitting server-managed fields).
- `api/` — one file per network call (`get<Thing>.ts`, `create<Thing>.ts`, …),
  `<feature>Keys.ts` (`featureKey('feature')`), a `use<Thing>`/`use<Things>`
  query hook per resource, and `use<Thing>Mutations.ts` for the create/update
  /delete hooks.
- `components/` — the screens.
- `locales/{en,ar}.json` — registered in `shared/i18n/resources.ts`.

**Every mutation invalidates its feature's whole key prefix**
(`<feature>Keys.all`), never an individual page or detail key. A create
changes which rows land on which page, an edit can change sort position, and
a delete shifts every later page — invalidating one cache entry would leave
the others stale.

**PATCH for edits, not PUT.** Verified against this project's DRF: a PUT
request with an optional field absent still drops that key from
`validated_data` entirely (DRF does not treat a full-update method as
"clear what's missing"), so the instance keeps its old value regardless of
HTTP semantics. PATCH's "only what I sent" contract is what an edit form
actually means, and it is what a client must use consistently: a field is
*cleared* by sending its value explicitly (`null` for a nullable field, `''`
for a blank-but-non-nullable one), never by omitting the key.

**`nullableString`/`nullableEmail` vs `optionalString`/`optionalEmail`**
(`shared/validation/schemas.ts`). Both pairs transform an empty input, but to
different things, and the difference is not stylistic:

| Helper | Transforms `''` to | Use for |
|---|---|---|
| `optionalString` / `optionalEmail` | `undefined` | A genuinely absent value — a query parameter, a field that should not appear in the payload at all when empty. |
| `nullableString` / `nullableEmail` | `null` | A **nullable database column**, so a cleared field round-trips as an explicit `null` the server can act on. |

The reason the `null`-transforming pair exists at all: `JSON.stringify` drops
an `undefined`-valued key, and DRF treats an absent key as "leave unchanged"
on a PATCH. So `optionalEmail()` on a nullable column would make a user who
clears the field silently fail to clear it — the value round-trips as if
nothing changed. Reach for `nullableString`/`nullableEmail` whenever the
column is `null=True`; keep `optionalString`/`optionalEmail` for a field that
is truly meant to be absent rather than explicitly empty.

**A unique nullable column needs blank→`NULL` normalisation in two places,**
because the two write paths do not share validation:

1. The model's `clean()` — guards the admin and any `full_clean()` caller.
2. The serializer (a `validate_<field>` method, or an equivalent) — guards
   the API path, because **DRF does not call model `clean()`.**

Verified against this project's Postgres 17: a unique column accepts any
number of `NULL`s but rejects a second `''` — `''` collides with itself,
`NULL` does not. Skipping either normalisation point leaves the path it does
not cover exposed to an `IntegrityError` (an unhandled 500) the moment a
second record is saved with that field left empty.

**One more verified trap this story surfaced:** if the unique field must also
be **explicitly declared** on the serializer (as it is here, to add
`allow_blank`/`allow_null`), `ModelSerializer` does **not** auto-derive a
`UniqueValidator` from the model's `unique=True` for it — that derivation
only applies to a field the serializer generates on its own. An explicitly
declared unique field needs its own `validators=[UniqueValidator(queryset=...)]`,
or a duplicate value also reaches the database's constraint directly as an
unhandled `IntegrityError` rather than a `validation_error`. This is safe to
combine with `allow_null=True`: DRF's own empty-value handling skips a
field's validators entirely when the incoming value is explicit `None`, so
two `null` writes never collide against each other through the validator
either — matching Postgres's own behaviour. See
`apps/customers/serializers.py::CustomerSerializer.email` for the worked
example.

**A child resource of an existing feature reuses the parent's permissions.**
A sub-resource that is part of an existing domain record (e.g. `ContactDetail`
on `Customer`) does not get its own permission constants — it is gated by the
parent feature's existing `permission_map` values. Add a new constant only
when the sub-resource is a genuinely separate authorization concern.

**A non-paginated, per-parent child resource may invalidate its own scoped
query key instead of the whole feature prefix**, when a write cannot affect a
sibling query's result set (no shared pagination, no shared sort). State the
reasoning at the call site — this is a documented exception, not the default;
the default (this section's own rule above) is still prefix-wide invalidation
for anything paginated or sorted.
`frontend/src/features/customers/api/useContactDetailMutations.ts` (Story 11,
`CUST-2`) is the worked example.

**A `PROTECT` foreign key needs the shared exception handler to translate
`ProtectedError`.** `apps/core/exceptions.py::_to_drf_exception` only
translates the exception types it explicitly lists; a new `on_delete=PROTECT`
relation is not automatically safe. Verify the referenced model's `destroy`
endpoint against a row that is actually protected before shipping the new FK
— `Ticket.customer` (Story 12, `TKT-1`) is the worked example, verified live
against `accounts.Role`/`User.role`, the only precedent before it.

**A resource that is read as a whole (not worked from row to row) splits
into two independently permission-gated route trees, not one gated-button
list page.** `FAQ` (Story 39, `KB-1`) is the first such case: `FaqBrowsePage`
(`knowledge_base.view`) is a fixed, unpaginated read of every row, and
`FaqListPage`/`FaqFormPage` (`knowledge_base.manage`, under
`/knowledge-base/manage`) are the `DataTable`-based CRUD surface every prior
feature already has. Contrast `CustomerListPage`/`TaskListPage`, where the
same table serves both browsing and management because the resource is
genuinely worked row by row — the deciding factor is whether a table is the
right reading shape at all, not whether the resource has an admin/non-admin
split in permissions (every feature already has that).

**A resource with its own draft/published split filters `get_queryset` by
whether the caller holds the resource's `manage` permission, not by action
name.** `ArticleViewSet.get_queryset` (Story 40, `KB-2`) returns every row
when the caller holds `knowledge_base.manage`, and only `status="published"`
rows otherwise — for `list` **and** `retrieve` alike, so a view-only caller
gets a 404, not a 403, on a draft's direct id (its existence is not
confirmed to someone who cannot manage it). Contrast
`TicketViewSet.get_queryset`'s `category`/`priority`/`assigned_to_me`
filters (Story 18/22/29), which narrow the same visible set identically for
every caller — this is the project's first queryset filter keyed on the
caller's permission level rather than a request parameter.

**A bilingual CONTENT field is returned in both languages by the API, and
the reader picks which one to render by `i18n.language` client-side, never
by `Accept-Language` server-side content negotiation.** `Article`
(Story 40, `KB-2`) is the first model with genuinely translated content —
every prior model's content is single-language, with only its surrounding
UI chrome translated (`Customer.name` is never translated). Returning both
`title_en`/`title_ar` and `body_en`/`body_ar` together means an editor sees
and edits both language sections on one screen regardless of their own UI
language, and a reader's language switch re-renders instantly with no
refetch.

**Two features may independently call the same backend endpoint.** This is
not the code duplication `frontend/src/README.md`'s "a feature never imports
from another feature" rule targets — each feature's `api/` layer owns exactly
the shape it needs (a full CRUD+search client in `customers`, a minimal
id+name selector in `tickets`), and the alternative (importing across
`features/`) is what `no-restricted-imports` forbids outright.
`frontend/src/features/tickets/api/getCustomerOptions.ts` is the worked
example.

**A component "shared across channels/variants" is not automatically a
`shared/` component.** When every real consumer of a "reusable" UI piece
renders in the same place (one parent screen), the reuse axis is *handling
every variant uniformly*, not *appearing on multiple screens* — it belongs in
the feature that owns that screen, not in `src/shared/ui/` or a separate
feature folder built to match a domain name.
`frontend/src/features/tickets/components/TicketConversation.tsx` (Story 13,
`COMM-0`) is the worked example: it renders every message channel identically
and lives in `tickets` (the one screen that ever shows it), not in a
`features/communications/` folder that would have needed to import it back
out — which `no-restricted-imports` forbids.

**A channel/provider dispatch table is a decorator plus a dict, wired
through `AppConfig.ready()` — not more.**
`apps/communications/adapters.py::register_adapter`/`get_adapter` (Story 14,
`COMM-1`) is the worked example: a concrete `ChannelAdapter` subclass
registers itself with `@register_adapter` at import time, and
`CommunicationsConfig.ready()` is what guarantees that import actually
happens once per process. **A dispatched side effect (an outbound send) must
not fail the request that triggered it** — `MessageViewSet.perform_create`
catches and logs any `adapter.send()` failure; the record it was attached to
is already committed. The next channel story (COMM-2, WhatsApp) copies both
shapes.

**A channel adapter's identity/routing key is whatever the channel actually
offers — not a pattern copied from the previous channel.** Email routes by a
`+<ticket id>` address tag; WhatsApp has no such per-conversation address, so
it routes by matching the sender's number against `ContactDetail(channel=...)`
(`CUST-2`, Story 11) and continuing the customer's most recent non-closed
ticket. **When a third-party protocol dictates a response shape this API's
envelope cannot express** (Meta's plain-text webhook-verification echo),
scope the exception to exactly the one view/method that needs it —
`PlainTextRenderer` (`apps/core/renderers.py`) plus a `get_renderers()`
override, not a global renderer change. **An outbound integration with no
safe "don't actually send" backend to swap** (unlike Django's mail backends)
should refuse to run at all against unconfigured settings, in every
environment, rather than attempting a live call with blank credentials.
`apps/communications/whatsapp_adapter.py` (Story 15, `COMM-2`) is the worked
example for all three.

**Real-time delivery for a channel with no external provider is a WebSocket
broadcast to a per-record channel-layer group, not a third-party API call.**
`LiveChatAdapter.send()` (Story 16, `COMM-3`) bridges from synchronous view
code to the (async) channel layer via `asgiref.sync.async_to_sync`;
`TicketChatConsumer` (async) bridges back to synchronous Django ORM/adapter
calls via `channels.db.database_sync_to_async` — both are Channels' own
documented utilities for this exact shape, not project inventions. **A
browser cannot set custom headers on a WebSocket handshake** — auth (a JWT,
or an anonymous signed session token) travels in the query string on every
WS connection this project makes, and a connection should be
**permission-checked, not just authenticated**, whenever the equivalent REST
endpoint would be. **A signed, unpersisted session token**
(`django.core.signing`, no new model field) is the pattern for a lightweight
anonymous identity that does not warrant a real customer account — reach for
it before adding a session/account model for a single-conversation
credential.

**A viewset with no create/update/destroy surface and no domain permission to
gate does not extend `BaseModelViewSet`.** `apps/notifications/views.py::NotificationViewSet`
(Story 31, `SLA-4`) is the first such case: `Notification` rows are created
only by `apps.notifications.services.notify`, and every action is scoped to
`request.user`'s own rows rather than a `tickets.manage`-style permission
string. It extends `mixins.ListModelMixin, mixins.RetrieveModelMixin,
viewsets.GenericViewSet` directly, with `permission_classes = [IsAuthenticated]`
and no `permission_map`. Reach for this shape only when both conditions
hold — a domain resource that is merely read-only but still permission-gated
would still extend `BaseModelViewSet` with a `permission_map` naming only its
`view` permission.

**A webhook signature scheme can depend on more than the raw request body —
verify what it actually signs before choosing how to check it.** Meta's
`X-Hub-Signature-256` (Story 15, `COMM-2`) is computed over raw request
bytes alone; Twilio's `X-Twilio-Signature` (Story 17, `COMM-4`) is computed
over the exact webhook URL plus every decoded POST parameter. When a
provider's algorithm depends on the URL, pin it as an explicit setting
(`SMS_WEBHOOK_URL`) rather than reconstructing it from the request — a
reverse proxy or tunnel rewriting `Host` would otherwise break verification
silently, not loudly. **A webhook's payload shape (JSON vs. form-encoded)
determines its `parser_classes`, and this project's `DEFAULT_PARSER_CLASSES`
is JSON-only** (`config/settings/base.py`) — a view receiving a
form-encoded provider payload must declare `parser_classes = [FormParser]`
itself, scoped to that one view, the same way `PlainTextRenderer` (Story 15)
was scoped to one view's `GET` method rather than changing a global default.

**A foreign key has three deletion behaviours in this project, chosen by
what the relationship means, not by default.** `PROTECT` (`Ticket.customer`,
Story 12) is for an identity relationship that must not silently vanish.
`CASCADE` (`Message.ticket`, Story 13) is for a child with no existence
independent of its parent. `SET_NULL` (`Ticket.category`, Story 18, `TKT-2`)
is for a classification tag: deleting the referenced row should leave the
referencing row intact, just unset — the FK must be `null=True` for Django
to allow `SET_NULL`, making this the project's first nullable foreign key.

**An optional equality filter on a list endpoint is validated when present,
never required.** Contrast `MessageViewSet`/`ContactDetailViewSet`'s
`ticket`/`customer` query params (Story 13/11), which raise
`ValidationError` when *absent* because the endpoint is meaningless without
them. `TicketViewSet`'s `category`/`priority` filters (Story 18) do the
opposite: silently skip filtering when the param is absent, but still raise
`ValidationError` for a present-but-malformed value (a non-numeric
`category`, an unrecognised `priority`) — a list screen's default
(unfiltered) view must keep working, but garbage input should not silently
do nothing either.

**A channel with no outbound delivery mechanism still implements
`ChannelAdapter.send()` — by always raising.** `WebFormAdapter.send()`
(Story 19, `COMM-5`) unconditionally raises `ValueError`, caught and logged
by `MessageViewSet.perform_create`'s existing `except Exception` (Story 14)
— the same "record now, deliver best-effort" contract every channel's own
failure path already has, not a special case. **A resource that must stay
permission-gated for authenticated use can still have a separate, narrower
public view over the same model** — `WebFormCategoriesView` (Story 19)
reads the same `Category` table `CategoryViewSet` (Story 18) does, without
loosening `CategoryViewSet`'s own `tickets.view` gate; add a second,
explicitly public view rather than widen an existing authenticated one.
**Not every channel routes a new inbound message into the customer's most
recent open ticket** — that rule (Email/WhatsApp/SMS/Live Chat) assumes an
ongoing conversation; a one-shot structured intake (a web form) should
always start a new ticket instead, because there is no "conversation" for a
later message to continue.

**An aggregate read that spans several apps belongs to the app that owns
the *question*, not the apps that own the rows.** `apps/customers/timeline.py`
(Story 20, `CUST-3`) reads `Ticket` and `Message` to answer "what has
happened with this customer," because `backend/apps/README.md`'s
app-purpose table assigns interaction history to `customers`. That is a
reverse-direction cross-app import (the models dependency runs
`customers ← tickets ← communications`) and it is safe **as long as no
model imports across apps** — Django loads every model before any view or
helper module, so only a model-level cycle can actually deadlock. **A
custom `@action` on a `ModelViewSet` is gated by its own method name in
`permission_map`** (`"timeline": …`), and — like any unmapped action — a
missing entry falls through to authenticated-only rather than denying, so
the entry is load-bearing. **When an aggregate's payload contains data
another domain's endpoints gate separately, check that permission
explicitly too** (`permissions_for(request.user)`), rather than letting the
aggregate become a way around it. **A heterogeneous feed is a `<ul>`, not a
`DataTable`** — § 19's rule covers homogeneous, server-sortable, paginated
rows; a merged timeline of two record shapes has none of those properties,
and its React key must combine the discriminator with the id
(`${kind}-${id}`), because ids are only unique within a kind.

**A file is served through a permission-gated action, never through
Django's own static/media URL mechanism.** `AttachmentViewSet.download`
(Story 21, `CUST-4`) returns a `FileResponse`, which bypasses
`EnvelopeJSONRenderer` entirely because it is not a
`rest_framework.response.Response` — verified against
`APIView.finalize_response`, which only attaches the envelope machinery to
that one class. No `MEDIA_URL` is configured at all, because Django's own
media serving carries no permission check. **A `FileField` is marked
`write_only` on its serializer** so DRF never calls `.url` (which would
raise without `MEDIA_URL`) — the read side exposes `original_filename`/
`size` instead. **A `FormData` upload through the project's shared
`httpClient` needs an explicit `Content-Type: undefined` override**,
because the instance's default JSON header would otherwise make axios
`JSON.stringify` the `FormData` instead of sending it as multipart —
verified against the installed axios's `transformRequest`. **An
authenticated file download cannot be a plain `<a href>` link** (a browser
navigation carries no `Authorization` header); fetch it as a blob through
the same authenticated `httpClient` instead, then trigger the save via a
temporary `URL.createObjectURL` link. **A verb a resource does not support
is removed from `http_method_names`**, not merely left out of
`permission_map` — an unmapped action is authenticated-only, not
forbidden, so narrowing the allowed HTTP methods is the only way to make an
unsupported verb a clean `405`.

**A field that has its own action endpoint should be read-only on the
resource's serializer.** `Ticket.assigned_agent` (Story 22, `TKT-3`) is
written only by `POST /tickets/<id>/assign/`; keeping it in
`read_only_fields` means a full-payload `PATCH` from the edit form can
never clear it as a side effect — a real bug class, since this project's
forms send every field they own on every save. **A `detail=False` `@action`
does not shadow the detail route**: DRF registers dynamic list routes
before `^{prefix}/{lookup}/` (`rest_framework/routers.py`), so
`/api/tickets/assignable-agents/` resolves to the action even though
`{lookup}` would match that literal string — ordering, not the regex, is
what makes it safe. **When a picker offers a restricted set of values, the
write endpoint must validate against the same queryset the picker reads**
— `apps/tickets/assignment.py::assignable_agents()` backs both, so a
hand-crafted request cannot assign a ticket to a user the picker would
never have offered. **A single control that fires a mutation immediately
is not a form** — § 20's `useAppForm`-is-the-only-entry-point rule governs
forms with a submit step and client-side validation; a lone `Select` that
saves on change uses the plain primitive, like `LanguageSwitcher` and the
ticket list's filters.

**A finite set of valid state changes is a hand-authored graph in a small
helper module, not inline `if`-chains in the view.**
`apps/tickets/status.py::VALID_TRANSITIONS`/`is_valid_transition` (Story 23,
`TKT-4`) is the same shape `apps/tickets/assignment.py` (Story 22)
established for a different business rule: a pure function, imported by the
viewset, easy to unit-reason-about and to extend without touching
request-handling code. **Re-stating a resource's current state is rejected,
not treated as a no-op success** — `TicketViewSet.set_status`/`escalate`
both compare the requested value against the current one before consulting
the transition graph, so "change status to what it already is" and
"escalate an already-escalated ticket" are both a `400`, consistent with
this project's preference for explicit, intentional writes over
silently-accepted no-ops. **A frontend picker that mirrors a backend
validation graph duplicates it as a plain data structure with a comment
pointing at the source of truth** — `TICKET_STATUS_TRANSITIONS`
(`frontend/src/features/tickets/types/ticket.ts`) is the same duplication
`TICKET_STATUSES` already makes of `Ticket.Status` (§3), narrowing what the
UI *offers* while the backend remains the sole enforcer of what it
*accepts*.

**A system-written audit log snapshots values at write time; it does not
store a live reference that can later resolve to nothing.** `TicketActivity`
(Story 24, `TKT-5`) is the project's first model written only as a side
effect of other actions (`assign`/`set_status`), never through its own
request body. Its `actor` follows the established `SET_NULL` pattern for a
reference that must survive account deletion, but its `from_value`/
`to_value` go further: an assignment change stores a **name snapshot**
(`User.get_full_name()` at write time), not a user id, so the log stays
correct even after the referenced user is gone — the standard audit-log
tradeoff of a point-in-time copy over a live foreign key. A status change,
by contrast, stores the **raw enum value** (not a snapshot label), because
status values are a fixed set the frontend must still translate via the
same `statuses.<value>` i18n keys every other status display uses — a
deliberate asymmetry driven by whether the underlying value can change
independently of the log entry. **Not every logged event needs a new
table.** `apps/tickets/history.py::build_history` extends
`apps/customers/timeline.py::build_timeline`'s (Story 20)
merge-two-querysets-into-one-feed shape to a second worked example: replies
are represented by the *existing* `Message` rows, merged into the read
rather than duplicated into the new `TicketActivity` table, because
`Message` already is the record of them and a second copy would just be a
drift risk. **A same-feature derived view invalidated by prefix gets the
update for free; a scoped-invalidation mutation does not.**
`useTicketHistory`'s query key is a child of `ticketKeys.all`, so
`useAssignTicket`/`useSetTicketStatus`'s existing prefix-wide invalidation
already refreshes it with no new code — but `useCreateMessage`'s narrower,
*scoped* invalidation (Story 11's documented exception) does not reach a
sibling key by construction, and had to be extended explicitly. When adding
a new aggregate view, check whether every mutation that should refresh it
uses prefix-wide or scoped invalidation before assuming it already works.

**A payload that spans two permission domains checks both explicitly,
regardless of which domain's action it hangs off.** `TicketViewSet.context`
(Story 26, `AGENT-2`) is the mirror image of `CustomerViewSet.timeline`
(Story 20, `CUST-3`): where `timeline` is a `customers.view`-gated action
whose payload reaches into `tickets`-gated data and re-checks `tickets.view`,
`context` is a `tickets.view`-gated action whose payload includes a full
customer record and re-checks `customers.view`. The direction of the anchor
(which app the `@action` lives in) is decided by what the endpoint is
*about* — here, "context for the ticket currently open" — not by which
domain's data makes up more of the response. **Reusing another domain's own
serializer for a sub-payload, not just its models, avoids a second
declaration of the same shape.** `apps/tickets/context.py::build_ticket_context`
calls `apps.customers.serializers.CustomerSerializer(customer).data`
directly rather than hand-assembling a dict of customer fields — the same
"reuse the target domain's already-built piece" instinct
`apps/customers/timeline.py` (Story 20) established for `Ticket`/`Message`,
extended here to a serializer, not just querysets. **The project's first
two-column/side-panel page layout uses the same arbitrary-value
`grid-cols-[...]` syntax already present in this codebase's own UI
primitives** (`alert.tsx`, `card.tsx`) — `TicketDetailPage`'s new grid is
that idiom's first use at the page level, not a new pattern.

**A derived status with a real deadline is computed fresh on every read,
never cached or persisted, when nothing forces otherwise.**
`apps/sla/policy.py::compute_sla_status` (Story 28, `SLA-1`) derives a
ticket's response/resolution due times and `met`/`breached`/`pending`
status entirely from `SLAPolicy` + `Ticket.created_at` + `Message`/
`TicketActivity` — no new `Ticket` field, no migration, no state that can
drift from reality. A "pending" ticket becomes "breached" automatically
the moment real time passes its deadline, with nothing to update — the
same reason this project prefers computing over caching wherever the read
is cheap enough to redo. **The event log is the source of truth for "when
did X first happen," never a row's own `updated_at`.**
`compute_sla_status` reads the first matching `TicketActivity` row for
"when was this ticket resolved," not `Ticket.updated_at`, which bumps on
any later save (an escalate call, a reassignment) and would silently
misreport how long resolution actually took — the same lesson
`TicketActivity` (Story 24) exists to generalize. **A reverse cross-app
import can run in either direction depending on which side owns the
*question*.** `apps/tickets/context.py` (Story 26) reads *from*
`apps.customers` because "what is this ticket's customer context" is
framed from the ticket; `apps/sla/policy.py` is read *by*
`apps.tickets.views` because "what is this ticket's SLA status" is framed
from SLA policy data. Both are safe for the identical reason: neither
app's `models.py` imports back into the other, so only a one-way
leaf-module dependency exists either way.

**A helper shared by a manual write path and an automatic one lives where
the manual path already put it, not duplicated for the automatic
caller.** `apps/tickets/assignment.py::apply_assignment` (Story 29,
`SLA-2`) is called by both `TicketViewSet.assign` (a human `actor`) and
`auto_assign_ticket` (`actor=None`, a system action) — one function
decides what "an assignment changed" means and how it gets logged, so a
future third caller inherits the same correctness rather than a fresh
chance to drift. **A background task fired from inside a request's
`perform_create`/`perform_update` must not be allowed to fail that
request.** `TicketViewSet.perform_create`'s `try/except Exception:
logger.exception(...)` around `auto_assign_ticket.delay(...)` is the same
shape `MessageViewSet.perform_create` (Story 14) already established for
`adapter.send()` — the record the request is about is already committed,
so a failure in triggering the *next* step (an outbound send, a queued
task) is logged, never returned as an error to a caller who already got
what they asked for. **`apps/<app>/tasks.py` (§24) is where a story's
first real `@shared_task` goes, with no additional Celery wiring** —
`app.autodiscover_tasks()` (Story 27, `config/celery.py`) already finds it
by that filename inside any installed app.

**A second owner-scoped personal resource, this time full CRUD.**
`TaskViewSet` (Story 32, `AGENT-3`) follows `NotificationViewSet`'s (Story
31, `SLA-4`) precedent of skipping `BaseModelViewSet`/`permission_map`
entirely for a resource with no domain-permission concept — every action
is scoped to `request.user`'s own rows via `get_queryset`, and
`IsAuthenticated` alone is the gate. Unlike `NotificationViewSet`
(list/retrieve-only, system-managed rows), `TaskViewSet` is a full
`viewsets.ModelViewSet`, so its serializer must mark any action-only field
(`completed_at`, mirroring `Notification.read_at`) explicitly
`read_only_fields` — `NotificationViewSet` never needed this because it
has no create/update action to bypass through in the first place.
**`TextField` (`shared/ui/form/TextField.tsx`) now also accepts
`type="datetime-local"`** — the first form field in this project editing a
date+time value; converting between its timezone-less input value and the
server's UTC-offset ISO string uses the browser's own `Date` local
getters/`toISOString()`, no new dependency.

**A shared resource in an owner-scoped app follows the shape of what it
*is*, not the shape of its siblings.** `QuickReply` (Story 33, `AGENT-4`)
lives in `apps.agents` beside `Task` (Story 32) and `Notification` lives in
`apps.notifications`, but unlike either — both owner-scoped, no domain
permission — `QuickReplyViewSet` extends `BaseModelViewSet` and reuses
`Permissions.TICKETS_VIEW`/`TICKETS_MANAGE`, the same call `CategoryViewSet`
already made for the identical reason: a quick reply is part of the
ticket-reply permission domain, not a separate one, regardless of which
Python app its model lives in. **`QuickReplyAdmin` is this project's fifth
"admin is the de facto config UI, no frontend CRUD screen" resource**, after
`Category`, `SLAPolicy`, `AssignmentRule`, and `EscalationRule` — the
pattern now clearly established: a shared, infrequently-edited
configuration list gets a real API (for whatever needs to read it) plus an
editable admin, not a bespoke management page, until a story's own intake
actually asks for one.

**A third resource in `apps.agents`, and the third instance of the
admin-editability split.** `InternalNote` (Story 34, `AGENT-5`) reuses
`apps.customers.models.Note`'s exact shape (Story 21) one app over — a
ticket-scoped, author-tracked, editable free-text note — plus an explicit
`mentioned_users` set, validated against the same `assignable_agents()`
queryset `TicketViewSet.assign` already validates assignment against, so a
hand-crafted request cannot notify an agent ineligible to work the ticket.
`InternalNoteAdmin` follows `TaskAdmin`'s (Story 32) "read-only ops
visibility" precedent, not `NoteAdmin`'s (Story 21, predates the
distinction) fully-editable one — the deciding factor is always whether the
resource has a real frontend management surface (it does,
`InternalNotesSection`), not whether it is shaped like a note. **A
`notify(...)` call's `body` argument must fit `Notification.body`'s
`CharField(max_length=500)`** — every prior caller passed an already-bounded
string (`Ticket.subject`); `InternalNote.body` is the first unconstrained
source text, truncated (`note.body[:500]`) at the call site before reaching
`notify(...)`, since a longer string would fail as a database-level
constraint violation on Postgres, not just a Python-level oversight.

**A resource that must never be hard-deleted removes the HTTP verb, not
just the permission mapping.** `UserViewSet` (Story 48, `SEC-1`) is the
first case: `accounts.User` is referenced by `agents.Task.owner` and
`notifications.Notification.recipient` with `on_delete=CASCADE`, so a
`DELETE` would silently remove a person's tasks and notifications.
Per this section's own grant-on-omission rule, leaving `destroy` out of
`permission_map` is not a deny — it falls through to authenticated-only.
Dropping `"delete"` from the viewset's `http_method_names` is what actually
disables the verb: Django's `View.dispatch()` gates on
`request.method.lower() in self.http_method_names` before a DRF viewset's
router-bound `self.delete` (set by `ViewSetMixin.as_view()`) is ever
reached, so the request 405s as `method_not_allowed` with no new error
code. Reach for this whenever a resource has a `CASCADE`-related model that
must survive a parent record's removal and there is no row-level rule
(`has_object_permission`) that could express "always deny" instead.

**A queryset filter can exclude rows that belong to a different feature's
identity, keyed on the owning relation, not on a denormalised field.**
`UserViewSet.get_queryset` (Story 48, `SEC-1`) excludes portal-customer
accounts from the staff user-admin screen by filtering on
`customer_profile__isnull=True` (the `Customer.user` OneToOne's reverse
accessor) rather than on `role.slug == "customer"` — the FK relation is
the actual grant of portal access; a role is just data an admin could
otherwise leave stale. The same reasoning as `ArticleViewSet.get_queryset`
filtering by the caller's *own* permission (Story 40) rather than by
action name: filter on the fact that is actually true, not on a proxy for it.

**A multi-select checklist bound to a `string[]` field composes `FormField`
directly, not a new shared field component, when there is exactly one
consumer.** `RoleFormPage`'s permissions checklist (Story 49, `SEC-2`) binds
many `Checkbox` primitives to one `permissions: string[]` value via
`FormField`'s own render prop — the same primitive `CheckboxField` (a
single-boolean field) is built on, generalised for a list instead of
extracted into a new `shared/ui/form/CheckboxListField.tsx`. The options
themselves are grouped by a computed transform of a code identifier (the
permission string's area prefix), not translated copy — the same category
of content `RoleListPage`'s `slug` column already shows untranslated.

**A "there is exactly one row" configuration table is a small, self-built
singleton, not a new dependency.** `OrganizationSettings` (Story 53,
`SEC-4`) is this codebase's first singleton model: `save()` forces `pk=1`,
`delete()` is a no-op, and `load()` (`get_or_create(pk=1)`) is the only
supported way to get an instance. No third-party package (e.g.
`django-solo`) is installed for this — the pattern is small enough to
own directly, the same "no new dependency" bias every other story in this
project has followed. `MeView` (Story 08) is the closer-to-hand precedent
for the *API* shape this pairs with: a `GET`/`PATCH` endpoint with no id
in the URL, because there is exactly one relevant object.

**A verb removed for a CASCADE risk (§ 23's own earlier entry) can be
reinstated once the risk is actually guarded, not just documented.**
`UserViewSet` (Story 48, `SEC-1`) dropped `"delete"` from
`http_method_names` because a hard delete would have silently cascaded
onto `agents.Task.owner`. Story 71 (`SEC-6`) adds `"delete"` back — not by
loosening anything, but by making the one still-real CASCADE risk
(`Task`, which cannot be reassigned — its own model docstring rules that
out) a `ValidationError` raised *before* `super().destroy()` runs, the
same PROTECT-style guard `RoleViewSet.destroy` already uses for a system
role. The other CASCADE relationship, `notifications.Notification.recipient`,
needed no guard at all — its own docstring already treats "deleted with
its recipient" as correct, not a hazard. The lesson: a removed HTTP verb
is not necessarily a permanent decision — re-examine it once a real guard
exists, rather than treating "we once removed this verb" as settled.

**A bulk endpoint reuses the single-item's validation/logging helper and
reports one result per row — it never gets its own looser rule, and it
never fails the whole request for one bad row.**
`TicketViewSet.bulk_assign`/`bulk_status` (Story 106, `TKT-7`) call the
exact same `apply_assignment`/`apply_status_change` functions
`assign`/`set_status` call — a bulk caller and a single-ticket caller can
never drift, because there is only one function that decides whether a
change is legal and only one call site that writes a `TicketActivity`
row. `apps/tickets/bulk.py::parse_ticket_ids` validates the REQUEST's
shape up front (empty/malformed/oversized `ticket_ids` is one 400), but a
per-ticket problem — not found, an illegal transition for that ticket's
current state, ... — is caught per iteration and turned into `{"id",
"ok": False, "error"}`, never an exception that aborts the rows after it.
**A field with no single-ticket action gets no bulk-only escalation,
either.** `bulk_priority` writes no `TicketActivity` row and rejects no
no-op, because the single-ticket priority edit (a plain writable
serializer field, not an action) does neither — a bulk endpoint's job is
to apply the SAME rule N times, not to invent a stricter one because it
now touches more rows at once.

**A resource can be both owned and shareable at once — pick which half of
the shape each rule follows, don't force one shape whole.** `SavedView`
(Story 108, `TKT-8`) is the first resource in this project combining
`Category`/`QuickReply`'s shape (a boolean makes a row visible to everyone
holding the domain's `.view` permission) with `Task`'s shape (owned,
personally writable) — read visibility follows the former
(`Q(owner=user) | Q(is_shared=True)`), write access follows a THIRD rule
neither sibling needed: **owner or a `.manage` holder**, checked
explicitly inside `perform_update`/`perform_destroy` rather than through
`HasPermission.has_object_permission` (which stays the
portal-customer-only extension point it already was) or through
`permission_map` (which can only ever gate by action name, never by row).
"A manager" is never a role-slug check — it is "holds the domain's
`.manage` permission," the same stand-in
`apps.tickets.assignment.assignable_agents()` already established,
because role permissions are data (`Role.permissions`, a `JSONField`
editable through `SEC-2`'s UI), not code.

**A model that reuses another app's search technology is not the same as
calling that app's function.** TKT-9 (Story 109) needed KB-3's
"text-similarity retrieval" for duplicate ticket detection, but
`apps.knowledge_base.search::search_knowledge_base` is model-locked to
`FAQ`/`Article` — it cannot be called for `Ticket`. The reusable unit was
the *mechanism* (Postgres `SearchVector`/`SearchQuery`/`SearchRank`), not
the function: `apps/tickets/duplicates.py::find_duplicate_candidates` is a
new, small function following the identical annotate/order-by/slice
shape, not a fork of a copy-pasted one and not a literal cross-app call.
When an intake says "reuse X's retrieval/search/pattern," check whether
X's actual code is a general-purpose function (call it) or a
domain-specific one built for a different model (reuse its *technique* in
a new, model-appropriate function, and say so explicitly in the plan).
**A self-referential pointer field left by an irreversible-in-the-UI-but-
auditable action is `SET_NULL`, not `PROTECT` or `CASCADE`.**
`Ticket.merged_into` (TKT-9) never blocks deleting the target it points to
and never cascades a delete backward onto the source — the same reasoning
every other "this reference should not force or block a delete" field in
this app already uses (`Ticket.category`, `Ticket.assigned_agent`),
applied for the first time to a self-referential FK.

---

## 24. Background jobs (Celery, SLA-0)

The shared Celery application instance is `config/celery.py` — project
bootstrapping/wiring, the same category as `config/asgi.py`/`wsgi.py`, not a
domain app (`apps/README.md`'s "needed by two or more apps → `apps/core`"
rule governs business logic, not process wiring). A feature story that
needs a background task adds `apps/<app>/tasks.py` with `@shared_task`
functions — `app.autodiscover_tasks()` (`config/celery.py`) finds it with no
further wiring.

**Redis is the broker and result backend, installed as a local service —
never Docker, never a hardcoded default that silently degrades.**
`REDIS_URL` is read the same way every other environment-differing value
in this project is (`env(...)`, `README.md` § "Environment variables"), and
Redis is installed locally exactly like PostgreSQL (`README.md` § 1 vs § 6)
— this project's `Docker (optional, future)` stance extends to Celery's
infrastructure too, not just the web/database stack.

**The periodic-task schedule lives in the database
(`django-celery-beat`'s `DatabaseScheduler`), never a hardcoded
`beat_schedule` dict.** A new scheduled job is a `PeriodicTask` row (added
via `/admin/`, a data migration, or a management command), not a settings
deploy — the same "vocabulary is code, mapping is data" split
`CONVENTIONS.md` § 22 already establishes for permissions.

**Celery's default worker pool does not run on native Windows** (no
`fork()`) — `celery -A config worker --pool=solo` is required there;
macOS/Linux use the default pool. Any story documenting a Celery command
for local dev must carry this caveat, the same way `README.md` § 6 does.

**`SLA-3` is the first story to actually use the "data migration" option
this section already named for adding a `PeriodicTask` row.**
`apps/sla/migrations/0004_seed_escalation_schedule.py` seeds an
`IntervalSchedule` (every 5 minutes) and an enabled `PeriodicTask`
pointing at `apps.sla.tasks.evaluate_escalations`, so the job is live the
moment this story ships — no manual `/admin/` step is required before it
can even start looking for at-risk/idle tickets. What it finds (or
whether it finds anything at all) stays entirely config-driven through
`EscalationRule` (`EscalationRuleAdmin`, § 23) — the schedule existing and
the criteria being configured are two independent opt-ins, not one.

**`SLA-4` is the second feature to add its own `tasks.py` module**
(`apps/notifications/tasks.py::send_notification_email`, after
`apps/sla/tasks.py`, Stories 29-30) — confirming `app.autodiscover_tasks()`
needs no per-app registration; any `apps/<app>/tasks.py` is picked up
automatically.

---

## 25. Design intelligence (DSN, EPIC 8)

`DSN` extends `UI` (§ 19) — it does not replace it. It is generated by the
`ui-ux-pro-max` Claude Code skill (installed at
`.claude/skills/ui-ux-pro-max/`, Story 35/`DSN-0`) and persisted to
**`design-system/supportos/MASTER.md`** at the repo root (the skill nests
persisted output under `design-system/<project-slug>/`, not flat
`design-system/MASTER.md`). Read that file for the full recommended UI
style, component CSS specs, spacing/shadow scale, and anti-patterns — this
section curates only the decisions that affect code: the token
reconciliation below, the UX/accessibility guidance, and chart-type guidance
for future dashboards.

**No token in `frontend/src/index.css` changes as part of this section.**
Every decision below is a commitment for `DSN-1` (Design System Refresh
Across Built Screens, `SupportOs backlog.MD:508`) to carry out, not
something this story applies.

**A naming quirk in the generated output, resolved here so `DSN-1` does not
have to re-derive it:** `design-system/supportos/MASTER.md`'s color table
labels `#475569` "Primary" and `#2563EB` "Accent/CTA" — but that same file's
own `.btn-primary` component spec uses `background: #2563EB` (the
"Accent/CTA" hex), not `#475569`. The vivid blue is the actual call-to-action
color; the slate is a neutral text/border/ring tone. The reconciliation below
maps shadcn's `--primary` (which drives default button styling, per § 19) to
`#2563EB`, not to the hex literally labeled "Primary" in the source table.

**The product-description query ("...knowledge base...", quoted from
`README.md:3-4`) pulled a `Category: Knowledge Base/Documentation`
classification and a "FAQ/Documentation Landing" page pattern** — appropriate
for the future customer-portal/KB pages (`EPIC 9`, `EPIC 10`) but not for the
already-built, table-and-detail agent-facing screens (`EPIC 0`-`7`), which
are dashboard/CRUD UI, not a landing page. The **Style** section ("Minimalism
& Swiss Style" — its own "Best For" list names "dashboards" and "professional
tools" explicitly) applies project-wide; the **Page Pattern** section applies
only when a future story builds an actual FAQ/landing page. `DSN-1` should
generate a page-specific override (`search.py --design-system --page
<name>`) for the agent workspace/ticket screens rather than force-fitting the
landing pattern onto them.

### Token reconciliation (`DSN` vs current `UI`)

Current values are shadcn's untouched default "neutral" theme (`oklch(... 0
0)`, i.e. zero chroma / greyscale) — verified against `frontend/src/index.css`
lines 9-46, never customized since Story 06.

| Token (`frontend/src/index.css`) | Current value | `DSN`-recommended value | Decision | Reason |
|---|---|---|---|---|
| `--primary` (line 17) / `--primary-foreground` (line 18) | `oklch(0.205 0 0)` (near-black) / `oklch(0.985 0 0)` (near-white) | `#2563EB` / `#FFFFFF` (MASTER.md "Accent/CTA", the hex its own `.btn-primary` actually uses) | **Adopted (Story 36)** | Gives buttons/links a real brand color instead of the greyscale shadcn default; unambiguous match to the CTA role shadcn's `--primary` plays. Shipped as `oklch(0.546 0.215 262.881)` in both `:root` and `.dark` (frontend/src/index.css) — see Story 36 for the light/dark-parity rationale. |
| `--secondary` (line 19) / `--secondary-foreground` (line 20) | `oklch(0.97 0 0)` (light grey) / `oklch(0.205 0 0)` (near-black) | Conflicting spec: color table gives `#64748B`/`#FFFFFF` (filled slate), but the same file's `.btn-secondary` sample is an **outline** button in `#475569` text/border on transparent | **Adopted (Story 36) — filled treatment** | Resolved by reading `button.tsx`: this codebase already has a separate `outline` variant distinct from `secondary` (line 15-16), so MASTER.md's outline `.btn-secondary` sample describes that variant, not this token — the color-table pairing (`#64748B`/`#FFFFFF`) applies cleanly to `--secondary`/`--secondary-foreground` with no conflict. Shipped as `oklch(0.554 0.041 257.417)` / `oklch(1 0 0)`, same value in both themes. |
| `--accent` (line 23) / `--accent-foreground` (line 24) | `oklch(0.97 0 0)` / `oklch(0.205 0 0)` (subtle hover surface) | *(none — DSN's palette has no separate "subtle hover surface" role; its "Accent/CTA" was already consumed by `--primary` above)* | **Keep current** | Reusing `#2563EB` a second time for hover/highlight backgrounds would give one hex two different UI meanings (CTA button vs. subtle surface) in the same interface. |
| `--destructive` (line 25) | `oklch(0.577 0.245 27.325)` (red) | `#DC2626` (MASTER.md "Destructive") | **Adopted (Story 36)** | Same role, same color family, no conflict; also satisfies MASTER.md's own pre-delivery checklist item on text contrast. Shipped as `oklch(0.577 0.215 27.325)` in both `:root` and `.dark` — verified 9.46:1 white-text contrast against the existing `dark:bg-destructive/60` treatment (`button.tsx` line 14). |
| `--chart-1` … `--chart-5` (lines 29-33) | five achromatic-to-hued shadcn defaults | Not in MASTER.md — no fixed 5-color chart palette exists anywhere in `DSN` (confirmed by `DSN-3`, Story 38) | **Resolved (Story 38) — keep current** | Already a mutually-distinguishable five-hue qualitative palette, untouched by Story 36's retint; no `DSN`-sourced alternative exists to adopt instead. See "Chart-type guidance" below for the separate, bounded status-zone colors (`#FFCDD2`/`#FFF9C4`/`#C8E6C9`) Bullet/Gauge charts need, which are not `--chart-1..5` slots. |
| `--font-sans` (line 44) | `system-ui, -apple-system, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif` | Atkinson Hyperlegible (Google Fonts, `@import url('https://fonts.googleapis.com/css2?family=Atkinson+Hyperlegible:wght@400;700&display=swap')`) | **Adopted (Story 36), English UI only** | An accessibility/dyslexia-friendly font fits MASTER.md's own "Enterprise apps... professional tools" framing and its Pre-Delivery Checklist's contrast/a11y emphasis. Loaded via `<link>` in `frontend/index.html` (not a CSS `@import`), first in the `--font-sans` fallback chain. |
| `--font-arabic` (line 45) | `'Segoe UI', Tahoma, 'Noto Naskh Arabic', system-ui, sans-serif` | *(same Atkinson Hyperlegible pairing — MASTER.md does not distinguish a bilingual/Arabic typeface)* | **Keep current** | Atkinson Hyperlegible is a Latin-only accessibility font with no Arabic glyph coverage; `CONVENTIONS.md` § 18 requires a font stack that renders Arabic, which the generated pairing does not provide. The skill's query did not mention bilingual/RTL requirements. |
| `--success`/`--success-foreground`, `--warning`/`--warning-foreground`, `--info`/`--info-foreground` (new) | *(did not exist)* | *(none — `MASTER.md`'s Color Palette table has no semantic-status role)* | **Adopted (Story 50)** | No DSN source exists for badge semantics; `#16A34A`/`#D97706`/`#0284C7` sourced from the `ui-ux-pro-max` skill's own `colors.csv` (the most-repeated "success green" across the dataset; amber and a `--primary`-distinct blue chosen by hue-family convention, no exact hex available). All three pair with **black**, not white, text — verified 6.37:1/6.59:1/5.13:1; white text fails 4.5:1 on all three. |
| `--background`/`--foreground`/`--card`/`--card-foreground`/`--muted`/`--muted-foreground`/`--border` (surface tokens), plus tied `--input`/`--popover` | shadcn's untouched greyscale defaults | `MASTER.md`'s Color Palette table, directly (light mode only — no dark-mode row exists in the generated output) | **Adopted (Story 51)** | Light-mode values are MASTER.md's own hexes, converted and contrast-verified (13.98:1–7.24:1 across all text pairs). Dark-mode values have no DSN source — independently derived at the same ~257° hue family, contrast-verified (17.02:1–5.88:1). `--input`/`--popover` follow `--border`/`--card` respectively, preserving an equality already present in the pre-Story-51 code. |
| `--ring` (new) | shadcn default, `oklch(0.708 0 0)` / `oklch(0.556 0 0)` | `#475569` (MASTER.md's own "Ring" row — never adopted by any prior story) | **Adopted (Story 51), light only** | Verified 7.24:1 against the new light `--background` (WCAG 2.4.11 non-text minimum is 3:1). Dark `--ring` is unchanged — verified 4.03:1/3.57:1 against the new dark `--background`/`--card`, still clearing 3:1, so no dark-mode value was invented. |
| `--radius` (line 10) | `0.625rem` (one value, `sm`/`md`/`lg`/`xl` derived via `calc()`, § "@theme inline" lines 115-118) | MASTER.md's component CSS uses differentiated per-component radii: `8px` (buttons/inputs), `12px` (cards), `16px` (modals) | **Resolved (Story 36) — component-level, not token-scale** | `card.tsx` (`rounded-xl`, 14px) and `input.tsx` (`rounded-md`, 8px) already land within 2px / exactly on MASTER.md's 12px/8px targets — no change. `dialog.tsx` and `alert-dialog.tsx` moved from `rounded-lg` (10px) to `rounded-xl` (14px), within 2px of the 16px modal target. The single derived `--radius` scale is unchanged; only which Tailwind radius utility two primitives use was adjusted. |

### UX & accessibility guidance (from `design-system/supportos/MASTER.md` and the `ux-guidelines.csv` catalog)

Audited and applied by `DSN-2` (Story 37, `SupportOs backlog.MD:514`) against
every already-built screen:

- **Contrast:** minimum 4.5:1 for normal text (MASTER.md Pre-Delivery
  Checklist; `ux-guidelines.csv` "Color Contrast", severity High) — verified
  in Story 36 for the tokens it changed; untouched shadcn defaults were
  already compliant.
- **Error messages must be announced, not shown by color alone**
  (`ux-guidelines.csv` "Error Messages", severity High) — **fixed**: 11
  duplicated unattached-error `<p>` blocks replaced by
  `shared/ui/form/FormErrorSummary.tsx` (`role="alert"`); toast error tone
  now `role="alert"`/`aria-live="assertive"` instead of sharing `status`/
  `polite` with success toasts. Per-field `FormMessage` deliberately left
  as-is — already discoverable via `aria-describedby` + focus-on-error, and
  adding `role="alert"` there risks re-announcing on every keystroke during
  re-validation.
- **Focus states visible for keyboard navigation**, `prefers-reduced-motion`
  respected, no emoji used as icons (SVG icon set only) — focus states
  already shadcn-default-compliant across all primitives (unaudited change);
  **fixed**: reduced-motion now respected app-wide (`index.css`, one rule —
  dialog/alert-dialog/select/dropdown entrance-exit, the toast entrance,
  `Reveal`, the route-change fade, and every CSS transition; widened from
  dialog/alert-dialog/select-only by MOTION-0, Story 97 — see "Motion
  vocabulary" below); loading spinners/skeletons deliberately keep
  animating (`ux-guidelines.csv` "Continuous Animation").
- **Wide tables get a horizontal-scroll wrapper or card layout on mobile** —
  **confirmed already compliant**, `shared/ui/primitives/table.tsx:10`.
- **Bulk row actions** (checkbox column + action bar) — **not implemented**,
  Low severity; a feature addition, not a fix — out of scope for this story.
- **Anti-patterns to avoid:** poor navigation, no search entry point, missing
  `cursor: pointer` on clickable elements, instant (non-transitioned) state
  changes, layout-shifting hover transforms — **fixed**: `cursor-pointer`
  added to the shared `Button` base classes (Tailwind v4 Preflight no longer
  sets this by default); the rest were already compliant.

**Also audited and fixed, beyond the original bullet list above:**
- **Heading hierarchy** — `CardTitle` (`shared/ui/primitives/card.tsx`) now
  supports `asChild`; `TicketDetailPage` and `CustomerProfilePage` (and
  10 more section-level titles) render real `<h1>`/`<h2>` elements instead
  of a styled `<div>`.
- **Accessible authentication** (WCAG 2.2, `ux-guidelines.csv` row 107,
  Critical) — login form now sets `autoComplete="email"`/
  `"current-password"`; paste was already not blocked.
- **Truncated text with no full-value access** — `AlertTitle` (via
  `ErrorState`), `SelectField`'s `SelectTrigger`, and
  `CustomerContextPanel`'s timeline entry body now carry a `title` attribute.
  6 standalone `SelectTrigger` usages outside `SelectField` (ticket
  assignee/status controls, list-page filters, the quick-reply picker) are
  **not** covered — noted as a follow-up, `TicketAssigneeControl.tsx` being
  the one with real unbounded text (agent names).

**Also confirmed already compliant, no change needed:** icon-only buttons
(all 5 already have `aria-label`), no bare `div`/`span onClick` anywhere,
RTL (`check-rtl.mjs`, CI-wired, zero violations), sortable table headers
(`DataTable.tsx`, already a model implementation), field
`aria-describedby`/`aria-invalid` wiring, and touch target size
(`icon-xs` = 24px, meets WCAG 2.2's minimum exactly).

**Correction (Story 96, `LAND-4`):** the "no `<img>` anywhere" finding
above is no longer true and is removed rather than left to mislead the
next reader. Two `<img>` elements exist today, both rendering an
admin-set external URL with real `alt` text and an `onError` fallback —
`shared/branding/BrandMark.tsx` (ORG-3, the org logo) and
`shared/landing/HeroImage.tsx` (LAND-4, the landing hero image). Any
third `<img>` this codebase adds must carry the same two defences.

### Chart-type guidance (for `RPT-0`)

Recorded by `DSN-3` (Story 38, `SupportOs backlog.MD:520`) against each
`RPT-*` report's actual data shape (`SupportOs backlog.MD:600-633`), queried
fresh from `charts.csv` — not a generic chart-type list. `RPT-0`
(Reporting Foundation, Story 55) implements its shared chart wrapper
against this table; no chart library, component, or token exists yet.

| Report | Data shape | Chart type | Library options | Color guidance |
|---|---|---|---|---|
| `RPT-1` Ticket Reports — trend over time | Trend Over Time | Line Chart (Area as secondary) | Chart.js, Recharts, ApexCharts | Primary `#0080FF`; multi-series needs distinct color **and** distinct line style (solid/dashed/dotted), never hue alone |
| `RPT-1` Ticket Reports — by status/category/channel | Compare Categories | Bar Chart, horizontal or vertical | Chart.js, Recharts, D3.js | One distinct color per bar (from `--chart-1..5`, see below); always sort descending by value |
| `RPT-2` SLA Performance — response/resolution time trend | Trend Over Time | Line Chart | Chart.js, Recharts, ApexCharts | Same as `RPT-1`'s trend row |
| `RPT-2` SLA Performance — breach rate vs. target | Performance vs Target | Gauge Chart (single KPI) or Bullet Chart (3+ KPIs in a grid) | D3.js, ApexCharts, Custom SVG | Qualitative zones `#FFCDD2`/`#FFF9C4`/`#C8E6C9` (bad/ok/good); performance bar `#1976D2`; target marker a black 3px line — zones must carry a text label, never color alone |
| `RPT-3` Agent Performance — handled/resolution/CSAT per agent | Compare Categories (ranked) | Horizontal Bar Chart | Chart.js, Recharts, D3.js | Same as `RPT-1`'s category row; ≤15 agents before switching to a paginated table |
| `RPT-4` Customer Satisfaction — trend over time | Trend Over Time | Line Chart | Chart.js, Recharts, ApexCharts | Same as `RPT-1`'s trend row |
| `RPT-4` Customer Satisfaction — satisfied/neutral/dissatisfied breakdown | Part-to-Whole (≤5 categories) | Waffle Chart — **not** Pie/Donut (`charts.csv` rates Pie/Donut `risk:high` for accessibility vs. Waffle's `risk:low` for the same use case) | D3.js, React-Waffle, Custom CSS Grid | Distinct accessible color pair per category, always labeled with percentage text; 10×10 grid standard |
| `RPT-5` Management Dashboards — combined KPIs (open tickets, SLA health, CSAT, agent load) | Performance vs Target (Compact), 4 KPIs | Bullet Chart grid (`charts.csv`'s own "ideal for 3-10 bullet charts in a grid" range) | D3.js, Plotly, Custom SVG | Same qualitative-zone + target-marker colors as `RPT-2`'s breach-rate row — `RPT-5` reuses `RPT-0`'s charts (`SupportOs backlog.MD:633`), not a new chart type |

**Accessibility floor, every row (`charts.csv`, all `risk:low` except Waffle
which is also `risk:low`):** a visible data table or text summary fallback;
color always paired with a text label, distinct line style, or shape — never
color alone. Keyboard: focus reveals the same detail hover does; sortable
headers expose `aria-sort`.

**`--chart-1`…`--chart-5` (`frontend/src/index.css` lines 29-33, 67-71):
kept as the current shadcn defaults**, used for the Line/Bar rows' multi-series
and multi-category color needs above. No `DSN`-sourced 5-swatch categorical
palette exists to adopt instead (`design-system/supportos/MASTER.md` has none;
no single `charts.csv` row supplies a general-purpose set). The Bullet/Gauge
qualitative zones (`#FFCDD2`/`#FFF9C4`/`#C8E6C9`) and Waffle's category pairs
are a **separate**, bounded, chart-specific color need — not `--chart-1..5`
slots — and are recorded in the table above for `RPT-0` to name as its own
tokens when it exists.

### Badge semantics, iconography, and page-header hierarchy (`DSN-4`, Story 50)

`success`/`warning`/`info` variants added to `badge.tsx` (§ above) — applied to
ticket status (`open`→info, `in_progress`→warning, `resolved`→success,
`closed`→outline), ticket priority (`low`→outline, `medium`→secondary,
`high`→warning, `urgent`→destructive), task completion state
(pending→warning, completed→success), one SLA dimension (`met`→success;
`breached` stays `destructive`; `pending` stays `secondary` — no `at_risk`
value exists in `SlaDimensionStatus` to justify a warning), and ticket
escalation (`false`→success, `true` stays `destructive`). Deliberately
**not** applied to article draft/published status or any `direction`/
`channel`/`category`/mention/`activity_kind`/`is_system`/`is_active` badge —
not one of the intake's four named categories.

The ticket-status/priority mapping is duplicated in
`features/tickets/lib/statusBadge.ts` and `features/portal/lib/statusBadge.ts`
rather than shared — `no-restricted-imports` forbids the cross-feature
import, the same boundary `features/portal/types/portalTicket.ts` already
documents for its own duplicated `TicketStatus`/`TicketPriority` types.

`lucide-react` icons added to: every list page's "New X" action, every
`RootLayout` nav link, and (via `Empty.tsx`'s new optional `icon` prop, a
generic `InboxIcon` default) every empty state. `Notification.kind` gained
its first-ever visual indicator (an icon, not a badge — no badge existed to
recolor) in `NotificationBell.tsx`'s dropdown rows.

`PageHeader` (`shared/ui/PageHeader.tsx`) replaces 13 duplicated list-page
header blocks, establishing the first real two-level heading hierarchy
(`text-2xl` page titles above `CardTitle`'s `text-lg` section titles,
Story 37) — everything previously read at one flat size. `Card`/`FormItem`
spacing was audited and found already exactly matching `MASTER.md`'s
24px/8px spacing scale — no change. `table.tsx`'s cell padding moved from
8px to 12px horizontal, a bounded judgment call — no DSN table spec exists
to size against precisely.

### App shell: sidebar navigation & primitive polish (`DSN-5`, Story 51)

`RootLayout.tsx`'s top `<nav>` became `app/Sidebar.tsx` — a hand-built `<aside>`
(not the official shadcn CLI `sidebar` component, which solves an SSR-cookie
hydration problem this client-only SPA does not have), collapsible to an
icon-only rail via `useState` + `localStorage`
(`supportos.sidebar.collapsed`), positioned by plain DOM order in a `flex`
row rather than a direction-branched class — flexbox already reverses
visually under `dir="rtl"` with the sidebar first in markup. Every
`<Can>`-gated link, `t(...)` key, and route from the prior top nav moved
across unchanged. `PortalLayout.tsx` (the customer-facing shell) is
untouched — a deliberately separate, simpler top nav since Story 42.

`button.tsx`/`input.tsx`/`select.tsx` gained MASTER-guided polish:
`font-semibold` and a `shadow-xs` + `-translate-y-px` hover lift (with an
`active:translate-y-0` press-back, this story's own addition — MASTER
defines no `:active` state) on the three filled button variants;
`border-color` added to `input.tsx`/`select.tsx`'s transition-property list,
fixing a real, verified "instant state change" on focus (the property was
silently excluded before this story); `duration-200` added throughout,
matching MASTER's 200ms. No height/padding/radius change — this project's
existing button/input/select height-alignment invariant (`h-9` shared
across all three) is verified compliant with MASTER's radius target already
and takes precedence over MASTER's literal padding numbers, which would
have broken that alignment.

### Landing page visual language (`LAND-4`, Story 96)

The public landing page (`frontend/src/shared/landing/sections/
LandingSections.tsx`) alternates surface per section — hero `bg-primary/5`,
features `bg-card`, CTA band `bg-muted`, footer the page's plain
`bg-background` — so four consecutive sections stay visually
distinguishable instead of reading as one flat scroll. `bg-primary/5` is
token-driven rather than a hex, which is why it follows ORG-3's admin-set
brand colour automatically.

Landing `Card`s carry `shadow-md hover:shadow-lg hover:-translate-y-0.5
transition-all duration-200`, applied **via `className` at each call site**
— `shared/ui/primitives/card.tsx` itself is never edited for this, so the
staff app's other `Card` usages keep their default flat `shadow-sm`.

`design-system/supportos/MASTER.md`'s `--shadow-*` and `--space-*` tables
are spent as the Tailwind utilities this codebase already uses
(`shadow-md`/`shadow-lg`, `py-16`/`py-24`/`gap-6`, etc.) and were
deliberately **not** introduced as a parallel set of CSS custom
properties — `index.css` has no `--shadow-*` token today, and adding one
would give the same concept two names.

MASTER.md's single generated page pattern ("FAQ/Documentation Landing":
hero-with-search-bar → popular categories → FAQ accordion → contact CTA)
is **rejected** for this page — `design-system/supportos/pages/` is empty,
so that pattern is all the design-system layer has, and it describes a
help centre rather than a signed-out product front door. A search bar
would have nothing to search for a first-time visitor, and a FAQ accordion
would duplicate `KB-1`'s portal FAQ browse outside the authenticated
surface it belongs behind. The landing page keeps its existing hero →
highlights → CTA → footer order.

### Motion vocabulary (`MOTION-0`, Story 97)

**Tokens.** `--motion-fast`/`--motion-base`/`--motion-slow` (150/200/300ms)
are `:root` custom properties, sourced from MASTER.md's own "transitions
(150-300ms)" Anti-Pattern and its repeated `200ms ease` component CSS —
consumed via the variable shorthand (`duration-(--motion-base)`) because
**Tailwind v4 has no `--duration-*` theme namespace**. `--motion-reveal`
(700ms) is the one value outside that band, kept for `Reveal`'s
scroll-triggered entrance, which is not an interaction response. Three
role-named easings — `ease-entrance`/`ease-exit`/`ease-state` — live in
`@theme inline` instead, because `--ease-*` **is** a real v4 namespace and
generates matching utilities; they alias the standard `ease-out`/`ease-in`/
`ease-in-out` curves by role rather than by curve, since MASTER.md
specifies no easing beyond the plain `ease` keyword.

**Reduced-motion policy.** One rule in `index.css`, never per component. It
collapses every decorative motion — `tw-animate-css` enter/exit
(dialog/alert-dialog/select/dropdown, the toast entrance, `Reveal`), the
route-change fade, and now CSS transitions generally. `animate-spin`
(`Loading`) and `animate-pulse` (`Skeleton`) are exempt, deliberately: they
are the only signal that work is in progress, and freezing them turns a
loading state into an indistinguishable broken one — worse for exactly the
users the preference protects (DSN-2, Story 37, `ux-guidelines.csv`
"Continuous Animation").

**No animation dependency was added, and none is needed.** `tw-animate-css`
(a devDependency — correctly, since Tailwind inlines its CSS at build time
and nothing imports it at runtime) already supplies the whole enter/exit
keyframe engine; Tailwind v4's `--ease-*`/`--animate-*` theme namespaces
supply everything else this story needed.

**Deliberately unanimated.** `sheet`/`popover` do not exist as primitives in
this codebase, so neither is animated. Toast *exit* is out of scope — the
toast is removed from state synchronously on dismiss, and an exit animation
would need a leaving-state machine, not a class. Route transitions use a
class re-trigger on `<main>` rather than the View Transitions API (driving
it needs a per-`<Link>` prop, which the shared-component-only constraint
forbids) or a `key={pathname}` remount (React Router deliberately keeps a
component mounted across a param change; a pathname key would break that).

`Reveal` moved from `frontend/src/shared/landing/` to
`frontend/src/shared/ui/Reveal.tsx` as part of this story — a scroll
reveal is a generic primitive, not a landing-page concern.

### Form presentation: dialog vs. full page (`DSN-15`, Story 112)

**The rule.** A form is a **dialog** — `shared/ui/form/FormDialog.tsx` over
`shared/ui/primitives/dialog.tsx` — when it is a single entity, has no
nested navigation of its own (no child sections that only make sense once
the entity is saved), and its field count fits comfortably in
`dialog.tsx`'s `sm:max-w-lg` default (or `sm:max-w-2xl` for a bilingual
pair). Examples: Department, Branch, Category, FAQ, Task, Customer, Landing
highlight/social link, and (a worked example with no live consumer yet)
Quick Reply.

A form stays a **full page** when it is multi-section (Ticket, Article,
Calendar's working-windows/holidays), has a permission grid or
role/department/branch assignment (Role, User), needs file upload or
event-type selection (WebhookSubscription), or is deep-linked/shared as its
own bookmarkable destination — a public form (`WebForm`) or a customer
portal form reached directly rather than from a list the customer is
browsing (`PortalTicketForm`, `PortalFeedbackForm`).

**No third ("sheet") tier.** `sheet`/`popover` do not exist as primitives in
this codebase (`MOTION-0`/Story 97 already noted this) and this story does
not add one — a boundary nobody can define is worse than two clear ones,
per this story's own constraint. A future form that feels "too big for a
dialog, too small for a page" is a full page until a sheet primitive is
deliberately added as its own decision.

**Mechanism.** A dialog form's route (`new`/`:id/edit`) is nested as a
**child route** of its list route in `frontend/src/app/router.tsx`, and the
list page renders `<Outlet />` (Radix portals the dialog to
`document.body` regardless of where in the tree it mounts, so `Outlet`'s
position in the list page's JSX does not affect layout). A permission gate
that already splits view/manage (Department, Branch, Calendar) keeps both
`RequirePermission` layers, nested the same way; a single-gate group
(Category, Faq, Landing highlights/social, Customer) nests with no second
layer; an ungated route (Task) nests with none at all. See Story 112's own
plan file for the full per-route table.

**Escape/overlay-dismiss vs. Cancel.** `FormDialog`'s Cancel button is a
`DialogClose asChild` wrapper, not a separate `onClick` handler — Radix
calls the same `onOpenChange(false)` for Escape, overlay click, the
built-in close button, and `DialogClose`, so all four dismiss paths run
through `FormDialog`'s one dirty-check, by construction, not by keeping two
paths in sync by hand.

### Motion completion & micro-interaction craft (`DSN-16`, Story 113)

`MOTION-0` (Story 97) shipped the token vocabulary, the reduced-motion
policy, `Reveal`'s promotion, and — verified against current code rather
than assumed from this story's own intake, which pre-dated a re-check —
the toast entrance, dropdown/select duration, table-row hover duration, and
the route-change fade on `<main>`, all already complete. This story closes
the two genuine gaps that remained:

- **`checkbox.tsx`/`switch.tsx`/`radio-group.tsx`/`tabs.tsx`** now carry an
  explicit `duration-(--motion-fast) ease-state` (or the matching
  property-list fix on `checkbox.tsx`, which transitioned only its focus
  ring, not its checked-state background/border) — a property changing in
  place, hence `ease-state`, not `ease-entrance`. `dialog`/`alert-dialog`/
  `dropdown-menu`/`select`/`button`/`input`/`table` (row hover) needed no
  change — `MOTION-0` already covered them.
- **`DataTable.tsx` gained one container-level cross-fade** on `<TableBody>`
  (`animate-in fade-in duration-(--motion-base) ease-entrance`, re-triggered
  on a content-signature change built from `query`'s pending/error/empty/
  row-id state) — covering skeleton→content, empty→populated, and a
  filter- or bulk-action-driven refetch alike, in one place inherited by
  every `DataTable` consumer. **Not per-row**: animating each `<TableRow>`
  independently at list scale is exactly what a container-level fade is for
  avoiding; a genuine per-row exit animation is not attempted at all — see
  below.

**Deliberately not built, each for a concrete reason:**
- **A true per-row exit animation** (a row visibly leaving when a filter or
  bulk action removes it from view) needs a leaving-state machine — React
  unmounts a removed `<tr>` before any CSS transition on it could run — the
  same category of gap as `ToastProvider`'s own exit, which `MOTION-0`
  named out of scope for the identical reason. Would need an animation
  library this codebase has never added.
- **`QueryBoundary.tsx`'s own loading→content fade.** 43 files call it; its
  `children(data)` render prop is caller JSX, so a non-invasive fade needs
  wrapping it in a new `<div>` — an unaudited risk against `CONVENTIONS.md`
  § 7's "stable contract" call on this exact component.
- **Optimistic-update settle.** No optimistic update exists anywhere in
  this codebase (`grep -rln "onMutate" frontend/src` — no hits) — nothing
  to animate.
- **`sheet`/`popover`/`tooltip` motion, and the View Transitions API for
  routing** — both already named out of scope by `MOTION-0` for the same
  reasons (the primitives do not exist; the API needs per-`<Link>` wiring
  the shared-component-only constraint forbids). Still true.

**Motion quality pass (verification walk against `DSN-13`'s route set):** no
animation exceeds its token's duration, no two overlapping animations fight
for the same element, nothing moves under `prefers-reduced-motion: reduce`
except the exempt `animate-spin`/`animate-pulse`, no cumulative layout
shift, and `en`/LTR + `ar`/RTL both read correctly — no further deliberate
exception was found beyond the ones already recorded above.

### Measured colour & contrast audit (`DSN-17`, Story 114)

Every semantic token pair in both themes, measured by a real oklch→sRGB→WCAG
conversion (`frontend/scripts/check-contrast.mjs`), not eyeballed — see that
script and this story's own plan file for the full matrix. Two genuine
failures were found beyond the two `bugs/101` already fixed (`--primary` as
text):

- **`--secondary` used as text failed AA in dark mode** (3.56:1 on `--card`)
  and on `--muted` in light mode (4.11:1) — no current call site renders it
  as body text, but a `--secondary-text` token was added anyway, extending
  `--primary-text`'s split-the-token mechanism per this story's own
  instruction, not waiting for a defect to land first.
- **Every interactive control's resting-state border failed WCAG 1.4.11's
  3:1 non-text/UI-boundary threshold in both themes** (`--input`, mirroring
  `--border`'s subtle value, measured ~1.2-1.3:1) — `Input`/`SelectTrigger`/
  `Checkbox`/`RadioGroupItem` all rely on that border alone in their resting
  state. A new `--input-border` token (separate from `--input`'s existing
  translucent-fill role) fixes this; `--border` itself is unchanged — every
  one of its consumers (`Card`, `TableRow`, `SelectContent`) has its own
  distinct fill or is non-interactive, so 1.4.11 does not apply to it.

`--foreground`/`--muted-foreground`/`--ring`/`--primary-text` (both themes)
and every fill+its-own-foreground pair already passed and needed no change.

The org-supplied brand colour (`shared/branding/`) already always resolves
legible via `brandTextFor()`'s blend algorithm (`bugs/101`) — this story
adds a warning in Organization Settings surfacing *when* an admin's exact
colour needed adjusting, reusing that same function with no new derivation.

`npm run check:contrast` (wired into `.github/workflows/lint.yml` beside
`check:rtl`) now gates every future token edit against the same matrix.

---

## 26. Customer portal identity & scoping

`PORTAL-0` (Story 42). A customer's portal login is not a second identity or
authorization system — it is `AUTHZ` (§ 13/§ 22), extended.

**A customer is a `User` row, not a second identity system.**
`customers.Customer.user` (nullable `OneToOneField` to `accounts.User`,
`related_name="customer_profile"`) links a CRM identity to a login-capable
account. A `Customer` with `user = None` — the default — cannot log in. There
is no separate customer credential table and no separate JWT configuration.

**The `customer` role carries exactly one permission, `portal.access`**
(`apps/core/permissions.py`), seeded the same way `admin`/`manager`/`agent`
are (`apps/accounts/migrations/0004_seed_customer_role.py`). Granting a
customer more portal-facing permissions later is a new `Permissions` constant
plus a role-permission grant migration — the same two-step pattern
`apps/customers/migrations/0002_grant_customer_permissions.py` already used
for staff roles.

**`CustomerScopedModelViewSet` (`apps/core/views.py`) is the base for every
portal viewset.** Its `get_queryset()` override — filtering to the caller's
`customer_profile` via `customer_field` (default `"customer"`) — is the
PRIMARY scoping mechanism: DRF's `get_object()` filters through
`get_queryset()` before any per-object check runs, so `list`, `retrieve`,
`update`, and `destroy` are all covered by this one override. `HasPermission`
also gained `has_object_permission`, a secondary, defense-in-depth layer that
only matters for a custom `@action` that fetches an object directly (e.g.
`Model.objects.get(pk=...)`) instead of through `self.get_object()`. **A
custom `@action` on a `CustomerScopedModelViewSet` subclass must route
through `self.get_object()`/`self.get_queryset()` — never a raw manager
query — or it bypasses the primary defence and leaves only the
object-permission check to catch a leak.**

**`has_object_permission` only tightens for a view that declares
`customer_field` — it must never assume every model has a `customer`
relation.** Fixed live by Story 46 (Access FAQs, `PORTAL-4`): the original
version defaulted `customer_field` to `"customer"` for *any* view once the
caller had a `customer_profile`, which produced a false `403` on
`ArticleViewSet.retrieve` — a plain `BaseModelViewSet` subclass with no
`customer` FK at all — the first time a portal customer got real `retrieve`
access to a non-`CustomerScopedModelViewSet` endpoint. The check now does
`if not hasattr(view, "customer_field"): return True` before reading it, so
it is a true no-op for every viewset that does not opt into row-scoping,
not just for a caller with no `customer_profile`.

**`CustomerScopedModelViewSet` declares no `permission_map` of its own.**
Per `HasPermission`'s existing grant-on-omission rule, a subclass that ships
without declaring one is authenticated-only, not closed — every `PORTAL-N`
viewset must declare its own `permission_map` (typically
`{"list": Permissions.PORTAL_ACCESS, ...}`), the same as any other
`BaseModelViewSet` subclass.

**The frontend gate is `RequirePermission permission="portal.access"` — no
new guard component.** `AuthUser`, `useAuth()`, `RequireAuth`, and
`RequirePermission` all work unmodified for a customer account, because a
customer is simply a `User` row with a different `role`.

**The portal route tree is a sibling of `RootLayout`'s, not nested inside
it.** `frontend/src/app/router.tsx` has two top-level route objects: the
existing `path: '/'` tree (`RootLayout`, staff nav, `NotificationBell`) and
`path: 'portal'` (`PortalLayout`). Nesting the portal under `RootLayout`
would wrap every customer-facing page in staff chrome — a customer must
never see staff navigation or the agent notification bell. Both trees share
one `AuthProvider`/`Direction.DirectionProvider`/`QueryClientProvider` stack
(`frontend/src/app/providers.tsx`, wrapped around the single `RouterProvider`
in `main.tsx`), so direction, i18n, and auth state all work identically in
both — only the visual shell differs.

**Provisioning is a staff-facing action on the customer profile — `CUST-5`
(Story 85).** `CustomerViewSet.portal_access` (`POST` grants, `DELETE`
revokes, gated on `customers.manage`) is the primary path: grant creates or
reuses a `User(role=customer, is_staff=False)` in exactly the same
`is_active=False` + unusable-password pending state `SEC-5`'s
`UserAdminSerializer.create` leaves for a new staff account, and dispatches
the same `send_invite_email` task; revoke unlinks `Customer.user` and sets
`User.is_active = False` together. Django admin's `Customer.user` field
(Story 42) is unchanged and still usable as a manual fallback — the same
role Django admin keeps for `Role`/`User` after `SEC-1`/`SEC-2` shipped their
own screens over those. Still no self-service registration: only a staff
member with `customers.manage` can grant or revoke.

---

## 27. Reporting (RPT-0)

`RPT-0` (Story 55) is the shared foundation `RPT-1`…`RPT-5` build on. See
§ 25 above for the chart-type specification it implements against.

1. **`apps/reports/aggregation.py` is the only place a report query is
   bucketed or grouped.** `bucketed_counts`/`grouped_counts` take a
   **queryset** and a field name, so a report view never writes its own
   `Trunc*`/`values().annotate()` chain — that chain is where the classic
   Django aggregation bugs live (see point 3 below).
2. **A trend series is always gap-filled.** `bucketed_counts` returns one
   row per bucket across the whole requested range, `value: 0` included,
   even when nothing fell in it. A missing bucket would otherwise draw a
   straight line across a real zero and silently misrepresent the trend.
   A nullable `series_field` maps NULL to `null_label` before the series
   keys are sorted — without it the sort compares `str` with `None` and
   raises (`RPT-1`'s origin channel, `RPT-3`'s `assigned_agent`).
3. **Two quiet aggregation failures this project has already hit once,
   fixed permanently in `aggregation.py`, never to be re-solved per
   report:** Django's `TruncWeek` truncates to **Monday**, so a gap-fill
   spine that steps in 7-day increments from an arbitrary start (instead of
   snapping to Monday first) never matches the database's own keys and the
   whole series reads as zeros. And a model's default `Meta.ordering`
   (e.g. `Ticket.Meta.ordering = ("-created_at",)`) silently joins itself
   into a `GROUP BY` and fragments an aggregate into one row per record
   unless `.order_by()` is called explicitly — every aggregate chain in
   `aggregation.py` ends in one.
4. **The export query parameter is `?export=csv`, never `?format=csv`.**
   DRF's `DefaultContentNegotiation` reads `?format=` as a renderer
   override and raises `Http404` when no renderer matches
   (`rest_framework/negotiation.py:41-45,80-89`) — this project registers
   exactly one renderer, format `"json"` (`config/settings/base.py:229`).
   Worse, `APIView.initial()` negotiates content **before** it checks
   permissions (`rest_framework/views.py:404-420`), so `?format=csv` would
   404 before a view body or permission check ever ran. `BaseReportView`
   (`apps/reports/views.py`) names the parameter `export` instead.
5. **A report response is a flat list of dicts; the CSV and the JSON are
   the same rows.** `BaseReportView.get` calls `get_report` once and
   branches only on how to render the result — an exported file can never
   disagree with the chart the user was looking at.
6. **`frontend/src/shared/ui/chart/` is the only home for chart
   components.** `no-restricted-imports` (`.oxlintrc.json`) forbids one
   feature importing another's code, so a chart built inside one `RPT-*`
   feature could never be reused by a sibling report. Every chart is
   rendered inside `ChartFrame`, which is what supplies § 25's required
   data-table fallback — a report screen never renders `LineChart`/
   `BarChart` directly.
7. **No chart library.** Two of the four chart types this epic needs
   (Bullet, Waffle) have no mainstream React library implementation, and
   § 25 lists only D3/Plotly/Custom SVG/Custom CSS Grid for them — so no
   single library covers the epic, and adopting one for Line/Bar alone
   would still leave Bullet/Waffle custom and add a dependency whose
   output must be overridden anyway to satisfy § 25's accessibility floor
   and this project's RTL discipline. Plain SVG, per `LineChart.tsx`/
   `BarChart.tsx`. `RPT-1`…`RPT-5` inherit this decision; it is not
   reopened per report.
8. **A report's dimensions are a whitelist, never a field name off the
   query string.** `apps/reports/tickets.py::DIMENSION_FIELDS` maps the
   four wire values to queryset fields; `parse_dimension` rejects
   everything else. An endpoint that resolved `?dimension=` directly
   would be a general-purpose data-extraction API for anyone with
   `reports.view`.
9. **A bucket is a calendar date, so format it in UTC.** `bucketed_counts`
   emits `YYYY-MM-DD`, which JS parses as UTC midnight — rendered through
   `useFormatters().date()` with no options it shows the **previous day**
   anywhere west of Greenwich (verified: `'2026-01-01'` → "Dec 31, 2025"
   in `America/New_York`). Every bucket label passes
   `{ dateStyle: 'medium', timeZone: 'UTC' }`.
10. **An average metric is never gap-filled with a false zero.**
    `bucketed_counts`'s `value: 0` gap-fill (point 2 above) is correct
    for a *count* — zero tickets is a real, meaningful zero — but wrong
    for an *average*: `apps/reports/sla.py::sla_trend` reports average
    response/resolution minutes, and a bucket with no achieved values in
    it is **omitted** rather than reported as "0 minutes", which would
    falsely claim instant response. Any future average-shaped report
    follows this, not `bucketed_counts`'s gap-fill.
11. **A gauge-shaped KPI can always reuse `GaugeChart` with zero code
    changes — frame it as a 0-1 "badness" fraction.** `GaugeChart`'s
    zone thresholds (`GOOD_THRESHOLD = 0.1`, `WARN_THRESHOLD = 0.25`)
    and orientation (0 = best, 1 = worst) are fixed, not props. `RPT-5`'s
    four dashboard KPIs — an open-ticket rate, a pooled SLA breach rate,
    a CSAT *dissatisfaction* rate (the inverse of `RPT-3`'s own "%
    satisfied"), and an unassigned-backlog rate — all fit this contract
    by construction: whichever raw quantity a KPI starts from, define
    its gauge input as *the share that is going wrong*, never *the
    share that is going right*. This is why `CsatRisk` shows
    dissatisfaction, not satisfaction, even though "% satisfied" is the
    more intuitive framing in isolation — a single dashboard-wide
    reading direction beats four gauges that each need to be read
    differently.

---

## 28. AI service foundation (AI-0)

`AI-0` (Story 74) is the shared foundation `AI-1`…`AI-5` build on — see
§ EPIC 13 in `SupportOs backlog.MD`.

**`apps/ai/client.py` is the only place `anthropic` is imported.** A
feature calls `generate_completion(...)`; it never constructs its own
`anthropic.Anthropic()` client or reads `settings.ANTHROPIC_API_KEY`
directly. This is what "single AI integration point" (the backlog's own
phrase) means in code: one client, one call signature, one exception
type (`apps.ai.exceptions.AIServiceError`) every consumer catches instead
of an `anthropic.*` exception class.

**`apps/ai/prompts.py::ground_with_knowledge_base` is how an AI feature
reads the knowledge base — never a second call into
`apps.knowledge_base.search.search_knowledge_base` with `include_drafts`
left to the caller's judgment.** It is hardcoded to `include_drafts=False`:
an AI-generated answer must never surface unpublished KB content, unlike
`KnowledgeBaseSearchView`'s permission-elevated human-facing search
(§ `KB-3`).

**No AI credential is ever logged, and neither is a prompt or a
response.** Ticket content, KB content, and customer data can appear in
any of the three; § 10's "never log secrets, never log request bodies"
rule applies to `apps/ai/client.py`'s own error logging exactly as it
does everywhere else — log the exception class or provider status code,
never the payload.

**`AI_MODEL` is an environment variable, not a per-feature constant.** A
story that needs a different model tier for its own task passes `model=`
to `generate_completion` explicitly; it does not add a second
`AI_*_MODEL` environment variable.

---

## 29. Public API & API keys (INT-1)

`INT-1` (Story 80) makes the existing `/api/` tree the public API. There is
no separate external surface, and there must never be one: a second tree
would need its own serializers, its own permission map, and its own
envelope, and would drift from the first within one story.

**An API key is an identity, not a permission set.**
`apps.integrations.authentication.ApiKeyAuthentication` returns the
`accounts.User` a key was issued for, and every existing `permission_map`,
`HasPermission` check, and `CustomerScopedModelViewSet` queryset filter
then applies to it unchanged (§ 22). **Never add a scope or permission
list to `ApiKey`** — § 13's "never build a second permission check" applies
directly. Narrow a key by issuing it against a narrowly-roled user.

**`apps/integrations/keys.py` is the only place a key is minted, hashed, or
compared.** Only `prefix` (the lookup column) and `sha256(secret)` are
stored; the plaintext exists for the duration of one `POST
/api/api-keys/` response and is never logged, never re-derivable, and
never returned again. Plain `sha256` rather than a password hasher is
deliberate — the secret is 256 bits of `secrets.token_hex`, so a slow KDF
defends nothing and would cost its full price on every API-key request.

**Revocation is a flag, never a delete.** `ApiKey.is_active = False` keeps
`last_used_at` and the issue date, which are the only record that a
credential ever existed. `ApiKeyViewSet.perform_destroy` is what `DELETE`
does; the OpenAPI description says so explicitly, because a `DELETE` that
does not delete would otherwise surprise an integrator.

**A new endpoint is documented by existing in the router — but its response
shape is documented by two shared pieces, not by the view.**
`apps.integrations.schema.envelope_postprocessing_hook` wraps every `2xx`
payload in the success envelope and attaches the shared `ErrorEnvelope` to
`400/401/403/404/500`;
`apps.core.pagination.DefaultPageNumberPagination.get_paginated_response_schema`
supplies the `meta.pagination` shape for list endpoints. A story that adds
an endpoint returning something other than a serializer (a bare dict, a
file) annotates it with `drf_spectacular.utils.extend_schema` on that view
— it does **not** add a second post-processing hook.

**`DEFAULT_RENDERER_CLASSES` stays a one-element list.** The doc views each
declare their own `renderer_classes`, which is why serving YAML and HTML
from under `/api/` does not need — and must not get — a global renderer
addition. `config/tests/test_settings.py::DrfSettingsTests
.test_only_the_envelope_renderer_is_registered` pins this.

---

## 30. ERP sync (INT-2)

`INT-2` (Story 81) is this project's first sync with a system it does not
own. Three rules follow from that and apply to `INT-3`/`INT-4` too.

**A foreign system's field names are configuration, never code.**
`ErpConnection.customer_field_map`/`order_field_map` translate ERP field
names to SupportOS ones, and `apps/integrations/erp_sync.py` is the only
module that applies them. A story that integrates a second external
system adds its own map to its own config row — it does not hardcode a
vendor's field name in a serializer or a task.

**A field map may only target an explicit allowlist.**
`CUSTOMER_SYNCABLE_FIELDS`/`ORDER_SYNCABLE_FIELDS`
(`apps/integrations/erp_sync.py`) are enforced in three places, on
purpose: `ErpConnection.clean()` (admin/`full_clean`),
`ErpConnectionSerializer` (the API path — DRF does not call model
`clean()`, § 22), and `apply_field_map` itself (a map written through the
ORM bypasses both). `Customer.external_id` and `Customer.user` are
deliberately **absent** from the allowlist: one is the correlation key the
upsert depends on, the other is the portal-login link a bulk import must
never re-point.

**An unconfigured integration is a no-op, not an error, and its schedule
ships enabled.** `run_erp_sync` returns immediately unless
`ErpConnection.is_configured()`, which is what lets
`0003_seed_erp_sync_schedule` seed an *enabled* `PeriodicTask` — the
schedule existing and the connection being configured are two independent
opt-ins, the same split § 24 already records for `SLA-3`.

**A per-record failure never aborts a run; a connection-level failure
does.** `erp_sync` counts a bad record into `ErpSyncRun.failed_count` and
carries on — imperfect upstream data is the normal case, and one
over-long name must not strand the other 4,999 records. An `ErpError`
(host down, non-2xx, non-JSON body) ends the run as `failed`. Either way
the `ErpSyncRun` row is the record; **no `AuditLog` row is written**, for
the same reason § 29 gives for API keys.

**A credential this project must replay cannot be hashed — so it is
write-only instead.** `ErpConnection.auth_token` is stored in plain text
(it is sent on every outbound call, unlike INT-1's `ApiKey`, which only
ever needs a digest), is `write_only` in its serializer, and is reported
to the UI only as the boolean `has_auth_token`. A blank token on `PATCH`
leaves the stored value alone, so saving the form cannot wipe it.
**Encryption at rest is not implemented** and is `INT-3`'s to decide — its
own task text is "secure central config for … credentials". Until then,
DB access is token access; § 10's never-log rule is what keeps it out of
logs.

---

## 31. Messaging provider config (INT-3)

`INT-3` (Story 82) moves the three outbound channel adapters'
credentials (`apps.communications.{email,whatsapp,sms}_adapter`) from
`ENV`-only settings to a DB-backed singleton per provider
(`EmailProviderConfig`/`WhatsAppProviderConfig`/`SmsProviderConfig`,
`apps/communications/models.py`), each following the `pk=1`/`load()`
shape `organization.OrganizationSettings` and `integrations.ErpConnection`
already established.

**Scope is deliberately narrow: only the three channel adapters' `send()`
methods read this config.** `apps.accounts.tasks` (invite, password
reset) and `apps.notifications.tasks` (notification email) still read
Django's own `EMAIL_*` settings, unchanged — confirmed with the user
during planning. This means an operator using one SMTP account for
everything configures it in two places today. Unifying the two is a
legitimate follow-up; it is not something a future story should assume
already happened just because "messaging provider config" sounds like it
would cover it.

**A credential shared between an adapter's outbound send and a webhook's
inbound verification has exactly one stored value, read by both.**
`SmsProviderConfig.auth_token` is the one example today —
`SMSAdapter.send()` and `SMSInboundWebhookView.post()` both read it,
because Twilio's own Auth Token is genuinely dual-purpose. A future
provider whose API has the same shared-secret design should follow this,
not add two fields that can drift apart. A verification-only secret with
no adapter involvement (`WHATSAPP_WEBHOOK_VERIFY_TOKEN`,
`WHATSAPP_APP_SECRET`, `EMAIL_INBOUND_WEBHOOK_TOKEN`) stays an `ENV`
setting — it is not "a credential reused by a channel adapter."

**Encryption at rest is not implemented, again, on purpose.** `INT-1`
(`ApiKey.hashed_key`, a digest — different case), `INT-2`
(`ErpConnection.auth_token`), and now `INT-3`
(`EmailProviderConfig.host_password`, `WhatsAppProviderConfig
.access_token`, `SmsProviderConfig.auth_token`) all store a live,
replayable credential in a plain `CharField`, `write_only` in its
serializer and never returned by the API. No encryption library is
installed in this project. Adding one is a single cross-cutting decision
that should encrypt all four fields at once — it is not a per-story
choice, and no story should quietly add its own encryption scheme for
just its own field.

**A removed `ENV` setting is removed everywhere at once: `config/settings/base.py`, `.env.example`, and the `README.md` table, in the same
change that removes its last Python reader.** `WHATSAPP_API_BASE_URL`/
`WHATSAPP_PHONE_NUMBER_ID`/`WHATSAPP_ACCESS_TOKEN`/`SMS_API_BASE_URL`/
`SMS_ACCOUNT_SID`/`SMS_AUTH_TOKEN`/`SMS_FROM_NUMBER` are the first
settings this project has ever removed rather than added — verified live
that each had zero remaining Python consumers before deletion. An
`ENV`-var removal without checking every consumer first is exactly the
mistake this rule exists to prevent.


---

## 32. Outbound webhooks & the signals exception (INT-4)

`INT-4` (Story 83) is the **first and, until a future story explicitly
says otherwise, only** place in this project that uses Django model
signals (`post_save`/`pre_save`/`@receiver`). Every other "something
happened, tell someone" hook in this codebase — `apps.notifications
.services.notify`, `apps.tickets.assignment.apply_assignment`,
`apps.tickets.escalation.apply_escalation` — is an explicit call at the
call site, and that stays the default. Signals were the deliberate
exception here, confirmed with the user during planning, because a
single domain event (a `Ticket` being created, say) has eight distinct
call sites across five channel adapters, the staff API, the portal API,
and the AI chatbot handoff, with more likely in the future — an explicit
call site at all eight, forever, is the wrong trade for "a ticket was
created" to keep meaning exactly that.

**Before adding a second signal receiver anywhere in this codebase, read
`apps/integrations/signals.py` first and ask whether the explicit-call-site
convention still fits better** — it usually does. Signals earn their cost
(implicit control flow, and — for change-detection specifically — an
extra query per update, see below) only when a project-wide, no-gaps
guarantee is the actual requirement, not merely a convenience.

**Detecting a field *change* via signals costs a query `post_save` alone
does not.** `post_save`'s own `created` flag answers "was this just
created" for free; answering "did `status` just change" needs the
*previous* value, which `apps/integrations/signals.py::_capture_ticket_changes`
gets via a `pre_save` re-fetch (`Ticket.objects.get(pk=instance.pk)`).
This runs on **every** `Ticket` UPDATE project-wide, not just ones a
webhook subscriber cares about — an accepted, deliberate cost of a
signals-only design with no new dependency (`django-model-utils`'
`FieldTracker` is not installed). A story adding a fourth tracked field
extends `_TRACKED_TICKET_FIELDS`, not a second re-fetch.

**The webhook event vocabulary is code; the subscription's chosen subset
is data** — the same split § 22 established for permissions.
`apps.integrations.models.WEBHOOK_EVENTS` is the vocabulary,
`WebhookSubscription.events` is the mapping, and adding a new event is a
two-line change: one entry in `WEBHOOK_EVENTS`, one new signal receiver
(or branch in an existing one) in `signals.py` — never a hardcoded event
string at a dispatch call site, because there is deliberately only one
dispatch call site (`webhook_dispatch.dispatch_event`).

**A one-shot event retries; a recurring sync does not.**
`apps.integrations.tasks.deliver_webhook` retries a failed delivery three
times with backoff before giving up — contrast `run_erp_sync` (Story 81),
which never retries, because an ERP sync failure self-heals on the next
hourly run. A webhook fires once for one real moment in time; if that
delivery is never retried and never succeeds, the moment it was
reporting is simply never communicated. A future one-shot async task
should default to retrying; a future recurring/scheduled one should
default to not.

---

## 33. Organizational scoping (ORG-1, ORG-2)

Two scoping primitives exist, and they answer different questions:

| Module | Scopes by | Caller can opt out? | Use for |
|---|---|---|---|
| `apps.core.views.CustomerScopedModelViewSet` | **who is calling** (`request.user.customer_profile`) | No — it is a security boundary | Every portal-facing viewset |
| `apps.core.scoping` | **what the caller asked for** (`?<param>=`) | Yes — absent means no filter | Staff-facing list narrowing, reports |

Never reach for the second where the first is meant. A `?department=`
filter is a convenience; it authorizes nothing.

**Declaring a scope.** A viewset lists its scopes as data and inherits the
parsing:

```python
class TicketViewSet(ScopedQuerysetMixin, BaseModelViewSet):
    queryset = Ticket.objects.all()
    scope_filters = (
        ScopeFilter(param="department", field="department"),
        ScopeFilter(param="branch", field="branch"),
    )
```

A second scope is a second tuple entry and nothing else — `apps/core/scoping.py`
was not modified when ORG-2 added `branch`. Multiple scopes compose with
**AND** (`apply_scope_filters` chains `.filter()` calls), so
`?department=3&branch=7` narrows on both and a no-overlap combination
returns an empty page — not a 400, and not an OR.

`ScopedQuerysetMixin` must come **before** `BaseModelViewSet` in the bases,
and the viewset must have a real `queryset` class attribute (its own
`get_queryset` override, if any, reaches the mixin through `super()`).
Only `list` is scoped; widen with `scoped_actions` deliberately.

A plain `APIView` (every `BaseReportView` subclass) calls
`apply_scope_filters(queryset, request.query_params, SCOPES)` directly
instead of inheriting anything.

**The param contract**, identical everywhere: absent/empty means no
filter; a numeric id filters by that id; the literal `"none"` filters for
rows with no value; anything else is a **400**. A malformed filter is
never a silently-unfiltered list.

**`Department` and `Branch` replaced the two JSON string lists.** SEC-4
shipped `departments` and `branches` as `JSONField` string lists, explicitly
as placeholders until something referenced an individual one. ORG-1 promoted
the departments half to `organization.Department`
(`0004_migrate_settings_departments`); ORG-2 promoted the branches half to
`organization.Branch` (`0008_migrate_settings_branches`). Both dropped their
column afterwards, so **`OrganizationSettings` now holds only scalars** —
branding (`name`, `logo_url`) and the two org-wide SLA defaults. No JSON
list column remains, and neither `_validate_string_list` helper survives.
A future story wanting a list of things on that model should create a model,
not a column: that is now the established answer, twice over.

`Department` is pointed at by `accounts.User.department` and
`tickets.Ticket.department`; `Branch` by `accounts.User.branch`,
`customers.Customer.branch`, and `tickets.Ticket.branch`. All five are
nullable `SET_NULL` — deleting an org unit unassigns, never cascades and
never blocks.

Note that `PortalTicketSerializer.Meta.fields` is **derived** from
`TicketSerializer.Meta.fields`, so every field added to the staff ticket
serializer lands on the portal automatically and must be considered for
`read_only_fields` in the same change. `department` was writable by portal
customers between ORG-1 and ORG-2 for exactly this reason.

**Frontend:** department options live in `src/shared/departments/` and branch
options in `src/shared/branches/`, not in a feature — three and four features
respectively need the same list, and `no-restricted-imports` (§15) forbids
reaching across features for it. `features/organization/` owns only the
management screens and the write path, and its mutation hooks invalidate the
**shared** key prefix so every picker refreshes.

**A scope filter is not an access boundary.** `?department=`/`?branch=`
narrow a list the caller was already authorized to read in full. Any staff
account with `tickets.view` can list any branch's tickets, by design.
Restricting *what a staff account may see* to its own org unit is a change to
the top row of this section's table, not the bottom one — it needs its own
story and its own audit of every report, export, and queue.

### Default list scope (ORG-4, Story 98)

**The rule.** `TicketListPage` initialises its department and branch
filters to the caller's own `user.department`/`user.branch` id when that
field is set, otherwise `'all'` — one uniform rule, with **no role check**.
A caller with neither field set (verified in seed data: `manager` and
`super_admin` both have no department/branch) gets `'all'` from that same
rule, with nothing special-cased for their role.

**This is a default, not a boundary — the preceding paragraph still holds
in full.** The backend is unchanged, `ScopeFilter` remains opt-in, the
`Select`s still offer "All departments"/"All branches", and any caller
holding `tickets.view` can still list every ticket by widening the filter
or calling the API directly with no params. Nothing here narrows what a
staff account is *authorized* to see — only what it sees by default.

**Why a real access boundary (rather than a default) was rejected.**
Enforcing this server-side would need filtering in `TicketViewSet.get_queryset`
by `request.user`, which this section's own preceding paragraph already
scopes to its own story — plus an audit of every report, export, and
`DataTable` consumer that has no such decision today. It would also break
assignment: assignment is verifiably department/branch-blind (`AssignmentRule`
has no department/branch field; `assignable_agents()` filters on
`tickets.manage` alone), so agents are routinely assigned tickets outside
their own org units, and a hard boundary would make those tickets
un-openable rather than merely unlisted by default.

**Why `MyTicketsPage` is exempt.** "Assigned to me" is already the
tightest possible scope — the assignee IS the filter. Intersecting it with
department/branch could only ever subtract the agent's own work, and given
assignment's department/branch-blindness above, it routinely would.

**The two single-dimension queue screens this replaced.**
`DepartmentQueuePage`/`BranchQueuePage` (ORG-1/ORG-2) are retired: each
could only ever show one dimension of an agent's tickets — never the
intersection, which is the number that is actually theirs.

---

## 34. Observability & logging mechanism (PROD-1)

§ 10 is the **policy** (logger names, the five levels, never log secrets).
This section is the **mechanism** `PROD-1` (Story 88) built under it. § 10
still governs how you write a log call; nothing here changes a call site.

**Three layers, and a new logger gets all of them for free.** A `ContextVar`
(`apps/core/logging.py`) holds the current request id; `ContextFilter` copies
it onto every record; `JsonFormatter` serialises it. The filter is registered
on the **`console` handler**, not on individual loggers — which is why
`apps.*`, `config.*`, `django.*` and `celery.*` are all correlated without
declaring anything, and why a new `logging.getLogger(__name__)` anywhere needs
no correlation code at all. **Do not move that filter onto a logger.** The
`text` formatter interpolates `{request_id}`, and a `{}`-style format naming an
attribute a record does not carry raises `ValueError` on *every* line it sees —
surfacing as garbage on stderr rather than as an exception anyone notices.

**`text` for humans, `json` for collectors.** `DJANGO_LOG_FORMAT` defaults to
`text` in `settings/base.py` and to `json` in `settings/prod.py`. JSON is one
object per line, `ensure_ascii=False` (an Arabic subject must stay readable,
§ 18) and `default=str` (a `UUID`/`datetime`/`Decimal` in `extra` must not
raise `TypeError` from inside the logging machinery).

**`request.path`, never `request.get_full_path()`, in any log call.** A query
string can carry a credential: the inbound-email webhook (COMM-1)
authenticates with `?token=<EMAIL_INBOUND_WEBHOOK_TOKEN>`, so logging full
paths would write a shared secret to stdout on every delivery. This is § 10's
"never log secrets" made specific, and it applies to Sentry too —
`before_send` pops `query_string`, `data`, and `cookies` off every event.

**`extra=` is scrubbed by key name, not by value.** `SENSITIVE_KEY_RE`
(`apps/core/logging.py`) matches `password|secret|token|api_key|authorization|
credential|cookie|session` as a case-insensitive substring of the **key** and
replaces the value with `[redacted]`, recursively. Values are never inspected:
a scrubber that guesses at value shapes both over- and under-redacts.

**Reserved `extra` keys.** `request_id` and `user_id` are written
authoritatively by `ContextFilter` — passing them in `extra` is pointless, they
are overwritten. `celery_task_id`/`celery_task` are filled from
`celery.current_task` only when the call site did **not** supply them. And
`logging` itself raises `KeyError: "Attempt to overwrite 'x' in LogRecord"` for
any `extra` key that collides with a real `LogRecord` attribute (`name`,
`module`, `args`, `message`, …) — which is why `AccessLogMiddleware` passes
`req_user_id`, not `user_id`. The full list is `apps/core/logging.py::RESERVED`.

**`request_id` lives inside `error`, never at the top level and never in
`meta`.** `apps/core/tests/test_exceptions.py:30` pins the envelope's four
top-level keys on every error path, and `test_health.py:30` pins `meta` to
`None` on a success. `error_envelope` adds it conditionally, exactly as it
already did for `debug`. Any future envelope change inherits this constraint.

**Django's own `django.request` lines carry no request id, and that is
expected.** `django/core/handlers/base.py:140-143` runs the middleware chain
and *then* calls `log_response`, so a 4xx/5xx line from that logger is emitted
after `RequestIDMiddleware` has already reset the ContextVar. Nothing is lost:
`AccessLogMiddleware` logs the same request with the id and the same status,
and an unhandled 500's traceback (`apps/core/exceptions.py`) is logged *inside*
the chain, correlated. **Do not "fix" this by dropping the reset** — a
ContextVar surviving a request would mislabel a later one, and a log that is
confidently wrong is worse than one that is blank.

**Correlation stops at two boundaries, deliberately.** A Channels WebSocket
connection never runs the HTTP middleware chain, so a consumer logs with an
empty `request_id`. And a Celery task runs in another process, so the
ContextVar does not travel with it — a task's lines correlate to each other via
`celery_task_id`, not back to the request that queued them. Joining those would
mean threading the id through every `.delay()` call site; if a later story
wants that, it is a deliberate change, not an oversight to patch locally.

**Sentry is DSN-gated and errors-only.** `sentry_sdk.init` sits inside
`if SENTRY_DSN:` in `settings/base.py` — with the DSN blank (the
`.env.example` default) the SDK is never even imported. It is initialised in
settings rather than `AppConfig.ready()` precisely so it is armed *before* the
app registry finishes building. `send_default_pii=False`,
`max_request_body_size="never"`, and `before_send` together mean no event,
breadcrumb, tag, or user field ever carries an email, a name, a role, a body, a
cookie, a query string, or a header matching `SENSITIVE_KEY_RE`. The only
identity sent is the numeric user id. `traces_sample_rate` defaults to `0.0`:
turning on performance tracing is a `PROD-2` decision with its own cost, not
something to enable in passing.

**`print()` is absent from `apps/` and `config/`, and stays absent.** Verify
with `grep -rn "print(" backend/apps backend/config --include="*.py"` — the
only hits are `password_fingerprint` substring matches. `config/celery.py`'s
`debug_task` was the last real one; note that its replacement needed the
`config` logger entry in `LOGGING`, because `config.*` is outside the `apps`
tree and would otherwise fall through to root at WARNING.

---

## 35. Performance & caching mechanism (PROD-2)

`PROD-2` (Story 91) added no `select_related`/`prefetch_related` and rewrote
no serializer. Every claim below is measured, not assumed — reproduce any of
them with the seed-and-`EXPLAIN` harness in Story 91's `## Verification
Steps` before adding to this section.

**Measured baseline** (250,000 customers, 250,000 tickets, a realistic
skewed status distribution — 97% `closed`, ~1% each `open`/`pending`/
`resolved` — on local PostgreSQL):

| Finding | Before | After | Change |
|---|---:|---:|---|
| `customers ORDER BY name LIMIT 25` | 14.5 ms (`Sort`) | 0.1 ms (`Index Scan`) | **233x** |
| `customers WHERE name ILIKE '%…%'` | 41.2 ms (`Sort`) | 1.1 ms (GIN trgm) | **37x** |
| `tickets WHERE status='open'` (**1%** of rows) | 0.6 ms | 0.1 ms | **5.2x** |
| `tickets WHERE status='open'` (**25%** of rows) | 7.5 ms | 5.7 ms | **no change** |
| `SELECT COUNT(*) FROM tickets_ticket` @50k rows | 4.3 ms (`Seq Scan`) | — | no index helps |
| `SELECT COUNT(*) FROM tickets_ticket` @250k rows | **96.1 ms** (`Parallel Seq Scan`) | — | **grows linearly, forever** |
| `/api/reports/dashboard/kpis/` end-to-end (the home page) | 406.3 ms | ~0 queries, cached | cache |
| `/api/reports/sla/trend/` end-to-end | 468.6 ms | ~0 queries, cached | cache |

**There was no N+1 anywhere in this API.** 28 endpoints — every list, the
ticket detail/`history`/`context`/`sla` actions, `customers/<id>/timeline`,
and all eight report endpoints — were measured with `CaptureQueriesContext`
at 1 row and at 25 rows. Every query count was completely flat. The existing
`select_related`/`prefetch_related` discipline and the `Subquery` batching in
`apps/reports/sla.py`/`apps/reports/agents.py` (Stories 57/58) already do
their job. **Before adding a `select_related` anywhere "for performance",
measure first** — the base rate in this codebase is zero N+1, not one.

**A filter does not justify a composite index — selectivity does.**
`(status, -created_at)` on `tickets_ticket` bought *nothing* at a uniform 25%
status distribution (Postgres correctly preferred a backward scan of the
existing `created_at` index under `LIMIT 25`), and **5.2x** once the data was
realistically skewed to ~1% `open`. Uniform test data produces the wrong
answer in either direction. **Measure selectivity with realistic data before
adding a composite index anywhere else in this project.**

**`COUNT(*)` is the worst-scaling query in this API, and no index fixes it**
— counting reads every row by definition. It is issued on every paginated
response, including `HomePage`'s two `page_size=1` KPI tiles
(`frontend/src/app/HomePage.tsx:107,110`), where it is the entire cost of the
request. `apps/core/pagination.py::CachedCountPaginator` caches only the
count, never the page of rows, behind `COUNT_CACHE_TTL_SECONDS` (30s,
deliberately matched to the frontend's own `staleTime: 30_000`,
`frontend/src/shared/lib/api/queryClient.ts:51`) and only above
`COUNT_CACHE_MIN_ROWS` (1,000 — below that a Redis round-trip costs more than
the query it would replace). `count`/`num_pages` cannot be removed from
`meta.pagination` — `DataTablePagination.tsx:31,59` and `HomePage.tsx:137,144`
read them directly.

**Every `?search=` in this API compiles to `ILIKE '%term%'`** (DRF's
`SearchFilter`), which no btree index — including the `varchar_pattern_ops`
indexes Django already builds — can serve, because the leading `%` rules out
any prefix match. A `pg_trgm` GIN index is the fix, measured at 37x.
`Customer.name` and `Ticket.subject` carry one each; the other 13
`search_fields` declarations in this project are on configuration or
low-volume tables and do not.

**Every cache read and write goes through `apps/core/cache.py`.** Its
`cache_get`/`cache_set`/`cache_delete` swallow every exception and log at
`WARNING` (§ 10) — a Redis outage degrades to uncached, **never** to a 500.
**Do not call `django.core.cache` directly anywhere else.**

**A cache key must fully determine the response it stores.** Report caching
(`apps/reports/views.py::BaseReportView.get`) is safe *only* because report
scoping is by query parameter (`apps/core/scoping.py::apply_scope_filters`,
`?department=`/`?branch=`), never by caller identity — the key is
`path + sorted query string + language`. **The identity-scoped `apps/portal/`
tree is never cached on a path+query key**, and must not be by a future
story: two customers hitting the identical URL get different rows, and a
path-only key would leak one customer's data to another. A future cache on
an identity-scoped view must include the user id in its key.

**Two Redis databases, never shared.** `CELERY_BROKER_URL`/
`CELERY_RESULT_BACKEND` (`REDIS_URL`, database 0) and `CACHES["default"]`
(`REDIS_CACHE_URL`, database 1) are deliberately different databases on the
same Redis instance — a cache `FLUSHDB` must never drop a queued Celery job.

**Caching needed no new dependency.** Django's built-in
`django.core.cache.backends.redis.RedisCache` and the `redis` package
(already installed for Celery since `SLA-0`) were sufficient — `django-redis`
was considered and rejected as redundant. Contrast `PROD-1`, which added
`sentry-sdk`/`@sentry/react` because nothing already in the project did error
tracking.

**Deliberately unindexed:** `accounts.Role.name`, `agents.QuickReply.title`,
`knowledge_base.FAQ.order`/`question`, `sla.EscalationRule.kind`/
`threshold_minutes`, `sla.SLAPolicy.category__name`,
`integrations.WebhookSubscription.name`, `customers.ContactDetail.channel`.
All are configuration tables holding tens of rows, or (`ContactDetail`)
always reached behind a required `?customer=` filter that narrows to a
handful of rows first. **Do not add an index to a configuration table without
a measurement showing it matters** — this is a decision, not an oversight.

**`TimeStampedModel.created_at` already carries `db_index=True`**
(`apps/core/models.py:10`), which is why every `-created_at` default
ordering in this project was already covered before `PROD-2`. **Never add a
redundant `created_at` index.**

---

## 36. Security hardening mechanism (PROD-3)

`PROD-3` (Story 92) was an audit first and a change second: 121 `/api/`
routes were enumerated programmatically, 45 serializers instantiated and
inspected, and `manage.py check --deploy` run against production settings.
**Three of the intake's four axes came back clean.** Reproduce any claim
below with the scripts described in Story 92's `## Verification Steps`
before assuming it needs re-doing.

**Authz coverage was already complete — zero real gaps across 121 routes.**
The first audit pass reported 19 apparent `permission_map` gaps; every one
was a false positive, because the router binds a route for a verb the view
already drops via `http_method_names`, which 405s at Django's own
`dispatch` **before `HasPermission` is ever consulted**
(`AuditLogViewSet`'s write actions are the clearest example — closed
deliberately, for immutability, not left unmapped). This is now enforced
mechanically: `apps/core/checks.py::check_permission_map_coverage`,
registered from `CoreConfig.ready()`, reports `core.W001` on
`manage.py check` for any `HasPermission`-gated action missing a
`permission_map` entry, exempting only verbs the view has already dropped
via `http_method_names` and the two names in `EXEMPT` (owner-scoped
personal resources, each with a written reason). **A `Warning`, not an
`Error`** — it must stay visible in every `check` run without becoming a
hostage to a legitimately authenticated-only view.

**Secret handling was already clean.** 45 serializers, 16 credential-named
fields, and the only 5 readable on output are `has_*` **booleans**
("is this configured?"), never a value. Every stored credential
(`EmailProviderConfig.host_password`, `WhatsAppProviderConfig.access_token`,
`SmsProviderConfig.auth_token`, `ErpConnection.auth_token`,
`WebhookSubscription.secret`) is `write_only`; `ApiKey` stores only a
`sha256` digest.

**`manage.py check --deploy` already reported zero security warnings**
against `config.settings.prod` — every issue it does report is
`drf_spectacular.W002` schema-generation noise on plain `APIView`s. `PROD-3`
therefore adds **no** `SECURE_*` setting; there was nothing left to add.

**Rate limiting was the one real gap: exactly one throttled endpoint in the
whole API** (`PasswordResetRequestView`, SEC-7). Login, token refresh,
invite/password-reset confirmation, change-password, both anonymous
`Customer`+`Ticket` creators, all three inbound webhooks, and every
AI-provider-backed endpoint were completely unthrottled.

**`NUM_PROXIES` is load-bearing for every throttle in this project, present
and future.** DRF's `BaseThrottle.get_ident` falls back to the entire,
client-supplied `X-Forwarded-For` header when `NUM_PROXIES` is `None` —
this project's state before `PROD-3` — which made every IP-keyed throttle,
including SEC-7's own, bypassable by rotating that header on each request.
`REST_FRAMEWORK["NUM_PROXIES"]` now reads `DJANGO_NUM_PROXIES` (default
`0`, meaning "trust `REMOTE_ADDR`, no proxy"). **Get this wrong in either
direction and rate limiting is wrong**: too low behind a real proxy
throttles an entire NAT as one client (visible, a support ticket); too high
trusts a forged header entry (silent, a bypass). Verified live in both
directions: with `NUM_PROXIES=0`, thirteen requests each carrying a
different forged `X-Forwarded-For` shared one bucket (10 × 401 then 429);
with `NUM_PROXIES=1`, the same thirteen requests each got their own bucket
(13 × 401) — proving the setting is read and that it must match the real
topology, not be raised "to be safe."

**DRF throttling is backed by `CACHES["default"]`, so it depends on
`PROD-2`'s Redis exactly as report/count caching does** (`rest_framework/
throttling.py:6,62`). On `LocMemCache`, the pre-`PROD-2` default, a rate is
per-worker — N workers allow N× the configured rate. **A throttle added
before a shared cache exists is not a throttle.**

**Throttling fails open, never closed — this is `apps/core/throttling.py`'s
whole reason to exist.** Plain DRF throttle classes have no exception
handling around their cache calls (`allow_request`'s `cache.get`,
`throttle_success`'s `cache.set`), so a Redis outage would raise *inside*
the throttle and 500 every throttled endpoint — strictly worse than not
throttling at all. `_FailOpenMixin` wraps the whole `allow_request` chain: a
cache failure logs at `WARNING` (§ 10) and allows the request. **Every
throttle class in this project must be a fail-open subclass**
(`FailOpenAnonRateThrottle`, `FailOpenUserRateThrottle`,
`FailOpenScopedRateThrottle`, `AiRateThrottle`) — never a bare
`rest_framework.throttling.*` class. Verified live: with `REDIS_CACHE_URL`
pointed at an unreachable port, `/api/auth/token/`, `/api/tickets/`,
`/api/reports/dashboard/kpis/`, and `/api/live-chat/start/` all returned
their normal status, never a 500, each logging exactly one `WARNING` tagged
with its `request_id`.

**A view's own `throttle_classes` replaces `DEFAULT_THROTTLE_CLASSES`; it
does not stack.** A sensitive endpoint loses the `anon`/`user` baseline the
moment it declares its own scope. A scope typo therefore silently removes
*all* throttling from that view rather than falling back to the baseline —
verify a new throttled endpoint actually 429s, don't assume it from the
declaration alone.

**`ScopedRateThrottle`/`FailOpenScopedRateThrottle` key on `request.user.pk`
when authenticated and on IP otherwise** (`rest_framework/throttling.py:
235-247`). This is why the credential scopes (`auth_credentials`) are
effectively per-IP — the caller has no identity yet — and why the `ai`
scope is per-user: one caller cannot spend another's provider budget, and
an integration calling through a single API key concentrates the cost on
that key's `User`, which is what makes it attributable rather than a bug.

**A per-`@action` throttle needs its own class, not a class attribute.**
`ScopedRateThrottle` reads `throttle_scope` off the *view*, which cannot
vary per action on a viewset without also throttling every other action on
it. `AiRateThrottle` carries its scope on itself instead, passed via
`@action(throttle_classes=[...])`, so `TicketViewSet.summarize` can be
limited without touching `list`/`retrieve`.

**`/api/health/` and the `/api/` 404 catch-all are permanently
throttle-exempt** (`throttle_classes: list = []`), verified live over 400
consecutive requests each with zero `429`s. Throttling a load-balancer's own
liveness probe converts a traffic burst into a reported outage. **Any
future global throttle mixin must preserve both exemptions.**

**A webhook throttle is set deliberately loose.** `webhook_inbound` at
`600/minute` exists to stop a flood from exhausting the database, not to
shape a provider's real burst — a dropped webhook is lost customer data,
and providers retry only for a bounded window. **Never tighten this without
measuring a provider's actual delivery rate first.**

**Uploads are allowlisted by extension, never denylisted, and this is
defense-in-depth, not an XSS fix.** `AttachmentViewSet.perform_create`
checks `ALLOWED_ATTACHMENT_EXTENSIONS` after the existing size check.
`download`'s `as_attachment=True` (`Content-Disposition: attachment`) is
what actually stops a stored `.svg`/`.html` from rendering inline — **never
remove `as_attachment=True`** — the allowlist alone only stops the
"redistribute an arbitrary executable" half of the problem. It is an
extension check, not content sniffing: a `.png` containing HTML still
passes; real content inspection would need a new binary dependency
(libmagic) this project deliberately does not add. Extend the set rather
than switching to a denylist. A `SuspiciousFileOperation` from Django's own
`validate_file_name` (a crafted `../` filename, already neutralised by
Django before it reaches disk) is now caught and re-raised as a
`ValidationError` — a 400, not the 500 it was before.

**`/api/schema/`, `/api/docs/`, `/api/redoc/` default to public in dev and
private in production.** `API_DOCS_PUBLIC` in `prod.py` **must recompute
`SPECTACULAR_SETTINGS["SERVE_PERMISSIONS"]`**, not merely rebind the flag —
`base.py` already computed that key from `base.py`'s own default, so
setting `API_DOCS_PUBLIC` in `prod.py` alone would change a variable
nothing reads again and leave the docs public. Verified live in both
settings modules. The routes are narrowed to `IsAuthenticated`, never
removed — an authenticated integrator keeps them.

**Known limitation, recorded rather than hidden: login throttling is
per-IP only.** `auth_credentials` does not stop a distributed
credential-stuffing attack spread across many source addresses. The two
real mitigations — a per-username failure counter, or an account-lockout
policy — both carry real UX and lockout-DoS trade-offs a future story
should decide deliberately, not inherit as a side effect of this one.

---

## 37. Optional Docker packaging (PROD-4)

**Docker is optional and must stay optional.** `README.md` §§ 1-6 — locally
installed PostgreSQL, Redis, Python and Node — is *the supported path*. A
change that makes a container required to run, test, or develop SupportOS
contradicts `SupportOs backlog.MD:969` ("must not become required for local
dev; local (non-Docker) path stays first-class") and this section. `PROD-4`
(Story 93) adds `docker-compose.yml`, two `Dockerfile`s, two `.dockerignore`s
and `.env.docker.example`, and **changes not one line under `backend/apps/`,
`backend/config/`, or `frontend/src/`**. That is the shape any future change
here should keep.

**The stack is dev-parity, not a deployment.** It runs `config.settings.dev`
and the same commands the README documents — `manage.py runserver`,
`celery -A config worker`, `celery -A config beat`, `npm run dev` — with the
source bind-mounted so reload works exactly as it does locally. It is a
different way to start the same processes, not a different architecture.

**There is deliberately no production compose file**, and the reason is three
decisions this repo has never made. A future story that wants one must make
them on purpose rather than inherit them:

1. **Static files are served by nothing under `DEBUG=False`.** There is no
   `whitenoise`, no `staticfiles_urlpatterns()` in `config/urls.py`, and
   Django's DEBUG static-serving is a **`runserver` feature, not an ASGI
   application one** — so a bare `daphne config.asgi:application` leaves
   `/admin/` and `/api/docs/` unstyled. Fixing it means a new dependency or an
   nginx volume-sharing design.
2. **`prod.py` defaults `SECURE_SSL_REDIRECT` to `True`.** Behind a
   plain-HTTP local proxy that never sets `X-Forwarded-Proto: https` that is an
   immediate redirect loop.
3. **`DJANGO_NUM_PROXIES` becomes load-bearing** (§ 36). Behind a reverse
   proxy it must be `1`; the current stack puts no proxy in front of Django,
   so `0` is correct and anything else is a rate-limiting bug.

**Never scale the backend service.** `CHANNEL_LAYERS` is
`InMemoryChannelLayer` (`config/settings/base.py`), single-process by design,
so `--scale backend=2` means a WebSocket broadcast reaches only the clients on
the replica that produced it — **live chat and notification push half-work
with no error anywhere**, which is far worse than an outright failure.
Switching to `channels_redis` is the prerequisite for any multi-replica
topology, and is its own story.

**Container-network values belong in `docker-compose.yml`, never in
`.env.docker`.** Six keys differ inside the Compose network:
`POSTGRES_HOST`, `REDIS_URL`, `REDIS_CACHE_URL`, `DJANGO_ALLOWED_HOSTS`,
`CORS_ALLOWED_ORIGINS`, `FRONTEND_URL`. They are set in each service's
`environment:` block, which outranks `env_file:` **and** outranks the
bind-mounted `backend/.env` — because `django-environ`'s `read_env()` never
overwrites a variable that already exists in the environment
(`environ/environ.py`), and returns quietly when the file is absent. That one
property is what lets the Docker path be self-contained without forbidding a
coexisting `backend/.env`, whose remaining values (AI keys, SMTP) usefully
carry over.

**`VITE_API_BASE_URL` must stay an absolute `http://` URL.**
`getWebSocketUrl` (`frontend/src/shared/lib/ws.ts`) derives `ws://` from it by
replacing the scheme, so a relative `/api` yields a schemeless string that
`new WebSocket()` rejects. The failure is partial and therefore nasty: **REST
keeps working and only WebSockets break.** This is why the containerized
topology stays cross-origin (frontend `:5174` → backend `:8001`) exactly like
local dev, rather than being collapsed behind one origin.

**`--pool=solo` is a Windows-*host* workaround and must never appear in the
container's Celery command.** README § 6 prescribes it correctly for Windows
developers because Windows lacks `fork()`; the container is Linux regardless of
host OS, so the default prefork pool is both correct and faster.

**Host ports are offset by design** — `5433`/`6380`/`8001`/`5174` against the
non-Docker `5432`/`6379`/`8000`/`5173` — so both stacks run simultaneously.
Changing one means changing `VITE_API_BASE_URL`, `CORS_ALLOWED_ORIGINS` and
`FRONTEND_URL` together, or the browser silently fails CORS.

**`docker compose down -v` destroys the database and every uploaded
attachment.** `postgres_data` and `backend_media` are named volumes precisely
so plain `down` does not. Note also that `postgres:16-alpine` only honours
`POSTGRES_*` on an **empty** data directory — changing the password later
requires `down -v` or an `ALTER ROLE`.

**Celery is not optional, and README § 6's old claim that "nothing dispatches
a real background task yet" was stale.** Fifteen modules dispatch or define
tasks; without a worker, invite/password-reset email, SLA escalation,
auto-assignment, notifications, AI jobs, ERP sync and webhook delivery all
silently do not run. Any stack claiming parity includes `worker` and `beat`.

---

## 38. Business hours & working-time arithmetic (SLA-5)

**One working-time primitive, every consumer calls it.**
`apps/organization/business_hours.py::advance`/`elapsed_working_minutes`
(Story 111) is the single implementation of "advance a timestamp by N
working minutes" / "measure elapsed working minutes between two
timestamps." `apps/sla/policy.py::compute_sla_status` and
`apps/sla/escalation_rules.py::is_at_risk`/`is_idle` are its only consumers
today — a future feature needing the same arithmetic (a second reporting
metric, a different domain's deadline) must import this module, never
re-derive it.

**A calendar is optional, all the way down.** No `SLAPolicy`/`Branch`/
`OrganizationSettings` configuration is required anywhere; a
`BusinessCalendar` with zero `WorkingWindow` rows and a ticket/policy/branch
with no calendar at all both resolve to the exact same plain wall-clock
arithmetic this codebase used before Story 111. Nothing "breaks" by
omission — see that story's own `## Story Goal`.

**Calendar resolution has one order, defined once.**
`apps/sla/policy.py::resolve_calendar(ticket, policy)`: the resolved
`SLAPolicy`'s own `calendar`, else the ticket's `branch.calendar`, else
`None`. Both `compute_sla_status` and `escalation_rules.py`'s
`is_at_risk`/`is_idle` call this same function — never a second, parallel
resolution.

**Not every SLA consumer is calendar-aware, and that is a recorded,
deliberate limitation, not an oversight.** The bulk ticket-list
`sla_status` column (`apps/sla/policy.py::bulk_target_resolver`/
`annotate_sla_facts`, `apps/tickets/serializers.py::get_sla_status`) and
`apps/reports/sla.py` (RPT-2) still compute plain wall-clock due times even
when a ticket's resolved policy/branch has a calendar. A ticket's list
badge can therefore disagree with its own `GET /tickets/<id>/sla/` detail
once a calendar is involved — see Story 111 `## Edge Cases & Failure
Modes`. Extending the bulk path needs its own batching design (the exact
deferral Story 28 already recorded for the N+1 problem itself) and is not
assumed solved by this addition.

---

## 38. Data retention & data-subject rights (SEC-10)

Two independent halves, deliberately living in two different apps.

**The scheduled purge/anonymize job lives in a NEW app, `apps/compliance`
— not in `tickets`/`communications`/`customers`/`accounts`, even though it
touches all four.** No single one of those apps "owns" a cross-cutting
compliance sweep any more than `tickets` owns SLA escalation — `apps/sla`
already established the precedent that a scheduled, cross-model automation
job gets its own app (`apps/README.md` rule 4). `apps/compliance` has no
`models.py` at all — the four retention-DAY settings it reads live on
`organization.OrganizationSettings` (SEC-4), read fresh on every run the
same way `apps.sla.policy.resolve_policy` already reads that model's SLA
defaults.

**The customer-scoped export/erasure actions live in `apps/customers`
instead**, as new `@action`s on the existing `CustomerViewSet` — the same
"belongs to exactly one business area, cross-app reads are normal" shape
`apps/customers/timeline.py::build_timeline` already established for
`CustomerViewSet.timeline` (`apps/README.md` rule 1 beating rule 2).

**Erasure anonymizes the `Customer` row; it never deletes it.**
`Ticket.customer` is `on_delete=PROTECT` — a customer with any ticket
history cannot be hard-deleted without breaking that guarantee, and every
`Ticket`/`AuditLog` row must survive an erasure for report aggregates and
the erasure's own audit trail to still mean anything. `apps.customers.
erasure.erase_customer` blanks `Customer.name`/`.email`/`.phone`/
`.company`, deletes every `ContactDetail`/`Note`/`Attachment` (row and
file), and blanks `Message.body`/`Ticket.subject`/`.description`/
`Feedback.comment` — the row, its status/priority/category/dates, and
every audit trail entry all survive untouched.

**`AuditLog` gained a third nullable target FK, `target_customer`** —
the exact `target_user`/`target_role` two-FK shape (§22, this model's own
docstring) extended by one, not replaced with a `GenericForeignKey`
(consistent with `apps/notifications/models.py`'s own established rule).

**`Ticket.closed_at` exists because `updated_at` is not a safe retention
clock for a terminal status.** `closed` has no outbound transition
(`apps/tickets/status.py::VALID_TRANSITIONS`), but a later edit to an
already-closed ticket still bumps `updated_at` — `closed_at` is set exactly
once, only inside `apply_status_change`, the same "set once, on one
specific transition" shape `escalated_at` already has.

**`Customer.legal_hold` is Django-admin-only, deliberately.** No
self-service UI in this story — the same scope boundary `external_id`
(a real serializer field, absent from the frontend form) already
establishes for an admin-only escape hatch on this same model.

**No shared Celery locking/idempotency primitive exists in this codebase
— a new scheduled task must invent its own via its own filter shape.**
`apps.compliance.retention`'s four functions are each idempotent because
they only ever re-select rows still past the cutoff and not yet in the
target end state; there is no `select_for_update`/distributed lock
anywhere in `config/celery.py`/`settings/base.py` to reuse, and none is
added by this story either.

---

## 39. SLA clock pause & the second signals exception (SLA-6)

**`apps/tickets/signals.py` (Story 112) is this codebase's SECOND
deliberate use of Django model signals, after `apps.integrations.signals`
(INT-4, §32).** Read §32 first — its own instruction — before adding a
THIRD. The justification is identical: an inbound `Message` (a customer's
own reply) is created from five independent channel-adapter call sites,
with more likely in the future, and this codebase has already been bitten
once by the decentralized-call-site alternative (`EmailAdapter.receive`'s
own "F-25" comment, apps/communications/email_adapter.py). A `post_save`
receiver on `Message`, watching for `direction=INBOUND`, is what ends a
ticket's `pending_customer` wait automatically, no matter which channel
the reply arrives on — see Story 112 `## Prerequisites`.

**A ticket's accumulated SLA pause is stored explicitly
(`Ticket.sla_paused_minutes`), never recomputed from history, and only
`apps/tickets/status.py::apply_status_change` writes it.** The still-OPEN
portion of a pause in progress right now is the one exception: it is added
live by `apps/sla/policy.py::_effective_paused_minutes`, the same "compute
what hasn't finished yet" rule this codebase already applies to
`response_status`/`resolution_status` themselves (§23's SLA-1 paragraph).
Editing a `WorkingWindow`/`Holiday` (SLA-5) later can still change a LIVE
due-date computation, but it can never rewrite an already-closed-out pause
— that total is a fact about the past, not a live derivation.

**Not every SLA consumer needs to agree on how precisely a pause is
measured.** The single-ticket detail path (`compute_sla_status`) is
calendar-aware for pause the same way it already is for due times (§38's
business-hours section); the ticket-list and reporting bulk paths
(`status_from_facts`, `apps/reports/sla.py`) treat accumulated pause as
plain minutes, no calendar lookup — the identical, already-accepted
simplification §38 documents for due-time calendar-awareness on those same
two paths, now extended to cover pause too.

---

## 40. Node port conventions (`CONV-NODE`, EPIC 18)

[`CONVENTIONS-NODE.md`](CONVENTIONS-NODE.md) is the Node/TypeScript counterpart of this
document, for `EPIC 18`'s port of the Django API. It covers only what is genuinely new
because the runtime is different — module layout, the single envelope interceptor, the
exception filter and its error-code map, DTO validation, guard placement, config
validation, and correlation-id propagation.

Everything else in `CONV` still governs the port unchanged: naming (§ 2), the `snake_case`
wire format (§ 12), the envelope as the only response shape (§ 11), the permission
vocabulary (§ 22), i18n (§ 18) and logging policy (§ 10, § 34) are cited there by section
number, never restated.

**The port adds no product scope.** A NODE story that introduces a new endpoint, a new
response shape, a schema change or a frontend edit has stopped being a port — raise it as
its own story in the owning epic instead. The acceptance spec is
[`docs/api-contract.django.yaml`](docs/api-contract.django.yaml), the frozen snapshot of
this API surface written by `python manage.py freeze_api_contract`.
