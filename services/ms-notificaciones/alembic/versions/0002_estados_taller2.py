"""Estados del aviso según el Taller 2 y RF-35, y motivo del fallo (RF-33).

- Estados: EN_COLA, PREPARADA, ENVIADA, ENTREGADA, FALLIDA, POR_REVISAR y SIN_AUTORIZACION
  (diagrama de estados del aviso y diccionario de datos, docs/analisis/Grupo01_Taller2_2.pdf).
  ENVIADA_MANUAL deja de existir: un WhatsApp asistido enviado queda ENVIADA y
  enviada_por_usuario_id dice quién lo envió.
- motivo_fallo: por qué falló el aviso o por qué quedó por revisar tras 24 h (RF-33, RF-35).

Revision ID: 0002_estados_taller2
Revises: 0001_init
Create Date: 2026-11-16 18:00:00
"""

from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa

revision: str = "0002_estados_taller2"
down_revision: Union[str, None] = "0001_init"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None

ESTADOS_NUEVOS = (
    "estado IN ('EN_COLA', 'PREPARADA', 'ENVIADA', 'ENTREGADA', 'FALLIDA', "
    "'POR_REVISAR', 'SIN_AUTORIZACION')"
)
ESTADOS_ANTERIORES = (
    "estado IN ('EN_COLA', 'ENVIADA', 'ENTREGADA', 'FALLIDA', 'PREPARADA', 'ENVIADA_MANUAL')"
)
RESTRICCION = "ck_notificacion_estado"


def upgrade() -> None:
    op.execute("UPDATE notificacion SET estado = 'ENVIADA' WHERE estado = 'ENVIADA_MANUAL'")
    # batch_alter_table recrea la tabla en SQLite (las pruebas) y usa ALTER TABLE en PostgreSQL
    with op.batch_alter_table("notificacion") as lote:
        lote.drop_constraint(RESTRICCION, type_="check")
        lote.create_check_constraint(RESTRICCION, ESTADOS_NUEVOS)
        lote.add_column(sa.Column("motivo_fallo", sa.String(255), nullable=True))


def downgrade() -> None:
    op.execute(
        "UPDATE notificacion SET estado = 'FALLIDA' WHERE estado IN ('POR_REVISAR', 'SIN_AUTORIZACION')"
    )
    with op.batch_alter_table("notificacion") as lote:
        lote.drop_column("motivo_fallo")
        lote.drop_constraint(RESTRICCION, type_="check")
        lote.create_check_constraint(RESTRICCION, ESTADOS_ANTERIORES)
