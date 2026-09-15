"""Shared query/aggregation helpers — RPT-0's 🔑 half.

Reused by RPT-1 (ticket volume/trends by status/category/channel/time),
RPT-2 (SLA response/resolution trends, breach rates), RPT-3 (per-agent
counts), RPT-4 (CSAT trends and breakdown), and RPT-5 (combined KPIs) —
`SupportOs backlog.MD:635-663`. Nothing here knows what a ticket, a
message, or a rating is: every function takes a **queryset** and a field
name, so one implementation serves all five.

A plain function module, not a view: the same shape
`apps/knowledge_base/search.py` (KB-3) and `apps/sla/policy.py` (SLA-1)
already use. `apps/reports/views.py::BaseReportView` is the thin HTTP
wrapper; RPT-1 writes the first subclass.

Computed on every request, never cached or pre-aggregated — the same
"compute over cache when the read is cheap enough to redo" call
`search.py` documents (lines 12-17). Revisit when a report is measurably
slow against real data, not before.
"""

from __future__ import annotations

from datetime import date, datetime, timedelta

from django.db.models import Count, QuerySet
from django.db.models.functions import TruncDay, TruncMonth, TruncWeek
from django.utils import timezone
from django.utils.translation import gettext_lazy as _
from rest_framework.exceptions import ValidationError

# Buckets, and the Trunc function each maps to. Keys are the wire values a
# client sends as `?bucket=`; adding a bucket means adding a row here and a
# branch in `_advance` below, nothing else.
BUCKETS = {
    "day": TruncDay,
    "week": TruncWeek,
    "month": TruncMonth,
}
DEFAULT_BUCKET = "day"

# A report with no explicit range covers the last 30 days ending today.
DEFAULT_RANGE_DAYS = 30
# Hard ceiling. A `day`-bucketed two-year range is 730 gap-filled rows in
# one response — a real client mistake, not a legitimate request. Raise it
# here (one constant) if a report ever genuinely needs more.
MAX_RANGE_DAYS = 366

DATE_FORMAT = "%Y-%m-%d"


def parse_date_range(query_params) -> tuple[datetime, datetime]:
    """`?from=YYYY-MM-DD`/`?to=YYYY-MM-DD` as an aware [start, end) pair.

    `to` is INCLUSIVE to the caller ("through 31 January") and returned as
    an EXCLUSIVE upper bound (00:00 on 1 February), so a `__gte`/`__lt`
    filter needs no off-by-one handling at any call site.

    Both default: `to` = today, `from` = DEFAULT_RANGE_DAYS earlier.
    Raises DRF `ValidationError` (-> a 400 in envelope form via
    `apps/core/exceptions.py`) on an unparseable date, a reversed range, or
    a span over MAX_RANGE_DAYS.
    """
    today = timezone.localdate()
    raw_from = query_params.get("from")
    raw_to = query_params.get("to")

    # DEFAULT_RANGE_DAYS calendar days INCLUDING today: today, today-1, ...,
    # today-(DEFAULT_RANGE_DAYS-1) — the ordinary reading of "last 30 days".
    from_date = _parse_date_param(
        "from", raw_from, default=today - timedelta(days=DEFAULT_RANGE_DAYS - 1)
    )
    to_date = _parse_date_param("to", raw_to, default=today)

    if from_date > to_date:
        raise ValidationError({"from": [_('Must not be later than "to".')]})

    span_days = (to_date - from_date).days + 1
    if span_days > MAX_RANGE_DAYS:
        raise ValidationError(
            {
                "from": [
                    _("The range must not span more than %(max)d days.") % {"max": MAX_RANGE_DAYS}
                ]
            }
        )

    tz = timezone.get_current_timezone()
    start = timezone.make_aware(datetime.combine(from_date, datetime.min.time()), tz)
    end = timezone.make_aware(
        datetime.combine(to_date + timedelta(days=1), datetime.min.time()), tz
    )
    return start, end


def _parse_date_param(name: str, raw: str | None, *, default: date) -> date:
    if raw is None:
        return default
    try:
        return datetime.strptime(raw, DATE_FORMAT).date()
    except ValueError:
        raise ValidationError({name: [_("Must be a valid date in YYYY-MM-DD format.")]}) from None


def parse_bucket(query_params) -> str:
    """`?bucket=` as one of BUCKETS' keys, defaulting to DEFAULT_BUCKET.
    Raises DRF `ValidationError` naming the valid values on anything else.
    """
    raw = query_params.get("bucket", DEFAULT_BUCKET)
    if raw not in BUCKETS:
        valid = ", ".join(sorted(BUCKETS))
        raise ValidationError({"bucket": [_("Must be one of: %(valid)s.") % {"valid": valid}]})
    return raw


def bucketed_counts(
    queryset: QuerySet,
    *,
    date_field: str,
    start: datetime,
    end: datetime,
    bucket: str = DEFAULT_BUCKET,
    series_field: str | None = None,
    null_label: str = "",
) -> list[dict]:
    """Rows-per-time-bucket, gap-filled, ascending by bucket.

    Returns `[{"bucket": "2026-01-01", "value": 12}, ...]`, or with
    `series_field` set, `[{"bucket": ..., "series": "open", "value": 12}, ...]`
    — the multi-series shape `LineChart` reads. Every bucket in
    [start, end) is present with `value: 0` when nothing falls in it: a
    trend line with a missing Tuesday draws a straight segment across it and
    silently lies, which is the single most important thing this module
    does.

    `bucket` values are `YYYY-MM-DD` date strings, not datetimes — the
    frontend formats them through `useFormatters().date()`, and a bucket is
    a day/week/month, never an instant.

    `null_label` mirrors `grouped_counts`'s own NULL policy: a row whose
    `series_field` is SQL NULL (a nullable FK with nothing assigned) is
    counted under `null_label` rather than dropped. Without this, sorting
    the collected series keys compares `str` with `None` and raises
    `TypeError` — a real crash, hit by RPT-1's origin-channel split and
    RPT-3's `assigned_agent` split. See Story 56 `## Prerequisites`.
    """
    trunc = BUCKETS[bucket]
    tz = timezone.get_current_timezone()

    filtered = queryset.filter(**{f"{date_field}__gte": start, f"{date_field}__lt": end})
    annotated = filtered.annotate(_bucket=trunc(date_field, tzinfo=tz))

    group_fields = ["_bucket", series_field] if series_field else ["_bucket"]
    rows = annotated.values(*group_fields).annotate(_count=Count("pk")).order_by()

    counts: dict[tuple, int] = {}
    for row in rows:
        bucket_date = row["_bucket"].date() if hasattr(row["_bucket"], "date") else row["_bucket"]
        series_value = row[series_field] if series_field else None
        if series_field and series_value is None:
            series_value = null_label
        key = (bucket_date, series_value) if series_field else (bucket_date,)
        counts[key] = row["_count"]

    # Every series key is a string by this point (NULLs became `null_label`
    # above), so this sort cannot raise. It did before: a nullable
    # `series_field` — RPT-1's origin channel, RPT-3's `assigned_agent` —
    # made this `sorted()` compare str with None and TypeError. See Story 56
    # `## Prerequisites`.
    series_keys = sorted({key[1] for key in counts}) if series_field else [None]
    spine = _bucket_starts(start, end, bucket)

    result: list[dict] = []
    for bucket_start in spine:
        for series_key in series_keys:
            key = (bucket_start, series_key) if series_field else (bucket_start,)
            item = {"bucket": bucket_start.strftime(DATE_FORMAT), "value": counts.get(key, 0)}
            if series_field:
                item["series"] = series_key
            result.append(item)
    return result


def grouped_counts(
    queryset: QuerySet,
    *,
    field: str,
    limit: int | None = None,
    include_null: bool = False,
    null_label: str = "",
) -> list[dict]:
    """Counts per distinct value of `field`, DESCENDING by count.

    Returns `[{"key": "open", "value": 42}, ...]` — the shape `BarChart`
    reads. Descending is not the caller's choice: CONVENTIONS.md § 25 line
    1630 ("always sort descending by value") applies to every category bar
    chart in EPIC 11, so it is enforced here rather than trusted to five
    call sites.

    `include_null` controls whether rows whose `field` is NULL are counted
    under `null_label` (a `Ticket` with no category, an unassigned agent) or
    dropped. Default False — a "no category" bar is meaningful in RPT-1 but
    noise in RPT-3's agent ranking, so the caller decides.

    `limit` caps the returned rows (RPT-3's "≤15 agents before switching to
    a paginated table", § 25 line 1633). Applied AFTER ordering, so it is
    the true top-N.
    """
    if not include_null:
        queryset = queryset.exclude(**{f"{field}__isnull": True})

    rows = queryset.values(field).annotate(_count=Count("pk")).order_by("-_count")

    result = [
        {"key": row[field] if row[field] is not None else null_label, "value": row["_count"]}
        for row in rows
    ]
    if limit is not None:
        result = result[:limit]
    return result


def _bucket_starts(start: datetime, end: datetime, bucket: str) -> list[date]:
    """Every bucket start in [start, end), ascending — the gap-fill spine.

    `start` is snapped to its own bucket boundary first (`week` -> Monday,
    matching Django's `TruncWeek`; `month` -> day 1; `day` -> unchanged) —
    without this the spine and the database's own truncated keys disagree
    and every bucket appears empty. See Story 55 `## Edge Cases`.
    """
    current = start.date()
    if bucket == "week":
        current = current - timedelta(days=current.weekday())
    elif bucket == "month":
        current = current.replace(day=1)

    end_date = end.date()
    starts: list[date] = []
    while current < end_date:
        starts.append(current)
        current = _advance(current, bucket)
    return starts


def _advance(current: date, bucket: str) -> date:
    """The next bucket start after `current`. `month` increments the month
    field and clamps to day 1 rather than adding 30 days — `timedelta` has
    no month, and a 30-day step drifts off month boundaries within a year.
    """
    if bucket == "day":
        return current + timedelta(days=1)
    if bucket == "week":
        return current + timedelta(days=7)
    # month
    if current.month == 12:
        return current.replace(year=current.year + 1, month=1, day=1)
    return current.replace(month=current.month + 1, day=1)
