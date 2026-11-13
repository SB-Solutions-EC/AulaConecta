"""Esquema inicial de db_notificaciones y las 3 plantillas oficiales de avisos.

Revision ID: 0001_init
Revises: None
Create Date: 2026-10-28 08:00:00
"""

from typing import Sequence, Union
import uuid

from alembic import op
import sqlalchemy as sa

revision: str = "0001_init"
down_revision: Union[str, None] = None
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None

PLANTILLAS_INICIALES = [
    {
        "id": uuid.UUID("11111111-1111-4111-8111-111111111101"),
        "codigo": "CONFIRMACION_AUTORIZACION",
        "texto": (
            '🏫 U.E. "Andoas" · AulaConecta\n\n'
            "Hola {{1}}, desde ahora recibirá por este medio avisos sobre el "
            "rendimiento y la asistencia de {{2}}.\n\n"
            'Puede dejar de recibirlos cuando quiera con el botón "No recibir avisos".'
        ),
        "nombre_meta": "confirmacion_autorizacion",
        "activa": True,
        "version": 0,
    },
    {
        "id": uuid.UUID("11111111-1111-4111-8111-111111111102"),
        "codigo": "PROMEDIO_BAJO",
        "texto": (
            '🏫 U.E. "Andoas" · AulaConecta\n\n'
            "Hola {{1}}, le informamos que {{2}} tiene un promedio menor a 7 en *{{3}}*.\n\n"
            "Le recomendamos revisar el detalle con su representado y, si lo necesita, "
            "acercarse al docente de la materia."
        ),
        "nombre_meta": "promedio_bajo",
        "activa": True,
        "version": 0,
    },
    {
        "id": uuid.UUID("11111111-1111-4111-8111-111111111103"),
        "codigo": "FALTA_SIN_JUSTIFICAR",
        "texto": (
            '🏫 U.E. "Andoas" · AulaConecta\n\n'
            "Hola {{1}}, {{2}} registró una *falta sin justificar* el {{3}} en {{4}}.\n\n"
            "Si la falta tiene justificación, puede registrarla en AulaConecta o "
            "comunicarse con el colegio."
        ),
        "nombre_meta": "falta_sin_justificar",
        "activa": True,
        "version": 0,
    },
]


def upgrade() -> None:
    """Crea las tablas del modelo de notificaciones e inserta las 3 plantillas oficiales."""
    op.create_table(
        "contacto",
        sa.Column("id", sa.Uuid(as_uuid=True), primary_key=True, nullable=False),
        sa.Column("representante_id", sa.Uuid(as_uuid=True), nullable=False),
        sa.Column("estudiante_id", sa.Uuid(as_uuid=True), nullable=False),
        sa.Column("whatsapp", sa.String(length=20), nullable=False),
        sa.Column(
            "autoriza_avisos",
            sa.Boolean(),
            nullable=False,
            server_default=sa.text("false"),
        ),
        sa.Column("fecha_autorizacion", sa.DateTime(timezone=True), nullable=True),
        sa.Column("fecha_baja", sa.DateTime(timezone=True), nullable=True),
        sa.Column(
            "creado_en",
            sa.DateTime(timezone=True),
            nullable=False,
            server_default=sa.func.now(),
        ),
        sa.Column(
            "actualizado_en",
            sa.DateTime(timezone=True),
            nullable=False,
            server_default=sa.func.now(),
        ),
        sa.Column("actualizado_por", sa.Uuid(as_uuid=True), nullable=True),
        sa.Column(
            "version", sa.Integer(), nullable=False, server_default=sa.text("0")
        ),
    )
    op.create_index("ix_contacto_representante_id", "contacto", ["representante_id"])
    op.create_index("ix_contacto_estudiante_id", "contacto", ["estudiante_id"])

    op.create_table(
        "suscripcion_push",
        sa.Column("id", sa.Uuid(as_uuid=True), primary_key=True, nullable=False),
        sa.Column(
            "contacto_id",
            sa.Uuid(as_uuid=True),
            sa.ForeignKey("contacto.id"),
            nullable=False,
        ),
        sa.Column("endpoint", sa.Text(), nullable=False, unique=True),
        sa.Column("clave_p256dh", sa.Text(), nullable=False),
        sa.Column("clave_auth", sa.Text(), nullable=False),
        sa.Column("dispositivo", sa.String(length=120), nullable=True),
        sa.Column(
            "activa", sa.Boolean(), nullable=False, server_default=sa.text("true")
        ),
        sa.Column(
            "creada_en",
            sa.DateTime(timezone=True),
            nullable=False,
            server_default=sa.func.now(),
        ),
    )
    op.create_index(
        "ix_suscripcion_push_contacto_id", "suscripcion_push", ["contacto_id"]
    )

    tabla_plantilla = op.create_table(
        "plantilla",
        sa.Column("id", sa.Uuid(as_uuid=True), primary_key=True, nullable=False),
        sa.Column("codigo", sa.String(length=40), nullable=False, unique=True),
        sa.Column("texto", sa.Text(), nullable=False),
        sa.Column("nombre_meta", sa.String(length=100), nullable=True),
        sa.Column(
            "activa", sa.Boolean(), nullable=False, server_default=sa.text("true")
        ),
        sa.Column(
            "version", sa.Integer(), nullable=False, server_default=sa.text("0")
        ),
        sa.CheckConstraint(
            "codigo IN ('CONFIRMACION_AUTORIZACION', 'PROMEDIO_BAJO', 'FALTA_SIN_JUSTIFICAR')",
            name="ck_plantilla_codigo",
        ),
    )

    op.create_table(
        "evento_recibido",
        sa.Column("id", sa.Uuid(as_uuid=True), primary_key=True, nullable=False),
        sa.Column("tipo", sa.String(length=60), nullable=False),
        sa.Column("datos", sa.JSON(), nullable=False),
        sa.Column(
            "recibido_en",
            sa.DateTime(timezone=True),
            nullable=False,
            server_default=sa.func.now(),
        ),
        sa.Column(
            "procesado",
            sa.Boolean(),
            nullable=False,
            server_default=sa.text("false"),
        ),
    )

    op.create_table(
        "notificacion",
        sa.Column("id", sa.Uuid(as_uuid=True), primary_key=True, nullable=False),
        sa.Column(
            "contacto_id",
            sa.Uuid(as_uuid=True),
            sa.ForeignKey("contacto.id"),
            nullable=False,
        ),
        sa.Column(
            "plantilla_id",
            sa.Uuid(as_uuid=True),
            sa.ForeignKey("plantilla.id"),
            nullable=False,
        ),
        sa.Column(
            "evento_id",
            sa.Uuid(as_uuid=True),
            sa.ForeignKey("evento_recibido.id"),
            nullable=True,
        ),
        sa.Column("canal", sa.String(length=30), nullable=False),
        sa.Column("motivo", sa.String(length=40), nullable=False),
        sa.Column(
            "clave_antiduplicado",
            sa.String(length=200),
            nullable=False,
            unique=True,
        ),
        sa.Column(
            "estado",
            sa.String(length=30),
            nullable=False,
            server_default=sa.text("'EN_COLA'"),
        ),
        sa.Column(
            "enviada_por_usuario_id", sa.Uuid(as_uuid=True), nullable=True
        ),
        sa.Column(
            "intentos", sa.Integer(), nullable=False, server_default=sa.text("0")
        ),
        sa.Column(
            "id_mensaje_proveedor", sa.String(length=150), nullable=True
        ),
        sa.Column(
            "creada_en",
            sa.DateTime(timezone=True),
            nullable=False,
            server_default=sa.func.now(),
        ),
        sa.Column("enviada_en", sa.DateTime(timezone=True), nullable=True),
        sa.Column(
            "version", sa.Integer(), nullable=False, server_default=sa.text("0")
        ),
        sa.CheckConstraint(
            "canal IN ('PUSH', 'WHATSAPP_ASISTIDO', 'WHATSAPP_API')",
            name="ck_notificacion_canal",
        ),
        sa.CheckConstraint(
            "motivo IN ('CONFIRMACION_AUTORIZACION', 'PROMEDIO_BAJO', 'FALTA_SIN_JUSTIFICAR')",
            name="ck_notificacion_motivo",
        ),
        sa.CheckConstraint(
            "estado IN ('EN_COLA', 'ENVIADA', 'ENTREGADA', 'FALLIDA', 'PREPARADA', 'ENVIADA_MANUAL')",
            name="ck_notificacion_estado",
        ),
    )
    op.create_index(
        "ix_notificacion_contacto_id", "notificacion", ["contacto_id"]
    )

    op.bulk_insert(tabla_plantilla, PLANTILLAS_INICIALES)


def downgrade() -> None:
    """Revierte las tablas del esquema inicial de db_notificaciones."""
    op.drop_index("ix_notificacion_contacto_id", table_name="notificacion")
    op.drop_table("notificacion")
    op.drop_table("evento_recibido")
    op.drop_table("plantilla")
    op.drop_index(
        "ix_suscripcion_push_contacto_id", table_name="suscripcion_push"
    )
    op.drop_table("suscripcion_push")
    op.drop_index("ix_contacto_estudiante_id", table_name="contacto")
    op.drop_index("ix_contacto_representante_id", table_name="contacto")
    op.drop_table("contacto")

