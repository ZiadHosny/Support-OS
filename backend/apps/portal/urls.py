from django.urls import path

from .views import (
    PortalChatbotHandoffView,
    PortalChatbotView,
    PortalFeedbackViewSet,
    PortalMessageViewSet,
    PortalTicketViewSet,
)

app_name = "portal"

# Plain path()s, not a router: this viewset exposes exactly three actions.
# Registering it with a router would additionally route update/partial_update
# /destroy URLs no story has asked for — see PortalTicketViewSet's own
# docstring.
urlpatterns = [
    path(
        "portal/tickets/",
        PortalTicketViewSet.as_view({"get": "list", "post": "create"}),
        name="portal-ticket-list",
    ),
    path(
        "portal/tickets/<int:pk>/",
        PortalTicketViewSet.as_view({"get": "retrieve"}),
        name="portal-ticket-detail",
    ),
    path(
        "portal/feedback/",
        PortalFeedbackViewSet.as_view({"post": "create"}),
        name="portal-feedback-create",
    ),
    path(
        "portal/messages/",
        PortalMessageViewSet.as_view({"get": "list", "post": "create"}),
        name="portal-message-list",
    ),
    path("portal/chatbot/", PortalChatbotView.as_view(), name="portal-chatbot"),
    path(
        "portal/chatbot/handoff/",
        PortalChatbotHandoffView.as_view(),
        name="portal-chatbot-handoff",
    ),
]
