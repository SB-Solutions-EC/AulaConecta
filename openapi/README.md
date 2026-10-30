# openapi — Contratos OpenAPI v0

**Tarea:** T1026-C · **Responsable:** Christian Mateo Bonifaz Vásquez · **Fecha:** 26/10/2026 · **Sprint 3**

Contratos OpenAPI 3.1.0 iniciales (**v0**) de los tres microservicios de AulaConecta, alineados con la [arquitectura C4 v2](../docs/arquitectura/c4.md), el [modelo de datos por servicio v2](../docs/arquitectura/modelo_datos.md) y el [diseño del trabajo sin conexión](../docs/arquitectura/Diagramas/trabajo_sin_conexion.md).

## Contratos por microservicio

| Contrato | Servicio | Tecnología | Ruta en el Gateway | Puerto interno | Base de datos |
|---|---|---|---|---|---|
| [ms-identidad.yaml](ms-identidad.yaml) | `ms-identidad` | Spring Boot 4 · Java 21 | `/api/identidad` | `8080` | `db_identidad` (Flyway) |
| [ms-academico.yaml](ms-academico.yaml) | `ms-academico` | NestJS · TypeScript | `/api/academico` | `3000` | `db_academico` (Prisma) |
| [ms-notificaciones.yaml](ms-notificaciones.yaml) | `ms-notificaciones` | FastAPI · Python | `/api/notificaciones` | `8000` | `db_notificaciones` (Alembic) |

## Convenciones comunes

1. **Identificadores y sincronización (`RNF-01`):** Todos los recursos de dominio usan `id` en formato `UUID` (generable tanto en el servidor como en la PWA sin conexión) y un entero `version` para control optimista de concurrencia y resolución de conflictos (`409 Conflict`).
2. **Autenticación y autorización (`RF-01`, `RNF-04`):**
   - La PWA envía el JWT RS256 de corta duración (15 min) en `Authorization: Bearer <token>` a través del Gateway Traefik.
   - `ms-academico` y `ms-notificaciones` validan localmente la firma consultando `GET /api/identidad/.well-known/jwks.json`.
   - La creación de cuentas desde `ms-academico` hacia `ms-identidad` usa un token de servicio emitido en `POST /api/identidad/oauth/token` (`client_credentials`).
3. **Separación de datos personales (`RNF-04`, `RNF-05`):**
   - `ms-identidad` solo almacena credenciales, roles, sesiones y auditoría de accesos (`usuario_id`).
   - `ms-academico` almacena los datos académicos y `PERSONA` referenciando `usuarioId`.
   - `ms-notificaciones` almacena únicamente los teléfonos en formato E.164, suscripciones Web Push, consentimiento y el historial de avisos.
4. **Eventos asíncronos (RabbitMQ):** Los avisos por promedio menor a 7 (`academico.promedio_bajo`) y faltas sin justificar (`academico.falta_registrada`) viajan desde la tabla `OUTBOX` de `ms-academico` hacia el exchange `aulaconecta.eventos` y la cola `notificaciones.avisos` (con DLQ `notificaciones.avisos.dlq`), registrándose en `EVENTO_RECIBIDO` de `ms-notificaciones`.

