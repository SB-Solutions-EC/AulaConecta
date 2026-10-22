# Política de seguridad

## Reportar una vulnerabilidad

Si encuentras un problema de seguridad, **no abras un issue público**. Usa la opción *Report a vulnerability* de la pestaña **Security** de este repositorio o escribe a los integrantes del equipo. Responderemos en un plazo de 5 días hábiles.

## Datos personales

AulaConecta maneja datos de menores de edad. En este repositorio:

- No se suben datos reales de estudiantes, docentes ni representantes; los ejemplos usan datos ficticios.
- No se suben contraseñas, tokens ni archivos `.env`; los valores sensibles van en GitHub Secrets.
- Cada cambio pasa por un pipeline que detecta secretos (Gitleaks) y vulnerabilidades (npm audit, Trivy, SonarQube).
