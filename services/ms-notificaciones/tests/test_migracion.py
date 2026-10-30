"""Pruebas de la migración inicial de Alembic (0001_init) de db_notificaciones."""

from pathlib import Path

from alembic import command
from alembic.config import Config
import pytest
from sqlalchemy import create_engine, inspect, text
from sqlalchemy.exc import IntegrityError

RUTA_INI = Path(__file__).resolve().parents[1] / "alembic.ini"


def test_migracion_alembic_crea_tablas_y_plantillas_oficiales(tmp_path: Path) -> None:
    """Verifica que upgrade('head') cree las 5 tablas y cargue las 3 plantillas oficiales."""
    db_file = tmp_path / "test_notificaciones.db"
    engine = create_engine(f"sqlite:///{db_file}")

    cfg = Config(str(RUTA_INI))
    cfg.set_main_option("script_location", str(RUTA_INI.parent / "alembic"))

    with engine.begin() as conn:
        cfg.attributes["connection"] = conn
        command.upgrade(cfg, "head")

    inspector = inspect(engine)
    tablas = set(inspector.get_table_names()) - {"alembic_version"}
    assert tablas == {
        "contacto",
        "suscripcion_push",
        "plantilla",
        "evento_recibido",
        "notificacion",
    }

    with engine.connect() as conn:
        codigos = [
            fila[0]
            for fila in conn.execute(
                text("SELECT codigo FROM plantilla ORDER BY codigo")
            ).fetchall()
        ]
        assert codigos == [
            "CONFIRMACION_AUTORIZACION",
            "FALTA_SIN_JUSTIFICAR",
            "PROMEDIO_BAJO",
        ]

    with engine.begin() as conn:
        cfg.attributes["connection"] = conn
        command.downgrade(cfg, "base")

    inspector_post = inspect(engine)
    assert set(inspector_post.get_table_names()) - {"alembic_version"} == set()


def test_restricciones_check_rechazan_valores_invalidos(tmp_path: Path) -> None:
    """Verifica que las restricciones CHECK de plantilla impidan códigos no permitidos."""
    db_file = tmp_path / "test_check.db"
    engine = create_engine(f"sqlite:///{db_file}")

    cfg = Config(str(RUTA_INI))
    cfg.set_main_option("script_location", str(RUTA_INI.parent / "alembic"))

    with engine.begin() as conn:
        cfg.attributes["connection"] = conn
        command.upgrade(cfg, "head")

    with pytest.raises(IntegrityError):
        with engine.begin() as conn:
            conn.execute(
                text(
                    "INSERT INTO plantilla (id, codigo, texto, activa, version) "
                    "VALUES ('22222222-2222-4222-8222-222222222222', 'CODIGO_INVALIDO', 'texto', 1, 0)"
                )
            )

