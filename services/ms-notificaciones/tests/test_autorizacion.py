"""Pruebas de autorización con tokens de ms-identidad en ms-notificaciones (T1106-M).

Las llaves RSA se generan en cada ejecución y el JWKS se publica en un servidor local:
no hay llaves guardadas en el repositorio.
"""

import base64
import hashlib
import hmac
import json
import threading
import time
import uuid
from collections.abc import Iterator
from http.server import BaseHTTPRequestHandler, HTTPServer
from pathlib import Path

import jwt
import pytest
from alembic import command
from alembic.config import Config
from cryptography.hazmat.primitives import serialization
from cryptography.hazmat.primitives.asymmetric import rsa
from fastapi.testclient import TestClient
from sqlalchemy import create_engine
from sqlalchemy.orm import Session, sessionmaker

from app import seguridad
from app.main import app
from app.sesion import obtener_sesion

EMISOR = "aulaconecta-identidad"
AUDIENCIA = "aulaconecta"
KID = "llave-prueba-notificaciones"
RUTA_INI = Path(__file__).resolve().parents[1] / "alembic.ini"

LLAVE = rsa.generate_private_key(public_exponent=65537, key_size=2048)
LLAVE_AJENA = rsa.generate_private_key(public_exponent=65537, key_size=2048)
JWK = json.loads(jwt.algorithms.RSAAlgorithm.to_jwk(LLAVE.public_key()))
JWKS = {"keys": [{**JWK, "kid": KID, "alg": "RS256", "use": "sig"}]}


def b64(datos: bytes) -> str:
    return base64.urlsafe_b64encode(datos).rstrip(b"=").decode()


def reclamos(roles: list[str], **cambios: object) -> dict[str, object]:
    ahora = int(time.time())
    base: dict[str, object] = {
        "sub": str(uuid.uuid4()),
        "iss": EMISOR,
        "aud": [AUDIENCIA],
        "roles": roles,
        "debe_cambiar_clave": False,
        "iat": ahora,
        "exp": ahora + 900,
    }
    base.update(cambios)
    return base


def token(roles: list[str], llave: rsa.RSAPrivateKey = LLAVE, kid: str = KID, **cambios: object) -> str:
    return jwt.encode(reclamos(roles, **cambios), llave, algorithm="RS256", headers={"kid": kid})


class ManejadorJwks(BaseHTTPRequestHandler):
    descargas = 0

    def do_GET(self) -> None:  # noqa: N802 (nombre impuesto por http.server)
        ManejadorJwks.descargas += 1
        cuerpo = json.dumps(JWKS).encode()
        self.send_response(200 if self.path == "/.well-known/jwks.json" else 404)
        self.send_header("Content-Type", "application/json")
        self.send_header("Content-Length", str(len(cuerpo)))
        self.end_headers()
        self.wfile.write(cuerpo)

    def log_message(self, *_: object) -> None:
        pass


@pytest.fixture(scope="module")
def cliente(tmp_path_factory: pytest.TempPathFactory) -> Iterator[TestClient]:
    servidor = HTTPServer(("127.0.0.1", 0), ManejadorJwks)
    threading.Thread(target=servidor.serve_forever, daemon=True).start()
    puerto = servidor.server_address[1]
    parche = pytest.MonkeyPatch()
    parche.setenv("AULACONECTA_JWKS_URL", f"http://127.0.0.1:{puerto}/.well-known/jwks.json")
    seguridad._cliente_jwks.cache_clear()

    # db_notificaciones en SQLite con las migraciones reales (incluye las 3 plantillas oficiales)
    motor = create_engine(f"sqlite:///{tmp_path_factory.mktemp('bd') / 'notificaciones.db'}")
    cfg = Config(str(RUTA_INI))
    cfg.set_main_option("script_location", str(RUTA_INI.parent / "alembic"))
    with motor.begin() as conexion:
        cfg.attributes["connection"] = conexion
        command.upgrade(cfg, "head")
    fabrica = sessionmaker(bind=motor)

    def sesion_prueba() -> Iterator[Session]:
        with fabrica() as sesion:
            yield sesion

    app.dependency_overrides[obtener_sesion] = sesion_prueba
    yield TestClient(app)
    app.dependency_overrides.clear()
    parche.undo()
    seguridad._cliente_jwks.cache_clear()
    servidor.shutdown()


def con_token(cliente: TestClient, valor: str) -> object:
    return cliente.get("/plantillas", headers={"Authorization": f"Bearer {valor}"})


def tokens_rechazados() -> list[tuple[str, str | None]]:
    admin = reclamos(["ADMIN"])
    cuerpo_admin = b64(json.dumps(admin).encode())
    encabezado_hs = b64(json.dumps({"alg": "HS256", "typ": "JWT", "kid": KID}).encode())
    pem = LLAVE.public_key().public_bytes(serialization.Encoding.PEM, serialization.PublicFormat.SubjectPublicKeyInfo)
    firma_hs = b64(hmac.new(pem, f"{encabezado_hs}.{cuerpo_admin}".encode(), hashlib.sha256).digest())
    cabecera_doc, _, firma_doc = token(["DOCENTE"]).split(".")
    ahora = int(time.time())
    return [
        ("sin cabecera", None),
        ("esquema Basic", "Basic dXN1YXJpbzpjbGF2ZQ=="),
        ("Bearer vacío", "Bearer "),
        ("texto que no es JWT", "Bearer esto-no-es-un-token"),
        ("inyección SQL", "Bearer ' OR '1'='1"),
        ("alg none", f"Bearer {b64(json.dumps({'alg': 'none', 'typ': 'JWT'}).encode())}.{cuerpo_admin}."),
        ("HS256 con la llave pública", f"Bearer {encabezado_hs}.{cuerpo_admin}.{firma_hs}"),
        ("firmado con otra llave", f"Bearer {token(['ADMIN'], llave=LLAVE_AJENA)}"),
        ("kid desconocido", f"Bearer {token(['ADMIN'], llave=LLAVE_AJENA, kid='otra-llave')}"),
        ("rol cambiado conservando la firma", f"Bearer {cabecera_doc}.{cuerpo_admin}.{firma_doc}"),
        ("vencido", f"Bearer {token(['ADMIN'], iat=ahora - 3600, exp=ahora - 120)}"),
        ("de otro emisor", f"Bearer {token(['ADMIN'], iss='emisor-falso')}"),
        ("para otra audiencia", f"Bearer {token(['ADMIN'], aud=['otro-sistema'])}"),
        ("token de servicio", f"Bearer {token(['ADMIN'], tipo='servicio')}"),
        ("roles que no son lista", f"Bearer {jwt.encode({**reclamos([]), 'roles': 'ADMIN'}, LLAVE, algorithm='RS256', headers={'kid': KID})}"),
    ]


@pytest.mark.parametrize(("nombre", "cabecera"), tokens_rechazados(), ids=[n for n, _ in tokens_rechazados()])
def test_responde_401_con_error_api(cliente: TestClient, nombre: str, cabecera: str | None) -> None:
    cabeceras = {} if cabecera is None else {"Authorization": cabecera}
    respuesta = cliente.get("/plantillas", headers=cabeceras)

    assert respuesta.status_code == 401, nombre
    assert respuesta.headers["WWW-Authenticate"] == "Bearer"
    assert respuesta.json()["codigo"] == "NO_AUTORIZADO"
    assert set(respuesta.json()) == {"codigo", "mensaje", "timestamp"}


@pytest.mark.parametrize("rol", ["ADMIN", "SECRETARIA", "DOCENTE"])
def test_lista_las_plantillas_oficiales_a_los_roles_permitidos(cliente: TestClient, rol: str) -> None:
    respuesta = con_token(cliente, token([rol]))

    assert respuesta.status_code == 200
    codigos = [p["codigo"] for p in respuesta.json()]
    assert codigos == ["CONFIRMACION_AUTORIZACION", "FALTA_SIN_JUSTIFICAR", "PROMEDIO_BAJO"]
    assert set(respuesta.json()[0]) == {"id", "codigo", "texto", "nombreMeta", "activa", "version"}


@pytest.mark.parametrize("rol", ["REPRESENTANTE", "ESTUDIANTE"])
def test_otros_roles_reciben_403_acceso_denegado(cliente: TestClient, rol: str) -> None:
    respuesta = con_token(cliente, token([rol]))

    assert respuesta.status_code == 403
    assert respuesta.json()["codigo"] == "ACCESO_DENEGADO"


def test_clave_inicial_pendiente_responde_403(cliente: TestClient) -> None:
    respuesta = con_token(cliente, token(["ADMIN"], debe_cambiar_clave=True))

    assert respuesta.status_code == 403
    assert respuesta.json()["codigo"] == "CAMBIO_CLAVE_PENDIENTE"


def test_acepta_tipo_usuario(cliente: TestClient) -> None:
    assert con_token(cliente, token(["DOCENTE"], tipo="usuario")).status_code == 200


def test_guarda_el_jwks_en_memoria(cliente: TestClient) -> None:
    con_token(cliente, token(["ADMIN"]))
    antes = ManejadorJwks.descargas
    for _ in range(5):
        assert con_token(cliente, token(["ADMIN"])).status_code == 200

    assert ManejadorJwks.descargas == antes


def test_jwks_caido_responde_401_y_no_500(monkeypatch: pytest.MonkeyPatch) -> None:
    monkeypatch.setenv("AULACONECTA_JWKS_URL", "http://127.0.0.1:1/.well-known/jwks.json")

    with pytest.raises(Exception) as error:
        seguridad.verificar_token(f"Bearer {token(['ADMIN'])}")

    assert getattr(error.value, "status_code", None) == 401


def test_rutas_desconocidas_responden_error_api_sin_repetir_la_ruta() -> None:
    respuesta = TestClient(app).get("/no-existe")

    assert respuesta.status_code == 404
    assert respuesta.json()["codigo"] == "NO_ENCONTRADO"
    assert "/no-existe" not in respuesta.text
