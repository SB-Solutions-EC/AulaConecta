# ms-academico

Microservicio de gestión académica de AulaConecta en **NestJS + TypeScript** con **PostgreSQL** (`db_academico`, Prisma). Gestiona año lectivo, cursos, materias, docentes, matrícula, planificación curricular ERCA, calificaciones (con `packages/calculo`), asistencia, comportamiento, reportes y sincronización offline (`/sync/pull` y `/sync/push`).

- **Contrato OpenAPI v0:** [openapi/ms-academico.yaml](../../openapi/ms-academico.yaml)
- **Modelo de datos:** [docs/arquitectura/modelo_datos.md](../../docs/arquitectura/modelo_datos.md)
- **Contenedores y puertos:** [docs/arquitectura/c4.md](../../docs/arquitectura/c4.md)

## Requisitos

- Node.js 22 o superior (el equipo usa la 24)
- Docker, para la imagen y para PostgreSQL

## Uso en local

```bash
npm install
cp .env.example .env
npm run start:dev
```

| Dirección | Qué muestra |
|---|---|
| http://localhost:3000/health | Estado del servicio (`{"status":"UP"}`), lo usan el gateway y Docker |
| http://localhost:3000/docs | Swagger: documentación interactiva de la API |
| http://localhost:3000/docs-json | Contrato OpenAPI generado por el código |

## Comandos

| Comando | Para qué |
|---|---|
| `npm run start:dev` | Levanta el servicio y lo reinicia al guardar cambios |
| `npm run build` | Compila a `dist/` |
| `npm start` | Ejecuta lo compilado |
| `npm test` | Pruebas con Vitest (unitarias y e2e con Supertest) |
| `npm run test:cov` | Pruebas con cobertura (`coverage/lcov.info`, para SonarQube) |
| `npm run typecheck` | Revisa los tipos sin compilar |

## Variables de entorno

| Variable | Valor por defecto | Para qué |
|---|---|---|
| `NODE_ENV` | `development` | Entorno de ejecución |
| `PORT` | `3000` | Puerto interno (C4) |
| `SWAGGER_HABILITADO` | `true`, salvo en `production` | Publica `/docs` y `/docs-json` |

## Imagen de Docker

```bash
docker build -t aulaconecta/ms-academico:dev .
docker run --rm -p 3000:3000 aulaconecta/ms-academico:dev
```

Compilación en dos etapas, usuario sin privilegios (UID 10001), paquetes del sistema actualizados para Trivy y `HEALTHCHECK` contra `/health`. En producción no publica Swagger.

## Estructura

```
src/
  main.ts              Arranque: puerto, Swagger y cierre ordenado
  app.module.ts        Módulo raíz
  swagger.ts           Configuración de Swagger
  config/              Configuración por variables de entorno
  salud/               GET /health
test/                  Pruebas e2e
```

## Plan

| Cuándo | Qué se construye | Estado |
|---|---|---|
| Sprint 3 (26/10) | Contrato OpenAPI v0 y estructura en el monorepo | Listo (T1026-C) |
| Sprint 3 (27/10) | Esqueleto en NestJS con `/health`, Swagger, pruebas y Dockerfile | Listo (T1027-M) |
| Sprint 3 (28/10) | Esquema inicial en `db_academico` con Prisma Migrate | Pendiente (T1028-M) |
| Sprint 4 en adelante | Módulos académicos según el Product Backlog | |

Responsable del área: @cmacuna7.
