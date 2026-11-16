# Informe del sprint 4 — Imágenes en el CI, autenticación y matrícula

**Fechas:** 04/11/2026 – 13/11/2026 *(corte técnico en `dev`: 15/11/2026)* · **Milestone:** Sprint 4 – Imágenes en el CI, autenticación y matrícula *(abierto al corte)* · **Demostración:** Pendiente (`T1113-M`)

## Meta del sprint

Consolidar la publicación y escaneo de imágenes Docker con Trivy y SBOM en el pipeline CI/CD (`T1104-A`), implementar la autenticación segura con JWT RS256, endpoint JWKS, hash Argon2id, bloqueo por intentos fallidos, auditoría de accesos y cierre por inactividad (`HU-01`), habilitar la configuración académica, gestión docente con pruebas E2E en Playwright, matrícula individual con consentimiento expreso de WhatsApp en `ms-notificaciones` e importación de nóminas `.xlsx` con controles de carga (`HU-02`, `HU-03`), validados mediante pruebas de integración, privacidad y análisis estático en SonarQube antes del paso a `test`.

## Historias y tareas

### Ítems del Product Backlog comprometidos

| Código | Tipo | Ítem del Product Backlog | Responsables | Estado al corte (`15/11`) | Evidencia |
|---|---|---|---|---|---|
| `HU-01` | Historia | Como usuario quiero iniciar sesión y ver solo las opciones de mi rol (`RF-01` a `RF-03`, `RNF-12`) | `@adarboleda`, `@cmbonifaz`, `@cmacuna7` | En cierre *(implementado en `ms-identidad`, `ms-notificaciones`, `ms-academico` y PWA; pendiente validación de CI en `ms-academico`)* | [services/ms-identidad/](../../services/ms-identidad), [verificador-jwt.ts](../../services/ms-academico/src/autenticacion/verificador-jwt.ts), [seguridad.py](../../services/ms-notificaciones/app/seguridad.py), [useCierrePorInactividad.ts](../../apps/pwa/src/sesion/useCierrePorInactividad.ts) |
| `HU-03` | Historia | Como administrador quiero gestionar docentes, cursos, materias y año lectivo (`RF-05` a `RF-07`) | `@cmacuna7`, `@adarboleda`, `@cmbonifaz` | Parcial *(pantallas PWA, prueba E2E Playwright y suites de seguridad/inyección listas; faltan endpoints en `ms-academico`)* | [PantallaConfiguracionAcademica.tsx](../../apps/pwa/src/componentes/PantallaConfiguracionAcademica.tsx), [PantallaDocentes.tsx](../../apps/pwa/src/componentes/PantallaDocentes.tsx), [docentes.spec.ts](../../apps/pwa/e2e/docentes.spec.ts), [services/ms-academico/test/seguridad/](../../services/ms-academico/test/seguridad) |
| `HU-02` | Historia | Como secretaría quiero matricular estudiantes e importar la nómina desde Excel (`RF-04`, `RF-29`) | `@cmacuna7`, `@adarboleda`, `@cmbonifaz` | Parcial *(pantallas PWA de matrícula/WhatsApp e importación `.xlsx` y suites de privacidad/carga listas; faltan endpoints en `ms-academico`)* | [PantallaMatricula.tsx](../../apps/pwa/src/componentes/PantallaMatricula.tsx), [PantallaImportacion.tsx](../../apps/pwa/src/componentes/PantallaImportacion.tsx), [limites.ts](../../services/ms-academico/src/importacion/limites.ts) |

### Tareas ejecutadas y pendientes en el sprint

| Código | Fecha ref. | Actividad / Subactividad | Responsable | Estado al corte (`15/11`) | Evidencia |
|---|---|---|---|---|---|
| `T1104-A` | 04/11 | Etapa `Imagen`: build, escaneo con Trivy, SBOM y publicación en GHCR; notificador Telegram | Abner (`@adarboleda`) | Terminado *(cerrado)* | [ci-imagen.yml](../../.github/workflows/ci-imagen.yml), [notificar_telegram.sh](../../.github/scripts/notificar_telegram.sh) |
| `T1104-C` | 07/11 | Layout de la PWA: menú lateral por rol, rutas protegidas y cliente HTTP con manejo del token | Christian (`@cmbonifaz`) | Terminado *(cerrado)* | [LayoutPwa.tsx](../../apps/pwa/src/componentes/LayoutPwa.tsx), [rutasProtegidas.tsx](../../apps/pwa/src/rutas/rutasProtegidas.tsx), [clienteHttp.ts](../../apps/pwa/src/api/clienteHttp.ts) |
| `T1104-M` | 15/11 | Pruebas de integración de `ms-academico` con Testcontainers (PostgreSQL real) | Marcelo (`@cmacuna7`) | En `dev` *(pendiente cierre de issue y verde en CI)* | Commit `f11dce5`, [prisma.service.ts](../../services/ms-academico/src/base-datos/prisma.service.ts) |
| `T1105-A` | 07/11 | Login con Spring Security, JWT RS256, endpoint JWKS, hash Argon2id y cambio obligatorio de clave | Abner (`@adarboleda`) | Terminado *(cerrado, PR #260)* | [services/ms-identidad/](../../services/ms-identidad) |
| `T1105-C` | 07/11 | Pantallas de inicio de sesión y de cambio de la clave inicial | Christian (`@cmbonifaz`) | Terminado *(cerrado)* | [PantallaInicioSesion.tsx](../../apps/pwa/src/componentes/PantallaInicioSesion.tsx), [PantallaCambioClaveInicial.tsx](../../apps/pwa/src/componentes/PantallaCambioClaveInicial.tsx) |
| `T1105-M` | 15/11 | Validación del JWT con JWKS y guardas por rol en `ms-academico` (NestJS) | Marcelo (`@cmacuna7`) | En `dev` *(pendiente validación de Vitest en CI)* | Commit `9abdd19`, [guardia-jwt.ts](../../services/ms-academico/src/autenticacion/guardia-jwt.ts) |
| `T1106-A` | 07/11 | Usuario generado por nombre y apellido, bloqueo tras 3 intentos fallidos y auditoría de accesos | Abner (`@adarboleda`) | Terminado *(cerrado, PR #261)* | PR [#261](https://github.com/SB-Solutions-EC/AulaConecta/pull/261) |
| `T1106-C` | 07/11 | Sesión, cierre por inactividad y menú según el rol | Christian (`@cmbonifaz`) | Terminado *(cerrado)* | [useCierrePorInactividad.ts](../../apps/pwa/src/sesion/useCierrePorInactividad.ts), [App.tsx](../../apps/pwa/src/App.tsx) |
| `T1106-M` | 15/11 | Validación del JWT en `ms-notificaciones` (FastAPI) y pruebas `pytest` de autorización | Marcelo (`@cmacuna7`) | En `dev` *(CI `notificaciones` en verde; pendiente cierre de issue)* | Commit `3d14ebe`, [seguridad.py](../../services/ms-notificaciones/app/seguridad.py) |
| `T1109-A` | 11/11 | Pruebas de validación de entradas e inyección en los endpoints académicos | Abner (`@adarboleda`) | Terminado *(cerrado, PR #263)* | PR [#263](https://github.com/SB-Solutions-EC/AulaConecta/pull/263), [validadores.ts](../../services/ms-academico/src/comun/validadores.ts) |
| `T1109-C` | 12/11 | Pantallas de configuración académica (año lectivo, días no dictados, cursos, paralelos y materias) | Christian (`@cmbonifaz`) | Terminado *(cerrado)* | [PantallaConfiguracionAcademica.tsx](../../apps/pwa/src/componentes/PantallaConfiguracionAcademica.tsx), [academicoConfigApi.ts](../../apps/pwa/src/api/academicoConfigApi.ts) |
| `T1109-M` | — | Endpoints de año lectivo, cursos, paralelos y materias en `ms-academico` | Marcelo (`@cmacuna7`) | Pendiente | Issue `#41` |
| `T1110-A` | 11/11 | Comunicación entre servicios con token de servicio (`client credentials`) y prueba de integración | Abner (`@adarboleda`) | Terminado *(cerrado, PR #264)* | PR [#264](https://github.com/SB-Solutions-EC/AulaConecta/pull/264), [ci-integracion.yml](../../.github/workflows/ci-integracion.yml) |
| `T1110-C` | 12/11 | Pantalla de docentes, asignación de materias/horarios y prueba E2E con Playwright | Christian (`@cmbonifaz`) | Terminado *(cerrado)* | [PantallaDocentes.tsx](../../apps/pwa/src/componentes/PantallaDocentes.tsx), [docentes.spec.ts](../../apps/pwa/e2e/docentes.spec.ts) |
| `T1110-M` | — | Endpoints de docentes y asignación docente–materia; creación de cuenta en `ms-identidad` | Marcelo (`@cmacuna7`) | Pendiente | Issue `#42` |
| `T1111-A` | 12/11 | Pruebas de privacidad (`RNF-04`): estudiante o representante no accede a datos ajenos | Abner (`@adarboleda`) | Terminado *(cerrado, PR #265)* | PR [#265](https://github.com/SB-Solutions-EC/AulaConecta/pull/265), [privacidad.e2e.spec.ts](../../services/ms-academico/test/seguridad/privacidad.e2e.spec.ts) |
| `T1111-C` | 12/11 | Pantalla de matrícula con número de WhatsApp y autorización del representante (en `ms-notificaciones`) | Christian (`@cmbonifaz`) | Terminado *(cerrado)* | [PantallaMatricula.tsx](../../apps/pwa/src/componentes/PantallaMatricula.tsx), [matriculasApi.ts](../../apps/pwa/src/api/matriculasApi.ts) |
| `T1111-M` | — | Endpoints de matrícula individual en `ms-academico` | Marcelo (`@cmacuna7`) | Pendiente | Issue `#43` |
| `T1112-A` | 12/11 | Controles de carga Excel `.xlsx`: tamaño máximo, tipo real, límites y 47 casos inválidos | Abner (`@adarboleda`) | Terminado *(cerrado, PR #266)* | PR [#266](https://github.com/SB-Solutions-EC/AulaConecta/pull/266), [libro-excel.ts](../../services/ms-academico/src/importacion/libro-excel.ts) |
| `T1112-C` | 12/11 | Pantalla de importación de nóminas `.xlsx` con vista previa y errores por fila | Christian (`@cmbonifaz`) | Terminado *(cerrado)* | [PantallaImportacion.tsx](../../apps/pwa/src/componentes/PantallaImportacion.tsx), [importacionApi.ts](../../apps/pwa/src/api/importacionApi.ts) |
| `T1112-M` | — | Importador de nóminas `.xlsx` con validación de cédula, duplicados y reporte por fila | Marcelo (`@cmacuna7`) | Pendiente | Issue `#44` |
| `T1113-A` | — | PR `dev → test` del sprint 4 con los 4 pipelines en verde | Abner (`@adarboleda`) | Pendiente *(bloqueado hasta completar `ms-academico`)* | Issue `#118` |
| `T1113-C` | 15/11 | Informe del sprint 4 con indicadores | Christian (`@cmbonifaz`) | Terminado *(en entrega)* | [sprint04.md](sprint04.md) |
| `T1113-M` | — | Demostración al vicerrector del módulo de usuarios y matrícula | Marcelo (`@cmacuna7`) | Pendiente | Issue `#45` |

> Además, durante el sprint se actualizaron el esquema Prisma de `db_academico` (`T1028-M`), la ejecución de migraciones en CI/Docker Compose (`T1029-M`, `T1030-M`), el prototipo v3, el modelo ER de 26 tablas, los diagramas UML y la atención a la retroalimentación docente ([retroalimentacion_docente.md](../entregables/retroalimentacion_docente.md)).

## Demostración

La demostración formal al vicerrector (`T1113-M`) se encuentra **pendiente** de ejecutarse en cuanto concluyan los endpoints de `ms-academico` (`T1109-M` a `T1112-M`) y el pipeline de `dev` pase al 100 % para habilitar la promoción a `test` (`T1113-A`).

A nivel técnico interno en la rama `dev`, los avances demostrables al corte (`15/11/2026`) son:

1. **Autenticación, cuentas y control por rol (`HU-01`):**
   - `ms-identidad` emite tokens JWT RS256 con endpoint JWKS, almacena contraseñas con Argon2id, genera nombres de usuario automáticos, bloquea cuentas tras 3 intentos fallidos, registra auditoría de accesos y exige cambio de clave inicial.
   - `ms-academico` y `ms-notificaciones` incorporan validación JWT contra JWKS y guardas de autorización por rol.
   - La PWA implementa inicio de sesión, cambio obligatorio de clave inicial, cierre de sesión por inactividad, manejo de token en memoria y menú lateral filtrado por rol.
2. **Módulos académicos y de matrícula en la PWA (`HU-02`, `HU-03`):**
   - Pantallas operativas alineadas con OpenAPI 3.1 para **Configuración académica** (`/configuracion-academica`), **Personal docente y asignación de materias** (`/docentes`, con prueba E2E en Playwright), **Matrícula y consentimiento de WhatsApp** (`/matriculas`, integrando `ms-academico` y `ms-notificaciones`) e **Importación de nóminas `.xlsx`** (`/importacion`, con vista previa y detalle de errores por fila).
3. **Controles de seguridad automatizados e integración:**
   - Prueba de integración real `academico-identidad` mediante `client credentials` en CI (`ci-integracion.yml`).
   - Suites de validación de entradas/inyección, privacidad (`RNF-04`) y controles de carga segura de libros `.xlsx` (sin macros, fórmulas, XXE ni bombas ZIP) en `services/ms-academico/test/seguridad/`.

## Indicadores

| ID | Dimensión | Indicador | Meta | Resultado al corte (`15/11`) | Fuente / Evidencia |
|---|---|---|---|---|---|
| **I-01** | Avance | Cumplimiento del sprint (`tareas cerradas o completadas ÷ planificadas × 100`) | ≥ 85 % | **62,5 %** cerradas en GitHub (`15/24` con `T1113-C`; `18/24 = 75,0 %` con entregas en `dev` incluyendo `T1104-M`–`T1106-M`) · `0/3` historias cerradas aún | Milestone `Sprint 4` en GitHub y commits en `dev` |
| **I-02** | Avance | Avance acumulado del Product Backlog | 100 % al 15/01 | **29,2 %** cerrado formalmente en `test`/`main` (`7/24` ítems S1–S3; `HU-01`, `HU-02`, `HU-03` en progreso en `dev`) | Tablero `AulaConecta – Product Backlog` |
| **I-03** | Calidad | Defectos detectados abiertos al cierre | Tendencia a la baja; 0 críticos abiertos | **0 issues `defecto` abiertos** en GitHub · **1 fallo activo en `dev`** en `academico / ms-academico` (paso `Vitest` del commit `7a7acb1`); durante el sprint se resolvieron errores de tipos/pruebas en PWA y 6 hallazgos de SonarQube | GitHub Issues y GitHub Actions (`run 43786905403`) |
| **I-04** | Calidad | Cobertura de pruebas y Quality Gate | ≥ 60 % en código nuevo; 100 % de PR aprobados | **Mixto al corte:** último cierre PWA (`3fd7f66`, 13/11) obtuvo **PASSED** completo en SonarQube; al `15/11` (`7a7acb1`) `identidad`, `notificaciones` y `web/pwa` aprobaron, mientras `quality-pr` falló bloqueado por `ms-academico` | SonarQube (`quality-pr`) y `ci.yml` |
| **I-06** | Retrabajo | Historias reabiertas | ≤ 10 % | **0 %** (`0/3` historias reabiertas) | GitHub Issues |
| **I-08** | Plazos | Entregas puntuales (`sprints cerrados en fecha ÷ sprints × 100`) | 100 % | **75 %** acumulado (`3/4` sprints cerrados en fecha: S1–S3 puntuales; Milestone Sprint 4 venció el `13/11/2026` y sigue abierto al `15/11` por pendientes de backend y demo) | Cronograma y Milestone 2 (`due_on: 2026-11-13`) |
| **I-09** | Seguridad | Vulnerabilidades críticas o altas y secretos abiertos | 0 antes de unir a `test` o `main` | **0 abiertas** en secretos y dependencias (`Gitleaks = 0`, `Dependency-Check = 0`, `npm audit = 0`, `pip-audit = 0`, `Trivy = 0` en imágenes de `identidad`, `notificaciones` y `pwa`; `imagen-academico` omitida al fallar `ms-academico`) | GitHub Actions (`ci.yml`) |
| **I-11** | Proceso | Salud del pipeline (`ejecuciones exitosas ÷ totales × 100` y duración media) | ≥ 80 %; ≤ 15 min | **24,0 %** en `push` a `dev` (`6/25` ejecuciones entre 01/11 y 15/11) · **4,4 min** de duración media en las ejecuciones exitosas (`3,7 – 6,0 min ≤ 15 min`) | GitHub Actions (`branch=dev`) |

### Análisis de los indicadores del Sprint 4

- **I-01 e I-08 (Cumplimiento y plazos):** El frente de **seguridad/CI (`@adarboleda`: 7/8 cerradas)** y el frente **frontend PWA (`@cmbonifaz`: 8/8 completadas con este informe)** cumplieron el alcance del sprint dentro de las fechas previstas (9 archivos de pruebas en `apps/pwa`, incluyendo E2E con Playwright para docentes). El cierre formal del Sprint 4 y el paso `dev → test` (`T1113-A`, `T1113-M`) dependen de completar `T1109-M`–`T1112-M` en `ms-academico` y resolver el fallo actual de Vitest tras el merge de `7a7acb1`.
- **I-11 (Salud del pipeline — `24,0 %` vs `≥ 80 %`, duración `4,4 min`):**
  - El bajo porcentaje de éxito acumulado en `dev` obedeció a tres factores concretos: (1) ejecuciones en que el runner autoalojado de SonarQube estuvo apagado provocando demoras/fallos en `quality-pr`; (2) integración incremental directamente sobre `dev` antes de verificar localmente `tsc --noEmit` y `vitest` (errores luego corregidos en `ca0c25a` y `3fd7f66`); y (3) el fallo reciente en `academico / ms-academico` (`7a7acb1`).
  - Asimismo, al abrirse un PR continuo `dev → main`, cada `push` a `dev` disparaba dos corridas paralelas (`push` y `pull_request`); se ajustó `ci.yml` (`ca0c25a`) para evitar avisos duplicados en Telegram sin omitir ningún check.
  - Cuando todas las etapas pasan sin espera del runner local, la duración promedio del pipeline completo es de **4,4 minutos**, cumpliendo ampliamente el umbral `≤ 15 min`.

## Retrospectiva (PDCA: Actuar)

- **Qué funcionó:**
  - Los contratos OpenAPI 3.1 y las suites preventivas de seguridad (`T1109-A`–`T1112-A`) permitieron avanzar todo el frontend de autenticación, docentes, matrícula con consentimiento WhatsApp e importación Excel sin bloquearse por el backend, manteniendo alineados los formatos (`ErrorApi`, E.164, límites `.xlsx`).
  - La corrección temprana de hallazgos de SonarQube (`S6389`, `S5332`, `S2187`) y Gitleaks evitó que deuda técnica o falsos positivos llegaran a `test`.
  - Cuando los jobs corren sin retención del runner propio, el CI completo (4 componentes, 3 bases/integración, Trivy y SonarQube) se mantiene en ~4,4 minutos.
- **Qué mejorar:**
  - No fusionar ni hacer push directo a `dev` sin haber ejecutado previamente `npm run lint`, `npm run test:coverage` / `pytest` / `mvn verify` en local, y evitar abrir PRs prematuros `dev → main` mientras el sprint sigue en desarrollo en `dev`.
  - Coordinar el cierre vertical por historia (`backend + frontend + integración`) antes de la fecha límite del milestone (`13/11`) para evitar que un servicio retrase la demostración (`T1113-M`) y el PR `dev → test` (`T1113-A`).
- **Acción de mejora para el próximo sprint (Sprint 5):**
  1. Corregir de inmediato el fallo de Vitest en `ms-academico`, cerrar `T1109-M`–`T1112-M`, ejecutar la demostración (`T1113-M`) y promover `dev → test` (`T1113-A`) antes de iniciar las historias de calificaciones (`HU-07`, `HU-08`).
  2. Mantener encendido el runner autoalojado durante las ventanas de integración o utilizar ramas `feature/*` con validación previa de pruebas antes de mezclar a `dev`.
