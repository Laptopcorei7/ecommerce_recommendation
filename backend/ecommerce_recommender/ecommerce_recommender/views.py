import requests
from rest_framework import status
from rest_framework.decorators import api_view
from rest_framework.response import Response

FASTAPI_URL = "http://127.0.0.1:8000/recommend/"


@api_view(["POST"])
def recommend_view(request):
    try:
        fastapi_response = requests.post(
            FASTAPI_URL, json=request.data
        )
        return Response(
            fastapi_response.json(),
            status=fastapi_response.status_code,
        )
    except Exception as e:
        return Response(
            {"error": str(e)},
            status=status.HTTP_500_INTERNAL_SERVER_ERROR,
        )
