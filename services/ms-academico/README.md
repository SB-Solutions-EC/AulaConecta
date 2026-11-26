# ms-academico

Microservicio de gestión académica de AulaConecta en **NestJS + TypeScript** con **PostgreSQL** (`db_academico`, Prisma). Gestiona año lectivo, cursos, materias, docentes, matrícula, planificación curricular ERCA, calificaciones (con `packages/calculo-notas`), asistencia, comportamiento, reportes y sincronización offline (`/sync/pull` y `/sync/push`).

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
# Desde la raíz del repositorio: el cálculo de notas llega como contexto aparte
docker build --build-context calculo-notas=packages/calculo-notas -t aulaconecta/ms-academico:dev services/ms-academico
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
  asignaciones/        Docente–materia–curso con bloques horarios (RF-05)
  calificaciones/      Libreta: registrar aportes y recalcular la nota en el servidor (RF-17, RF-18)
  configuracion-academica/  Año lectivo, trimestres, cursos y materias (RF-06, RF-07)
  identidad/           Cliente de ms-identidad con token de servicio (T1110-A)
  importacion/         Controles de carga de la nómina en Excel (T1112-A)
  personas/            Docentes, estudiantes y representantes, con su cuenta en ms-identidad (RF-02, RF-05)
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
| `@TextoLibre(max, { minimo, multilinea })` | Texto que se guarda **literal** (título de una tarea, retroalimentación): admite `: ¿? ¡! # < >`, porque la PWA lo muestra como texto. Rechaza caracteres de control, de dirección (U+202E) e invisibles, y los saltos de línea salvo con `multilinea` |
| `@EnlaceSeguro()` | Enlace que la PWA puede convertir en vínculo: solo `https://` o `http://`, sin usuario ni clave, sin espacios, hasta 255 caracteres (T1119-A) |

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

## Personas y asignaciones (T1110-M)

`POST /personas` (administrador y secretaría) registra a un docente, estudiante o representante. Funciona así:

- Pide a ms-identidad la cuenta con el mismo UUID de la persona; la cédula nunca viaja allá (CR-02).
- Devuelve la clave temporal solo en esa respuesta, dentro de `credenciales`, para que la secretaría la entregue. No se guarda en ms-academico.
- La cédula repetida se rechaza con 409 **antes** de crear la cuenta, para no dejar cuentas sin persona.
- La cédula no aparece en ninguna respuesta.

`GET /personas?tipo=&q=`: el personal ve a todos; el estudiante y el representante, solo sus propios datos. El docente recibe 403.

`POST /asignaciones` (administrador) asigna docente, materia y curso con `horarios` (`[{dia: 1–5, hora: h1–h5}]`). Se rechaza con:

| Caso | Respuesta |
|---|---|
| La materia ya tiene docente en ese curso | `409` |
| El docente ya tiene clase en otro curso a esa hora, o el curso ya tiene otra materia en ese bloque | `409 HORARIO_OCUPADO` |
| Bloques repetidos, o el docente no es una persona de tipo DOCENTE | `400` |

`GET /asignaciones?docenteId=&cursoId=`: el personal ve todas; el docente, solo las suyas.

## Calificaciones (T1118-M)

`PUT /calificaciones` registra o actualiza el resumen trimestral de un estudiante en una materia. El servidor **siempre** recalcula la nota final y el cualitativo con [packages/calculo-notas](../../packages/calculo-notas), el mismo cálculo de la PWA, verificado contra la hoja oficial anonimizada (T1117-A). El cliente nunca los envía: si lo intenta, recibe 400.

| Regla | Respuesta |
|---|---|
| Solo el docente de esa asignación (su `persona.usuario_id` es el `sub` del token) | Otro docente, secretaría, administrador, estudiante o representante: `403` |
| Notas de 0 a 10 con hasta 2 decimales, hasta 20 aportes por bloque | `400 DATOS_INVALIDOS` |
| La matrícula debe estar activa en el curso de la asignación y el trimestre, configurado | `400` |
| Trimestre cerrado (RN-18) | `409 TRIMESTRE_CERRADO` |
| `version` es la que el docente estaba editando (0 si es nueva). Si otro la cambió antes | `409` con `ConflictoSincronizacion`: datos del servidor, quién y cuándo, y los campos en conflicto |

`GET /calificaciones?asignacionId=&matriculaId=&trimestre=` filtra por rol: el docente ve sus materias, el estudiante lo suyo y el administrador todo. La secretaría recibe `403`. El representante recibe una lista vacía hasta que exista la representación (T1111-M).

El cálculo llega por `postinstall`, que copia los `.ts` de `packages/calculo-notas/src/` a `src/generado/` (`index.ts` queda como `calculo-notas.ts`). Incluye `calcularComportamiento` (RF-22, T1124-A): el endpoint de comportamiento lo usa desde `../generado/calculo-notas`. La imagen se construye con `--build-context calculo-notas=packages/calculo-notas`.

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

## Pruebas de calificaciones (RF-17, RF-18)

`test/seguridad/verificar-calificaciones.ts` (T1118-A) arma por la API este escenario:
- **curso A:** materia M1 con el docente D1, que es el que califica, y materia M2 con el docente D2;
- **curso B:** materia M1 con el docente D3;
- un estudiante de control con su representante, y una matrícula por cada 3 casos de la hoja oficial.

Luego prueba tres cosas:

| Grupo | Qué comprueba |
|---|---|
| Exactitud (I-05, RNF-02) | Cada fila de la [hoja oficial anonimizada](../../packages/calculo-notas/casos/hoja-oficial-anonimizada.json) que admite el contrato (143 de 151, todas con proyecto y examen) se registra con `PUT /calificaciones`. La nota final y el cualitativo que devuelve el **servidor** deben coincidir con el libro oficial. Después, la libreta del docente debe devolver lo mismo, y una nota final enviada por el cliente se rechaza o se ignora |
| Permisos | Solo D1 califica la asignación de M1 en el curso A. Responden **403**: D2 (otra materia), D3 (misma materia, otro curso), el administrador, la secretaría, el estudiante, su representante, un docente sin persona y D1 con la clave temporal pendiente. Los 13 tokens inválidos responden 401. La asignación ajena y la inventada dan el mismo 403, y no se puede suplantar con `docenteId` ni con cabeceras. Calificar a un estudiante de otro curso se rechaza |
| Versiones y entradas | Una versión vieja responde 409. Aportes fuera de 0 a 10, texto, nulos, más de 5 por bloque, trimestre fuera de 1 a 3 y faltantes responden 400 |
| Lectura | D1 ve su libreta. D2 y la secretaría reciben 403. El estudiante y el representante ven solo lo suyo |

Se ejecuta contra la referencia (`referencia/modulo-calificaciones-referencia.ts`, que calcula con `packages/calculo-notas`) y contra los endpoints reales (`calificaciones.e2e.spec.ts`), que se omiten hasta que existan todas las rutas del escenario. Su resumen en el CI muestra los casos de la hoja que coinciden.

**Comprobación de la suite.** Se debilitó la referencia de 8 maneras, una por vez, y cada una hizo fallar pruebas:

| Debilidad | Pruebas que fallan |
|---|---|
| Calcula la nota con su propia fórmula, sin truncar cada componente como el libro | 114 |
| Cualquier docente califica cualquier asignación | 6 |
| El administrador también puede calificar | 2 |
| Respeta un `docenteId` que manda el cliente | 2 |
| No revisa que la matrícula sea del curso de la asignación | 1 |
| No controla la versión | 1 |
| Cualquier docente lee cualquier libreta | 1 |
| El estudiante ve las notas de todo el curso | 1 |

**Para los endpoints reales (T1118-M).** La referencia importa el cálculo con la ruta relativa `packages/calculo-notas/src/index`. Para usarlo en el código del servicio, la imagen Docker necesita el paquete como contexto adicional, igual que la PWA:
- `additional_contexts` en `infra/docker-compose.yml`;
- `contextos-adicionales` en `ci.yml`.

`tsconfig.json` ya tiene `rootDir: ../..` para el typecheck.

## Pruebas de asistencia y de quién puede justificar (RF-21)

`test/seguridad/verificar-asistencia.ts` (T1123-A) arma por la API este escenario:
- **curso A:** M1 con el docente D1 y M2 con D2; estudiantes E1 (con representante) y E2;
- **curso B**, de otro año lectivo: M1 con D3; estudiante F.

**Regla acordada con el equipo.** El documento solo dice que el Inspector justifica, y ese rol no existe en el sistema. Se decidió:
- el **docente de esa materia en ese curso** registra la asistencia y es el **único que aprueba** una justificación (estado `JUSTIFICADA`);
- el **estudiante** dueño de la falta solo la **solicita** (`POST /asistencias/{id}/justificacion`, CU-19);
- el representante, la secretaría, el administrador y los demás docentes no la cambian.

| Grupo | Qué comprueba |
|---|---|
| Registrar | Solo D1. Responden 403: D2, D3, el administrador, la secretaría, el estudiante, el representante, un docente sin persona y D1 con la clave temporal pendiente. Los 13 tokens inválidos responden 401, y la asignación ajena y la inventada dan el mismo 403. Una matrícula de otro curso se rechaza. **Fecha fuera del año lectivo → 400** (falla de RF-21). Versión vieja → 409 |
| Justificar | E1 solicita y queda `SOLICITADA`, sin dejar de ser `FALTA`. D1 aprueba con el motivo del estudiante o con el suyo. **Nadie más aprueba**: E1, el representante, otros docentes, la secretaría y el administrador reciben 403 y la falta sigue igual. No solicitan un compañero, otro curso, el representante, el docente, la secretaría ni el administrador. Mandar `estado: JUSTIFICADA` en la solicitud no aprueba nada. Sin nada que justificar, o con una solicitud pendiente → 409. **Volver a `FALTA` una falta justificada pide `confirmar: true`** (excepción de RF-21). El motivo pasa por los textos inválidos y las cargas de XSS |
| Consultar | D1 ve la asistencia de su asignación; el estudiante, la suya; el representante, la de su representado. Lo ajeno responde 403, también para la secretaría, igual para una matrícula ajena que para una inventada |

Se ejecuta contra la referencia (`referencia/modulo-asistencia-referencia.ts`) y contra los endpoints reales (`asistencia.e2e.spec.ts`), que se omiten hasta que existan.

**Comprobación de la suite.** Se debilitó la referencia de 10 maneras, una por vez, y cada una hizo fallar pruebas:

| Debilidad | Pruebas que fallan |
|---|---|
| El estudiante se aprueba a sí mismo al solicitar | 7 |
| Cualquier docente registra y aprueba en cualquier asignación | 6 |
| El estudiante ve la asistencia de todo el curso | 5 |
| Cualquier estudiante solicita por la falta de otro | 3 |
| El administrador también aprueba | 2 |
| Acepta fechas fuera del año lectivo | 2 |
| La secretaría consulta la asistencia | 2 |
| El representante también solicita | 1 |
| No pide confirmar al volver a marcar FALTA una falta justificada | 1 |
| Acepta JUSTIFICADA sin motivo | 1 |

## Pruebas de tareas: autorización y XSS (RF-19, RF-20)

`test/seguridad/verificar-tareas.ts` (T1119-A) arma por la API este escenario:
- **curso A**, con su trimestre: M1 con el docente D1, que crea y califica, y M2 con D2; estudiantes E1 (con representante) y E2;
- **curso B**, de otro año lectivo: M1 con D3; estudiante F.

| Grupo | Qué comprueba |
|---|---|
| Crear tareas | Solo D1 crea en su asignación. Responden **403**: D2, D3, el administrador, la secretaría, el estudiante, el representante, un docente sin persona y D1 con la clave temporal pendiente. Los 13 tokens inválidos responden 401, y la asignación ajena y la inventada dan el mismo 403. **RF-19:** una fecha fuera del trimestre se rechaza, igual que un trimestre de otro año lectivo |
| Saneamiento de texto | 20 cargas (SQL, `<script>`, atributos `on…`, SVG, iframe, Markdown, entidades, plantillas, fórmulas) en el título y la descripción: **se rechazan o se guardan literales** y vuelven idénticas al listar, siempre como JSON. Los caracteres de control, de dirección (U+202E), invisibles y los saltos de línea en el título responden 400 |
| Saneamiento de enlaces | `enlaceRecurso` solo admite `https://` y `http://`. Responden 400: `javascript:` (también con mayúsculas, espacios o tabuladores), `data:`, `vbscript:`, `file:`, `//host`, `usuario@host`, saltos de línea y más de 255 caracteres |
| Calificar entregas | Solo D1. El estudiante no se pone su nota ni actúa a nombre de otro con `estudianteId`. Una matrícula de otro curso se rechaza. **RF-20:** una nota negativa o mayor que 10 responde 400. La versión vieja responde 409, y la retroalimentación pasa por las mismas cargas de XSS |
| Lectura | El curso ve sus tareas, y otro curso, otro docente y la secretaría reciben 403. Cada estudiante ve solo su nota y su comentario; el representante, solo los de su representado |

Para el texto libre y los enlaces hay dos validadores en `src/comun/validadores.ts` (ver la tabla de arriba). Se ejecuta contra la referencia (`referencia/modulo-tareas-referencia.ts`) y contra los endpoints reales (`tareas.e2e.spec.ts`), que se omiten hasta que existan.

**Comprobación de la suite.** Se debilitó la referencia de 9 maneras, una por vez, y cada una hizo fallar pruebas:

| Debilidad | Pruebas que fallan |
|---|---|
| Acepta cualquier enlace (`javascript:`, `data:`, `file:`) | 12 |
| "Limpia" el HTML del título en vez de guardarlo literal | 7 |
| No revisa los caracteres del título | 5 |
| Cualquier docente crea tareas en cualquier asignación | 4 |
| Cualquier docente califica cualquier tarea | 3 |
| Cualquiera con sesión ve las tareas de cualquier asignación | 3 |
| No revisa la fecha contra el trimestre | 2 |
| No revisa el curso de la matrícula | 2 |
| El estudiante ve las notas y comentarios de todo el curso | 2 |

**En la PWA**, `PantallaTareas.xss.test.tsx` muestra títulos, descripciones, comentarios, nombres y un enlace `javascript:` hostiles, como docente y como estudiante, y comprueba tres cosas:
- que no aparece ningún `<script>`, `<img>`, `<iframe>` ni atributo de evento;
- que ningún `href` o `src` usa `javascript:` o `data:`;
- que el texto se ve literal.

Si alguien usa `dangerouslySetInnerHTML` o convierte el adjunto en `<a href>` sin revisar el protocolo, la prueba falla (se comprobó con las dos cosas).

## Acceso a notas: el estudiante solo ve las suyas (RF-20, RNF-04)

`test/seguridad/verificar-acceso-notas.ts` (T1120-A) es una matriz de quién pide qué en todo lo que expone notas: `GET /calificaciones` (sin filtro, por matrícula, por asignación) y `GET /tareas/{id}/entregas`. Arma por la API este escenario:
- **curso A:** E1 y E2;
- **curso B:** F;
- **representantes:** de E1, de E2, de E1 y E2, y de F;
- **notas:** una calificación de cada estudiante y una tarea por curso con nota y una retroalimentación de texto único, para detectar fugas.

| Quién | Ve | Recibe 403 |
|---|---|---|
| Cada estudiante y cada representante | Solo sus notas o las de sus representados: sin filtro, por matrícula y en la tarea de su curso. En ninguna respuesta aparece la matrícula ni la retroalimentación de otro | Las notas de cada estudiante ajeno (por matrícula y por trimestre), la tarea del otro curso, y una matrícula inventada (el mismo 403 que una ajena) |
| Manipulación (E1) | — | Pedir A1 con la matrícula de E2. La matrícula repetida, en mayúsculas, un `usuarioId`, o cabeceras `X-Usuario-Id` de E2 no le dan nada ajeno. Tampoco su token con la clave temporal pendiente, con el rol `REPRESENTANTE` o de una cuenta sin persona |
| Personal | El docente de A1, su libreta y las notas de su tarea | El docente de otra materia o de otro curso y la secretaría: la libreta de A1 y las notas de su tarea |

El resumen del CI publica el **reporte de pruebas 403** por persona, en la referencia y en los endpoints reales (que se omiten hasta que existan).

**Comprobación de la suite.** Se debilitaron las referencias de calificaciones y tareas de 8 maneras, una por vez, y cada una hizo fallar pruebas:

| Debilidad | Pruebas que fallan |
|---|---|
| Una matrícula ajena devuelve lista vacía en vez de 403 | 35 |
| Un representante ve a los representados de todos | 23 |
| El estudiante ve las calificaciones de todo el colegio | 11 |
| Una matrícula inexistente responde 404 (deja averiguar cuáles existen) | 8 |
| Cualquiera abre las notas de una tarea de otro curso | 7 |
| En una tarea, el representante ve las notas de cualquiera del curso | 6 |
| En una tarea, el estudiante ve las notas de todo el curso | 4 |
| La persona del token cuenta aunque el rol del token no corresponda | 1 |

## Pruebas de parámetros: al cambiar una ponderación se recalculan las notas (RNF-10)

`test/seguridad/verificar-parametros.ts` (T1125-A) parte del escenario de la suite de calificaciones (curso A con M1 y el docente D1, curso B con otro docente) y registra las **143 notas de la hoja oficial** en 3 trimestres, más una nota del estudiante de control y otra del curso B. Después hace lo que dice la ficha de RNF-10: el administrador cambia una ponderación por la API, sin tocar código, y las notas se recalculan.

| Grupo | Qué comprueba |
|---|---|
| Punto de partida | `GET /parametros` trae `ponderaciones_calificaciones` con 70/15/15 y una versión. Las 143 notas coinciden con la hoja oficial |
| Cambio de ponderación | Para 60/20/20 (el de la ficha), 50/25/25, 80/10/10, 100/0/0 y 33,33/33,33/33,34: el cambio responde 200, sube la versión y devuelve los valores nuevos; **las 143 notas guardadas se recalculan** y coinciden con el oráculo de fracciones exactas; el estudiante ve su nota recalculada y también cambia la del curso B, de otro docente. Volver a 70/15/15 devuelve las notas de antes |
| Notas nuevas | Una nota guardada después del cambio usa las ponderaciones nuevas |
| Quién cambia | Solo el administrador. Responden 403: el docente que califica la materia, otro docente, la secretaría, el estudiante, el representante, un docente sin persona y el administrador con la clave temporal pendiente. Los 13 tokens inválidos responden 401. Después de cada intento, las ponderaciones y las 143 notas siguen igual |
| Rechazos | 400 si no suman 100 % (por 0,01), si suman de más, si una es negativa, pasa de 100, llega como texto o null, falta, tiene más de 2 decimales, o la nota mínima de aprobación no va de 1 a 10; también si el valor no es un objeto o la versión es inválida. 409 con una versión vieja. El parámetro inexistente se rechaza. Ninguno cambia nada. Acepta `18,08 + 0,07 + 81,85`, que en coma flotante no suma 100 exacto |

Se ejecuta contra la referencia (`referencia/modulo-parametros-referencia.ts`, con el módulo de calificaciones leyendo sus ponderaciones) y contra los endpoints reales (`parametros.e2e.spec.ts`), que se omiten hasta que existan `GET` y `PUT /parametros` (T1125-M). Los parámetros son globales: la suite los deja en 70/15/15 al terminar.

**Lo que no cubre la ficha de RNF-10:** que el cambio tome «≤ 10 min» se mide con una persona, no con esta suite, y el trimestre cerrado (RN-18) no se prueba porque el contrato no tiene cómo cerrarlo.

**Comprobación de la suite.** Se debilitó la referencia de 11 maneras, una por vez (dos de ellas, quién cambia, se muestran juntas), y cada una hizo fallar pruebas:

| Debilidad | Pruebas que fallan |
|---|---|
| Cualquier cuenta autenticada, o cualquier docente, cambia las ponderaciones | 40 |
| Las notas nuevas ignoran las ponderaciones vigentes | 41 |
| La secretaría también las cambia | 38 |
| No exige que sumen 100 % | 20 |
| Guarda la ponderación aunque la rechace | 20 |
| Las notas ya guardadas no se recalculan | 16 |
| Acepta una nota mínima de aprobación fuera de 1 a 10 | 11 |
| La versión no sube al cambiar | 6 |
| Solo se recalculan las notas de una materia (no las de otro curso) | 5 |
| No mira la versión (pisa el cambio de otro administrador) | 1 |

## Plan

| Cuándo | Qué se construye | Estado |
|---|---|---|
| Sprint 3 (26/10) | Contrato OpenAPI v0 y estructura en el monorepo | Listo (T1026-C) |
| Sprint 3 (27/10) | Esqueleto en NestJS con `/health`, Swagger, pruebas y Dockerfile | Listo (T1027-M) |
| Sprint 3 (28/10) | Esquema inicial en `db_academico` con Prisma Migrate | Listo (T1028-M) |
| Sprint 4 (04/11) | Pruebas de integración con PostgreSQL real (Testcontainers) | Listo (T1104-M) |
| Sprint 4 (05/11) | Validación del JWT con JWKS y guardas por rol | Listo (T1105-M) |
| Sprint 5 (16/11) | Datos de prueba ficticios (seed) | Listo (T1116-M) |
| Sprint 5 (17/11) | Cálculo de notas compartido (`packages/calculo-notas`) integrado en ms-academico | Listo (T1117-M) |
| Sprint 5 (18/11) | Endpoints de calificaciones que recalculan con el mismo paquete | Listo (T1118-M) |
| Sprint 4 (09/11) | Validación de entradas global y pruebas de validación e inyección de RF-06 y RF-07 | Listo (T1109-A) |
| Sprint 4 (09/11) | Endpoints de año lectivo, trimestres, cursos, paralelos y materias | Listo (T1109-M, adelantado en T1113-A) |
| Sprint 4 (10/11) | Cliente de ms-identidad con token de servicio y prueba de integración en el CI | Listo (T1110-A) |
| Sprint 4 (10/11) | Endpoints de personas (con la cuenta en ms-identidad) y de asignación docente–materia–curso con horarios | Listo (T1110-M) |
| Sprint 4 (11/11) | Validación de cédula y pruebas de privacidad de matrícula y personas (RNF-04) | Listo (T1111-A) |
| Sprint 4 (11/11) | Endpoints de matrícula individual y representaciones | Pendiente (T1111-M) |
| Sprint 4 (12/11) | Controles de carga de la nómina en Excel y pruebas con archivos inválidos | Listo (T1112-A) |
| Sprint 4 (12/11) | Importador de nóminas | Pendiente (T1112-M) |
| Sprint 5 (18/11) | Pruebas de exactitud contra la hoja oficial y de que solo el docente de la materia califica | Listo (T1118-A) |
| Sprint 5 (19/11) | Pruebas de autorización de tareas y saneamiento de texto (XSS) | Listo (T1119-A) |
| Sprint 5 (19/11) | Endpoints de tareas con fecha de entrega | Pendiente (T1119-M) |
| Sprint 5 (20/11) | Pruebas de acceso: el estudiante solo ve sus propias notas (reporte de pruebas 403) | Listo (T1120-A) |
| Sprint 5 (20/11) | Endpoints de entregas, nota y retroalimentación | Pendiente (T1120-M) |
| Sprint 5 (21/11) | Pruebas de asistencia y de quién puede justificar | Listo (T1123-A) |
| Sprint 5 (21/11) | Endpoints de asistencia, atrasos y justificación | Pendiente (T1123-M) |
| Sprint 5 (24/11) | Pruebas del cálculo de comportamiento contra la hoja oficial (`packages/calculo-notas`) | Listo (T1124-A) |
| Sprint 5 (24/11) | Endpoints de comportamiento con nueve indicadores y cálculo del cualitativo | Pendiente (T1124-M) |
| Sprint 5 (25/11) | Prueba: al cambiar una ponderación se recalculan las notas | Listo (T1125-A) |
| Sprint 5 (25/11) | Endpoints de parámetros del colegio y recálculo de notas | Pendiente (T1125-M) |
| Sprint 4 en adelante | Módulos académicos según el Product Backlog | |

Responsable del área: @cmacuna7.
