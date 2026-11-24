# ms-notificaciones

Microservicio de notificaciones y consentimiento de AulaConecta en **FastAPI + Python 3.12** con **SQLAlchemy + Alembic** (`db_notificaciones`) y **RabbitMQ**. Expone `/health` (`{"status":"UP"}`) y aplica automáticamente el esquema inicial en `db_notificaciones` con Alembic al arrancar.

- **Contrato OpenAPI v0:** [openapi/ms-notificaciones.yaml](../../openapi/ms-notificaciones.yaml)
- **Modelo de datos y canales:** [docs/arquitectura/modelo_datos.md](../../docs/arquitectura/modelo_datos.md) y [docs/arquitectura/plantillas_whatsapp.md](../../docs/arquitectura/plantillas_whatsapp.md)

| Cuándo | Qué se construye |
|---|---|
| Sprint 3 (26/10) | Contrato OpenAPI v0 y estructura en el monorepo |
| Sprint 3 (27/10) | Esqueleto en FastAPI con `/health` y pruebas con `pytest` |
| Sprint 3 (28/10) | `db_notificaciones` con Alembic (`alembic/versions/0001_init.py`) y RabbitMQ en `docker-compose.yml` |
| Sprint 4 (06/11) | Validación del JWT de ms-identidad, roles y pruebas `pytest` de autorización (T1106-M) |
| Sprint 5 (16/11) | Datos de prueba ficticios: `python -m app.semilla` crea los contactos de [infra/datos-prueba](../../infra/datos-prueba) (T1116-M) |
| Sprint 8 | Contactos, consentimiento, consumidor de RabbitMQ, canales Push/WhatsApp e historial |

## Autenticación y roles

Los endpoints (salvo `/health`) exigen el token de acceso de ms-identidad (`Authorization: Bearer ...`). La validación está en [app/seguridad.py](app/seguridad.py) y se usa como dependencia de FastAPI:

```python
@aplicacion.get("/plantillas")
def listar(usuario: Annotated[UsuarioToken, Depends(requiere_roles("ADMIN", "SECRETARIA", "DOCENTE"))]): ...
```

Solo se acepta RS256 con un kid del JWKS de ms-identidad (`AULACONECTA_JWKS_URL`, por defecto `http://ms-identidad:8080/.well-known/jwks.json`); las llaves se guardan 10 minutos. Un token inválido, vencido, de otro emisor o audiencia, o de servicio responde `401 NO_AUTORIZADO`; la clave inicial sin cambiar, `403 CAMBIO_CLAVE_PENDIENTE`; un rol no permitido, `403 ACCESO_DENEGADO`. Todos los errores tienen la forma ErrorApi `{codigo, mensaje, timestamp}`.

| Endpoint | Roles |
|---|---|
| `GET /plantillas` | ADMIN, SECRETARIA, DOCENTE |

Las pruebas ([tests/test_autorizacion.py](tests/test_autorizacion.py)) generan llaves RSA en cada ejecución y publican el JWKS en un servidor local.

## Cómo ejecutarlo

Con Python 3.12 en local:

```bash
cd services/ms-notificaciones
python -m venv .venv
# En Linux/macOS: source .venv/bin/activate | En Windows: .venv\Scripts\activate
pip install -r requirements-dev.txt
uvicorn app.main:app --reload --port 8000
```

Ejecutar migraciones manualmente con Alembic:

```bash
export DATABASE_URL="postgresql+psycopg://usr_notificaciones:cambiar-notificaciones-local@localhost:5432/db_notificaciones"
alembic upgrade head
```

Ejecutar pruebas unitarias y de migración con cobertura:

```bash
pytest --cov=app --cov-report=xml
```

Con Docker, junto con el gateway, PostgreSQL y RabbitMQ (ver [infra/](../../infra)):

```bash
cp infra/.env.example infra/.env     # solo la primera vez
docker compose -f infra/docker-compose.yml up --build
curl -k https://localhost/api/notificaciones/health
```

Responsables del área: @cmbonifaz (esqueleto y migración inicial) y @cmacuna7 (módulo).
