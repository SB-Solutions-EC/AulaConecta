# Trazabilidad de los casos de prueba

Relaciona los casos de prueba del documento integrado ([Grupo01_Taller2_1.pdf](../analisis/Grupo01_Taller2_1.pdf), v1.0 del 10/11/2026) con las pruebas automáticas del repositorio. Todas corren en cada ejecución del CI (`.github/workflows/ci.yml`).

**Estados:**
- **Automatizado:** el caso completo tiene pruebas que lo cubren.
- **Parcial:** ya se prueba una parte (controles de seguridad o la implementación de referencia) y falta el endpoint real o la pantalla.
- **Pendiente:** se construye en el sprint indicado.

Corte: 16/11/2026, inicio del sprint 5.

## Requisitos funcionales

| Caso | Requisito | Estado | Pruebas |
|---|---|---|---|
| CP-01 | RF-01 · cinco roles contra la matriz de permisos | Parcial | ms-identidad: `UsuariosTests`, `AuditoriaTests`, `ClaveTemporalTests` y `TokenServicioTests` (403 por rol y por token de servicio). ms-academico: `test/autenticacion.e2e.spec.ts` (guardia JWT por rol) y la suite `verificar-endpoint.ts` (403 para cada rol sin permiso). PWA: rutas por rol en `App.test.tsx`. Falta el recorrido de las cinco cuentas cuando existan todos los endpoints |
| CP-02 | RF-02 · nombre de usuario con repetidos, tildes y ñ | Automatizado | `GeneradorNombreUsuarioTests`, `UsuariosTests.conNombresRepetidosAgregaUnNumero` |
| CP-03 | RF-03 v1.1 · clave temporal vigente, vencida y reutilizada | Automatizado | `ClaveTemporalTests` (un solo uso, vencimiento a las 72 h, inicios simultáneos, nueva clave de la secretaría) y la prueba de integración `test/integracion/identidad.integracion.ts` contra ms-identidad real. PWA: `ClaveTemporal.test.tsx` y `PantallasAcceso.test.tsx` (clave usada y vencida) |
| CP-04 | RF-04 · nómina válida y con errores | Parcial | Controles de carga del archivo: `src/importacion/*.spec.ts`, `referencia-carga.spec.ts` (47 archivos inválidos) y `carga.e2e.spec.ts`, que se aplica al importador real cuando exista. Falta el reporte por fila de T1112-M (cédula y duplicados) |
| CP-05 | RF-05 · docente y asignación | Parcial | Pantalla y E2E de Playwright: `apps/pwa/e2e/docentes.spec.ts`. Faltan los endpoints de T1110-M |
| CP-06 | RF-06 · cursos, paralelos y materias | Automatizado | `endpoints-academicos.e2e.spec.ts` contra los endpoints reales `/cursos` y `/materias` sobre PostgreSQL: roles, validación, inyección y duplicados (también el código de materia). Esquema: `test/base-datos/esquema.bd.spec.ts`. PWA: `PantallaConfiguracionAcademica.test.tsx` |
| CP-07 | RF-07 · fechas del año lectivo y trimestres | Automatizado | `endpoints-academicos.e2e.spec.ts` contra `/anios-lectivos` y `/periodos` reales: trimestre 1 a 3, fin antes del inicio, fuera del año lectivo, superposición y duplicado. PWA: pestaña de trimestres en `PantallaConfiguracionAcademica.test.tsx` |
| CP-17 | RF-17 · registro de aportes por el docente de la materia | Parcial | `verificar-calificaciones.ts` (T1118-A) contra la referencia: solo el docente asignado a esa materia en ese curso califica (403 para los demás roles y docentes), versión vieja 409 y validación de aportes. Se aplica sola a los endpoints de T1118-M (`calificaciones.e2e.spec.ts`) |
| CP-18 | RF-18 · cálculo de la nota final en el servidor | Parcial | Exactitud del servidor contra la hoja oficial anonimizada: 143 de 143 casos en la referencia, que calcula con `packages/calculo-notas`. Falta el endpoint real (T1118-M) |
| CP-38 | RF-38 · el representante ve solo a sus representados | Parcial | `verificar-privacidad.ts` contra la referencia (`referencia-privacidad.spec.ts`); se aplica sola a los endpoints de T1111-M (`privacidad.e2e.spec.ts`) |
| CP-19 | RF-19 · tareas con fecha dentro del trimestre | Parcial | `verificar-tareas.ts` (T1119-A) contra la referencia: solo el docente de la asignación crea; fecha fuera del trimestre o de otro año lectivo se rechaza; el curso ve sus tareas. Se aplica sola a los endpoints de T1119-M (`tareas.e2e.spec.ts`). PWA: `PantallaTareas.test.tsx` y `e2e/tareas.spec.ts` |
| CP-20 | RF-20 · nota y retroalimentación de cada tarea | Parcial | `verificar-tareas.ts`: solo el docente de la tarea califica, nota de 0 a 10, versión vieja 409, cada estudiante ve solo su nota y comentario. Falta el endpoint real (T1119-M) |
| CP-08 a CP-16, CP-21 a CP-37 y CP-39 | RF-08 a RF-16, RF-21 a RF-37 y RF-39 | Pendiente | Sprints 5 a 8 según la sección 9.2 del documento |

## Requisitos no funcionales

| Caso | Requisito | Estado | Pruebas |
|---|---|---|---|
| CP-N04 | RNF-04 · 0 accesos a datos ajenos | Parcial | Suite de privacidad: 34 pruebas, 19 de ellas de 403, contra la referencia. Se aplica a los endpoints reales cuando existan. El resumen del job `academico / ms-academico` cuenta las pruebas de 403 |
| CP-N09 | RNF-09 · registro inalterable | Parcial | Bitácora de accesos: `AuditoriaTests.laBitacoraNoSePuedeAlterarNiDesdeElServicio` y `MigracionFlywayTests`. La auditoría de notas es T1126-M |
| CP-N12 | RNF-12 · hash, bloqueo e inactividad | Automatizado | `AutenticacionTests` (Argon2id y migración desde BCrypt), `BloqueoTests` (3 intentos, 15 min, intentos simultáneos) y `apps/pwa/src/sesion/useCierrePorInactividad.test.tsx` |
| CP-N13 | RNF-13 · validación en el servidor e inyección | Parcial | Suite de T1109-A (unas 350 pruebas por implementación), controles de carga de T1112-A y validación de ms-identidad (`UsuariosTests.rechazaDatosInvalidos`, `TokenServicioTests.validaLaSolicitud`). Falta el análisis dinámico con OWASP ZAP (sprint 7). Texto libre y enlaces de tareas (T1119-A): `@TextoLibre`, `@EnlaceSeguro`, suite de XSS (69 pruebas por implementación) y `PantallaTareas.xss.test.tsx` en la PWA |
| CP-N14 | RNF-14 · HTTPS con TLS 1.2 o superior | Parcial | `infra/traefik/dinamico.yml` (`minVersion: VersionTLS12`, HSTS y cabeceras). Falta el escaneo dinámico con OWASP ZAP (informe de seguridad del sprint 7, 18/12) |
| CP-N15 | RNF-15 · 0 secretos y 0 vulnerabilidades altas | Automatizado | Jobs `gitleaks`, `identidad` (Dependency-Check), `academico` (`npm audit`), `notificaciones` (`pip-audit`), `imagen-*` (Trivy) y `quality-pr` (SonarQube); ver [checklist_ci.md](../seguridad/checklist_ci.md) |
| CP-N01 | RNF-01 · sin conexión | Pendiente | Sprint 9 |
| CP-N02 | RNF-02 · exactitud de cálculos | Automatizado | `packages/calculo-notas/test/hoja-oficial.test.ts`: 151 filas de la hoja oficial anonimizada (120 estudiantes generados y 31 casos límite) contra un oráculo exacto en Python; indicador I-05 = 100 % en el job `calculo` del CI (T1117-A). Falta validar con el colegio la regla del promedio del curso (T1117-M) |
| CP-N05 | RNF-05 · consentimiento de avisos | Pendiente | Sprint 8 |
| CP-N06 | RNF-06 · rendimiento | Pendiente | Sprint 9 (k6 con 460 usuarios) |
| CP-N08 | RNF-08 · respaldos | Pendiente | Sprint 9 (restauración cronometrada) |
| CP-N03, CP-N07, CP-N10, CP-N11 | RNF-03, RNF-07, RNF-10, RNF-11 | Pendiente | Sprints 5, 6 y 10 |

## Integración entre servicios

| Prueba | Qué comprueba | Dónde corre |
|---|---|---|
| `test/integracion/identidad.integracion.ts` | ms-academico obtiene su token de servicio y crea una cuenta en ms-identidad real. La clave temporal sirve una vez, los tokens se validan con el JWKS y el token de servicio no sirve como persona | Job `integracion / academico-identidad` (`ci-integracion.yml`), con PostgreSQL y ms-identidad levantados con `infra/docker-compose.yml` |
