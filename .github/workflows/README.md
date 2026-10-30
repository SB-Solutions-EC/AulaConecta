# Workflows de GitHub Actions

| Workflow | Etapas | Desde |
|---|---|---|
| `ci.yml` | Gitleaks · llama a cada servicio · validación del repositorio · SonarQube multilenguaje · avisos en Telegram | `dev`, `test`, `main` y sus PR |
| `ci-identidad.yml` | JUnit 5 · cobertura con JaCoCo · Dependency-Check (falla con CVSS 7 o mayor) | Lo llama `ci.yml` |

| Job | Dónde corre | Por qué |
|---|---|---|
| `gitleaks`, `ms-identidad`, `telegram-*` | GitHub (`ubuntu-latest`) | Ejecutan código del PR: así no corre en una máquina del equipo (modelo de amenazas E-03) y no dependen de que el runner propio esté encendido |
| `quality-pr` | Runner propio | El servidor de SonarQube es local. Si el runner está apagado, este job queda en cola y solo llega el primer aviso de Telegram |

Gitleaks se instala desde su release con checksum verificado porque la acción oficial exige licencia a las organizaciones. Las acciones están fijadas por SHA para evitar que un cambio en una etiqueta altere el pipeline (T-06). Dependency-Check usa los archivos públicos de la NVD, que no requieren clave, y los guarda en caché por día.

Para sumar un servicio: crea `ci-<servicio>.yml` con `workflow_call`, llámalo desde `ci.yml`, agrégalo a `needs` de `quality` y `notificar-pruebas`, y declara sus reportes en `sonar-project.properties`.

El workflow no fusiona ramas automáticamente. El flujo manual es:

1. Ramas de trabajo por módulo o actividad → PR aprobado hacia `dev`.
2. Cierre del sprint: `dev` → `test` mediante PR aprobado.
3. Control o versión estable: `test` → `main` mediante PR aprobado.

`test` y `main` exigen los checks `quality-pr`, `gitleaks` e `identidad / ms-identidad`, y una aprobación humana ([proteccion-main-test.json](../rulesets/proteccion-main-test.json)). El nombre del check es el del job, sin el prefijo `CI /` que muestra la interfaz. Los tokens van en GitHub Secrets (`TELEGRAM_BOT_TOKEN`, `TELEGRAM_CHAT_ID`, `SONAR_TOKEN`, `SONAR_PROJECT_KEY`, `SONAR_HOST_URL`), nunca en el código.
