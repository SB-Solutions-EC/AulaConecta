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
| `IDENTIDAD_URL` | `https://ms-identidad:8443` (en docker-compose, `http://ms-identidad:8080`) | ms-identidad por la red interna, sin pasar por el gateway |
| `AULACONECTA_CLIENTE_ID` | `ms-academico` | Nombre del cliente de servicio |
| `AULACONECTA_JWKS_URL` | `<IDENTIDAD_URL>/.well-known/jwks.json` | Llaves públicas de ms-identidad para validar los tokens de acceso |
| `DATABASE_URL` | — | Conexión a `db_academico` con `usr_academico`. Sin ella el servicio arranca, pero no guarda datos |
| `AULACONECTA_CLIENTE_SECRETO_ARCHIVO` | — | Archivo con el secreto de servicio. Sin él, crear cuentas responde 503; el resto del servicio funciona |

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
  app.module.ts        Módulo raíz: el núcleo más los endpoints
  nucleo.module.ts     Configuración, guardia JWT, base de datos, validación y filtro de errores globales
  swagger.ts           Configuración de Swagger
  comun/               Validación de entradas, decoradores y formato de errores (ErrorApi)
  config/              Configuración por variables de entorno
  configuracion-academica/  Año lectivo, trimestres, cursos y materias (RF-06, RF-07)
  identidad/           Cliente de ms-identidad con token de servicio (T1110-A)
  importacion/         Controles de carga de la nómina en Excel (T1112-A)
  salud/               GET /health
test/                  Pruebas e2e
  seguridad/           Suites de validación e inyección (T1109-A), privacidad (T1111-A) y carga de archivos (T1112-A)
  integracion/         Prueba contra un ms-identidad real (npm run test:integracion)
```

## Base de datos (Prisma)

`db_academico` se define en [prisma/schema.prisma](prisma/schema.prisma), siguiendo el modelo de [docs/modelos/bd](../../docs/modelos/bd): claves UUID que genera la aplicación, columna `version` para la sincronización y referencias a otros servicios solo por UUID (`persona.usuario_id` enlaza 1 a 1 con la cuenta de ms-identidad).

| Migración | Tablas |
|---|---|
| `20261028000000_inicial` (T1028-M) | `anio_lectivo`, `periodo`, `curso`, `materia`, `persona`, `matricula` |

```bash
npm install                 # genera el cliente en src/generado/prisma (no se sube al repositorio)
npm run prisma:validar      # revisa el esquema
npm run prisma:migrar       # aplica las migraciones pendientes (necesita DATABASE_URL)
npx prisma migrate dev --name <cambio> --create-only   # nueva migración, revisarla antes de subirla
```

Las migraciones se versionan en `prisma/migrations`; nunca se edita una que ya está en `dev`.

Datos de prueba ficticios (T1116-M): `npm run datos-prueba` carga en la base de `DATABASE_URL` el año lectivo, los trimestres, las materias, los cursos, las personas y las matrículas de [infra/datos-prueba](../../infra/datos-prueba). Se niega a correr con `NODE_ENV=production`.

### Pruebas con PostgreSQL real (Testcontainers)

`npm test` levanta un contenedor `postgres:16.15-alpine3.24` (la misma versión del docker-compose), aplica las migraciones con `prisma migrate deploy` y pasa la URL a las pruebas con `inject('urlBaseDatos')` ([test/postgres-global.ts](test/postgres-global.ts)). Cada ejecución empieza con una base vacía y el contenedor se borra al terminar. Necesita Docker en marcha.

[test/base-datos/esquema.bd.spec.ts](test/base-datos/esquema.bd.spec.ts) comprueba en la base, no solo en el código, las claves únicas (año lectivo, curso por nivel y paralelo, matrícula, `usuario_id`), las llaves foráneas, el borrado restringido y que las fechas se guardan como `DATE`. Los datos de prueba son ficticios: las cédulas usan la provincia 99, que no existe.

## Validación de entradas y errores

Todo endpoint queda protegido por lo que registra `nucleo.module.ts`, sin configurar nada en el controlador:

- **Pipe global** (`src/comun/validacion.ts`): rechaza con `400 DATOS_INVALIDOS` los campos que el DTO no declara (evita que alguien envíe `version` o `rol`), no convierte tipos por su cuenta (`"true"` no es un booleano) y nunca devuelve el valor rechazado.
- **Solo JSON** (`src/comun/solo-json.middleware.ts`): un `POST`, `PUT` o `PATCH` con otro formato recibe `415`; se admite `multipart/form-data` para la importación de nóminas.
- **Filtro de errores** (`src/comun/filtro-errores.ts`): toda respuesta de error tiene la forma `ErrorApi` del contrato (`codigo`, `mensaje`, `detalles`, `timestamp`). Un error inesperado responde `500 ERROR_INTERNO` sin detalles y el detalle queda solo en el registro del servidor.

Para los DTOs se usan los decoradores de `src/comun/validadores.ts`:

| Decorador | Para qué |
|---|---|
| `@TextoSeguro(max, min = 1)` | Texto escrito por personas: recorta espacios y admite letras con tildes, números y `. , ' ( ) / ° - –`. Rechaza ``< > ; " = \ ` ``, saltos de línea, el byte nulo (que PostgreSQL no acepta) y caracteres invisibles |
| `@FechaCalendario()` | Fecha `AAAA-MM-DD` que existe (rechaza `2026-02-30` y fechas con hora) |
| `@Identificador()` | UUID |
| `@Cedula()` | Cédula ecuatoriana: provincia 01–24 o 30, tercer dígito 0–5 y verificador del módulo 10. Nunca se devuelve en una respuesta |
| `@Opcional()` | Campo que se puede omitir. Usarlo en lugar de `@IsOptional()`, que también deja pasar un `null` explícito |

Para errores propios del negocio: `throw new ExcepcionApi(409, 'CONFLICTO', 'El paralelo ya existe.')`. La validación no reemplaza a las consultas parametrizadas: con Prisma nunca se usa `$queryRawUnsafe` ni `$executeRawUnsafe` con texto armado a mano.

## Autenticación y roles

Todas las rutas exigen el token de acceso de ms-identidad (`Authorization: Bearer ...`), salvo las marcadas con `@Publico()` como `/health`. La guardia global está en [src/autenticacion](src/autenticacion):

```ts
@Get()
@Roles('ADMIN', 'SECRETARIA')            // basta con tener uno; sin @Roles alcanza con haber iniciado sesión
listar(@UsuarioActual() usuario: UsuarioToken) { ... }   // usuario.id es el UUID de la cuenta
```

| Caso | Respuesta |
|---|---|
| Sin token, firma inválida, `alg` distinto de RS256, kid desconocido, vencido, otro emisor u otra audiencia, token de servicio | `401 NO_AUTORIZADO` |
| Clave inicial sin cambiar (`debe_cambiar_clave`) | `403 CAMBIO_CLAVE_PENDIENTE` |
| Rol no permitido | `403 ACCESO_DENEGADO` |

Las llaves públicas se descargan de `AULACONECTA_JWKS_URL` y se guardan 10 minutos. Si llega un kid nuevo (ms-identidad rotó la llave) se recarga, como mucho una vez cada 30 s. Si ms-identidad no responde se conservan las llaves anteriores. El emisor y la audiencia se pueden cambiar con `AULACONECTA_JWT_EMISOR` y `AULACONECTA_JWT_AUDIENCIA`.

## Comunicación con ms-identidad

Para crear la cuenta de un docente, estudiante o representante (RF-05, RF-04), ms-academico llama a `POST /usuarios` de ms-identidad con un **token de servicio** (client credentials, `src/identidad/cliente-identidad.ts`):

```ts
constructor(private readonly identidad: ClienteIdentidad) {}   // importar IdentidadModule

const cuenta = await this.identidad.crearCuenta({ id: persona.id, nombres, apellidos, roles: ['DOCENTE'] });
// ms-identidad genera cuenta.nombreUsuario y cuenta.claveTemporal (un solo uso, 72 horas, RF-03 v1.1).
// La clave temporal se devuelve a la secretaría en la respuesta del alta y no se guarda; la cédula no viaja a ms-identidad
```

| Tema | Comportamiento |
|---|---|
| Token | Lo pide a `POST /oauth/token` y lo reutiliza hasta 30 s antes de que venza (dura 5 min). Las peticiones simultáneas comparten una sola solicitud |
| Secreto | Se lee del archivo en cada renovación: si rota, no hace falta reiniciar. En local lo genera el servicio `secretos-servicio` de `infra/docker-compose.yml` |
| 401 | Pide otro token y reintenta una sola vez |
| 400 y 409 | Se deben a los datos (`NOMBRE_INVALIDO`, `USUARIO_EXISTENTE`): se devuelven con el código de ms-identidad |
| Otros errores, caída o más de 5 s | `503 IDENTIDAD_NO_DISPONIBLE`; el detalle queda en el registro, sin el secreto, el token ni la clave temporal |

### Prueba de integración

`test/integracion/` prueba lo anterior contra un ms-identidad y un PostgreSQL reales. En el CI la corre el job `integracion / academico-identidad`, y si falla, `quality-pr` también falla. En local:

```bash
# Desde la raíz del repositorio. -p aulaconecta-ci: no toca los volúmenes del stack local
docker compose -p aulaconecta-ci -f infra/docker-compose.yml -f infra/docker-compose.integracion.yml up -d --build --wait ms-identidad
docker run --rm -v aulaconecta-ci_secreto-ms-academico:/s:ro --entrypoint cat alpine/openssl:3.5.9 /s/secreto > /tmp/secreto
cd services/ms-academico
IDENTIDAD_URL=http://127.0.0.1:18080 AULACONECTA_CLIENTE_SECRETO_ARCHIVO=/tmp/secreto npm run test:integracion
cd ../.. && docker compose -p aulaconecta-ci -f infra/docker-compose.yml -f infra/docker-compose.integracion.yml down -v
```

## Pruebas de seguridad (`test/seguridad/`)

Suite reutilizable para los endpoints de RF-06 (cursos, paralelos y materias) y RF-07 (fechas del año lectivo y de sus trimestres). Por cada endpoint prueba:

- **Autorización:** 13 tokens que deben dar `401` (sin token, `alg: none`, confusión RS256/HS256, firma de otra llave, rol cambiado conservando la firma, vencido, otro emisor u otra audiencia); `403` para los roles sin permiso y para un ADMIN que aún no cambia su clave inicial.
- **Tipos y formato:** cada campo con valores de otro tipo, operadores NoSQL (`{"$ne": null}`), vacíos, 10 000 caracteres, byte nulo, CRLF, caracteres de control, UUID y fechas inválidas.
- **Inyección:** SQL (tautología, consulta apilada, `UNION`, `pg_sleep`), XSS, plantillas, recorrido de rutas y fórmulas de hoja de cálculo en cada texto. Se aceptan dos resultados: `400`, o `201` con el texto guardado exactamente igual y la tabla intacta.
- **Cuerpo:** campos que el contrato no define, `__proto__` y `constructor` (contaminación del prototipo), JSON mal formado, arreglos, cuerpo vacío, formulario `urlencoded` y 200 KB.
- **Reglas del negocio:** fin antes del inicio, año lectivo inexistente, registros repetidos (también el código de materia) y, en los trimestres, número de 1 a 3, fechas dentro del año lectivo y sin superponerse.
- **Consultas:** filtros UUID con inyección y parámetros repetidos.

| Archivo | Qué hace |
|---|---|
| `contrato.spec.ts` | Falla si `openapi/ms-academico.yaml` cambia y la suite queda desactualizada |
| `referencia.spec.ts` | Ejecuta la suite contra `referencia/`, una implementación en memoria que cumple todo: prueba la propia suite. Se monta sobre `NucleoModule` para que los endpoints reales no le tapen las rutas |
| `endpoints-academicos.e2e.spec.ts` | Ejecuta la suite contra los endpoints reales sobre el PostgreSQL de Testcontainers. `/anios-lectivos`, `/periodos`, `/cursos` y `/materias` ya corren; los que aún no existen aparecen como omitidos y, al montarlos, sus pruebas corren solas |

Los tokens se firman con una llave generada en cada ejecución (`tokens.ts`); el e2e publica su JWKS en un servidor local y pasa la URL en `AULACONECTA_JWKS_URL`. Si la guardia JWT real lee otra variable, se ajusta solo `endpoints-academicos.e2e.spec.ts`.

En el CI el resumen del job muestra el resultado por endpoint, y los reportes JUnit y JSON quedan en el artefacto `academico-resultados`.

## Pruebas de privacidad (RNF-04)

Un estudiante o un representante solo puede ver sus propios datos. `test/seguridad/verificar-privacidad.ts` arma por la API dos familias:

- Curso X: el estudiante A, representado por RA y por RAC, y el estudiante B, representado por RB.
- Curso Y: el estudiante C, representado por RAC.

Luego prueba con el token de cada persona:

| Qué | Esperado |
|---|---|
| `GET /matriculas` sin filtro | Cada uno recibe solo lo suyo; RAC ve a A y a C, nunca a B |
| `GET /matriculas?estudianteId=` de otro | 403, **el mismo** para un estudiante que existe y uno inventado (no se puede averiguar quién está matriculado) |
| Nómina del curso (`?cursoId=`) y `GET /personas` | 403, o una lista sin rastro de nadie ajeno (ni ids, ni nombres, ni cédula) |
| Cabeceras (`X-Usuario-Id`...) o `?usuarioId=` con la identidad de otro | Se ignoran: la identidad sale solo del token |
| `POST /matriculas`, `/representaciones` y `/personas` por un estudiante, representante o docente | 403, y el intento no le da acceso después |
| La cédula | No aparece en ninguna respuesta, ni para el administrador, y no viaja a ms-identidad (CR-02) |
| La clave temporal | Solo en la respuesta del alta, para la secretaría; ningún listado la repite |
| Un token de servicio (T1110-A) | 401 o 403: no representa a una persona |

Se ejecuta contra `referencia/modulo-matricula-referencia.ts`, que cumple todo y sirve de ejemplo de cómo decidir qué ve cada quien con el `sub` del token. También se ejecuta contra los endpoints reales (`privacidad.e2e.spec.ts`), que se omiten hasta que existan todas las rutas del escenario. Para probar la suite, se debilitó la referencia de 8 maneras: sin filtrar por persona, lista vacía en vez de 403, 404 que revela si el estudiante existe, identidad tomada de una cabecera, representante que puede vincularse, cédula en la respuesta, representante que ve todo el curso y estudiante que ve a todas las personas. En cada caso fallaron entre 1 y 17 pruebas.

En los dos e2e, ms-identidad se reemplaza por `IdentidadFalsa` (`aplicacion-real.ts`); la comunicación real se prueba en `test/integracion/`. Las cédulas y los nombres se generan al ejecutar (`datos-ficticios.ts`).

## Controles de carga de la nómina (RF-04)

`POST /matriculas/importar` recibe el Excel con `ArchivoExcelInterceptor` y `ArchivoExcelPipe` (`src/importacion/`). El importador recibe un `LibroValidado` y solo tiene que leer los datos:

```ts
@Post('matriculas/importar')
@Roles('ADMIN', 'SECRETARIA')
@UseInterceptors(ArchivoExcelInterceptor)
importar(@UploadedFile(ArchivoExcelPipe) libro: LibroValidado, @Body() { cursoId }: SolicitudImportacion) {
  // libro.contenido: el .xlsx ya revisado; libro.filasDeDatos: filas debajo del encabezado
}
```

| Control | Límite o regla (`LIMITES_CARGA`) | Respuesta |
|---|---|---|
| Tamaño | 2 MB; multer corta la subida al pasarlo | 413 `SOLICITUD_MUY_GRANDE` |
| Forma de la solicitud | Un solo archivo en el campo `archivo`, pocos campos | 400 |
| Nombre y tipo declarados | `.xlsx`, sin caracteres de control; tipo de Excel u `octet-stream` | 415 `TIPO_NO_ADMITIDO` |
| Contenido real | Firma ZIP y partes de un libro de Excel normal: no basta con renombrar un CSV, PDF, ejecutable, `.xls`, `.docx` o `.xltx` | 415 `TIPO_NO_ADMITIDO` |
| Macros | Sin `vbaProject.bin` ni tipo `macroEnabled` | 415 `ARCHIVO_CON_MACROS` |
| Fórmulas | Ninguna celda con fórmula (modelo de amenazas T-04) | 400 `ARCHIVO_CON_FORMULAS` |
| Bombas ZIP | 25 MB descomprimidos en total, proporción máxima 100 y descompresión cortada aunque los encabezados mientan; 100 archivos internos | 400 `ARCHIVO_SOSPECHOSO` |
| Estructuras de ataque | Rutas `../` o absolutas (zip slip), entradas repetidas o cifradas, ZIP64, vínculos externos, `<!DOCTYPE>` o `<!ENTITY>` (XXE, "mil millones de risas"), partes en UTF-16 | 400 `ARCHIVO_SOSPECHOSO` |
| Dañado | ZIP truncado, CRC distinto, compresión inválida | 400 `ARCHIVO_DANADO` |
| Límites de la nómina | 5 hojas, 30 columnas y 1000 filas de datos por hoja (también por índice de fila) | 400 `DEMASIADAS_HOJAS`, `DEMASIADAS_COLUMNAS`, `DEMASIADAS_FILAS` |
| Sin datos | Al menos una fila debajo del encabezado | 400 `ARCHIVO_SIN_DATOS` |

El archivo nunca se escribe en disco ni se usa su nombre para guardar nada. Los mensajes indican qué hacer (por ejemplo, "guárdalo como .xlsx sin contraseña") sin repetir el contenido del archivo. Las validaciones de cada fila (cédula con `@Cedula()`, duplicados) son del importador (T1112-M).

**Pruebas con archivos inválidos.** `test/seguridad/archivos-invalidos.ts` arma al ejecutar 47 archivos (no hay binarios en el repositorio) y `verificar-carga.ts` los envía por HTTP:
- contra la referencia (`referencia-carga.spec.ts`);
- contra el importador real (`carga.e2e.spec.ts`, que se omite hasta que exista).

`src/importacion/*.spec.ts` prueba el lector de ZIP y el validador sin HTTP. Para probar la suite, se desactivaron 9 controles, uno por vez: firma, tipo declarado, macros, DTD, filas, tamaño descomprimido total, nombres peligrosos, CRC y cifrado. En cada caso fallaron entre 1 y 5 pruebas.

## Plan

| Cuándo | Qué se construye | Estado |
|---|---|---|
| Sprint 3 (26/10) | Contrato OpenAPI v0 y estructura en el monorepo | Listo (T1026-C) |
| Sprint 3 (27/10) | Esqueleto en NestJS con `/health`, Swagger, pruebas y Dockerfile | Listo (T1027-M) |
| Sprint 3 (28/10) | Esquema inicial en `db_academico` con Prisma Migrate | Listo (T1028-M) |
| Sprint 4 (04/11) | Pruebas de integración con PostgreSQL real (Testcontainers) | Listo (T1104-M) |
| Sprint 4 (05/11) | Validación del JWT con JWKS y guardas por rol | Listo (T1105-M) |
| Sprint 5 (16/11) | Datos de prueba ficticios (seed) | Listo (T1116-M) |
| Sprint 4 (09/11) | Validación de entradas global y pruebas de validación e inyección de RF-06 y RF-07 | Listo (T1109-A) |
| Sprint 4 (09/11) | Endpoints de año lectivo, trimestres, cursos, paralelos y materias | Listo (T1109-M, adelantado en T1113-A) |
| Sprint 4 (10/11) | Cliente de ms-identidad con token de servicio y prueba de integración en el CI | Listo (T1110-A) |
| Sprint 4 (11/11) | Validación de cédula y pruebas de privacidad de matrícula y personas (RNF-04) | Listo (T1111-A) |
| Sprint 4 (11/11) | Endpoints de matrícula individual y personas | Pendiente (T1111-M) |
| Sprint 4 (12/11) | Controles de carga de la nómina en Excel y pruebas con archivos inválidos | Listo (T1112-A) |
| Sprint 4 (12/11) | Importador de nóminas | Pendiente (T1112-M) |
| Sprint 4 en adelante | Módulos académicos según el Product Backlog | |

Responsable del área: @cmacuna7.
