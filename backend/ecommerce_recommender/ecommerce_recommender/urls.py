"""URL configuration for the API gateway."""

from django.contrib import admin
from django.urls import path

from .views import health_view, recommend_view

urlpatterns = [
    path("admin/", admin.site.urls),
    path("api/recommend/", recommend_view, name="recommend"),
    path("api/health/", health_view, name="health"),
]
