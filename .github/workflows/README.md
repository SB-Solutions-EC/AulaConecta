# Workflows de GitHub Actions

| Workflow | Etapas | Desde |
|---|---|---|
| `ci.yml` | Gitleaks · llama a cada servicio · validación del repositorio · SonarQube multilenguaje · avisos en Telegram | `dev`, `test`, `main` y sus PR |
| `ci-identidad.yml` | JUnit 5 · cobertura con JaCoCo · Dependency-Check (falla con CVSS 7 o mayor) | Lo llama `ci.yml` |
| `ci-imagen.yml` | Construcción · SBOM CycloneDX · Trivy (falla con HIGH o CRITICAL con corrección disponible) · publicación en GHCR | Lo llama `ci.yml` por cada servicio |

| Job | Dónde corre | Por qué |
|---|---|---|
| `gitleaks`, `ms-identidad`, `imagen-*`, `telegram-*` | GitHub (`ubuntu-latest`) | Ejecutan código del PR: así no corre en una máquina del equipo (modelo de amenazas E-03) y no dependen de que el runner propio esté encendido |
| `quality-pr` | Runner propio | El servidor de SonarQube es local. Si el runner está apagado, este job queda en cola y el aviso de Telegram se queda con SonarQube en ⏳ |

Gitleaks se instala desde su release con checksum verificado porque la acción oficial exige licencia a las organizaciones. Las acciones están fijadas por SHA para evitar que un cambio en una etiqueta altere el pipeline (T-06). Dependency-Check usa los archivos públicos de la NVD, que no requieren clave, y los guarda en caché por día.

### Imágenes

Las imágenes se publican en `ghcr.io/sb-solutions-ec/aulaconecta/<servicio>` con las etiquetas `sha-<commit>` y el nombre de la rama, solo en push a `dev`, `test` y `main`. En un PR se construyen y escanean, pero no se publican. El job `publicar` no hace checkout y sube la misma imagen que se escaneó, así que el código de un PR nunca corre con permiso de escritura. El SBOM queda como artefacto de la ejecución durante 30 días.

### Telegram

`notificar_telegram.sh` envía un único mensaje al iniciar la ejecución y lo edita al terminar cada grupo de etapas, con el estado, la duración y el enlace. Si no puede editarlo, envía uno nuevo.

### Sumar un servicio

1. Crea `ci-<servicio>.yml` con `workflow_call` y llámalo desde `ci.yml`.
2. Agrega en `ci.yml` un job `imagen-<servicio>` que llame a `ci-imagen.yml`, igual que `imagen-identidad`.
3. Agrega ambos a `needs` de `quality`, `notificar-pruebas` y `notificar-calidad`, y sus etapas al mensaje de Telegram.
4. Declara sus reportes en `sonar-project.properties`.
5. Agrega sus checks en [proteccion-main-test.json](../rulesets/proteccion-main-test.json) y aplícalo en GitHub.

El workflow no fusiona ramas automáticamente. El flujo manual es:

1. Ramas de trabajo por módulo o actividad → PR aprobado hacia `dev`.
2. Cierre del sprint: `dev` → `test` mediante PR aprobado.
3. Control o versión estable: `test` → `main` mediante PR aprobado.

`test` y `main` exigen los checks `quality-pr`, `gitleaks`, `identidad / ms-identidad` e `imagen-identidad / escanear`, y una aprobación humana ([proteccion-main-test.json](../rulesets/proteccion-main-test.json)). El nombre del check es el del job, sin el prefijo `CI /` que muestra la interfaz. Los tokens van en GitHub Secrets (`TELEGRAM_BOT_TOKEN`, `TELEGRAM_CHAT_ID`, `SONAR_TOKEN`, `SONAR_PROJECT_KEY`, `SONAR_HOST_URL`), nunca en el código.
