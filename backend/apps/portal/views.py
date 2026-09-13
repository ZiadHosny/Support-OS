import logging

from django.utils.translation import gettext_lazy as _
from drf_spectacular.utils import OpenApiTypes, extend_schema
from rest_framework.exceptions import PermissionDenied, ValidationError
from rest_framework.permissions import IsAuthenticated
from rest_framework.response import Response
from rest_framework.views import APIView

from apps.ai.chatbot import BOT_AUTHOR, answer, get_or_start_session, hand_off
from apps.ai.exceptions import AIServiceError, AIServiceUnavailable
from apps.ai.models import ChatbotSession
from apps.ai.tasks import categorize_ticket
from apps.communications.models import Message
from apps.core.permissions import HasPermission, Permissions
from apps.core.throttling import AiRateThrottle
from apps.core.views import CustomerScopedModelViewSet
from apps.sla.tasks import auto_assign_ticket
from apps.tickets.models import Feedback, Ticket

from .serializers import (
    PortalChatbotMessageSerializer,
    PortalFeedbackSerializer,
    PortalMessageSerializer,
    PortalTicketSerializer,
)

logger = logging.getLogger(__name__)


class PortalTicketViewSet(CustomerScopedModelViewSet):
    """A customer's own tickets — create (PORTAL-1), list and retrieve
    (PORTAL-2). `customer_field` is left at `CustomerScopedModelViewSet`'s
    default (`"customer"`) — `Ticket.customer` is already the right name,
    no override needed.

    Only `create`, `list`, `retrieve` are routed to a URL (see
    `apps/portal/urls.py`); `update`/`partial_update`/`destroy` exist on
    this class (inherited from `ModelViewSet`) but are unreachable — no
    router registers them, and no story has asked for a customer to edit
    or delete a submitted ticket.
    """

    # Same select_related tuple as TicketViewSet.queryset
    # (apps/tickets/views.py:50) — `category_name`/`assigned_agent_name`
    # are derived, joined fields; without this, `list` is an N+1 query,
    # one extra SELECT per row per joined field. `"feedback"` added for
    # `has_feedback` (PORTAL-5) — the reverse side of a OneToOneField IS
    # select_related-able in Django (unlike a reverse ForeignKey, which
    # needs prefetch_related).
    queryset = Ticket.objects.select_related(
        "customer", "category", "assigned_agent", "feedback"
    ).all()
    serializer_class = PortalTicketSerializer
    permission_map = {
        "create": Permissions.PORTAL_ACCESS,
        "list": Permissions.PORTAL_ACCESS,
        "retrieve": Permissions.PORTAL_ACCESS,
    }

    # Each name here must match a ColumnDef.id on the frontend, exactly
    # like TicketViewSet's own contract (CONVENTIONS.md §23).
    ordering_fields = ("subject", "status", "priority", "created_at")

    def get_queryset(self):
        queryset = super().get_queryset()
        if self.action != "list":
            return queryset

        # Same validation TicketViewSet.get_queryset already uses for the
        # identical param (apps/tickets/views.py:118-122) — "live status
        # tracking" is the one filter this story's intake names.
        status = self.request.query_params.get("status")
        if status:
            if status not in Ticket.Status.values:
                raise ValidationError({"status": [_("Must be a valid status.")]})
            queryset = queryset.filter(status=status)

        return queryset

    def perform_create(self, serializer):
        # The one line CustomerScopedModelViewSet's scoping cannot do for
        # you on create: force the customer, never trust the client for it.
        # `customer_profile` raises `RelatedObjectDoesNotExist` (an
        # `AttributeError` subclass) for a caller with no linked `Customer`
        # row — a real case, not hypothetical: `super_admin` legitimately
        # holds `portal.access` alongside every other permission, so a
        # staff account can reach this action without ever having a
        # customer profile. `hasattr` is the verified-safe check this
        # codebase already uses for the same reverse accessor elsewhere
        # (`PortalTicketSerializer.get_has_feedback`).
        if not hasattr(self.request.user, "customer_profile"):
            raise PermissionDenied(
                _("Only customer accounts can submit tickets through the portal.")
            )
        ticket = serializer.save(customer=self.request.user.customer_profile)
        try:
            auto_assign_ticket.delay(ticket.id)
        except Exception:
            # Same resilience contract as TicketViewSet.perform_create
            # (apps/tickets/views.py:83-93) — the Ticket row is already
            # committed; auto-assignment queuing failing must not fail
            # the customer's submission.
            logger.exception("Failed to queue auto-assignment for ticket %s", ticket.id)
        try:
            categorize_ticket.delay(ticket.id)
        except Exception:
            # Same resilience contract, one call site over — AI-3.
            logger.exception("Failed to queue AI categorization for ticket %s", ticket.id)


class PortalFeedbackViewSet(CustomerScopedModelViewSet):
    """A customer's own CSAT submission — PORTAL-5. Create only; no
    `list`/`retrieve` route exists or is needed — a customer learns
    whether they already rated a ticket via
    `PortalTicketSerializer.has_feedback`, not by fetching `Feedback` rows
    directly. `customer_field` left at the default (`"customer"`) —
    `Feedback.customer` is a direct FK, matching what
    `CustomerScopedModelViewSet`/`HasPermission.has_object_permission`
    both expect (see Story 47 `## Prerequisites`).
    """

    queryset = Feedback.objects.all()
    serializer_class = PortalFeedbackSerializer
    permission_map = {"create": Permissions.PORTAL_ACCESS}

    def perform_create(self, serializer):
        # Same guard as `PortalTicketViewSet.perform_create` — see its
        # comment. `validate_ticket` on the serializer already checks this
        # first in the normal request path, but this stays defensive in
        # case `perform_create` is ever reached without it (e.g. a direct
        # `serializer.save()` call in a future test or script).
        if not hasattr(self.request.user, "customer_profile"):
            raise PermissionDenied(
                _("Only customer accounts can submit feedback through the portal.")
            )
        serializer.save(customer=self.request.user.customer_profile)


class PortalMessageViewSet(CustomerScopedModelViewSet):
    """A customer's own reply thread on their tickets. `list` + `create`
    only — never `retrieve`/`update`/`partial_update`/`destroy`: no
    object-level permission check ever runs against a `Message` through
    this viewset (only `RetrieveModelMixin`/`UpdateModelMixin`/
    `DestroyModelMixin` trigger `HasPermission.has_object_permission`),
    which is what makes the nested `customer_field` below safe. Do not
    add those routes without re-deriving that reasoning first.

    `customer_field = "ticket__customer"` — `Message` has no direct
    `customer` FK (unlike `Feedback`, which denormalized one specifically
    to support `has_object_permission`'s single-attribute lookup — not
    needed here since this viewset never triggers that check).
    """

    customer_field = "ticket__customer"
    queryset = Message.objects.select_related("ticket").all()
    serializer_class = PortalMessageSerializer
    permission_map = {
        "list": Permissions.PORTAL_ACCESS,
        "create": Permissions.PORTAL_ACCESS,
    }

    def get_queryset(self):
        queryset = super().get_queryset()
        if self.action != "list":
            return queryset
        # Same required-param shape as MessageViewSet.get_queryset
        # (apps/communications/views.py) — a conversation list with no
        # ticket filter makes no sense for either surface.
        ticket_id = self.request.query_params.get("ticket")
        if not ticket_id:
            raise ValidationError({"ticket": [_("This query parameter is required.")]})
        try:
            ticket_id = int(ticket_id)
        except ValueError:
            raise ValidationError({"ticket": [_("Must be a valid ticket id.")]}) from None
        return queryset.filter(ticket_id=ticket_id)

    def perform_create(self, serializer):
        # Same guard as PortalTicketViewSet.perform_create /
        # PortalFeedbackViewSet.perform_create — a staff account can hold
        # portal.access (e.g. super_admin) without ever having a linked
        # Customer row.
        if not hasattr(self.request.user, "customer_profile"):
            raise PermissionDenied(
                _("Only customer accounts can send messages through the portal.")
            )
        # A portal reply is always inbound, always web_form — never
        # client-controlled. No adapter dispatch: MessageViewSet.perform_create
        # only calls adapter.send() for OUTBOUND messages; an inbound
        # customer message needs no delivery step.
        serializer.save(direction=Message.Direction.INBOUND, channel=Message.Channel.WEB_FORM)


def _chatbot_state(session: ChatbotSession) -> dict:
    """The one response shape all three chatbot endpoints return — the
    full conversation state, so the widget replaces its state wholesale
    instead of merging. `author` is derived here rather than exposing
    `direction`/`metadata`: a customer-facing surface should not have to
    know that "outbound" means "not the customer."
    """
    messages = Message.objects.filter(ticket=session.ticket).order_by("created_at")
    return {
        "ticket": session.ticket_id,
        "handed_off": session.handed_off_at is not None,
        "messages": [
            {
                "id": message.id,
                "author": (
                    "customer"
                    if message.direction == Message.Direction.INBOUND
                    else ("bot" if message.metadata.get("author") == BOT_AUTHOR else "agent")
                ),
                "body": message.body,
                "created_at": message.created_at,
            }
            for message in messages
        ],
    }


@extend_schema(
    request=OpenApiTypes.OBJECT,
    responses={200: OpenApiTypes.OBJECT},
    summary="Portal chatbot session",
    description=(
        "GET returns the current session state; POST sends a message and "
        "returns the updated state (messages plus any suggested articles)."
    ),
)
class PortalChatbotView(APIView):
    """The portal assistant — AI-5. `GET` loads (or starts) the customer's
    conversation; `POST` sends a message and returns the state including
    the bot's reply. A plain `APIView`, so `permission_classes` is set
    explicitly and `permission_map` is keyed by lowercased HTTP method —
    the same shape `KnowledgeBaseSearchView` (KB-3) established.
    """

    permission_classes = [IsAuthenticated, HasPermission]
    permission_map = {
        "get": Permissions.PORTAL_ACCESS,
        "post": Permissions.PORTAL_ACCESS,
    }
    # PROD-3: every POST here costs a paid provider call, and this was
    # callable in a loop by any portal customer. `get` is included
    # deliberately — `get_or_start_session` can CREATE a session, and the
    # scope is shared with `post` so a client cannot alternate verbs to
    # double its budget. Keyed per user. See CONVENTIONS.md § 36.
    throttle_classes = [AiRateThrottle]

    def _customer(self):
        # Same guard, same reason as PortalTicketViewSet.perform_create:
        # a staff account can hold `portal.access` without ever having a
        # customer profile.
        if not hasattr(self.request.user, "customer_profile"):
            raise PermissionDenied(_("Only customer accounts can use the portal assistant."))
        return self.request.user.customer_profile

    def get(self, request):
        session = get_or_start_session(self._customer())
        return Response(_chatbot_state(session))

    def post(self, request):
        serializer = PortalChatbotMessageSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)

        session = get_or_start_session(self._customer())
        if session.handed_off_at is not None:
            raise ValidationError({"body": [_("This conversation is now with a human agent.")]})
        try:
            answer(session, serializer.validated_data["body"])
        except AIServiceError as exc:
            raise AIServiceUnavailable() from exc
        session.refresh_from_db()
        return Response(_chatbot_state(session))


@extend_schema(
    request=None,
    responses={200: OpenApiTypes.OBJECT},
    summary="Hand the chatbot session to a human agent",
)
class PortalChatbotHandoffView(APIView):
    """Customer-requested handoff — AI-5. Idempotent (`hand_off` is), so a
    double-click is a no-op rather than a second assignment attempt.
    """

    permission_classes = [IsAuthenticated, HasPermission]
    permission_map = {"post": Permissions.PORTAL_ACCESS}
    # PROD-3: shares the `ai` scope with `PortalChatbotView` above, so the
    # handoff path cannot be used to top up a spent chat budget.
    throttle_classes = [AiRateThrottle]

    def post(self, request):
        if not hasattr(request.user, "customer_profile"):
            raise PermissionDenied(_("Only customer accounts can use the portal assistant."))
        session = get_or_start_session(request.user.customer_profile)
        hand_off(session)
        session.refresh_from_db()
        return Response(_chatbot_state(session))
