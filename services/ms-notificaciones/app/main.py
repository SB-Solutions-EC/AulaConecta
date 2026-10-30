"""Esqueleto de ms-notificaciones de AulaConecta.

Expone únicamente /health sin detalles internos, alineado con el contrato OpenAPI v0
(openapi/ms-notificaciones.yaml) y las reglas del gateway Traefik (/api/notificaciones/health).
"""

from contextlib import asynccontextmanager
import os
from pathlib import Path
from typing import AsyncIterator, Literal

from alembic import command
from alembic.config import Config
from fastapi import FastAPI
from pydantic import BaseModel

RUTA_ALEMBIC_INI = Path(__file__).resolve().parents[1] / "alembic.ini"


class RespuestaSalud(BaseModel):
    """Estado de disponibilidad del microservicio."""

    status: Literal["UP", "DOWN"]


def ejecutar_migraciones_al_arrancar() -> None:
    """Aplica las migraciones de Alembic cuando DATABASE_URL está configurada."""
    if not os.getenv("DATABASE_URL") or os.getenv("SALTAR_MIGRACIONES") == "1":
        return
    cfg = Config(str(RUTA_ALEMBIC_INI))
    cfg.set_main_option(
        "script_location", str(RUTA_ALEMBIC_INI.parent / "alembic")
    )
    command.upgrade(cfg, "head")


@asynccontextmanager
async def ciclo_vida(_aplicacion: FastAPI) -> AsyncIterator[None]:
    """Ejecuta las migraciones de db_notificaciones al iniciar el servicio."""
    ejecutar_migraciones_al_arrancar()
    yield


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
        lifespan=ciclo_vida,
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
