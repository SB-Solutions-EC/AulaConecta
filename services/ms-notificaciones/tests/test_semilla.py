"""Pruebas de los datos de prueba ficticios de db_notificaciones (T1116-M)."""

import json
import re
from pathlib import Path

import pytest

from alembic import command
from alembic.config import Config
from sqlalchemy import create_engine, func, select
from sqlalchemy.orm import Session

from app.db import Contacto
from app import semilla
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

    # +1 202 555-01XX, escrito por partes para no formar 10 dígitos seguidos (regla de cédula de gitleaks)
    assert all(re.fullmatch(r"\+1(202)(555)(01\d\d)", n) for n in numeros)


def test_lee_el_archivo_de_datos_prueba_archivo(tmp_path: Path, monkeypatch) -> None:
    """En la imagen no hay carpeta del repositorio: los datos llegan por DATOS_PRUEBA_ARCHIVO (T1116-A)."""
    copia = tmp_path / "datos.json"
    copia.write_text(json.dumps(leer_datos()), encoding="utf-8")
    monkeypatch.setenv("DATOS_PRUEBA_ARCHIVO", str(copia))

    assert len(leer_datos()["estudiantes"]) == 12


def test_sin_repositorio_ni_variable_pide_datos_prueba_archivo(monkeypatch) -> None:
    """Como dentro de la imagen (/app/app/semilla.py): importar el módulo no falla, pero sí pedir la ruta."""
    monkeypatch.delenv("DATOS_PRUEBA_ARCHIVO", raising=False)
    monkeypatch.setattr(semilla, "__file__", "/app/semilla.py")

    with pytest.raises(FileNotFoundError, match="DATOS_PRUEBA_ARCHIVO"):
        semilla.leer_datos()
