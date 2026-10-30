# ms-academico

Microservicio de gestión académica de AulaConecta en **NestJS + TypeScript** con **PostgreSQL** (`db_academico`, Prisma). Gestiona año lectivo, cursos, materias, docentes, matrícula, planificación curricular ERCA, calificaciones (con `packages/calculo`), asistencia, comportamiento, reportes y sincronización offline (`/sync/pull` y `/sync/push`).

- **Contrato OpenAPI v0:** [openapi/ms-academico.yaml](../../openapi/ms-academico.yaml)
- **Modelo de datos:** [docs/arquitectura/modelo_datos.md](../../docs/arquitectura/modelo_datos.md)

| Cuándo | Qué se construye |
|---|---|
| Sprint 3 (26/10) | Contrato OpenAPI v0 y estructura en el monorepo |
| Sprint 3 (27/10) | Esqueleto en NestJS con `/health` y Swagger |
| Sprint 3 (28/10) | Esquema inicial en `db_academico` con Prisma Migrate |
| Sprint 4 en adelante | Módulos académicos según el Product Backlog |

Responsable del área: @cmacuna7.

