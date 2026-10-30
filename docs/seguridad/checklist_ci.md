# Checklist de seguridad del CI

**Tarea:** T1030-A · **Responsable:** Abner David Arboleda Roman · **Fecha:** 30/10/2026 · **Sprint 3**

Revisión de la seguridad del pipeline ([ci.yml](../../.github/workflows/ci.yml) y [ci-identidad.yml](../../.github/workflows/ci-identidad.yml)) y prueba negativa: un secreto falso y una dependencia vulnerable deben bloquear el pull request. Cubre las amenazas T-06, I-04 y E-03 del [modelo de amenazas](modelo_amenazas.md).

Estado: ✅ cumple · ⚠️ pendiente, con su acción en la sección 3.

## 1. Prueba negativa

La prueba se ejecuta con [scripts/github/prueba_negativa_ci.sh](../../scripts/github/prueba_negativa_ci.sh). Abre un PR hacia `test` que agrega un secreto inventado y `log4j-core` 2.14.1 (Log4Shell, CVE-2021-44228, CVSS 10). El PR nunca se fusiona: la misma herramienta lo cierra y borra la rama con `limpiar`.

| Control | Qué se prueba | Resultado esperado |
|---|---|---|
| Gitleaks | `prueba-negativa/credenciales.properties` con una clave falsa | Falla el check `gitleaks` (regla `generic-api-key`) |
| Dependency-Check | `log4j-core` 2.14.1 en `pom.xml` | Falla el check `identidad / ms-identidad` (CVSS 7 o mayor) |
| Reglas de la rama | Checks obligatorios sin aprobar | GitHub impide fusionar el PR |

**Verificado en local (30/10):** con una copia del repositorio, Gitleaks detecta el secreto y sale con código 1; Dependency-Check falla por CVE-2021-44228; `mvn verify` pasa con `log4j-core`, de modo que el rechazo viene del análisis de dependencias y no de otra causa. El script no activa Gitleaks estando en `dev` porque arma el valor falso por partes.

**Verificado en GitHub (30/10):** el pipeline bloqueó el PR y cada check falló en el paso que corresponde.

| PR | `gitleaks` | `identidad / ms-identidad` | Fusión |
|---|---|---|---|
| [#257](https://github.com/SB-Solutions-EC/AulaConecta/pull/257), cerrado sin fusionar | ❌ Paso "Buscar secretos y datos personales en el historial" | ❌ Paso "Analizar dependencias (falla con CVSS 7 o mayor)" | Bloqueada (`BLOCKED`) |

El PR también tenía pendiente la aprobación humana, que es otro requisito de `test`. El check `quality-pr` quedó en cola porque el runner propio estaba apagado; no influyó en el resultado, ya que los dos checks fallidos corren en GitHub.

## 2. Checklist

### Secretos y datos

| Estado | Control | Evidencia |
|---|---|---|
| ✅ | Ningún secreto en el código: todos en GitHub Secrets | 5 secretos; ningún valor en los workflows |
| ✅ | Búsqueda de secretos en todo el historial | Job `gitleaks` con `fetch-depth: 0` y `--redact` |
| ✅ | Reglas para datos personales | Cédula y celular de Ecuador en [.gitleaks.toml](../../.gitleaks.toml) |
| ✅ | Cada secreto solo en el paso que lo usa | `env` por paso, nunca a nivel de workflow |
| ✅ | El token de SonarQube no va en la línea de comandos | Variable de entorno `SONAR_TOKEN` |
| ✅ | Los avisos de Telegram no llevan datos personales | Solo etapa, rama, commit y enlace |
| ⚠️ | Secret scanning de GitHub con protección al hacer push | Hoy desactivado (acción 1) |

### Permisos y ejecución

| Estado | Control | Evidencia |
|---|---|---|
| ✅ | Permisos mínimos del token | `contents: read` en los workflows; por defecto `read` en el repositorio |
| ✅ | GitHub Actions no puede aprobar PR | `can_approve_pull_request_reviews: false` |
| ✅ | Sin `pull_request_target` | Disparadores: `push` y `pull_request` |
| ✅ | Sin inyección de comandos desde la rama o el PR | Valores por `env`, nunca `${{ }}` dentro de `run` |
| ✅ | El código de los PR corre en runners de GitHub | `gitleaks` y `ms-identidad` en `ubuntu-latest` |
| ✅ | PR de forks fuera del runner propio y con aprobación | Condición en `quality`; política `first_time_contributors` |
| ✅ | Tiempo máximo por job | `timeout-minutes` en todos los jobs |
| ⚠️ | Runner propio con una cuenta sin privilegios | Hoy corre como Administrador (acción 2) |

### Cadena de suministro

| Estado | Control | Evidencia |
|---|---|---|
| ✅ | Acciones fijadas por SHA | `checkout`, `setup-java`, `cache`, `upload-artifact`, `download-artifact` |
| ✅ | Herramientas con checksum verificado | Gitleaks 8.30.1 con `sha256sum -c` |
| ✅ | Dependencias de Java analizadas | Dependency-Check; falla con CVSS 7 o mayor |
| ✅ | Alertas de dependencias en GitHub | Dependabot alerts activado |
| ⚠️ | Solo acciones fijadas por SHA, exigido por GitHub | Hoy `sha_pinning_required: false` (acción 3) |

### Bloqueo

| Estado | Control | Evidencia |
|---|---|---|
| ✅ | Un fallo previo no se puede saltar | `quality-pr` corre siempre y falla si una etapa previa falló; un job omitido contaría como exitoso |
| ✅ | `main` y `test` solo por PR con una aprobación | [proteccion-main-test.json](../../.github/rulesets/proteccion-main-test.json) |
| ✅ | Sin force push ni borrado en `dev`, `test` y `main` | Rulesets activos |
| ✅ | `main` y `test` exigen los tres checks | `quality-pr`, `gitleaks` e `identidad / ms-identidad`, aplicados en GitHub el 30/10 y comprobados con el PR #257 |
| ⚠️ | `dev` exige el CI | Hoy no lo exige (acción 4) |

## 3. Pendientes

| # | Acción | Responsable | Por qué |
|---|---|---|---|
| 1 | Activar secret scanning y push protection | Abner | Son gratuitos en repositorios públicos y bloquean el secreto antes de que llegue a GitHub |
| 2 | Ejecutar el servicio del runner con una cuenta sin privilegios | Dueño del equipo | Amenaza E-03: SonarQube todavía corre en esa máquina |
| 3 | Activar `sha_pinning_required` | Abner | Convierte la práctica actual en una regla; conviene hacerlo cuando todos los workflows de servicio ya estén fijados |
| 4 | Decidir si `dev` exige el CI | Equipo | Bloquearía también los push directos que hoy permite el README; hasta decidirlo, el bloqueo efectivo está en `test` y `main` |

## 4. Hallazgos de la revisión

| Hallazgo | Estado |
|---|---|
| El ruleset de `main` y `test` exigía un check con un nombre que no existe (`CI / quality-pr`). Se creó después del último PR a esas ramas, así que nunca se había puesto a prueba | Corregido y aplicado |
| `gitleaks` y `ms-identidad` detectaban problemas, pero no eran obligatorios: el pipeline avisaba sin bloquear | Corregido y aplicado |
| El token de SonarQube se pasaba como argumento, visible en la lista de procesos del runner | Corregido |
| La API de la NVD ya no funciona sin clave y Dependency-Check fallaba por completo | Corregido en T1029-A con los archivos públicos de la NVD |
