"""Conexión a db_notificaciones para los endpoints (sesión de SQLAlchemy por petición)."""

import os
from collections.abc import Iterator
from functools import lru_cache

from sqlalchemy import Engine, create_engine
from sqlalchemy.orm import Session, sessionmaker


@lru_cache(maxsize=1)
def _fabrica_sesiones() -> sessionmaker[Session]:
    # Se crea al primer uso: el servicio arranca aunque DATABASE_URL no esté configurada
    url = os.getenv("DATABASE_URL")
    if not url:
        raise RuntimeError("DATABASE_URL no está configurada")
    motor: Engine = create_engine(url, pool_pre_ping=True)
    return sessionmaker(bind=motor, expire_on_commit=False)


def obtener_sesion() -> Iterator[Session]:
    """Dependencia de FastAPI: abre una sesión y la cierra al terminar la petición."""
    with _fabrica_sesiones()() as sesion:
        yield sesion
