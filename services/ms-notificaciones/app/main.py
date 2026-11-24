"""ms-notificaciones de AulaConecta.

Expone /health sin detalles internos y los endpoints protegidos con el token de ms-identidad
(T1106-M), alineados con el contrato openapi/ms-notificaciones.yaml y el gateway Traefik.
Los errores siguen la forma ErrorApi: {codigo, mensaje, timestamp}.
"""

import os
import uuid
from datetime import datetime, timezone
from pathlib import Path
from typing import Annotated, Literal

from alembic import command
from alembic.config import Config
from fastapi import Depends, FastAPI, Request
from fastapi.exceptions import RequestValidationError
from fastapi.responses import JSONResponse
from pydantic import BaseModel, ConfigDict
from pydantic.alias_generators import to_camel
from sqlalchemy import select
from sqlalchemy.orm import Session
from starlette.exceptions import HTTPException as StarletteHTTPException

from app.db import Plantilla
from app.seguridad import UsuarioToken, requiere_roles
from app.sesion import obtener_sesion

RUTA_ALEMBIC_INI = Path(__file__).resolve().parents[1] / "alembic.ini"


class RespuestaSalud(BaseModel):
    """Estado de disponibilidad del microservicio."""

    status: Literal["UP", "DOWN"]


class PlantillaRespuesta(BaseModel):
    """Plantilla oficial de aviso (sin notas detalladas, RNF-05)."""

    model_config = ConfigDict(alias_generator=to_camel, populate_by_name=True)

    id: uuid.UUID
    codigo: str
    texto: str
    nombre_meta: str | None
    activa: bool
    version: int


CODIGOS_POR_ESTADO = {
    400: "VALIDACION",
    401: "NO_AUTORIZADO",
    403: "ACCESO_DENEGADO",
    404: "NO_ENCONTRADO",
    405: "METODO_NO_PERMITIDO",
}


def respuesta_error(
    estado: int, codigo: str, mensaje: str, cabeceras: dict[str, str] | None = None
) -> JSONResponse:
    """Respuesta con la forma ErrorApi del contrato."""
    return JSONResponse(
        status_code=estado,
        content={
            "codigo": codigo,
            "mensaje": mensaje,
            "timestamp": datetime.now(timezone.utc).isoformat(),
        },
        headers=cabeceras,
    )


def registrar_manejadores(aplicacion: FastAPI) -> None:
    """Todos los errores salen como ErrorApi, sin rutas ni detalles internos."""

    @aplicacion.exception_handler(StarletteHTTPException)
    async def _error_http(_: Request, error: StarletteHTTPException) -> JSONResponse:
        if isinstance(error.detail, dict):
            codigo = str(error.detail.get("codigo"))
            mensaje = str(error.detail.get("mensaje"))
        else:
            codigo = CODIGOS_POR_ESTADO.get(error.status_code, "ERROR")
            mensaje = "No se pudo atender la solicitud."
        return respuesta_error(error.status_code, codigo, mensaje, error.headers)

    @aplicacion.exception_handler(RequestValidationError)
    async def _error_validacion(_: Request, __: RequestValidationError) -> JSONResponse:
        return respuesta_error(400, "VALIDACION", "Los datos enviados no son válidos.")


def ejecutar_migraciones_al_arrancar() -> None:
    """Aplica las migraciones de Alembic cuando DATABASE_URL está configurada."""
    if not os.getenv("DATABASE_URL") or os.getenv("SALTAR_MIGRACIONES") == "1":
        return
    cfg = Config(str(RUTA_ALEMBIC_INI))
    cfg.set_main_option(
        "script_location", str(RUTA_ALEMBIC_INI.parent / "alembic")
    )
    command.upgrade(cfg, "head")


def crear_aplicacion() -> FastAPI:
    """Crea y configura la instancia de FastAPI de ms-notificaciones."""
    ejecutar_migraciones_al_arrancar()
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

    @aplicacion.get(
        "/plantillas",
        response_model=list[PlantillaRespuesta],
        response_model_by_alias=True,
        tags=["Plantillas"],
        summary="Plantillas oficiales de avisos",
    )
    def listar_plantillas(
        _usuario: Annotated[
            UsuarioToken, Depends(requiere_roles("ADMIN", "SECRETARIA", "DOCENTE"))
        ],
        sesion: Annotated[Session, Depends(obtener_sesion)],
    ) -> list[PlantillaRespuesta]:
        filas = sesion.scalars(select(Plantilla).order_by(Plantilla.codigo)).all()
        return [
            PlantillaRespuesta(
                id=f.id,
                codigo=f.codigo,
                texto=f.texto,
                nombre_meta=f.nombre_meta,
                activa=f.activa,
                version=f.version,
            )
            for f in filas
        ]

    registrar_manejadores(aplicacion)

    return aplicacion


app = crear_aplicacion()
