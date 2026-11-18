"""Pruebas de los datos de prueba ficticios de db_notificaciones (T1116-M)."""

import re
from pathlib import Path

from alembic import command
from alembic.config import Config
from sqlalchemy import create_engine, func, select
from sqlalchemy.orm import Session

from app.db import Contacto
from app.semilla import leer_datos, sembrar

RUTA_INI = Path(__file__).resolve().parents[1] / "alembic.ini"


def base_migrada(tmp_path: Path) -> Session:
    motor = create_engine(f"sqlite:///{tmp_path / 'semilla.db'}")
    cfg = Config(str(RUTA_INI))
    cfg.set_main_option("script_location", str(RUTA_INI.parent / "alembic"))
    with motor.begin() as conexion:
        cfg.attributes["connection"] = conexion
        command.upgrade(cfg, "head")
    return Session(motor)


def test_crea_un_contacto_autorizado_por_estudiante(tmp_path: Path) -> None:
    datos = leer_datos()
    with base_migrada(tmp_path) as sesion:
        assert sembrar(sesion, datos) == 12
        contactos = sesion.scalars(select(Contacto)).all()

    assert len(contactos) == 12
    assert all(c.autoriza_avisos and c.fecha_autorizacion for c in contactos)


def test_se_puede_ejecutar_otra_vez_sin_duplicar(tmp_path: Path) -> None:
    datos = leer_datos()
    with base_migrada(tmp_path) as sesion:
        sembrar(sesion, datos)
        sembrar(sesion, datos)
        assert sesion.scalar(select(func.count()).select_from(Contacto)) == 12


def test_solo_usa_numeros_reservados_para_ficcion() -> None:
    numeros = [r["whatsapp"] for r in leer_datos()["representantes"]]

    assert all(re.fullmatch(r"\+1202555010\d", n) for n in numeros)
