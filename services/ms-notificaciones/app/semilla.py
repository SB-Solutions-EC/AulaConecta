"""Datos de prueba FICTICIOS de db_notificaciones (T1116-M).

Crea un contacto con WhatsApp y consentimiento por cada estudiante de
infra/datos-prueba/datos.json, con los mismos UUID de representante y estudiante que
ms-academico. Los números son de la serie 555-01XX, reservada para ficción: nunca llegan a nadie.
Se puede ejecutar varias veces: cada contacto se crea o se actualiza por su id.

Uso: DATABASE_URL=<base de pruebas> python -m app.semilla
"""

import json
import os
import sys
import uuid
from datetime import datetime, timezone
from pathlib import Path
from typing import Any

from sqlalchemy import create_engine
from sqlalchemy.orm import Session

from app.db import Contacto

RUTA_POR_DEFECTO = Path(__file__).resolve().parents[3] / "infra" / "datos-prueba" / "datos.json"


def leer_datos(ruta: Path | None = None) -> dict[str, Any]:
    """Lee el archivo compartido de datos de prueba."""
    archivo = ruta or Path(os.getenv("DATOS_PRUEBA_ARCHIVO") or RUTA_POR_DEFECTO)
    return json.loads(archivo.read_text(encoding="utf-8"))


def sembrar(sesion: Session, datos: dict[str, Any]) -> int:
    """Crea o actualiza los contactos; devuelve cuántos quedaron."""
    whatsapp = {r["id"]: r["whatsapp"] for r in datos["representantes"]}
    autorizado_en = datetime(2026, 9, 7, 8, 0, tzinfo=timezone.utc)
    for estudiante in datos["estudiantes"]:
        sesion.merge(
            Contacto(
                id=uuid.UUID(estudiante["contactoId"]),
                representante_id=uuid.UUID(estudiante["representanteId"]),
                estudiante_id=uuid.UUID(estudiante["id"]),
                whatsapp=whatsapp[estudiante["representanteId"]],
                autoriza_avisos=True,
                fecha_autorizacion=autorizado_en,
                fecha_baja=None,
                version=1,
            )
        )
    sesion.commit()
    return len(datos["estudiantes"])


def principal() -> None:
    # Nunca en producción: son datos inventados
    if os.getenv("ENTORNO") == "production":
        sys.exit("Los datos de prueba no se cargan con ENTORNO=production")
    url = os.getenv("DATABASE_URL")
    if not url:
        sys.exit("Falta DATABASE_URL de la base de pruebas")
    with Session(create_engine(url)) as sesion:
        cantidad = sembrar(sesion, leer_datos())
    print(f"Datos de prueba cargados en db_notificaciones: {cantidad} contactos")


if __name__ == "__main__":
    principal()
