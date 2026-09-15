# Backend architecture — responsibility boundaries and measured manifest

This document answers one question: **for any given request, which file is responsible for
what, and how do we prove it?** It names the four backend responsibilities (models, routes,
controllers, services), shows where each one lives per app, and records a measured manifest
with the commands that reproduce every number in it.

The *decision record* for why the layout is shaped this way lives in
[`backend/apps/README.md`](../backend/apps/README.md) (one app per business area, files created
on demand, `core` is not a dumping ground). This document does not restate those rules — it
evidences the result.

---

## The four responsibilities

This project is Django + Django REST Framework, so the conventional MVC words map onto DRF
names. The mapping is fixed and there are no exceptions:

| Responsibility | Lives in | DRF/Django name | What it may do | What it may not do |
|---|---|---|---|---|
| **Model** | `apps/<area>/models.py` | Model / QuerySet | Field definitions, constraints, `Meta`, model-level validation, query helpers | Reach into HTTP, know about request/response, call another app's view |
| **Route** | `apps/<area>/urls.py`, registered once in `config/api_urls.py` | URLConf / DRF router | Map a URL to a controller, name the route | Contain logic or branching |
| **Controller** | `apps/<area>/views.py` | `ViewSet` / `APIView` | Resolve permissions, bind a serializer, call **one** service function, shape the HTTP result | Hold business rules, build querysets by hand when a scoping mixin exists, talk to a third party |
| **Service** | `apps/<area>/<concern>.py` — one module per concern | plain module-level functions | All business rules, transactions, side effects, third-party calls | Import DRF, read `request`, return `Response` |

**Naming note (important, and the reason this doc exists):** there is deliberately no
`services.py` in most apps. A single `services.py` per app becomes a 2,000-line grab bag. The
service layer here is **one module per business concern**, named after the concern, holding
plain functions. In `tickets` that is `assignment.py`, `bulk.py`, `context.py`,
`duplicates.py`, `escalation.py`, `history.py`, `merge.py`, `reply_suggestions.py`,
`solution_suggestions.py`, `status.py`, `summarization.py`. `TicketViewSet` imports a function
from each and calls it; the rules live in the module, not the viewset. `notifications` is the
one app that does use `services.py`, because it has exactly one concern to hold.

So the layering is:

```
Route (urls.py)
  → Controller (ViewSet action in views.py)
      → Serializer (validation / representation)
      → Service (one function in one concern module)
          → Model / QuerySet
```

---

## Request lifecycle — one concrete trace

`PATCH /api/tickets/42/status/` end to end:

| Step | File | Responsibility |
|---|---|---|
| 1 | `config/asgi.py` | process entry (ASGI; also serves the WebSocket consumers) |
| 2 | `apps/core/middleware.py` | assigns/propagates `X-Request-ID`, logs the request line |
| 3 | `config/urls.py` → `config/api_urls.py` | mounts every app's routes under `/api/` — the single place to read the API surface |
| 4 | `apps/tickets/urls.py` | router resolves the `status` detail action |
| 5 | `apps/core/permissions.py` | `permissions_for(Permissions.TICKETS_MANAGE)` gate (25 permission constants, one catalog) |
| 6 | `apps/core/scoping.py` | `ScopedQuerysetMixin` narrows the queryset to the caller's org/department scope **before** the object is fetched |
| 7 | `apps/tickets/views.py` | `TicketViewSet.status` — the controller: validate via serializer, call the service, return |
| 8 | `apps/tickets/status.py` | `apply_status_change(...)` — the service: transition rules, SLA timer effects, activity record |
| 9 | `apps/tickets/models.py` | `Ticket`, `TicketActivity` — persistence |
| 10 | `apps/tickets/signals.py` | post-save fan-out (notifications, SLA) |
| 11 | `apps/core/renderers.py` / `exceptions.py` | wraps success **and** error into the one response envelope |

Two boundary properties fall out of this and are worth stating explicitly, because they are
what "clear boundaries" means in practice:

- **Scoping is not the controller's job.** No viewset writes `.filter(org=...)` by hand;
  authorization-by-visibility is a mixin, so it cannot be forgotten in a new action.
- **The response shape is not the controller's job.** No viewset builds `{"success": ...}`.
  A renderer and an exception handler do it, so a hand-rolled response shape cannot leak.

---

## Per-app manifest

Measured from the running Django app registry, not hand-maintained. Reproduce with the
commands in [§ Reproducing every number](#reproducing-every-number).

| App | Models (measured) | Routes | Controllers | Service modules (business concerns) |
|---|---|---|---|---|
| `accounts` | 4 — `User`, `Role`, `AuditLog`, `TwoFactorRecoveryCode` | `urls.py` + `admin_urls.py`, mounted at `auth/` and root | 13 | `mfa.py`, `tokens.py`, `throttled_token_views.py`, `tasks.py` |
| `organization` | 9 — `Department`, `Branch`, `BusinessCalendar`, `WorkingWindow`, `Holiday`, `OrganizationSettings`, `LandingContent`, `LandingHighlight`, `LandingSocialLink` | `urls.py` | 11 | `business_hours.py` |
| `customers` | 4 — `Customer`, `ContactDetail`, `Note`, `Attachment` | `urls.py` | 4 | `timeline.py`, `export.py`, `erasure.py` |
| `tickets` | 5 — `Ticket`, `Category`, `TicketActivity`, `SavedView`, `Feedback` | `urls.py` | 3 | `assignment.py`, `status.py`, `escalation.py`, `history.py`, `merge.py`, `duplicates.py`, `bulk.py`, `context.py`, `reply_suggestions.py`, `solution_suggestions.py`, `summarization.py`, `signals.py` |
| `communications` | 4 — `Message`, `EmailProviderConfig`, `SmsProviderConfig`, `WhatsAppProviderConfig` | `urls.py` + `routing.py` (WebSocket) | 10 | `adapters.py` + `email_adapter.py`, `sms_adapter.py`, `whatsapp_adapter.py`, `live_chat_adapter.py`, `web_form_adapter.py`, `consumers.py` |
| `agents` | 3 — `Task`, `QuickReply`, `InternalNote` | `urls.py` | 3 | `tasks.py` |
| `sla` | 3 — `SLAPolicy`, `AssignmentRule`, `EscalationRule` | **none — internal** | 0 | `policy.py`, `assignment_rules.py`, `escalation_rules.py`, `tasks.py` |
| `knowledge_base` | 3 — `Article`, `Category`, `FAQ` | `urls.py` | 4 | `search.py` |
| `portal` | 0 — reuses `tickets`/`customers` models | `urls.py` | 5 | — (thin surface over other apps' services) |
| `reports` | 0 — read-only over other apps | `urls.py` | 9 | `aggregation.py`, `dashboard.py`, `tickets.py`, `sla.py`, `agents.py`, `export.py` |
| `notifications` | 1 — `Notification` | `urls.py` + `routing.py` (WebSocket) | 1 | `services.py`, `consumers.py`, `tasks.py` |
| `integrations` | 6 — `ApiKey`, `ErpConnection`, `ErpOrder`, `ErpSyncRun`, `WebhookSubscription`, `WebhookDelivery` | `urls.py` | 9 | `erp_client.py`, `erp_sync.py`, `webhook_client.py`, `webhook_dispatch.py`, `authentication.py`, `keys.py`, `schema.py`, `signals.py`, `tasks.py` |
| `ai` | 1 — `ChatbotSession` | **none — internal** | 0 | `client.py`, `prompts.py`, `categorization.py`, `chatbot.py`, `exceptions.py`, `tasks.py` |
| `compliance` | 0 — operates on other apps' models | **none — scheduled job only** | 0 | `retention.py`, `tasks.py` |
| `core` | 0 — abstract only (`TimeStampedModel`) | `urls.py` (health, permission catalog) | 5 | `envelope.py`, `renderers.py`, `exceptions.py`, `scoping.py`, `permissions.py`, `pagination.py`, `filters.py`, `throttling.py`, `cache.py`, `middleware.py`, `monitoring.py`, `logging.py`, `checks.py` |

**Three apps expose no routes, on purpose.** `sla`, `ai`, and `compliance` are consumed by
other apps' services (`tickets` imports `apps.sla.policy`; `tickets.summarization` imports
`apps.ai`) or run only on the Celery beat schedule (`compliance.retention`). An app without a
`urls.py` is evidence of the boundary holding, not of an unfinished app.

---

## Measured manifest

| Fact | Value | Source of truth |
|---|---|---|
| Domain apps | 15 (11 own models; `core`, `portal`, `reports`, `compliance` own none by design) | `backend/apps/` |
| Domain models | 43 | Django app registry |
| Database tables (dev, after `migrate`) | 62 | `connection.introspection.table_names()` |
| Migrations | 91 | `backend/apps/*/migrations/` |
| Python modules (apps + config) | 292 | `find apps config -name '*.py'` |
| REST endpoint paths | 131 | generated OpenAPI schema |
| Permission constants | 25 | `apps/core/permissions.py` |
| Route registry | `config/api_urls.py` | one `include()` per app, versionless `/api/` root |
| Dependency manifest | `backend/requirements.txt`, `requirements-dev.txt` | pinned runtime + dev deps |
| Lint/format manifest | `backend/pyproject.toml` | Ruff config (lint + format) |
| Schema generator | `drf-spectacular>=0.30,<1` | `SPECTACULAR_SETTINGS` in `config/settings/base.py` |

The OpenAPI document is **generated, not checked in** — a committed copy goes stale silently,
and `drf-spectacular` derives it from the live URLConf and serializers, so generating it is
also a consistency check on routes and controllers. It currently generates **clean, with no
warnings, across 131 paths**.

### Endpoint distribution (from the generated schema)

| Prefix | Paths | Prefix | Paths |
|---|---|---|---|
| `/api/tickets` | 17 | `/api/notifications` | 5 |
| `/api/auth` | 12 | `/api/tasks` | 4 |
| `/api/webhooks` | 8 | `/api/users`, `/api/saved-views`, `/api/providers`, `/api/attachments` | 3 each |
| `/api/reports` | 8 | `/api/roles`, `/api/categories`, `/api/departments`, `/api/branches`, `/api/calendars`, `/api/holidays`, `/api/faqs`, `/api/articles`, `/api/messages`, `/api/notes`, `/api/internal-notes`, `/api/quick-replies`, `/api/contact-details`, `/api/audit-logs`, `/api/api-keys`, `/api/working-windows`, `/api/landing-*`, `/api/web-form`, `/api/settings`, `/api/article-categories` | 2 each |
| `/api/portal` | 6 | `/api/search`, `/api/permissions`, `/api/live-chat`, `/api/landing`, `/api/branding` | 1 each |
| `/api/erp` | 6 | | |
| `/api/customers` | 6 | | |

---

## Reproducing every number

Run from `backend/` with the virtualenv active. Latest recorded outcomes are in
[`VERIFICATION.md`](VERIFICATION.md).

```bash
# models per app, and the live table count
python manage.py shell -c "from django.apps import apps; [print(c.label, sorted(m.__name__ for m in c.get_models())) for c in apps.get_app_configs() if c.name.startswith('apps.')]"

# endpoint surface — generates clean or fails loudly
python manage.py spectacular --file openapi.yaml
grep -cE '^  /' openapi.yaml            # 131

# structural counts
find apps -path '*/migrations/*.py' ! -name '__init__.py' | wc -l   # 91
find apps config -name '*.py' ! -path '*__pycache__*' | wc -l       # 292

# boundary + correctness gates
python manage.py check                              # 0 issues
python manage.py makemigrations --check --dry-run    # no drift between models and migrations
python -m ruff check . && python -m ruff format --check .
python manage.py test
```

`makemigrations --check --dry-run` is the one that matters most for the model boundary: it
fails if a model changed without a migration, so "models are the source of truth for the
schema" is enforced by a command rather than by reviewer memory.

---

## Related documents

- [`backend/apps/README.md`](../backend/apps/README.md) — why the layout is this shape (decision record)
- [`FRONTEND-WORKFLOWS.md`](FRONTEND-WORKFLOWS.md) — the other half of each request: page → hook → endpoint → model
- [`VERIFICATION.md`](VERIFICATION.md) — commands actually run, with their recorded output
- [`ASSUMPTIONS.md`](ASSUMPTIONS.md) — assumptions and acceptance criteria these boundaries serve
- [`CONVENTIONS.md`](../CONVENTIONS.md) — the full `CONV` spec
- Root [`README.md`](../README.md) § API conventions — the response envelope contract
