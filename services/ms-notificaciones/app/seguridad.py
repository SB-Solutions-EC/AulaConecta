"""Validación de los tokens de acceso de ms-identidad en ms-notificaciones (T1106-M).

Los tokens son RS256 con kid; las llaves públicas se descargan del JWKS de ms-identidad
y se guardan en memoria. Cualquier problema con el token termina en 401 con la forma ErrorApi.
"""

import os
import re
from dataclasses import dataclass
from functools import lru_cache
from typing import Annotated, Callable

import jwt
from fastapi import Depends, HTTPException, Request

FORMATO_BEARER = re.compile(r"^Bearer ([\w-]+\.[\w-]+\.[\w-]+)$")
TOLERANCIA_RELOJ_S = 30
VIGENCIA_JWKS_S = 600


@dataclass(frozen=True)
class UsuarioToken:
    """Usuario autenticado tal como lo describe el token."""

    id: str
    roles: tuple[str, ...]
    debe_cambiar_clave: bool


def error_api(estado: int, codigo: str, mensaje: str) -> HTTPException:
    """Error con código propio; el manejador de main.py lo convierte en ErrorApi."""
    cabeceras = {"WWW-Authenticate": "Bearer"} if estado == 401 else None
    return HTTPException(
        status_code=estado,
        detail={"codigo": codigo, "mensaje": mensaje},
        headers=cabeceras,
    )


def no_autorizado() -> HTTPException:
    return error_api(401, "NO_AUTORIZADO", "Inicia sesión para continuar.")


def _url_jwks() -> str:
    return os.getenv(
        "AULACONECTA_JWKS_URL", "http://ms-identidad:8080/.well-known/jwks.json"
    )


def _emisor() -> str:
    return os.getenv("AULACONECTA_JWT_EMISOR") or "aulaconecta-identidad"


def _audiencia() -> str:
    return os.getenv("AULACONECTA_JWT_AUDIENCIA") or "aulaconecta"


@lru_cache(maxsize=4)
def _cliente_jwks(url: str) -> jwt.PyJWKClient:
    # Un cliente por URL: guarda las llaves en memoria y las renueva cada 10 minutos
    return jwt.PyJWKClient(url, cache_keys=True, lifespan=VIGENCIA_JWKS_S, timeout=5)


def verificar_token(cabecera: str | None) -> UsuarioToken:
    """Valida la cabecera Authorization y devuelve el usuario del token."""
    coincidencia = FORMATO_BEARER.match(cabecera or "")
    if not coincidencia:
        raise no_autorizado()
    token = coincidencia.group(1)
    try:
        # El algoritmo lo fija el servidor (RS256), nunca el token: evita alg none y HS256
        encabezado = jwt.get_unverified_header(token)
        if encabezado.get("alg") != "RS256" or not isinstance(encabezado.get("kid"), str):
            raise no_autorizado()
        llave = _cliente_jwks(_url_jwks()).get_signing_key(encabezado["kid"])
        reclamos = jwt.decode(
            token,
            llave.key,
            algorithms=["RS256"],
            audience=_audiencia(),
            issuer=_emisor(),
            leeway=TOLERANCIA_RELOJ_S,
            options={"require": ["exp", "iss", "aud", "sub"]},
        )
    except (jwt.PyJWTError, ValueError) as error:
        # Incluye la firma inválida, el kid desconocido y el JWKS caído (PyJWKClientError)
        raise no_autorizado() from error

    roles = reclamos.get("roles")
    tipo = reclamos.get("tipo")
    sub = reclamos.get("sub")
    # Los tokens de servicio son para llamadas entre microservicios, no para la API de usuarios
    if (
        tipo not in (None, "usuario")
        or not isinstance(sub, str)
        or not sub
        or not isinstance(roles, list)
        or not all(isinstance(rol, str) for rol in roles)
    ):
        raise no_autorizado()
    return UsuarioToken(
        id=sub,
        roles=tuple(roles),
        debe_cambiar_clave=reclamos.get("debe_cambiar_clave") is not False,
    )


def usuario_actual(request: Request) -> UsuarioToken:
    """Dependencia: exige un token válido y la clave inicial ya cambiada."""
    usuario = verificar_token(request.headers.get("Authorization"))
    if usuario.debe_cambiar_clave:
        raise error_api(
            403, "CAMBIO_CLAVE_PENDIENTE", "Cambia tu clave inicial para continuar."
        )
    return usuario


def requiere_roles(*permitidos: str) -> Callable[[UsuarioToken], UsuarioToken]:
    """Dependencia: además del token, exige uno de los roles indicados."""

    def _verificar(
        usuario: Annotated[UsuarioToken, Depends(usuario_actual)],
    ) -> UsuarioToken:
        if not any(rol in usuario.roles for rol in permitidos):
            raise error_api(
                403, "ACCESO_DENEGADO", "No tienes permiso para esta acción."
            )
        return usuario

    return _verificar
