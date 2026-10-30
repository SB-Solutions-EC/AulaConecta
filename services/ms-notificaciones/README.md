# ms-notificaciones

Microservicio de notificaciones y consentimiento de AulaConecta en **FastAPI + Python 3.12**. Por ahora es el esqueleto: expone `/health` (`{"status":"UP"}`) y se publica a través del gateway en `/api/notificaciones/health`.

- **Contrato OpenAPI v0:** [openapi/ms-notificaciones.yaml](../../openapi/ms-notificaciones.yaml)
- **Modelo de datos y canales:** [docs/arquitectura/modelo_datos.md](../../docs/arquitectura/modelo_datos.md) y [docs/arquitectura/plantillas_whatsapp.md](../../docs/arquitectura/plantillas_whatsapp.md)

| Cuándo | Qué se construye |
|---|---|
| Sprint 3 (26/10) | Contrato OpenAPI v0 y estructura en el monorepo |
| Sprint 3 (27/10) | Esqueleto en FastAPI con `/health` y pruebas con `pytest` |
| Sprint 3 (28/10) | `db_notificaciones` con Alembic y RabbitMQ en `docker-compose.yml` |
| Sprint 8 | Contactos, consentimiento, consumidor de RabbitMQ, canales Push/WhatsApp e historial |

## Cómo ejecutarlo

Con Python 3.12 en local:

```bash
cd services/ms-notificaciones
python -m venv .venv
# En Linux/macOS: source .venv/bin/activate | En Windows: .venv\Scripts\activate
pip install -r requirements-dev.txt
uvicorn app.main:app --reload --port 8000
```

Ejecutar pruebas unitarias y cobertura:

```bash
pytest --cov=app --cov-report=xml
```

Con Docker, junto con el gateway (ver [infra/](../../infra)):

```bash
cp infra/.env.example infra/.env     # solo la primera vez
docker compose -f infra/docker-compose.yml up --build
curl -k https://localhost/api/notificaciones/health
```

Responsables del área: @cmbonifaz (esqueleto) y @cmacuna7 (módulo).
