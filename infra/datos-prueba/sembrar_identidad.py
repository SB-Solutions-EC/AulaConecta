"""Cuentas de prueba FICTICIAS en db_identidad (T1116-M).

Crea una cuenta por cada persona de datos.json (más el administrador y la secretaría) con los
mismos UUID que usa ms-academico en persona.usuario_id. Todas comparten una clave de pruebas
que llega por CLAVE_DATOS_PRUEBA: nunca se escribe en el repositorio y solo se guarda su hash
Argon2id, igual que lo hace ms-identidad ({argon2}, 19 MiB, 2 iteraciones, 1 hilo).
Se puede ejecutar varias veces: cada cuenta se crea o se actualiza por su id.

Uso:
    pip install "psycopg[binary]" argon2-cffi
    DATABASE_URL=postgresql://usr_identidad:...@localhost:5432/db_identidad \\
    CLAVE_DATOS_PRUEBA=... python infra/datos-prueba/sembrar_identidad.py
"""

import json
import os
import sys
from pathlib import Path
from typing import Any

import psycopg
from argon2 import PasswordHasher
from argon2.low_level import Type

RUTA_DATOS = Path(__file__).resolve().parent / "datos.json"
LONGITUD_MINIMA_CLAVE = 12

# Los mismos parámetros que ConfiguracionSeguridad de ms-identidad
HASHER = PasswordHasher(time_cost=2, memory_cost=19_456, parallelism=1, hash_len=32, salt_len=16, type=Type.ID)


def cuentas(datos: dict[str, Any]) -> list[tuple[str, str, list[str]]]:
    """(usuario_id, nombre_usuario, roles) de todas las cuentas de prueba."""
    lista = [(p["usuarioId"], p["nombreUsuario"], p["roles"]) for p in datos["personal"]]
    for grupo, rol in (("docentes", "DOCENTE"), ("representantes", "REPRESENTANTE"), ("estudiantes", "ESTUDIANTE")):
        lista += [(p["usuarioId"], p["nombreUsuario"], [rol]) for p in datos[grupo]]
    return lista


def sembrar(conexion: psycopg.Connection, datos: dict[str, Any], clave: str) -> int:
    """Crea o actualiza las cuentas en una transacción; devuelve cuántas quedaron."""
    lista = cuentas(datos)
    with conexion.transaction(), conexion.cursor() as cursor:
        for usuario_id, nombre, roles in lista:
            # Cada cuenta con su propia sal; ya cambió la clave inicial para que la demo entre directo
            cursor.execute(
                """
                INSERT INTO usuario (id, nombre_usuario, hash_clave, debe_cambiar_clave, estado)
                VALUES (%s, %s, %s, FALSE, 'ACTIVO')
                ON CONFLICT (id) DO UPDATE SET nombre_usuario = EXCLUDED.nombre_usuario,
                    hash_clave = EXCLUDED.hash_clave, debe_cambiar_clave = FALSE, estado = 'ACTIVO',
                    intentos_fallidos = 0, bloqueado_hasta = NULL, clave_temporal_vence = NULL,
                    clave_temporal_usada = FALSE, actualizado_en = now()
                """,
                (usuario_id, nombre, "{argon2}" + HASHER.hash(clave)),
            )
            cursor.execute(
                """
                INSERT INTO usuario_rol (usuario_id, rol_id)
                SELECT %s, id FROM rol WHERE codigo = ANY(%s)
                ON CONFLICT DO NOTHING
                """,
                (usuario_id, roles),
            )
    return len(lista)


def principal() -> None:
    # Nunca en producción: son cuentas inventadas con una clave compartida
    if os.getenv("ENTORNO") == "production":
        sys.exit("Las cuentas de prueba no se cargan con ENTORNO=production")
    url = os.getenv("DATABASE_URL")
    clave = os.getenv("CLAVE_DATOS_PRUEBA", "")
    if not url:
        sys.exit("Falta DATABASE_URL de db_identidad de pruebas")
    if len(clave) < LONGITUD_MINIMA_CLAVE:
        sys.exit(f"CLAVE_DATOS_PRUEBA debe tener al menos {LONGITUD_MINIMA_CLAVE} caracteres")
    datos = json.loads(RUTA_DATOS.read_text(encoding="utf-8"))
    with psycopg.connect(url) as conexion:
        cantidad = sembrar(conexion, datos, clave)
    print(f"Cuentas de prueba cargadas en db_identidad: {cantidad}")


if __name__ == "__main__":
    principal()
