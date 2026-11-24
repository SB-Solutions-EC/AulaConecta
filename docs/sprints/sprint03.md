# Informe del sprint 3 — Arquitectura de microservicios y CI/CD básico

**Fechas:** 21/10/2026 – 30/10/2026 · **Milestone:** Sprint 3 – Arquitectura de microservicios y CI/CD básico (cerrado) · **Demostración:** 30/10/2026

## Meta del sprint

Configurar la organización y el repositorio en GitHub con ramas protegidas (`main`, `test`, `dev`), secretos y el Product Backlog en GitHub Projects (`TEC-01`); entregar el Entregable 3 con la selección justificada de tecnologías y el prototipo anonimizado verificado con Gitleaks (`DOC-03`); definir la arquitectura C4 de 3 microservicios (`ms-identidad`, `ms-academico`, `ms-notificaciones`), el modelo de datos por servicio, el diseño de sincronización sin conexión, el modelo de amenazas STRIDE y los contratos OpenAPI 3.1 v0 (`TEC-02`); construir los esqueletos ejecutables de los 3 microservicios, el gateway Traefik, la PWA, PostgreSQL con 3 bases aisladas y RabbitMQ (`TEC-03`); y habilitar el pipeline DevSecOps por servicio con detección de secretos, pruebas, cobertura, auditoría de dependencias, escaneo de imágenes con Trivy, SonarQube y avisos automáticos en Telegram (`HU-15`).

## Historias y tareas

### Ítems del Product Backlog comprometidos

| Código | Tipo | Ítem del Product Backlog | Responsables | Estado | Evidencia |
|---|---|---|---|---|---|
| `TEC-01` | Habilitador | Organización, repositorio, ramas protegidas y Product Backlog | Equipo (`@cmacuna7`, `@adarboleda`, `@cmbonifaz`) | Terminado | [README.md](../../README.md), [CODEOWNERS](../../.github/CODEOWNERS), [rulesets](../../.github/rulesets), [sincronizar_backlog.py](../../scripts/github/sincronizar_backlog.py) |
| `DOC-03` | Entregable | Entregable 3: Metodología, planificación, tecnologías y prototipo | Equipo (`@cmacuna7`, `@adarboleda`, `@cmbonifaz`) | Terminado | [Entregable 3](../entregables/Entregable3_Metodologia_Planificacion_Prototipo.pdf), [seleccion_tecnologias.md](../arquitectura/seleccion_tecnologias.md), [datos_sensibles.md](../seguridad/datos_sensibles.md) |
| `TEC-02` | Habilitador | Arquitectura de 3 microservicios, modelo de datos y modelo de amenazas | Equipo (`@cmacuna7`, `@adarboleda`, `@cmbonifaz`) | Terminado | [c4.md](../arquitectura/c4.md), [modelo_datos.md](../arquitectura/modelo_datos.md), [modelo_amenazas.md](../seguridad/modelo_amenazas.md), [openapi/](../../openapi) |
| `TEC-03` | Habilitador | Esqueletos de los microservicios, gateway, PWA, bases de datos y RabbitMQ | Equipo (`@cmacuna7`, `@adarboleda`, `@cmbonifaz`) | Terminado | [services/](../../services), [apps/pwa/](../../apps/pwa), [infra/docker-compose.yml](../../infra/docker-compose.yml), [infra/postgres/init.sql](../../infra/postgres/init.sql), [infra/rabbitmq/](../../infra/rabbitmq) |
| `HU-15` | Historia | Como equipo queremos un pipeline con pruebas y análisis de seguridad que avise por Telegram | `@adarboleda`, `@cmacuna7`, `@cmbonifaz` | Terminado | [ci.yml](../../.github/workflows/ci.yml), [notificar_telegram.sh](../../.github/scripts/notificar_telegram.sh), [sonar-project.properties](../../sonar-project.properties), [checklist_ci.md](../seguridad/checklist_ci.md) |

### Tareas ejecutadas en el sprint

| Código | Fecha | Actividad / Subactividad | Responsable | Estado | Evidencia |
|---|---|---|---|---|---|
| `T1021-M` | 21/10 | Organización en GitHub con 3 owners y repositorio con ramas `main`, `test` y `dev`, `README`, `CODEOWNERS` y plantilla de PR | Marcelo (`@cmacuna7`) | Terminado | [README.md](../../README.md), [CODEOWNERS](../../.github/CODEOWNERS), [pull_request_template.md](../../.github/pull_request_template.md) |
| `T1021-A` | 21/10 | Product Backlog en GitHub Projects: 15 historias de usuario con requisitos, prioridad de Wiegers y sprint | Abner (`@adarboleda`) | Terminado | [crear_backlog.sh](../../scripts/github/crear_backlog.sh), [sincronizar_backlog.py](../../scripts/github/sincronizar_backlog.py) |
| `T1021-C` | 21/10 | Reglas de protección (`main`, `test`, `dev`) y configuración de secretos de Telegram y SonarQube en GitHub Secrets | Christian (`@cmbonifaz`) | Terminado | [proteccion-main-test.json](../../.github/rulesets/proteccion-main-test.json), [proteccion-dev.json](../../.github/rulesets/proteccion-dev.json) |
| `T1022-M` | 22/10 | Selección de tecnologías con criterios y estructura inicial del monorepo | Marcelo (`@cmacuna7`) | Terminado | [seleccion_tecnologias.md](../arquitectura/seleccion_tecnologias.md) |
| `T1022-A` | 22/10 | Inventario de datos sensibles y prototipo anonimizado revisado con Gitleaks | Abner (`@adarboleda`) | Terminado | [datos_sensibles.md](../seguridad/datos_sensibles.md), [.gitleaks.toml](../../.gitleaks.toml), [prototipo/](../../prototipo) |
| `T1022-C` | 22/10 | Revisión final y entrega del Entregable 3 (metodología, RACI, cronograma, Wiegers, riesgos, indicadores y prototipo) | Christian (`@cmbonifaz`) | Terminado | [Entregable 3](../entregables/Entregable3_Metodologia_Planificacion_Prototipo.pdf), [Planificacion_v2.xlsx](../planificacion/Planificacion_v2.xlsx) |
| `T1023-M` | 23/10 | Modelo de datos v1 (usuarios, roles, cursos, materias, matrículas, planificaciones, calificaciones, asistencia y avisos) | Marcelo (`@cmacuna7`) | Terminado | [modelo_datos.md](../arquitectura/modelo_datos.md) |
| `T1023-A` | 23/10 | Modelo de amenazas STRIDE a partir del taller de vulnerabilidades y riesgos | Abner (`@adarboleda`) | Terminado | [modelo_amenazas.md](../seguridad/modelo_amenazas.md) |
| `T1023-C` | 23/10 | Diagrama C4 inicial y diseño del trabajo sin conexión (cola local en IndexedDB y resolución de conflictos) | Christian (`@cmbonifaz`) | Terminado | [c4_contexto_contenedores.md](../arquitectura/Diagramas/c4_contexto_contenedores.md), [trabajo_sin_conexion.md](../arquitectura/Diagramas/trabajo_sin_conexion.md) |
| `T1026-M` | 26/10 | Modelo de datos por servicio v2 (`ms-academico` y `ms-notificaciones`) con IDs UUID y campo `version` | Marcelo (`@cmacuna7`) | Terminado | [modelo_datos.md](../arquitectura/modelo_datos.md), [plantillas_whatsapp.md](../arquitectura/plantillas_whatsapp.md), [cambios_requisitos.md](../requisitos/cambios_requisitos.md) |
| `T1026-A` | 26/10 | Arquitectura C4 v2 (contexto y contenedores: gateway, 3 microservicios, RabbitMQ y PostgreSQL) y modelo de `ms-identidad` | Abner (`@adarboleda`) | Terminado | [c4.md](../arquitectura/c4.md) |
| `T1026-C` | 26/10 | Contratos OpenAPI 3.1 v0 de los 3 servicios y estructura del monorepo (`apps`, `services`, `packages`, `infra`, `tests`) | Christian (`@cmbonifaz`) | Terminado | [ms-identidad.yaml](../../openapi/ms-identidad.yaml), [ms-academico.yaml](../../openapi/ms-academico.yaml), [ms-notificaciones.yaml](../../openapi/ms-notificaciones.yaml) |
| `T1027-M` | 27/10 | Esqueleto de `ms-academico` en NestJS (TypeScript) con `/health` y Swagger | Marcelo (`@cmacuna7`) | Terminado | [services/ms-academico/](../../services/ms-academico) |
| `T1027-A` | 27/10 | Esqueleto de `ms-identidad` en Spring Boot (Java 21) y gateway Traefik con TLS local y rate limiting | Abner (`@adarboleda`) | Terminado | [services/ms-identidad/](../../services/ms-identidad), [infra/traefik/](../../infra/traefik) |
| `T1027-C` | 27/10 | Esqueleto de la PWA (React + Vite + TypeScript) y de `ms-notificaciones` (FastAPI, Python 3.12) | Christian (`@cmbonifaz`) | Terminado | [apps/pwa/](../../apps/pwa), [services/ms-notificaciones/](../../services/ms-notificaciones) |
| `T1028-M` | 28/10 | Base `db_academico` y estructura de datos iniciales del servicio académico | Marcelo (`@cmacuna7`) | Terminado | [modelo_datos.md](../arquitectura/modelo_datos.md), [services/ms-academico/](../../services/ms-academico) |
| `T1028-A` | 28/10 | PostgreSQL con 3 bases y 3 usuarios separados (`init.sql`); migración inicial de `db_identidad` con Flyway | Abner (`@adarboleda`) | Terminado | [init.sql](../../infra/postgres/init.sql), [V1__init.sql](../../services/ms-identidad/src/main/resources/db/migration/V1__init.sql) |
| `T1028-C` | 28/10 | Base `db_notificaciones` con Alembic (`0001_init.py` y las 3 plantillas oficiales) y RabbitMQ en `docker-compose` | Christian (`@cmbonifaz`) | Terminado | [0001_init.py](../../services/ms-notificaciones/alembic/versions/0001_init.py), [definitions.json](../../infra/rabbitmq/definitions.json), [rabbitmq.conf](../../infra/rabbitmq/rabbitmq.conf) |
| `T1029-M` | 29/10 | Workflows de `ms-academico` y `ms-notificaciones` (Vitest, pytest, `npm audit` y `pip-audit`) | Marcelo (`@cmacuna7`) | Terminado | [ci-academico.yml](../../.github/workflows/ci-academico.yml), [ci-notificaciones.yml](../../.github/workflows/ci-notificaciones.yml) |
| `T1029-A` | 29/10 | Workflow de `ms-identidad` (JUnit 5, JaCoCo, Dependency-Check), Gitleaks común, SonarQube y notificador de Telegram | Abner (`@adarboleda`) | Terminado | [ci-identidad.yml](../../.github/workflows/ci-identidad.yml), [ci-imagen.yml](../../.github/workflows/ci-imagen.yml), [notificar_telegram.sh](../../.github/scripts/notificar_telegram.sh) |
| `T1029-C` | 29/10 | Workflow de la PWA (`ci-web.yml`: lint, build, Vitest, cobertura LCOV) y Dockerfiles multietapa de los 4 componentes | Christian (`@cmbonifaz`) | Terminado | [ci-web.yml](../../.github/workflows/ci-web.yml), [apps/pwa/Dockerfile](../../apps/pwa/Dockerfile), [services/ms-notificaciones/Dockerfile](../../services/ms-notificaciones/Dockerfile) |
| `T1030-M` | 30/10 | `docker-compose.yml` completo (gateway, 3 microservicios, PostgreSQL, RabbitMQ y PWA) e integración del sprint | Marcelo (`@cmacuna7`) | Terminado | [infra/docker-compose.yml](../../infra/docker-compose.yml) |
| `T1030-A` | 30/10 | Prueba negativa del CI (secreto falso y dependencia vulnerable Log4Shell bloquean el PR) y checklist de seguridad | Abner (`@adarboleda`) | Terminado | [checklist_ci.md](../seguridad/checklist_ci.md), [prueba_negativa_ci.sh](../../scripts/github/prueba_negativa_ci.sh), PR [#257](https://github.com/SB-Solutions-EC/AulaConecta/pull/257) |
| `T1030-C` | 30/10 | Informe del sprint 3 con indicadores I-01, I-08 e I-11 y demostración del esqueleto | Christian (`@cmbonifaz`) | Terminado | [sprint03.md](sprint03.md) |

## Demostración

En la revisión de cierre del sprint (30/10/2026) se demostró el funcionamiento integrado del esqueleto de la arquitectura y del pipeline DevSecOps:

1. **Orquestación completa en contenedores ([infra/docker-compose.yml](../../infra/docker-compose.yml)):**
   - Levantamiento con un solo comando (`docker compose -f infra/docker-compose.yml up --build`) de los contenedores endurecidos (`read_only: true`, `cap_drop: ALL`, `no-new-privileges:true` y ejecución sin privilegios `root`) segmentados en las redes `publica` (únicamente el gateway Traefik en `80/443`) e `interna` (`internal: true`).
2. **Gateway Traefik con TLS 1.2+ y endpoints `/health` de los 3 microservicios:**
   - `GET https://localhost/api/identidad/health` → `ms-identidad` (Spring Boot 4 · Java 21) respondiendo `{"status":"UP"}` tras aplicar `V1__init.sql` con Flyway sobre `db_identidad`.
   - `GET https://localhost/api/academico/health` → `ms-academico` (NestJS 11 · TypeScript) respondiendo `{"status":"UP"}`.
   - `GET https://localhost/api/notificaciones/health` → `ms-notificaciones` (FastAPI · Python 3.12) respondiendo `{"status":"UP"}` tras aplicar la migración `0001_init` de Alembic sobre `db_notificaciones`.
3. **Esqueleto de la PWA (`https://localhost/`):**
   - Despliegue de la PWA de la **Unidad Educativa "Andoas"** servida con Nginx sin privilegios sobre Alpine 3.24, consumiendo en tiempo real los 3 endpoints `/health` a través del gateway Traefik, permitiendo alternar la vista de los 5 roles institucionales (`RF-01`, `RF-38`) y reaccionando a los eventos de conectividad (`online` / `offline`).
4. **Aislamiento de bases de datos y mensajería asíncrona:**
   - Verificación en PostgreSQL 16 de las 3 bases independientes (`db_identidad`, `db_academico`, `db_notificaciones`) con usuarios de permisos mínimos (`usr_identidad`, `usr_academico`, `usr_notificaciones`) y autenticación `scram-sha-256`.
   - Verificación en RabbitMQ (`127.0.0.1:15672`) del exchange `aulaconecta.eventos` (`topic`), la cola `notificaciones.eventos` con las routing keys `academico.promedio_bajo` y `academico.falta_registrada`, y la cola de mensajes muertos `notificaciones.eventos.dlq`.
5. **Pipeline CI/CD, Quality Gate y prueba negativa de seguridad:**
   - Demostración de la ejecución en verde de [ci.yml](../../.github/workflows/ci.yml) (Gitleaks, pruebas unitarias y cobertura de los 4 componentes, auditoría de dependencias, escaneo Trivy + SBOM CycloneDX de las 4 imágenes y Quality Gate en SonarQube con 0 vulnerabilidades, 0 security hotspots y cobertura > 80 %), los avisos automáticos editados en vivo en Telegram y el bloqueo efectivo del PR [#257](https://github.com/SB-Solutions-EC/AulaConecta/pull/257) ante un secreto inyectado y `log4j-core` 2.14.1 (`CVE-2021-44228`).
6. **Observaciones de la revisión:**
   - Se validó la transición de monolito modular a 3 microservicios alineados con los dominios de privacidad (`RNF-04`, `RNF-05`) y la solicitud de cambio [CR-01](../requisitos/cambios_requisitos.md) para operar avisos en 3 niveles (Web Push gratuito, WhatsApp asistido por enlace `wa.me` y WhatsApp Cloud API opcional) sin costo obligatorio para la institución.

## Indicadores

| ID | Dimensión | Indicador | Meta | Resultado Sprint 3 | Fuente / Evidencia |
|---|---|---|---|---|---|
| **I-01** | Avance | Cumplimiento del sprint (`ítems terminados ÷ planificados × 100`) | ≥ 85 % | **100 %** (5/5 ítems; 24/24 tareas) | Tablero GitHub Projects y milestone `Sprint 3` |
| **I-02** | Avance | Avance acumulado del Product Backlog | 100 % al 15/01 | **29,2 %** (7/24 ítems obligatorios cerrados: `DOC-01`, `DOC-02`, `DOC-03`, `TEC-01`, `TEC-02`, `TEC-03`, `HU-15`) | GitHub Projects (`AulaConecta – Product Backlog`) |
| **I-03** | Calidad | Defectos detectados abiertos al cierre | Tendencia a la baja; 0 críticos abiertos | **0 defectos abiertos** (los hallazgos de CI/Docker detectados antes de integrar se corrigieron en el mismo sprint) | GitHub Issues (etiqueta `defecto`) y [checklist_ci.md](../seguridad/checklist_ci.md) |
| **I-04** | Calidad | Cobertura de pruebas y Quality Gate | ≥ 60 % en código nuevo; 100 % de PR aprobados | **Aprobado (PASSED)** · Cobertura > 85 % y 100 % de PR con Quality Gate en verde | SonarQube (`quality-pr`) |
| **I-06** | Retrabajo | Historias reabiertas | ≤ 10 % | **0 %** (0/5 ítems reabiertos) | GitHub Projects |
| **I-07** | Retrabajo | Observaciones del cliente | Tendencia a la baja | **1 ajuste preventivo acordado** ([CR-01](../requisitos/cambios_requisitos.md): esquema de avisos gratuitos por niveles) | [cambios_requisitos.md](../requisitos/cambios_requisitos.md) |
| **I-08** | Plazos | Entregas puntuales (`sprints cerrados en fecha ÷ sprints × 100`) | 100 % | **100 %** (3/3 sprints cerrados en fecha: S1 el 06/10, S2 el 20/10, S3 el 30/10) | Cronograma ([Planificacion_v2.xlsx](../planificacion/Planificacion_v2.xlsx)) |
| **I-09** | Seguridad | Vulnerabilidades críticas o altas y secretos abiertos | 0 antes de unir a `test` o `main` | **0 abiertas** (Gitleaks = 0, Dependency-Check = 0, `npm audit` = 0, `pip-audit` = 0, Trivy = 0, SonarQube Security = 0) | GitHub Actions y [checklist_ci.md](../seguridad/checklist_ci.md) |
| **I-11** | Proceso | Salud del pipeline (`ejecuciones exitosas ÷ totales × 100` y duración media) | ≥ 80 %; ≤ 15 min | **83,3 %** en las ejecuciones de cierre (100 % de jobs en verde al cierre) · **~8 min** de duración media (≤ 15 min) | GitHub Actions (`CI`) y avisos en Telegram |

### Detalle de los indicadores foco de `T1030-C` (I-01, I-08 e I-11)

- **I-01 · Cumplimiento del sprint (`100 % ≥ 85 %`):**
  $$\text{I-01} = \frac{5\text{ ítems terminados}}{5\text{ ítems planificados}} \times 100 = 100\,\% \quad \left(\frac{24\text{ tareas completadas}}{24\text{ tareas planificadas}} = 100\,\%\right)$$
  Se completaron íntegramente `TEC-01`, `DOC-03`, `TEC-02`, `TEC-03` y `HU-15`, dejando la arquitectura de 3 microservicios, las 3 bases de datos con migraciones, los contratos OpenAPI 3.1 y el pipeline de CI/CD operativos en `dev`.
- **I-08 · Entregas puntuales (`100 %`):**
  $$\text{I-08} = \frac{3\text{ sprints entregados a tiempo}}{3\text{ sprints ejecutados}} \times 100 = 100\,\%$$
  Tanto el Entregable 3 (22/10/2026) como el cierre técnico del Sprint 3 (30/10/2026) se completaron dentro de las fechas establecidas en el cronograma oficial.
- **I-11 · Salud del pipeline (`≥ 80 %` y `~8 min ≤ 15 min`):**
  -Durante la puesta a punto del pipeline multi-servicio, las fallas tempranas permitieron detectar y corregir problemas reales antes de llegar a `test` (selectores ambiguos en Vitest, vulnerabilidades de paquetes base en `alpine 3.21.3` detectadas por Trivy en `imagen-pwa`, vulnerabilidades de `starlette` en `ms-notificaciones` detectadas por `pip-audit` y un recurso externo sin SRI en `index.html` detectado por SonarQube `Web:S5725`).
  - Gracias al uso de caché para Maven, NVD (`~/.dependency-check`) y Trivy (`~/.cache/trivy`), y a la ejecución en paralelo de los jobs por servicio (`identidad`, `academico`, `notificaciones`, `web`) e imágenes (`imagen-*`), el tiempo medio del pipeline completo se mantuvo alrededor de **8 minutos**, muy por debajo del límite de **15 minutos**.

## Retrospectiva (PDCA: Actuar)

- **Qué funcionó:**
  - La separación física en 3 microservicios (`ms-identidad`, `ms-academico`, `ms-notificaciones`) con 3 bases de datos y usuarios PostgreSQL independientes simplificó el cumplimiento de los controles de privacidad de menores (`RNF-04`, `RNF-05`) y del modelo de amenazas STRIDE.
  - Los contratos OpenAPI 3.1 v0 ([openapi/](../../openapi)) y los Dockerfiles multietapa endurecidos permitieron integrar en paralelo Spring Boot 4, NestJS 11, FastAPI y la PWA en React sin bloqueos entre integrantes.
  - El notificador de Telegram ([notificar_telegram.sh](../../.github/scripts/notificar_telegram.sh)) que edita un único mensaje por ejecución dio visibilidad inmediata al equipo del estado de cada etapa sin saturar el chat.
- **Qué mejorar:**
  - Algunas reglas del análisis estático de SonarQube (`docker:S6470` por `COPY . .`, `Web:S5725` por hojas de estilo externas sin SRI) y del escaneo de imágenes con Trivy (paquetes desactualizados en imágenes base de `alpine 3.21`) se detectaron recién al ejecutar el CI completo en GitHub, requiriendo commits correctivos adicionales.
  - Quedó documentado en [checklist_ci.md](../seguridad/checklist_ci.md) que el archivo [proteccion-main-test.json](../../.github/rulesets/proteccion-main-test.json) debe sincronizarse en GitHub cuando se incorporan nuevos checks de servicios para que los 10 checks sean obligatorios al abrir un PR hacia `test` o `main`.
- **Acción de mejora para el próximo sprint (Sprint 4):**
  - Ejecutar localmente las validaciones de cada servicio (`mvn verify`, `npm run lint && npm run test:coverage`, `pytest`, `docker build` con `apk upgrade --no-cache` sobre `alpine:3.24` y `gitleaks detect`) antes de subir la rama, y aplicar mediante `gh api` la actualización completa de los 10 checks requeridos en el ruleset de `main` y `test` al inicio del Sprint 4.

