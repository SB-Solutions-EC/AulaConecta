# Workflows de GitHub Actions

| Workflow (cuando exista) | Etapas | Desde |
|---|---|---|
| `ci.yml` | Secretos (Gitleaks) · Dependencias (npm audit, Trivy) · Compilación · Pruebas · SonarQube · Imagen · avisos en Telegram | 26/10 |

Los tokens van en GitHub Secrets (`TELEGRAM_BOT_TOKEN`, `TELEGRAM_CHAT_ID`, `SONAR_TOKEN`), nunca en el código.
