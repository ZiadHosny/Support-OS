"""Freeze the Django API surface as the EPIC 18 port contract.

`docs/BACKEND-ARCHITECTURE.md` states the OpenAPI document is generated, never
checked in. This command writes the one documented exception:
`docs/api-contract.django.yaml`, the frozen reference the Node port (EPIC 18,
NODE-0) is diffed against by NODE-2's harness.

The header is written by this command rather than by hand, because a hand-added
header does not survive the next regeneration — and a snapshot without its
header is indistinguishable from the live schema, which is exactly the
confusion the "never checked in" rule exists to prevent. Generation and header
have to be one operation or the rule decays into a convention.

`--fail-on-warn` is passed through to `spectacular` deliberately: Story 104
drove the schema to zero W001/W002, and a regression there would otherwise be
frozen into the contract and become the port's target. A broken contract is
worse than no contract, so the freeze fails instead.

Regenerate ONLY when the Django reference itself changes. See
CONVENTIONS-NODE.md and SupportOs backlog.MD EPIC 18.
"""

import tempfile
from pathlib import Path

from django.conf import settings
from django.core.management import call_command
from django.core.management.base import BaseCommand, CommandError

# Relative to the repository root (BASE_DIR is `backend/`), so the command
# writes to the same file no matter which directory it is invoked from.
DEFAULT_RELATIVE_PATH = Path("docs") / "api-contract.django.yaml"

HEADER = """\
# ============================================================================
# PORT CONTRACT — NOT THE LIVE SCHEMA.
#
# A frozen snapshot of the Django API surface, committed as the acceptance
# spec for EPIC 18 (Node.js Backend Port). The live schema is generated on
# demand — `python manage.py spectacular`, or GET /api/schema/ — and is
# still never checked in (docs/BACKEND-ARCHITECTURE.md, Measured manifest).
# This file is the single, documented exception to that rule.
#
# Every 2xx body below is the WRAPPED form: `apps.integrations.schema.
# envelope_postprocessing_hook` nests each payload under `data` inside
# {success, data, error, meta}, and list endpoints carry `meta.pagination`
# from `apps.core.pagination.DefaultPageNumberPagination`.
#
# DO NOT EDIT BY HAND. Regenerate with:
#     python manage.py freeze_api_contract
# and only when the Django reference implementation itself changes.
#
# Generated from config/api_urls.py via drf-spectacular.
# Consumed by NODE-2's contract-diff harness.
# ============================================================================
"""


class Command(BaseCommand):
    help = (
        "Write the frozen Django API contract (docs/api-contract.django.yaml) "
        "that EPIC 18's Node port is diffed against."
    )

    def add_arguments(self, parser):
        parser.add_argument(
            "--file",
            dest="file",
            default=None,
            help=(
                "Write to this path instead of docs/api-contract.django.yaml. "
                "Used to regenerate into a scratch file and diff it against the "
                "committed one, which is how a hand-edit is detected."
            ),
        )

    def handle(self, *args, **options):
        destination = (
            Path(options["file"])
            if options["file"]
            else Path(settings.BASE_DIR).parent / DEFAULT_RELATIVE_PATH
        )

        if not destination.parent.is_dir():
            raise CommandError(f"Destination directory does not exist: {destination.parent}")

        body = self._generate()

        # newline="\n" explicitly: the contract is committed and diffed on
        # every platform, and Windows' default translation would make the
        # snapshot differ from a Linux regeneration byte for byte.
        with open(destination, "w", encoding="utf-8", newline="\n") as handle:
            handle.write(HEADER)
            handle.write(body)

        paths = sum(1 for line in body.splitlines() if line.startswith("  /"))
        self.stdout.write(self.style.SUCCESS(f"Wrote {destination} ({paths} paths)."))

    @staticmethod
    def _generate() -> str:
        """Run `spectacular` into a scratch file and return what it produced.

        Via the scratch file rather than straight to the destination: a
        generation that fails on a warning must leave the committed contract
        exactly as it was, not half-written.
        """
        with tempfile.TemporaryDirectory() as scratch:
            generated = Path(scratch) / "openapi.yaml"
            call_command("spectacular", file=str(generated), fail_on_warn=True)
            return generated.read_text(encoding="utf-8")
