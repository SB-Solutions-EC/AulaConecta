# services — Microservicios de AulaConecta

Microservicios de backend del monorepo. Cada servicio es dueño exclusivo de su base de datos en PostgreSQL y publica su contrato en [openapi/](../openapi).

| Microservicio | Tecnología | Puerto interno | Base de datos y migraciones | Contrato OpenAPI | Responsable |
|---|---|---|---|---|---|
| [ms-identidad/](ms-identidad) | Spring Boot 4 · Java 21 | `8080` | `db_identidad` (Flyway) | [openapi/ms-identidad.yaml](../openapi/ms-identidad.yaml) | @adarboleda |
| [ms-academico/](ms-academico) | NestJS · TypeScript | `3000` | `db_academico` (Prisma) | [openapi/ms-academico.yaml](../openapi/ms-academico.yaml) | @cmacuna7 |
| [ms-notificaciones/](ms-notificaciones) | FastAPI · Python | `8000` | `db_notificaciones` (Alembic) | [openapi/ms-notificaciones.yaml](../openapi/ms-notificaciones.yaml) | @cmbonifaz / @cmacuna7 |

Arquitectura y comunicación entre servicios: [docs/arquitectura/c4.md](../docs/arquitectura/c4.md) y [docs/arquitectura/modelo_datos.md](../docs/arquitectura/modelo_datos.md).

