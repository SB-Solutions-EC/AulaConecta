# AulaConecta

Plataforma de gestión académica para la **Unidad Educativa "Andoas"** (Puyo, Pastaza). Reúne en un solo lugar la planificación curricular de los docentes con su revisión y aprobación, el cálculo automático de calificaciones y reportes, y los avisos por WhatsApp a los representantes cuando un estudiante baja de 7 o falta a clases. Funciona también sin conexión a internet.

> **Estado:** en desarrollo (octubre 2026 – enero 2027). Proyecto de la asignatura Construcción y Evolución del Software — Universidad de las Fuerzas Armadas ESPE.

## Qué resuelve

| Necesidad del colegio | Cómo la atiende AulaConecta |
|---|---|
| Planificaciones en papel o Word que se revisan una y otra vez | Plantilla digital del Ministerio con estados de revisión y observaciones por campo |
| Notas y reportes calculados a mano en archivos separados | Cálculo automático idéntico a las hojas oficiales: nota final, cualitativo, estándares y valoración de logros |
| Padres que se enteran tarde del bajo rendimiento o las faltas | Avisos automáticos por WhatsApp, con consentimiento y registro de cada envío |
| Internet inestable en la zona | Aplicación web instalable (PWA) que registra sin conexión y sincroniza después |

## Roles

Administrador (vicerrector) · Secretaría · Docente · Estudiante · Representante

## Stack tecnológico (planificado)

| Área | Herramientas |
|---|---|
| Backend | NestJS, TypeScript, Prisma, PostgreSQL |
| Frontend | React + Vite (PWA), Tailwind, IndexedDB para el trabajo sin conexión |
| Cálculo de notas | Paquete compartido en TypeScript (`packages/calculo`) |
| Seguridad en CI | Gitleaks, npm audit, Trivy, SonarQube Cloud, OWASP ZAP |
| Pruebas | Jest, Vitest, Playwright, k6 |
| CI/CD | GitHub Actions, Docker, avisos de progreso en Telegram |
| Notificaciones | WhatsApp Cloud API |

## Flujo de ramas

| Rama | Uso | Cómo se actualiza |
|---|---|---|
| `dev` | Trabajo diario | Push directo de los integrantes; el CI corre en cada push |
| `test` | Demostración de cada sprint | Solo por pull request desde `dev`, con el CI en verde |
| `main` | Versiones aceptadas por el cliente | Solo por pull request desde `test`, con el CI en verde |

Ninguna de las tres ramas permite force push ni borrado.

## Estructura del repositorio

```
.github/          CODEOWNERS, plantilla de PR, reglas de protección (rulesets) y workflows
docs/             Planificación, requisitos, análisis, modelos y entregables
scripts/          Scripts de apoyo (por ejemplo, creación del Product Backlog)
backend/          API NestJS (sprint 3)
frontend/         PWA React + Vite (sprint 3)
packages/         Código compartido, como el cálculo de notas (sprint 4)
```

## Metodología

Scrum con prácticas DevSecOps, en 10 sprints del 30/09/2026 al 15/01/2027. El orden de construcción sigue la matriz de priorización de Wiegers. El detalle día por día está en [docs/planificacion/Planificacion.xlsx](docs/planificacion/Planificacion.xlsx) y el Product Backlog en GitHub Projects.

## Equipo — SB Solutions

| Integrante | Área responsable |
|---|---|
| Christian Marcelo Acuña Gamboa ([@cmacuna7](https://github.com/cmacuna7)) | Backend, datos y cálculo de notas · Scrum Master |
| Abner David Arboleda Roman ([@adarboleda](https://github.com/adarboleda)) | DevSecOps, CI/CD y seguridad |
| Christian Mateo Bonifaz Vásquez ([@cmbonifaz](https://github.com/cmbonifaz)) | Frontend PWA y trabajo sin conexión |

## Datos personales

Este repositorio es público. **No contiene datos reales de estudiantes ni docentes**: los ejemplos usan datos ficticios. Ver [SECURITY.md](SECURITY.md).
