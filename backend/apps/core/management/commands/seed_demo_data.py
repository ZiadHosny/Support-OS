"""Wipes generated test data and reseeds a realistic demo dataset covering
the full SupportOS business flow (users, customers, tickets, SLA, tasks,
notes, notifications) end to end.

Reference/system data is left untouched: roles, scheduled `PeriodicTask`
rows, org/provider singletons, ticket & knowledge-base categories, and the
existing `Department`/`Branch` rows — those are created only when absent, so
the command also works on a freshly migrated database. Any user account whose
email is passed via `--keep-email` (default: `ziad@email.com`) is never
touched either.

Re-running this command is safe: it wipes its own previous output first.
"""

import json
from datetime import date, timedelta
from decimal import Decimal

from django.contrib.auth import get_user_model
from django.core.files.base import ContentFile
from django.core.management.base import BaseCommand
from django.db import transaction
from django.utils import timezone

from apps.accounts.mfa import encrypt_secret, hash_recovery_code
from apps.accounts.models import AuditLog, Role, TwoFactorRecoveryCode
from apps.agents.models import InternalNote, QuickReply, Task
from apps.ai.models import ChatbotSession
from apps.communications.models import Message
from apps.customers.models import Attachment, ContactDetail, Customer, Note
from apps.integrations.models import (
    ApiKey,
    ErpOrder,
    ErpSyncRun,
    WebhookDelivery,
    WebhookSubscription,
)
from apps.notifications.models import Notification
from apps.notifications.services import notify
from apps.organization.models import Branch, BusinessCalendar, Department, Holiday, WorkingWindow
from apps.sla.models import AssignmentRule, EscalationRule, SLAPolicy
from apps.tickets.assignment import apply_assignment
from apps.tickets.escalation import apply_escalation
from apps.tickets.models import Category, Feedback, SavedView, Ticket, TicketActivity
from apps.tickets.status import apply_status_change

User = get_user_model()
PASSWORD = "Passw0rd!2026"

# The ticket categories the seeded tickets and SLA rules below reference by name.
CATEGORY_NAMES = (
    "General Inquiry",
    "Technical Issue",
    "Account Access",
    "Billing",
    "Feature Request",
)

# Fixed (not randomly generated) so this stays valid across every re-seed —
# HOW_TO_USE.md documents these exact values for agent.mfa@supportos.local.
AGENT_MFA_TOTP_SECRET = "JBSWY3DPEHPK3PXPJBSWY3DPEHPK3PXP"
AGENT_MFA_RECOVERY_CODES = [
    "a1b2c3d4e5",
    "f6a7b8c9d0",
    "1a2b3c4d5e",
    "6f7a8b9c0d",
    "2b3c4d5e6f",
    "7a8b9c0d1e",
    "3c4d5e6f7a",
    "8b9c0d1e2f",
    "4d5e6f7a8b",
    "9c0d1e2f3a",
]


def _backdate(instance, created_at):
    type(instance).objects.filter(pk=instance.pk).update(
        created_at=created_at, updated_at=created_at
    )


class Command(BaseCommand):
    help = (
        "Delete all generated test data and reseed a realistic demo dataset "
        "for the full SupportOS user journey."
    )

    def add_arguments(self, parser):
        parser.add_argument(
            "--keep-email",
            action="append",
            default=["ziad@email.com"],
            help="Email of a user account to never delete or modify. Repeatable.",
        )
        parser.add_argument(
            "--secrets-out",
            default=None,
            help="Path to write one-time secrets (TOTP seed, recovery codes) as JSON.",
        )

    def handle(self, *args, **options):
        keep_emails = options["keep_email"]
        with transaction.atomic():
            self._wipe(keep_emails)
            secrets = self._seed()

        if options["secrets_out"]:
            with open(options["secrets_out"], "w", encoding="utf-8") as fh:
                json.dump(secrets, fh, indent=2)
            self.stdout.write(
                self.style.SUCCESS(f"Wrote one-time secrets to {options['secrets_out']}")
            )
        else:
            self.stdout.write(json.dumps(secrets, indent=2))

        self.stdout.write(self.style.SUCCESS("\nDone."))

    # -- wipe ----------------------------------------------------------------

    def _wipe(self, keep_emails):
        self.stdout.write("Clearing existing test data (reference/system data untouched)...")

        WebhookDelivery.objects.all().delete()
        WebhookSubscription.objects.all().delete()
        ErpOrder.objects.all().delete()
        ErpSyncRun.objects.all().delete()
        ApiKey.objects.all().delete()
        ChatbotSession.objects.all().delete()
        AuditLog.objects.all().delete()
        TwoFactorRecoveryCode.objects.all().delete()

        # Ticket cascades Message/TicketActivity/Feedback/InternalNote and
        # any ticket-linked Notification; Ticket.customer is PROTECT so
        # tickets must go before customers.
        Ticket.objects.all().delete()
        Customer.objects.all().delete()  # cascades ContactDetail/Note/Attachment

        # Cascades Task/SavedView/remaining Notification/ApiKey/recovery codes.
        User.objects.exclude(email__in=keep_emails).delete()

        # SLA config is currently empty in this project; clear it too so the
        # command is safe to re-run without unique-constraint clashes.
        SLAPolicy.objects.all().delete()
        AssignmentRule.objects.all().delete()
        EscalationRule.objects.all().delete()
        # Empty in a fresh deployment and never seeded by a migration — any
        # row here (like this project's own stray "NEW" calendar, orphaned
        # and unreferenced by any branch/policy) is leftover test/UI-testing
        # debris, not real org config.
        BusinessCalendar.objects.all().delete()

    # -- seed ------------------------------------------------------------------

    def _seed(self) -> dict:
        now = timezone.now()

        # get_or_create, not get: no migration creates these org/reference rows,
        # so on a freshly `migrate`d database the documented setup path
        # (`migrate` then `seed_demo_data`) failed on the first lookup.
        department_tech, _ = Department.objects.get_or_create(name="Technical Support")
        department_billing, _ = Department.objects.get_or_create(name="Billing")
        branch_cairo, _ = Branch.objects.get_or_create(name="Cairo HQ")
        branch_dubai, _ = Branch.objects.get_or_create(name="Dubai Office")
        categories = {c.name: c for c in Category.objects.all()}
        for name in CATEGORY_NAMES:
            if name not in categories:
                categories[name] = Category.objects.create(name=name)

        calendar = self._seed_calendar(branch_cairo)
        self._seed_sla_config(categories, calendar)

        # Either administrative slug, mirroring `sync_role_permissions.ADMIN_SLUGS`
        # and migration 0015: a fresh database is seeded with `admin` (migration
        # 0003) while this project's own database carries `super_admin`, so
        # keying on one alone works in exactly one environment.
        role_super_admin = Role.objects.filter(slug="super_admin").first() or Role.objects.get(
            slug="admin"
        )
        role_manager = Role.objects.get(slug="manager")
        role_agent = Role.objects.get(slug="agent")
        role_customer = Role.objects.get(slug="customer")

        def make_user(email, first, last, role, **extra):
            return User.objects.create_user(
                email=email, password=PASSWORD, first_name=first, last_name=last, role=role, **extra
            )

        # -- staff accounts ---------------------------------------------------
        admin_user = make_user(
            "admin@supportos.local",
            "Admin",
            "User",
            role_super_admin,
            is_staff=True,
            branch=branch_cairo,
        )
        manager_user = make_user(
            "manager.sara@supportos.local",
            "Sara",
            "Naguib",
            role_manager,
            department=department_tech,
            branch=branch_cairo,
        )
        agent_omar = make_user(
            "agent.omar@supportos.local",
            "Omar",
            "Zaki",
            role_agent,
            department=department_tech,
            branch=branch_cairo,
        )
        agent_lina = make_user(
            "agent.lina@supportos.local",
            "Lina",
            "Fahmy",
            role_agent,
            department=department_billing,
            branch=branch_dubai,
        )
        default_rule, billing_rule, _disabled_rule = self._assignment_rules
        default_rule.agents.set([agent_omar, agent_lina])
        billing_rule.agents.set([agent_lina])

        agent_hassan = make_user(
            "agent.hassan.inactive@supportos.local",
            "Hassan",
            "Adly",
            role_agent,
            department=department_tech,
            branch=branch_cairo,
            is_active=False,
        )
        agent_mfa = make_user(
            "agent.mfa@supportos.local",
            "Mona",
            "Reda",
            role_agent,
            department=department_tech,
            branch=branch_cairo,
        )
        agent_mfa.mfa_secret = encrypt_secret(AGENT_MFA_TOTP_SECRET)
        agent_mfa.mfa_enabled = True
        agent_mfa.save(update_fields=["mfa_secret", "mfa_enabled"])
        TwoFactorRecoveryCode.objects.bulk_create(
            [
                TwoFactorRecoveryCode(user=agent_mfa, code_hash=hash_recovery_code(c))
                for c in AGENT_MFA_RECOVERY_CODES
            ]
        )

        # -- customers + portal accounts ---------------------------------------
        nadia_user = make_user("nadia.fathy@example.com", "Nadia", "Fathy", role_customer)
        nadia = Customer.objects.create(
            name="Nadia Fathy",
            email="nadia.fathy@example.com",
            phone="+201001234567",
            user=nadia_user,
            branch=branch_cairo,
        )
        ContactDetail.objects.create(
            customer=nadia, channel=ContactDetail.Channel.PHONE, value="+201098765432"
        )
        Note.objects.create(
            customer=nadia,
            author=manager_user,
            body="VIP customer — respond within 1 business day whenever possible.",
        )

        youssef_user = make_user(
            "youssef.adel@example.com", "Youssef", "Adel", role_customer, is_active=False
        )
        youssef = Customer.objects.create(
            name="Youssef Adel",
            email="youssef.adel@example.com",
            phone="+201009876543",
            user=youssef_user,
            branch=branch_cairo,
        )

        khalid = Customer.objects.create(
            name="Khalid Trading LLC",
            email="accounts@khalidtrading.example.com",
            phone="+97141234567",
            company="Khalid Trading LLC",
            branch=branch_dubai,
        )
        Note.objects.create(
            customer=khalid,
            author=agent_lina,
            body="Enterprise account, prefers email over phone contact.",
        )

        mariam = Customer.objects.create(
            name="Mariam El-Sayed",
            email="mariam.elsayed@example.com",
            phone="+201112223344",
            legal_hold=True,
            branch=branch_cairo,
        )

        tarek = Customer.objects.create(
            name="Tarek Fouad",
            phone="+201223334455",
            whatsapp_enabled=True,
            branch=branch_cairo,
        )
        ContactDetail.objects.create(
            customer=tarek, channel=ContactDetail.Channel.WHATSAPP, value="+201223334455"
        )

        globalmart_user = make_user(
            "procurement@globalmart.example.com", "Ahmed", "Salem", role_customer
        )
        globalmart = Customer.objects.create(
            name="GlobalMart Retail",
            email="procurement@globalmart.example.com",
            company="GlobalMart Retail",
            external_id="ERP-CUST-1001",
            user=globalmart_user,
            branch=branch_dubai,
        )
        ContactDetail.objects.create(
            customer=globalmart,
            channel=ContactDetail.Channel.EMAIL,
            value="billing@globalmart.example.com",
        )
        ErpOrder.objects.create(
            customer=globalmart,
            external_id="ERP-ORD-5001",
            order_number="SO-5001",
            status="shipped",
            total_amount=Decimal("4820.00"),
            currency="AED",
            placed_at=now - timedelta(days=20),
            synced_at=now - timedelta(days=1),
            raw={"source": "seed_demo_data"},
        )
        ErpOrder.objects.create(
            customer=globalmart,
            external_id="ERP-ORD-5002",
            order_number="SO-5002",
            status="processing",
            total_amount=Decimal("1275.50"),
            currency="AED",
            placed_at=now - timedelta(days=3),
            synced_at=now - timedelta(days=1),
            raw={"source": "seed_demo_data"},
        )
        ErpSyncRun.objects.create(
            direction=ErpSyncRun.Direction.IMPORT,
            state=ErpSyncRun.State.SUCCESS,
            triggered_by=admin_user,
            created_count=2,
            updated_count=0,
            skipped_count=0,
            failed_count=0,
            started_at=now - timedelta(days=1, minutes=5),
            finished_at=now - timedelta(days=1),
        )

        layla_user = make_user("layla.new@example.com", "Layla", "Hamdy", role_customer)
        Customer.objects.create(
            name="Layla Hamdy",
            email="layla.new@example.com",
            user=layla_user,
            branch=branch_cairo,
        )

        Attachment.objects.create(
            customer=nadia,
            uploaded_by=agent_omar,
            file=ContentFile(
                b"Sample attachment content for testing.", name="issue_screenshot.txt"
            ),
            original_filename="issue_screenshot.txt",
            size=39,
        )

        # -- tickets ------------------------------------------------------------
        tickets = {}

        t1 = Ticket.objects.create(
            subject="Cannot find the invoice download button",
            description="I logged in but can't locate where to download last month's invoice.",
            customer=nadia,
            category=categories["General Inquiry"],
            priority=Ticket.Priority.MEDIUM,
            department=department_tech,
            branch=branch_cairo,
        )
        tickets["t1_fresh_open"] = t1

        t2 = Ticket.objects.create(
            subject="App crashes when uploading a profile photo",
            description="Every time I try to upload a photo larger than 2MB the app crashes.",
            customer=nadia,
            category=categories["Technical Issue"],
            priority=Ticket.Priority.HIGH,
            department=department_tech,
            branch=branch_cairo,
        )
        _backdate(t2, now - timedelta(days=2))
        inbound2 = Message.objects.create(
            ticket=t2,
            direction=Message.Direction.INBOUND,
            channel=Message.Channel.WEB_FORM,
            body="Every time I try to upload a photo larger than 2MB the app crashes.",
        )
        _backdate(inbound2, now - timedelta(days=2))
        apply_assignment(t2, agent_omar, actor=manager_user)
        apply_status_change(t2, Ticket.Status.IN_PROGRESS, actor=agent_omar)
        reply = Message.objects.create(
            ticket=t2,
            direction=Message.Direction.OUTBOUND,
            channel=Message.Channel.WEB_FORM,
            body="Thanks for the report — could you tell us your device model and OS version?",
        )
        _backdate(reply, now - timedelta(days=2) + timedelta(minutes=30))
        note1 = InternalNote.objects.create(
            ticket=t2,
            author=manager_user,
            body=(
                "Omar, please prioritize this — long-standing account, "
                "second crash report this month."
            ),
        )
        note1.mentioned_users.set([agent_omar])
        tickets["t2_in_progress_on_track"] = t2

        t3 = Ticket.objects.create(
            subject="Need to change the email on my account",
            description=(
                "My old company email is deactivated, please switch it to my personal address."
            ),
            customer=nadia,
            category=categories["Account Access"],
            priority=Ticket.Priority.MEDIUM,
            department=department_tech,
            branch=branch_cairo,
        )
        _backdate(t3, now - timedelta(days=1))
        apply_assignment(t3, agent_omar, actor=manager_user)
        apply_status_change(t3, Ticket.Status.IN_PROGRESS, actor=agent_omar)
        apply_status_change(t3, Ticket.Status.PENDING_CUSTOMER, actor=agent_omar)
        Ticket.objects.filter(pk=t3.pk).update(pending_customer_since=now - timedelta(hours=6))
        Task.objects.create(
            owner=agent_omar,
            ticket=t3,
            title="Follow up with Nadia on account access request",
            description="Check whether she confirmed the new email address yet.",
            due_at=now + timedelta(days=1),
        )
        tickets["t3_pending_customer_paused"] = t3

        t4 = Ticket.objects.create(
            subject="Requesting a refund for a duplicate charge",
            description="I was charged twice for the same invoice this month.",
            customer=nadia,
            category=categories["Billing"],
            priority=Ticket.Priority.LOW,
            department=department_billing,
            branch=branch_cairo,
        )
        _backdate(t4, now - timedelta(days=5))
        Message.objects.create(
            ticket=t4,
            direction=Message.Direction.INBOUND,
            channel=Message.Channel.EMAIL,
            body="I was charged twice for the same invoice this month.",
        )
        apply_assignment(t4, agent_lina, actor=manager_user)
        apply_status_change(t4, Ticket.Status.IN_PROGRESS, actor=agent_lina)
        Message.objects.create(
            ticket=t4,
            direction=Message.Direction.OUTBOUND,
            channel=Message.Channel.EMAIL,
            body=(
                "Confirmed the duplicate charge and issued a refund — "
                "it should land within 5 business days."
            ),
        )
        apply_status_change(t4, Ticket.Status.RESOLVED, actor=agent_lina)
        Feedback.objects.create(
            ticket=t4,
            customer=nadia,
            rating=Feedback.Rating.SATISFIED,
            comment="Quick and helpful resolution, thank you!",
        )
        tickets["t4_resolved_with_feedback"] = t4

        t5 = Ticket.objects.create(
            subject="Repeated login failures after password reset",
            description="I reset my password but I'm still locked out of the mobile app.",
            customer=nadia,
            category=categories["Technical Issue"],
            priority=Ticket.Priority.HIGH,
            department=department_tech,
            branch=branch_cairo,
        )
        _backdate(t5, now - timedelta(days=7))
        apply_assignment(t5, agent_omar, actor=manager_user)
        apply_status_change(t5, Ticket.Status.IN_PROGRESS, actor=agent_omar)
        apply_escalation(t5, True)
        note2 = InternalNote.objects.create(
            ticket=t5,
            author=agent_omar,
            body="Escalating per manager's request — customer has been locked out for 3 days.",
        )
        note2.mentioned_users.set([manager_user])
        apply_status_change(t5, Ticket.Status.RESOLVED, actor=agent_omar)
        apply_status_change(t5, Ticket.Status.CLOSED, actor=agent_omar)
        Feedback.objects.create(
            ticket=t5,
            customer=nadia,
            rating=Feedback.Rating.NEUTRAL,
            comment="Took longer than expected but got resolved.",
        )
        Task.objects.create(
            owner=agent_omar,
            ticket=t5,
            title="Send closure confirmation email",
            description="",
            due_at=now - timedelta(days=2),
            completed_at=now - timedelta(days=2) + timedelta(hours=1),
        )
        tickets["t5_closed_escalated_feedback"] = t5

        t6 = Ticket.objects.create(
            subject="Urgent: cannot place any orders, checkout is broken",
            description="Checkout has been failing for everyone on our end since this morning.",
            customer=youssef,
            category=categories["Billing"],
            priority=Ticket.Priority.URGENT,
            department=department_billing,
            branch=branch_cairo,
        )
        _backdate(t6, now - timedelta(days=10))
        inbound6 = Message.objects.create(
            ticket=t6,
            direction=Message.Direction.INBOUND,
            channel=Message.Channel.EMAIL,
            body="Checkout has been failing for everyone on our end since this morning.",
        )
        _backdate(inbound6, now - timedelta(days=10))
        tickets["t6_urgent_unassigned_sla_breached"] = t6

        t7 = Ticket.objects.create(
            subject="Feature request: bulk export for order history",
            description="We'd like to export our full order history to CSV for accounting.",
            customer=khalid,
            category=categories["Feature Request"],
            priority=Ticket.Priority.MEDIUM,
            department=department_billing,
            branch=branch_dubai,
        )
        _backdate(t7, now - timedelta(days=3))
        Message.objects.create(
            ticket=t7,
            direction=Message.Direction.INBOUND,
            channel=Message.Channel.EMAIL,
            body="We'd like to export our full order history to CSV for accounting.",
        )
        apply_assignment(t7, agent_lina, actor=manager_user)
        apply_status_change(t7, Ticket.Status.IN_PROGRESS, actor=agent_lina)
        Message.objects.create(
            ticket=t7,
            direction=Message.Direction.OUTBOUND,
            channel=Message.Channel.EMAIL,
            body="Thanks for the suggestion — I've logged this with our product team.",
        )
        tickets["t7_no_portal_login_in_progress"] = t7

        t8 = Ticket.objects.create(
            subject="General question about business hours",
            description="What are your support hours during the holidays?",
            customer=khalid,
            category=categories["General Inquiry"],
            priority=Ticket.Priority.LOW,
            department=department_tech,
            branch=branch_dubai,
        )
        _backdate(t8, now - timedelta(days=20))
        apply_assignment(t8, agent_lina, actor=manager_user)
        apply_status_change(t8, Ticket.Status.IN_PROGRESS, actor=agent_lina)
        apply_status_change(t8, Ticket.Status.RESOLVED, actor=agent_lina)
        apply_status_change(t8, Ticket.Status.CLOSED, actor=agent_lina)
        tickets["t8_closed_no_feedback"] = t8

        t9 = Ticket.objects.create(
            subject="Please update the name on my account records",
            description="My legal name changed recently, please update it on file.",
            customer=mariam,
            category=categories["Account Access"],
            priority=Ticket.Priority.MEDIUM,
            department=department_tech,
            branch=branch_cairo,
        )
        _backdate(t9, now - timedelta(days=4))
        apply_assignment(t9, agent_omar, actor=manager_user)
        apply_status_change(t9, Ticket.Status.IN_PROGRESS, actor=agent_omar)
        apply_status_change(t9, Ticket.Status.RESOLVED, actor=agent_omar)
        tickets["t9_legal_hold_customer_resolved"] = t9

        t10 = Ticket.objects.create(
            subject="Delivery to Alexandria?",
            description="Hi, do you deliver to Alexandria?",
            customer=tarek,
            category=categories["General Inquiry"],
            priority=Ticket.Priority.LOW,
            branch=branch_cairo,
        )
        Message.objects.create(
            ticket=t10,
            direction=Message.Direction.INBOUND,
            channel=Message.Channel.WHATSAPP,
            body="Hi, do you deliver to Alexandria?",
        )
        tickets["t10_whatsapp_inbound_unassigned"] = t10

        t11 = Ticket.objects.create(
            subject="API integration returns 500 on order sync",
            description="Our nightly ERP sync job started failing with a 500 two days ago.",
            customer=globalmart,
            category=categories["Technical Issue"],
            priority=Ticket.Priority.HIGH,
            department=department_tech,
            branch=branch_dubai,
        )
        _backdate(t11, now - timedelta(days=2))
        Message.objects.create(
            ticket=t11,
            direction=Message.Direction.INBOUND,
            channel=Message.Channel.EMAIL,
            body="Our nightly ERP sync job started failing with a 500 two days ago.",
        )
        apply_assignment(t11, agent_omar, actor=manager_user)
        apply_status_change(t11, Ticket.Status.IN_PROGRESS, actor=agent_omar)
        Message.objects.create(
            ticket=t11,
            direction=Message.Direction.OUTBOUND,
            channel=Message.Channel.EMAIL,
            body="We can see the failed syncs on our end — investigating the root cause now.",
        )
        tickets["t11_erp_customer_in_progress"] = t11

        t12 = Ticket.objects.create(
            subject="Question about an invoice line item",
            description="One of the line items on invoice SO-5002 doesn't match our PO.",
            customer=globalmart,
            category=categories["Billing"],
            priority=Ticket.Priority.MEDIUM,
            department=department_billing,
            branch=branch_dubai,
        )
        tickets["t12_billing_unassigned_for_auto_assign_test"] = t12

        t13 = Ticket.objects.create(
            subject="Duplicate: app crash on photo upload",
            description="Same crash as my other ticket, reporting again just in case.",
            customer=nadia,
            category=categories["Technical Issue"],
            priority=Ticket.Priority.HIGH,
            department=department_tech,
            branch=branch_cairo,
        )
        _backdate(t13, now - timedelta(days=6))
        Message.objects.create(
            ticket=t13,
            direction=Message.Direction.INBOUND,
            channel=Message.Channel.EMAIL,
            body="Same crash as my other ticket, reporting again just in case.",
        )
        apply_status_change(t13, Ticket.Status.CLOSED, actor=agent_omar)
        Ticket.objects.filter(pk=t13.pk).update(merged_into=t2)
        TicketActivity.objects.create(
            ticket=t13,
            actor=agent_omar,
            kind=TicketActivity.Kind.MERGED_INTO,
            to_value=f"Ticket #{t2.id}",
        )
        TicketActivity.objects.create(
            ticket=t2,
            actor=agent_omar,
            kind=TicketActivity.Kind.MERGED_FROM,
            to_value=f"Ticket #{t13.id}",
        )
        tickets["t13_merged_into_t2"] = t13

        # -- agent tools ----------------------------------------------------------
        Task.objects.create(
            owner=agent_lina,
            title="Prepare monthly billing summary",
            description="Compile the Q3 billing summary for management review.",
            due_at=now - timedelta(days=1),
        )
        overdue = Task.objects.filter(
            owner=agent_lina, title="Prepare monthly billing summary"
        ).first()
        Task.objects.filter(pk=overdue.pk).update(reminder_sent_at=now - timedelta(hours=12))

        SavedView.objects.create(
            owner=agent_omar,
            name="My open tickets",
            is_default=True,
            filters={"status": "open", "assigned_to_me": "true"},
        )
        SavedView.objects.create(
            owner=manager_user,
            name="Escalated tickets",
            is_shared=True,
            filters={"escalated": "true"},
        )
        QuickReply.objects.get_or_create(
            title="Password reset instructions",
            defaults={
                "body": (
                    "Hi, you can reset your password from the login page "
                    'by selecting "Forgot password".'
                )
            },
        )
        QuickReply.objects.get_or_create(
            title="Refund policy explanation",
            defaults={
                "body": (
                    "Refunds for duplicate or incorrect charges are "
                    "processed within 5 business days."
                )
            },
        )

        notify(
            agent_lina,
            Notification.Kind.TASK_DUE,
            title="Task overdue: Prepare monthly billing summary",
            body="This task was due yesterday.",
        )
        Notification.objects.filter(
            recipient=agent_omar, kind=Notification.Kind.TICKET_ASSIGNED, ticket=t2
        ).update(read_at=now)

        AuditLog.objects.create(
            actor=admin_user,
            action=AuditLog.Action.USER_CREATED,
            target_user=agent_mfa,
            target_label=agent_mfa.email,
            to_value="agent",
        )
        AuditLog.objects.create(
            actor=admin_user,
            action=AuditLog.Action.PORTAL_ACCESS_GRANTED,
            target_user=nadia_user,
            target_label=nadia_user.email,
        )
        AuditLog.objects.create(
            actor=admin_user,
            action=AuditLog.Action.USER_STATUS_CHANGED,
            target_user=agent_hassan,
            target_label=agent_hassan.email,
            from_value="active",
            to_value="inactive",
        )

        return {
            "password_for_all_seeded_accounts": PASSWORD,
            "agent_mfa_totp_secret_base32": AGENT_MFA_TOTP_SECRET,
            "agent_mfa_recovery_codes": AGENT_MFA_RECOVERY_CODES,
        }

    def _seed_calendar(self, branch_cairo) -> BusinessCalendar:
        calendar = BusinessCalendar.objects.create(
            name="Standard Business Hours", description="Sun-Thu 09:00-18:00 (Cairo HQ default)."
        )
        # Weekday() numbering: Mon=0 ... Sun=6. Egypt work week is Sun-Thu.
        for weekday in (6, 0, 1, 2, 3):
            WorkingWindow.objects.create(
                calendar=calendar, weekday=weekday, start_time="09:00", end_time="18:00"
            )
        Holiday.objects.create(
            calendar=calendar,
            date=date.today() + timedelta(days=14),
            label="Public Holiday (seeded)",
        )
        branch_cairo.calendar = calendar
        branch_cairo.save(update_fields=["calendar"])
        return calendar

    def _seed_sla_config(self, categories, calendar):
        SLAPolicy.objects.create(
            priority=Ticket.Priority.LOW,
            response_target_minutes=480,
            resolution_target_minutes=2880,
        )
        SLAPolicy.objects.create(
            priority=Ticket.Priority.MEDIUM,
            response_target_minutes=240,
            resolution_target_minutes=1440,
        )
        SLAPolicy.objects.create(
            priority=Ticket.Priority.HIGH, response_target_minutes=60, resolution_target_minutes=480
        )
        SLAPolicy.objects.create(
            priority=Ticket.Priority.URGENT,
            response_target_minutes=30,
            resolution_target_minutes=240,
        )
        SLAPolicy.objects.create(
            priority=Ticket.Priority.HIGH,
            category=categories["Billing"],
            response_target_minutes=30,
            resolution_target_minutes=240,
            calendar=calendar,
        )

        default_rule = AssignmentRule.objects.create(
            category=None, strategy=AssignmentRule.Strategy.ROUND_ROBIN, enabled=True
        )
        billing_rule = AssignmentRule.objects.create(
            category=categories["Billing"], strategy=AssignmentRule.Strategy.LOAD, enabled=True
        )
        disabled_rule = AssignmentRule.objects.create(
            category=categories["Feature Request"],
            strategy=AssignmentRule.Strategy.ROUND_ROBIN,
            enabled=False,
        )
        self._assignment_rules = (default_rule, billing_rule, disabled_rule)

        EscalationRule.objects.create(
            kind=EscalationRule.Kind.AT_RISK, threshold_minutes=30, enabled=True
        )
        EscalationRule.objects.create(
            kind=EscalationRule.Kind.IDLE, threshold_minutes=1440, enabled=True
        )
