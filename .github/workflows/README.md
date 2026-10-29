# Workflows de GitHub Actions

| Workflow (cuando exista) | Etapas | Desde |
|---|---|---|
| `ci.yml` | Validación de repositorio · SonarQube local · avisos en Telegram | `dev`, `test`, `main` y sus PR |

El workflow no fusiona ramas automáticamente. El flujo manual es:

1. Ramas de trabajo por módulo o actividad → PR aprobado hacia `dev`.
2. Cierre del sprint: `dev` → `test` mediante PR aprobado.
3. Control o versión estable: `test` → `main` mediante PR aprobado.

`test` y `main` deben exigir el check `CI / quality-pr` y una aprobación humana en sus rulesets. Los tokens van en GitHub Secrets (`TELEGRAM_BOT_TOKEN`, `TELEGRAM_CHAT_ID`, `SONAR_TOKEN`, `SONAR_PROJECT_KEY`, `SONAR_HOST_URL`), nunca en el código.
