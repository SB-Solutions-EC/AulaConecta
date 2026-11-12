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
| `npm test` | Pruebas con Vitest (unitarias, e2e con Supertest y suite de seguridad) |
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
  app.module.ts        Módulo raíz: registra la validación y el filtro de errores globales
  swagger.ts           Configuración de Swagger
  comun/               Validación de entradas, decoradores y formato de errores (ErrorApi)
  config/              Configuración por variables de entorno
  salud/               GET /health
test/                  Pruebas e2e
  seguridad/           Suite de validación de entradas, inyección y autorización (T1109-A)
```

## Validación de entradas y errores

Todo endpoint queda protegido por lo que registra `app.module.ts`, sin configurar nada en el controlador:

- **Pipe global** (`src/comun/validacion.ts`): rechaza con `400 DATOS_INVALIDOS` los campos que el DTO no declara (evita que alguien envíe `version` o `rol`), no convierte tipos por su cuenta (`"true"` no es un booleano) y nunca devuelve el valor rechazado.
- **Solo JSON** (`src/comun/solo-json.middleware.ts`): un `POST`, `PUT` o `PATCH` con otro formato recibe `415`; se admite `multipart/form-data` para la importación de nóminas.
- **Filtro de errores** (`src/comun/filtro-errores.ts`): toda respuesta de error tiene la forma `ErrorApi` del contrato (`codigo`, `mensaje`, `detalles`, `timestamp`). Un error inesperado responde `500 ERROR_INTERNO` sin detalles y el detalle queda solo en el registro del servidor.

Para los DTOs se usan los decoradores de `src/comun/validadores.ts`:

| Decorador | Para qué |
|---|---|
| `@TextoSeguro(max, min = 1)` | Texto escrito por personas: recorta espacios y admite letras con tildes, números y `. , ' ( ) / ° - –`. Rechaza ``< > ; " = \ ` ``, saltos de línea, el byte nulo (que PostgreSQL no acepta) y caracteres invisibles |
| `@FechaCalendario()` | Fecha `AAAA-MM-DD` que existe (rechaza `2026-02-30` y fechas con hora) |
| `@Identificador()` | UUID |
| `@Opcional()` | Campo que se puede omitir. Usarlo en lugar de `@IsOptional()`, que también deja pasar un `null` explícito |

Para errores propios del negocio: `throw new ExcepcionApi(409, 'CONFLICTO', 'El paralelo ya existe.')`. La validación no reemplaza a las consultas parametrizadas: con Prisma nunca se usa `$queryRawUnsafe` ni `$executeRawUnsafe` con texto armado a mano.

## Pruebas de seguridad (`test/seguridad/`)

Suite reutilizable para los endpoints de RF-06 y RF-07 (año lectivo, cursos y paralelos, materias). Por cada endpoint prueba:

- **Autorización:** 13 tokens que deben dar `401` (sin token, `alg: none`, confusión RS256/HS256, firma de otra llave, rol cambiado conservando la firma, vencido, otro emisor u otra audiencia); `403` para los roles sin permiso y para un ADMIN que aún no cambia su clave inicial.
- **Tipos y formato:** cada campo con valores de otro tipo, operadores NoSQL (`{"$ne": null}`), vacíos, 10 000 caracteres, byte nulo, CRLF, caracteres de control, UUID y fechas inválidas.
- **Inyección:** SQL (tautología, consulta apilada, `UNION`, `pg_sleep`), XSS, plantillas, recorrido de rutas y fórmulas de hoja de cálculo en cada texto. Se aceptan dos resultados: `400`, o `201` con el texto guardado exactamente igual y la tabla intacta.
- **Cuerpo:** campos que el contrato no define, `__proto__` y `constructor` (contaminación del prototipo), JSON mal formado, arreglos, cuerpo vacío, formulario `urlencoded` y 200 KB.
- **Reglas del negocio:** fin antes del inicio, año lectivo inexistente y registros repetidos.
- **Consultas:** filtros UUID con inyección y parámetros repetidos.

| Archivo | Qué hace |
|---|---|
| `contrato.spec.ts` | Falla si `openapi/ms-academico.yaml` cambia y la suite queda desactualizada |
| `referencia.spec.ts` | Ejecuta la suite contra `referencia/`, una implementación en memoria que cumple todo: prueba la propia suite y sirve de ejemplo de DTOs |
| `endpoints-academicos.e2e.spec.ts` | Ejecuta la suite contra los endpoints reales. Los que aún no existen aparecen como omitidos; al montarlos, sus pruebas corren solas |

Los tokens se firman con una llave generada en cada ejecución (`tokens.ts`); el e2e publica su JWKS en un servidor local y pasa la URL en `AULACONECTA_JWKS_URL`. Si la guardia JWT real lee otra variable, se ajusta solo `endpoints-academicos.e2e.spec.ts`.

En el CI el resumen del job muestra el resultado por endpoint, y los reportes JUnit y JSON quedan en el artefacto `academico-resultados`.

## Plan

| Cuándo | Qué se construye | Estado |
|---|---|---|
| Sprint 3 (26/10) | Contrato OpenAPI v0 y estructura en el monorepo | Listo (T1026-C) |
| Sprint 3 (27/10) | Esqueleto en NestJS con `/health`, Swagger, pruebas y Dockerfile | Listo (T1027-M) |
| Sprint 3 (28/10) | Esquema inicial en `db_academico` con Prisma Migrate | Pendiente (T1028-M) |
| Sprint 4 (09/11) | Validación de entradas global y pruebas de validación e inyección de RF-06 y RF-07 | Listo (T1109-A) |
| Sprint 4 (09/11) | Endpoints de año lectivo, cursos, paralelos y materias | Pendiente (T1109-M) |
| Sprint 4 en adelante | Módulos académicos según el Product Backlog | |

Responsable del área: @cmacuna7.
