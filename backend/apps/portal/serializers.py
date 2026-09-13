from django.utils.translation import gettext_lazy as _
from rest_framework import serializers

from apps.communications.models import Message
from apps.core.serializers import BaseModelSerializer
from apps.tickets.models import Feedback, Ticket
from apps.tickets.serializers import TicketSerializer


class PortalTicketSerializer(TicketSerializer):
    """`TicketSerializer`, narrowed for a customer's own tickets — used for
    `create`, `list`, and `retrieve` alike (PORTAL-1/PORTAL-2). Was named
    `PortalTicketCreateSerializer` when it served only `create`; renamed
    now that it also serves the two read-only actions — the same
    relationship `TicketSerializer` (not `TicketCreateSerializer`) has to
    `TicketViewSet`'s full CRUD surface.

    `customer` is read-only here on top of `TicketSerializer`'s own
    read-only set — `PortalTicketViewSet.perform_create` is what actually
    sets it, from `request.user.customer_profile`, never from client input.
    Scoping `get_queryset()` (CustomerScopedModelViewSet) protects reads;
    it does nothing for a writable field on `create`, which is why this
    also has to be a serializer-level change, not just a viewset one.

    `category` and `priority` are read-only too — not named in either
    PORTAL-1 or PORTAL-2's task, and exposing a category picker would need
    a new customer-facing "list categories" endpoint nothing else here
    needs. A portal-submitted ticket lands uncategorized at the default
    priority; staff triage assigns both later, the same way an unassigned
    `assigned_agent` already works.

    `department` (ORG-1) and `branch` (ORG-2) are read-only for exactly the
    same reason, and are the reason this class must re-check
    `read_only_fields` whenever `TicketSerializer` grows a writable field:
    `Meta.fields` is derived from that serializer's own tuple, so a new
    staff-writable field lands on the portal automatically. `department`
    was writable here between ORG-1 and ORG-2 because of that.

    `has_feedback` — PORTAL-5. `Feedback.ticket` is a `OneToOneField` with
    `related_name="feedback"`, so `hasattr(ticket, "feedback")` is the same
    verified-safe pattern Story 42 already used for `Customer.user`'s
    reverse accessor (`RelatedObjectDoesNotExist` subclasses
    `AttributeError`, so `getattr`/`hasattr` need no try/except). Read-only
    by construction (`SerializerMethodField`); no entry needed in
    `read_only_fields`.
    """

    has_feedback = serializers.SerializerMethodField()

    class Meta(TicketSerializer.Meta):
        fields = TicketSerializer.Meta.fields + ("has_feedback",)
        read_only_fields = TicketSerializer.Meta.read_only_fields + (
            "customer",
            "category",
            "priority",
            # ORG-1 added `department` to `TicketSerializer` as a writable
            # field and did not narrow it here, so a portal customer could
            # POST `department: <any id>` and file into an arbitrary org
            # unit. Not a visibility breach — neither field affects
            # `CustomerScopedModelViewSet`'s `customer_field` scoping — but
            # nothing intended it either. Both org units are staff triage
            # decisions, the same reasoning this class's docstring already
            # gives for `category` and `priority`. Closed by ORG-2.
            "department",
            "branch",
        )

    def get_has_feedback(self, ticket: Ticket) -> bool:
        return hasattr(ticket, "feedback")


class PortalFeedbackSerializer(BaseModelSerializer):
    """A customer's own post-resolution rating — PORTAL-5. No staff-facing
    counterpart exists to subclass (unlike `PortalTicketSerializer`
    narrowing `TicketSerializer`) — `Feedback` has no viewer at all yet,
    staff or portal, so this is the only serializer for it. See Story 47
    `## Explicitly out of scope`.
    """

    class Meta(BaseModelSerializer.Meta):
        model = Feedback
        fields = ("id", "ticket", "customer", "rating", "comment", "created_at", "updated_at")
        read_only_fields = BaseModelSerializer.Meta.read_only_fields + ("customer",)

    def validate_ticket(self, ticket: Ticket) -> Ticket:
        """Runs in ADDITION to (not instead of) the automatic `UniqueValidator`
        DRF derives for `ticket` because it is left un-overridden — see
        `apps.customers.serializers.CustomerSerializer`'s own comment on
        this exact DRF behaviour. Ownership and status-eligibility are
        checked here; "already has feedback" is the free UniqueValidator.
        """
        user = self.context["request"].user
        if not hasattr(user, "customer_profile"):
            raise serializers.ValidationError(
                _("Only customer accounts can submit feedback through the portal.")
            )
        customer = user.customer_profile
        if ticket.customer_id != customer.id:
            raise serializers.ValidationError(_("That ticket does not belong to you."))
        if ticket.status not in (Ticket.Status.RESOLVED, Ticket.Status.CLOSED):
            raise serializers.ValidationError(
                _("Feedback can only be submitted for a resolved or closed ticket.")
            )
        return ticket


class PortalMessageSerializer(BaseModelSerializer):
    """A customer's own reply on their ticket's conversation — the portal
    counterpart to `MessageViewSet`'s staff-facing shape. No
    staff-facing serializer is subclassed (unlike `PortalTicketSerializer`
    narrowing `TicketSerializer`) — this exposes a deliberately narrower
    field set (`channel`/`metadata`/`target_address` all omitted), so it
    stands alone, the same relationship `PortalFeedbackSerializer` has to
    `Feedback` (no staff viewer exists to subclass either).

    `author` is derived rather than exposing `direction` raw — the same
    reasoning `apps.portal.views._chatbot_state()` already documents: "a
    customer-facing surface should not have to know that 'outbound' means
    'not the customer.'"
    """

    author = serializers.SerializerMethodField()
    immutable_fields = ("ticket",)

    class Meta(BaseModelSerializer.Meta):
        model = Message
        fields = ("id", "ticket", "author", "body", "created_at")

    def get_author(self, message: Message) -> str:
        return "customer" if message.direction == Message.Direction.INBOUND else "agent"

    def validate_ticket(self, ticket: Ticket) -> Ticket:
        """Ownership only — deliberately no status branch. Contrast
        `PortalFeedbackSerializer.validate_ticket` (post-resolution
        only): a customer can reply regardless of ticket status.
        """
        customer = self.context["request"].user.customer_profile
        if ticket.customer_id != customer.id:
            raise serializers.ValidationError(_("That ticket does not belong to you."))
        return ticket


class PortalChatbotMessageSerializer(serializers.Serializer):
    """Write-only input for `PortalChatbotView.post` — a plain
    `Serializer`, not a `ModelSerializer`: the customer supplies only a
    body, and everything else about the resulting `Message` (ticket,
    direction, channel) is decided server-side by `apps.ai.chatbot`.
    `max_length` matches the live-chat widget's own 2000-char cap
    (`LiveChatWidget`'s `messageSchema`).
    """

    body = serializers.CharField(max_length=2000, trim_whitespace=True)
