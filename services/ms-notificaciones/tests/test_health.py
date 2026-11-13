"""Pruebas del endpoint /health de ms-notificaciones."""

import pytest
from fastapi.testclient import TestClient

from app.main import app

cliente = TestClient(app)


def test_health_responde_up_sin_detalles() -> None:
    """Verifica que GET /health devuelva HTTP 200 y exactamente {'status': 'UP'}."""
    respuesta = cliente.get("/health")
    assert respuesta.status_code == 200
    assert respuesta.json() == {"status": "UP"}


@pytest.mark.parametrize("ruta", ["/", "/docs", "/redoc", "/openapi.json", "/env"])
def test_no_se_exponen_rutas_internas_en_produccion(ruta: str) -> None:
    """Verifica que no queden rutas administrativas o de documentación expuestas por defecto."""
    respuesta = cliente.get(ruta)
    assert respuesta.status_code == 404

