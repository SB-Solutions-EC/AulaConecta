# ms-notificaciones

Microservicio de notificaciones y consentimiento de AulaConecta en **FastAPI + Python** con **PostgreSQL** (`db_notificaciones`, SQLAlchemy + Alembic) y **RabbitMQ**. Gestiona contactos de representantes en formato E.164, autorización y baja de avisos (RNF-05), suscripciones Web Push (nivel 1), avisos por WhatsApp asistido (nivel 2), WhatsApp Cloud API opcional (nivel 3) e historial antiduplicados.

- **Contrato OpenAPI v0:** [openapi/ms-notificaciones.yaml](../../openapi/ms-notificaciones.yaml)
- **Modelo de datos y canales:** [docs/arquitectura/modelo_datos.md](../../docs/arquitectura/modelo_datos.md) y [docs/arquitectura/plantillas_whatsapp.md](../../docs/arquitectura/plantillas_whatsapp.md)

| Cuándo | Qué se construye |
|---|---|
| Sprint 3 (26/10) | Contrato OpenAPI v0 y estructura en el monorepo |
| Sprint 3 (27/10) | Esqueleto en FastAPI con `/health` |
| Sprint 3 (28/10) | `db_notificaciones` con Alembic y RabbitMQ en `docker-compose.yml` |
| Sprint 8 | Contactos, consentimiento, consumidor de RabbitMQ, canales Push/WhatsApp e historial |

Responsables del área: @cmbonifaz (esqueleto) y @cmacuna7 (módulo).

