"""Pruebas de la migración inicial de Alembic (0001_init) de db_notificaciones."""

from pathlib import Path

from alembic import command
from alembic.config import Config
import pytest
from sqlalchemy import create_engine, inspect, text
from sqlalchemy.exc import IntegrityError

RUTA_INI = Path(__file__).resolve().parents[1] / "alembic.ini"
TABLA_ALEMBIC = "alembic_version"


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
    tablas = set(inspector.get_table_names()) - {TABLA_ALEMBIC}
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
    assert set(inspector_post.get_table_names()) - {TABLA_ALEMBIC} == set()


def test_restricciones_check_rechazan_valores_invalidos(tmp_path: Path) -> None:
    """Verifica que las restricciones CHECK de plantilla impidan códigos no permitidos."""
    db_file = tmp_path / "test_check.db"
    engine = create_engine(f"sqlite:///{db_file}")

    cfg = Config(str(RUTA_INI))
    cfg.set_main_option("script_location", str(RUTA_INI.parent / "alembic"))

    with engine.begin() as conn:
        cfg.attributes["connection"] = conn
        command.upgrade(cfg, "head")

    sentencia_invalida = text(
        "INSERT INTO plantilla (id, codigo, texto, activa, version) "
        "VALUES ('22222222-2222-4222-8222-222222222222', 'CODIGO_INVALIDO', 'texto', 1, 0)"
    )
    with engine.connect() as conn:
        with pytest.raises(IntegrityError):
            conn.execute(sentencia_invalida)


def test_estados_del_aviso_siguen_el_taller_2(tmp_path: Path) -> None:
    """La migración 0002 deja los estados del diagrama del aviso (RF-35) y el motivo del fallo (RF-33)."""
    db_file = tmp_path / "test_estados.db"
    engine = create_engine(f"sqlite:///{db_file}")

    cfg = Config(str(RUTA_INI))
    cfg.set_main_option("script_location", str(RUTA_INI.parent / "alembic"))
    with engine.begin() as conn:
        cfg.attributes["connection"] = conn
        command.upgrade(cfg, "head")

    columnas = {c["name"] for c in inspect(engine).get_columns("notificacion")}
    assert "motivo_fallo" in columnas

    contacto = "33333333-3333-4333-8333-333333333333"
    plantilla = "11111111-1111-4111-8111-111111111102"

    def insertar(conn, numero: int, estado: str) -> None:
        conn.execute(
            text(
                "INSERT INTO notificacion (id, contacto_id, plantilla_id, canal, motivo, clave_antiduplicado, "
                "estado, intentos, version) VALUES (:id, :contacto, :plantilla, 'PUSH', 'PROMEDIO_BAJO', :clave, "
                ":estado, 0, 0)"
            ),
            {
                "id": f"44444444-4444-4444-8444-44444444440{numero}",
                "contacto": contacto,
                "plantilla": plantilla,
                "clave": f"clave-{numero}",
                "estado": estado,
            },
        )

    with engine.begin() as conn:
        conn.execute(
            text(
                "INSERT INTO contacto (id, representante_id, estudiante_id, whatsapp, autoriza_avisos, version) "
                "VALUES (:id, :id, :id, '+593000000000', 1, 0)"
            ),
            {"id": contacto},
        )
        for numero, estado in enumerate(["POR_REVISAR", "SIN_AUTORIZACION"], start=1):
            insertar(conn, numero, estado)

    with engine.connect() as conn:
        with pytest.raises(IntegrityError):
            insertar(conn, 9, "ENVIADA_MANUAL")
