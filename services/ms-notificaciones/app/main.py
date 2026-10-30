"""Esqueleto de ms-notificaciones de AulaConecta.

Expone únicamente /health sin detalles internos, alineado con el contrato OpenAPI v0
(openapi/ms-notificaciones.yaml) y las reglas del gateway Traefik (/api/notificaciones/health).
"""

from typing import Literal

from fastapi import FastAPI
from pydantic import BaseModel


class RespuestaSalud(BaseModel):
    """Estado de disponibilidad del microservicio."""

    status: Literal["UP", "DOWN"]


def crear_aplicacion() -> FastAPI:
    """Crea y configura la instancia de FastAPI de ms-notificaciones."""
    aplicacion = FastAPI(
        title="AulaConecta — ms-notificaciones API",
        version="0.1.0",
        description=(
            "Microservicio de notificaciones y consentimiento de AulaConecta "
            "(Web Push, WhatsApp asistido y WhatsApp Cloud API)."
        ),
        docs_url=None,
        redoc_url=None,
        openapi_url=None,
    )

    @aplicacion.get(
        "/health",
        response_model=RespuestaSalud,
        tags=["Salud"],
        summary="Estado de salud del servicio",
    )
    def obtener_salud() -> RespuestaSalud:
        return RespuestaSalud(status="UP")

    return aplicacion


app = crear_aplicacion()

