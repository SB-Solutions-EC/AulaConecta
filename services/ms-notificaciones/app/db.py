"""Modelos declarativos SQLAlchemy de db_notificaciones (docs/arquitectura/modelo_datos.md)."""

import uuid
from datetime import datetime
from typing import Any

from sqlalchemy import (
    JSON,
    Boolean,
    CheckConstraint,
    DateTime,
    ForeignKey,
    Integer,
    String,
    Text,
    Uuid,
    func,
)
from sqlalchemy.orm import DeclarativeBase, Mapped, mapped_column

FK_CONTACTO_ID = "contacto.id"


class Base(DeclarativeBase):
    """Clase base declarativa de SQLAlchemy para ms-notificaciones."""


class Contacto(Base):
    """Contacto del representante con consentimiento para avisos (RF-29, RNF-05)."""

    __tablename__ = "contacto"

    id: Mapped[uuid.UUID] = mapped_column(
        Uuid(as_uuid=True), primary_key=True, default=uuid.uuid4
    )
    representante_id: Mapped[uuid.UUID] = mapped_column(
        Uuid(as_uuid=True), nullable=False, index=True
    )
    estudiante_id: Mapped[uuid.UUID] = mapped_column(
        Uuid(as_uuid=True), nullable=False, index=True
    )
    whatsapp: Mapped[str] = mapped_column(String(20), nullable=False)
    autoriza_avisos: Mapped[bool] = mapped_column(
        Boolean, nullable=False, default=False
    )
    fecha_autorizacion: Mapped[datetime | None] = mapped_column(
        DateTime(timezone=True), nullable=True
    )
    fecha_baja: Mapped[datetime | None] = mapped_column(
        DateTime(timezone=True), nullable=True
    )
    creado_en: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), nullable=False, server_default=func.now()
    )
    actualizado_en: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), nullable=False, server_default=func.now()
    )
    actualizado_por: Mapped[uuid.UUID | None] = mapped_column(
        Uuid(as_uuid=True), nullable=True
    )
    version: Mapped[int] = mapped_column(Integer, nullable=False, default=0)


class SuscripcionPush(Base):
    """Suscripción Web Push (VAPID) del dispositivo de un representante (Nivel 1)."""

    __tablename__ = "suscripcion_push"

    id: Mapped[uuid.UUID] = mapped_column(
        Uuid(as_uuid=True), primary_key=True, default=uuid.uuid4
    )
    contacto_id: Mapped[uuid.UUID] = mapped_column(
        Uuid(as_uuid=True), ForeignKey(FK_CONTACTO_ID), nullable=False, index=True
    )
    endpoint: Mapped[str] = mapped_column(Text, nullable=False, unique=True)
    clave_p256dh: Mapped[str] = mapped_column(Text, nullable=False)
    clave_auth: Mapped[str] = mapped_column(Text, nullable=False)
    dispositivo: Mapped[str | None] = mapped_column(String(120), nullable=True)
    activa: Mapped[bool] = mapped_column(Boolean, nullable=False, default=True)
    creada_en: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), nullable=False, server_default=func.now()
    )


class Plantilla(Base):
    """Plantilla oficial de aviso sin notas detalladas (RNF-05)."""

    __tablename__ = "plantilla"
    __table_args__ = (
        CheckConstraint(
            "codigo IN ('CONFIRMACION_AUTORIZACION', 'PROMEDIO_BAJO', 'FALTA_SIN_JUSTIFICAR')",
            name="ck_plantilla_codigo",
        ),
    )

    id: Mapped[uuid.UUID] = mapped_column(
        Uuid(as_uuid=True), primary_key=True, default=uuid.uuid4
    )
    codigo: Mapped[str] = mapped_column(String(40), nullable=False, unique=True)
    texto: Mapped[str] = mapped_column(Text, nullable=False)
    nombre_meta: Mapped[str | None] = mapped_column(String(100), nullable=True)
    activa: Mapped[bool] = mapped_column(Boolean, nullable=False, default=True)
    version: Mapped[int] = mapped_column(Integer, nullable=False, default=0)


class EventoRecibido(Base):
    """Registro idempotente de eventos consumidos desde RabbitMQ."""

    __tablename__ = "evento_recibido"

    id: Mapped[uuid.UUID] = mapped_column(Uuid(as_uuid=True), primary_key=True)
    tipo: Mapped[str] = mapped_column(String(60), nullable=False)
    datos: Mapped[dict[str, Any]] = mapped_column(JSON, nullable=False)
    recibido_en: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), nullable=False, server_default=func.now()
    )
    procesado: Mapped[bool] = mapped_column(Boolean, nullable=False, default=False)


class Notificacion(Base):
    """Historial de avisos enviados o preparados con clave antiduplicado (RF-33, RF-34)."""

    __tablename__ = "notificacion"
    __table_args__ = (
        CheckConstraint(
            "canal IN ('PUSH', 'WHATSAPP_ASISTIDO', 'WHATSAPP_API')",
            name="ck_notificacion_canal",
        ),
        CheckConstraint(
            "motivo IN ('CONFIRMACION_AUTORIZACION', 'PROMEDIO_BAJO', 'FALTA_SIN_JUSTIFICAR')",
            name="ck_notificacion_motivo",
        ),
        CheckConstraint(
            "estado IN ('EN_COLA', 'ENVIADA', 'ENTREGADA', 'FALLIDA', 'PREPARADA', 'ENVIADA_MANUAL')",
            name="ck_notificacion_estado",
        ),
    )

    id: Mapped[uuid.UUID] = mapped_column(
        Uuid(as_uuid=True), primary_key=True, default=uuid.uuid4
    )
    contacto_id: Mapped[uuid.UUID] = mapped_column(
        Uuid(as_uuid=True), ForeignKey(FK_CONTACTO_ID), nullable=False, index=True
    )
    plantilla_id: Mapped[uuid.UUID] = mapped_column(
        Uuid(as_uuid=True), ForeignKey("plantilla.id"), nullable=False
    )
    evento_id: Mapped[uuid.UUID | None] = mapped_column(
        Uuid(as_uuid=True), ForeignKey("evento_recibido.id"), nullable=True
    )
    canal: Mapped[str] = mapped_column(String(30), nullable=False)
    motivo: Mapped[str] = mapped_column(String(40), nullable=False)
    clave_antiduplicado: Mapped[str] = mapped_column(
        String(200), nullable=False, unique=True
    )
    estado: Mapped[str] = mapped_column(
        String(30), nullable=False, default="EN_COLA"
    )
    enviada_por_usuario_id: Mapped[uuid.UUID | None] = mapped_column(
        Uuid(as_uuid=True), nullable=True
    )
    intentos: Mapped[int] = mapped_column(Integer, nullable=False, default=0)
    id_mensaje_proveedor: Mapped[str | None] = mapped_column(
        String(150), nullable=True
    )
    creada_en: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), nullable=False, server_default=func.now()
    )
    enviada_en: Mapped[datetime | None] = mapped_column(
        DateTime(timezone=True), nullable=True
    )
    version: Mapped[int] = mapped_column(Integer, nullable=False, default=0)
