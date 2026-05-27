from django.db import IntegrityError
from rest_framework import status
from rest_framework.response import Response
from rest_framework.views import exception_handler


def api_exception_handler(exc, context):
    response = exception_handler(exc, context)
    if response is not None:
        return response

    if isinstance(exc, IntegrityError):
        message = str(exc)
        if "uniq_payment_plan_per_unit_owner" in message:
            return Response(
                {"non_field_errors": ["Bu daire ve malik için zaten ödeme planı mevcut."]},
                status=status.HTTP_400_BAD_REQUEST,
            )
        if "uniq_category_slug_per_project_active" in message:
            return Response(
                {"slug": ["Bu slug zaten kullanılıyor."]},
                status=status.HTTP_400_BAD_REQUEST,
            )
        return Response(
            {"detail": "Veri bütünlüğü hatası. Gönderilen alanları kontrol edin."},
            status=status.HTTP_400_BAD_REQUEST,
        )

    return Response(
        {"detail": "Sunucu hatası oluştu."},
        status=status.HTTP_500_INTERNAL_SERVER_ERROR,
    )
