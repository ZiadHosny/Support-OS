"""Project URL root: the Django admin and the API. Every API route is
registered in `config/api_urls.py`, not here.
"""

from django.contrib import admin
from django.urls import include, path

urlpatterns = [
    path("admin/", admin.site.urls),
    path("api/", include("config.api_urls")),
]
