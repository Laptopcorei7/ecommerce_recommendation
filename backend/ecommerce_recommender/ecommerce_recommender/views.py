"""API gateway between the storefront and the model service.

The previous version POSTed a JSON body to an endpoint declared as GET with
query parameters, at the same port Django itself runs on, so the call could
never have succeeded. It also returned str(exc) to the client on any failure,
which leaks internal addresses, and had no timeout, so a hung model service
would hold a Django worker open forever.
"""

from __future__ import annotations

import logging

import requests
from django.conf import settings
from rest_framework import status
from rest_framework.decorators import api_view
from rest_framework.response import Response

log = logging.getLogger(__name__)


@api_view(["GET"])
def recommend_view(request):
    user_id = request.query_params.get("user_id")
    if not user_id:
        return Response(
            {"error": "user_id is required"}, status=status.HTTP_400_BAD_REQUEST
        )

    try:
        top_n = int(request.query_params.get("top_n", 10))
    except ValueError:
        return Response(
            {"error": "top_n must be a whole number"}, status=status.HTTP_400_BAD_REQUEST
        )
    top_n = max(1, min(top_n, 100))

    params = {"user_id": user_id, "top_n": top_n}
    alpha = request.query_params.get("alpha")
    if alpha is not None:
        params["alpha"] = alpha

    try:
        upstream = requests.get(
            settings.MODEL_SERVICE_URL + "/recommend/",
            params=params,
            timeout=settings.MODEL_SERVICE_TIMEOUT,
        )
    except requests.Timeout:
        log.warning("model service timed out for user_id=%s", user_id)
        return Response(
            {"error": "recommendation service timed out"},
            status=status.HTTP_504_GATEWAY_TIMEOUT,
        )
    except requests.RequestException:
        # Logged with the traceback server-side; the client gets a fixed string
        # so the internal host and port never reach the browser.
        log.exception("model service unreachable")
        return Response(
            {"error": "recommendation service unavailable"},
            status=status.HTTP_503_SERVICE_UNAVAILABLE,
        )

    if upstream.status_code == 404:
        return Response(
            {"error": "user not found", "user_id": user_id},
            status=status.HTTP_404_NOT_FOUND,
        )

    try:
        payload = upstream.json()
    except ValueError:
        log.error("model service returned non-JSON (status %s)", upstream.status_code)
        return Response(
            {"error": "recommendation service returned an invalid response"},
            status=status.HTTP_502_BAD_GATEWAY,
        )

    return Response(payload, status=upstream.status_code)


@api_view(["GET"])
def health_view(request):
    """Reports whether the gateway can actually reach the model service."""
    try:
        upstream = requests.get(
            settings.MODEL_SERVICE_URL + "/health",
            timeout=settings.MODEL_SERVICE_TIMEOUT,
        )
        return Response(
            {"gateway": "ok", "model_service": upstream.json()},
            status=status.HTTP_200_OK,
        )
    except requests.RequestException:
        return Response(
            {"gateway": "ok", "model_service": "unreachable",
             "url": settings.MODEL_SERVICE_URL},
            status=status.HTTP_503_SERVICE_UNAVAILABLE,
        )
