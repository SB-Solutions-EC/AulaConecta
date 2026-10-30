# AulaConecta

Plataforma de gestión académica para la **Unidad Educativa "Andoas"** (Puyo, Pastaza). Reúne en un solo lugar la planificación curricular de los docentes con su revisión y aprobación, el cálculo automático de calificaciones y reportes, y los avisos por WhatsApp a los representantes cuando un estudiante baja de 7 o falta a clases. Funciona también sin conexión a internet.

> **Estado:** en desarrollo (octubre 2026 – enero 2027). Proyecto de la asignatura Construcción y Evolución del Software — Universidad de las Fuerzas Armadas ESPE.

## Qué resuelve

| Necesidad del colegio | Cómo la atiende AulaConecta |
|---|---|
| Planificaciones en papel o Word que se revisan una y otra vez | Plantilla digital del Ministerio con estados de revisión y observaciones por campo |
| Notas y reportes calculados a mano en archivos separados | Cálculo automático idéntico a las hojas oficiales: nota final, cualitativo, estándares y valoración de logros |
| Padres que se enteran tarde del bajo rendimiento o las faltas | Avisos automáticos por Web Push y WhatsApp, con consentimiento y registro de cada envío |
| Internet inestable en la zona | Aplicación web instalable (PWA) que registra sin conexión y sincroniza después |

## Roles

Administrador (vicerrector) · Secretaría · Docente · Estudiante · Representante

## Stack tecnológico (planificado)

| Área | Herramientas |
|---|---|
| Microservicios | `ms-identidad` (Spring Boot 4 + Java 21), `ms-academico` (NestJS + TypeScript + Prisma), `ms-notificaciones` (FastAPI + Python + SQLAlchemy) |
| Base de datos y mensajería | PostgreSQL 16 (una base por servicio: `db_identidad`, `db_academico`, `db_notificaciones`) y RabbitMQ |
| Gateway | Traefik (TLS, cabeceras de seguridad y límite de peticiones) |
| Frontend (PWA) | React + Vite + TypeScript, Tailwind CSS, Workbox e IndexedDB (Dexie) para el trabajo sin conexión |
| Cálculo de notas | Paquete compartido en TypeScript (`packages/calculo`) |
| Contratos API | OpenAPI 3.1 (`openapi/`) |
| Seguridad en CI | Gitleaks, Dependency-Check, npm audit, pip-audit, Trivy, SonarQube, OWASP ZAP |
| Pruebas | JUnit 5, Jest/Vitest, pytest, Playwright, k6 |
| CI/CD | GitHub Actions, Docker, GHCR, avisos de progreso en Telegram |
| Notificaciones | Web Push (nivel 1), WhatsApp asistido `wa.me` (nivel 2) y WhatsApp Cloud API opcional (nivel 3) |

## Flujo de ramas

| Rama | Uso | Cómo se actualiza |
|---|---|---|
| `dev` | Trabajo diario | Push directo de los integrantes; el CI corre en cada push |
| `test` | Demostración de cada sprint | Solo por pull request desde `dev`, con el CI en verde |
| `main` | Versiones aceptadas por el cliente | Solo por pull request desde `test`, con el CI en verde |

Ninguna de las tres ramas permite force push ni borrado.

## Estructura del repositorio (monorepo)

```
apps/                Aplicaciones cliente (apps/pwa: PWA React + Vite + TypeScript)
services/            Microservicios (ms-identidad, ms-academico, ms-notificaciones)
packages/calculo/    Motor de cálculo de notas compartido en TypeScript (sprint 5)
openapi/             Contratos OpenAPI 3.1 v0 de los 3 microservicios
infra/               docker-compose, Traefik, PostgreSQL y despliegue
tests/               Pruebas transversales: extremo a extremo (e2e) y de carga (k6)
prototipo/           Prototipo navegable con datos ficticios
docs/                Planificación, requisitos, análisis, modelos, arquitectura, seguridad, sprints y entregables
scripts/github/      Creación del Product Backlog y de las tareas del cronograma
.github/             CODEOWNERS, plantilla de PR, rulesets y workflows
```

La carpeta `privado/` existe solo en el computador de cada integrante (documentos reales del colegio) y está excluida por `.gitignore`.

## Metodología

Scrum con prácticas DevSecOps, en 10 sprints del 30/09/2026 al 15/01/2027. El orden de construcción sigue la matriz de priorización de Wiegers. El detalle día por día está en [docs/planificacion/Planificacion_v2.xlsx](docs/planificacion/Planificacion_v2.xlsx) (la v1 se conserva como historial) y el Product Backlog en GitHub Projects.

## Equipo — SB Solutions

| Integrante | Área responsable |
|---|---|
| Christian Marcelo Acuña Gamboa ([@cmacuna7](https://github.com/cmacuna7)) | Backend, datos y cálculo de notas · Scrum Master |
| Abner David Arboleda Roman ([@adarboleda](https://github.com/adarboleda)) | DevSecOps, CI/CD y seguridad |
| Christian Mateo Bonifaz Vásquez ([@cmbonifaz](https://github.com/cmbonifaz)) | Frontend PWA y trabajo sin conexión |

## Datos personales

Este repositorio es público. **No contiene datos reales de estudiantes ni docentes**: los ejemplos usan datos ficticios. Ver [SECURITY.md](SECURITY.md).
