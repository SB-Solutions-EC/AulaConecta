# Selección de tecnologías

**Tarea:** T1022-M · **Responsable:** Christian Marcelo Acuña Gamboa · **Fecha:** 22/10/2026 · **Sprint 3**

> **Actualización v2 (26/10/2026).** El equipo adoptó la planificación v2 ([Planificacion_v2.xlsx](../planificacion/Planificacion_v2.xlsx)) con **3 microservicios**, cada uno con su base de datos. Lo que sigue en este documento (criterios, PostgreSQL, PWA, CI/CD, seguridad y pruebas) se mantiene. Cambia el backend:
>
> | Servicio | Tecnología | Base de datos y migraciones | Responsable del esqueleto |
> |---|---|---|---|
> | ms-identidad (usuarios, roles, JWT) | Spring Boot · Java 21 · Spring Security | `db_identidad` · Flyway | Abner |
> | ms-academico (gestión académica, notas, planificación) | NestJS · TypeScript | `db_academico` · Prisma | Marcelo |
> | ms-notificaciones (avisos por WhatsApp) | FastAPI · Python | `db_notificaciones` · SQLAlchemy + Alembic | Christian |
> | Gateway | Traefik (TLS y límite de peticiones) | — | Abner |
> | Mensajería entre servicios | RabbitMQ (patrón outbox) | — | Christian |
>
> El cálculo de notas (`packages/calculo`) sigue en TypeScript y lo comparten ms-academico y la PWA. El modelo de datos por servicio está en [modelo_datos.md](modelo_datos.md).

## 1. Criterios de selección

Cada tecnología se evaluó con cinco criterios que salen de los requisitos del SRS y de las restricciones del proyecto (sección 6 del Entregable 3):

| Criterio | De dónde sale | Qué se pide |
|---|---|---|
| C1. Cumple los requisitos | RF y RNF del SRS | Resuelve la necesidad sin construir todo desde cero |
| C2. Trabajo sin conexión | RNF-01 | Permite registrar datos sin internet y sincronizar después |
| C3. Seguridad | RNF-04, RNF-12 a RNF-15 | Validación en el servidor, roles, cifrado y herramientas de análisis |
| C4. Costo | Restricción de presupuesto | Gratuita o de código abierto |
| C5. Curva de aprendizaje | Equipo de 3 y 15 semanas | Un solo lenguaje para todo el equipo y documentación abundante |

Escala: 3 = cumple muy bien · 2 = cumple · 1 = cumple con dificultad.

## 2. Decisión principal: un solo lenguaje (TypeScript)

El prototipo validado con el cliente ya está escrito en JavaScript, incluido el motor de cálculo de notas que coincide con la hoja oficial del colegio. Usar **TypeScript** en el servidor y en el navegador permite reutilizar ese cálculo en los dos lados. Así la nota se calcula igual en línea y sin conexión, y los tres integrantes pueden rotar entre backend y frontend sin aprender otro lenguaje.

## 3. Comparación por capa

### Backend (API)

| Opción | C1 | C2 | C3 | C4 | C5 | Total |
|---|---|---|---|---|---|---|
| **NestJS (TypeScript)** | 3 | 3 | 3 | 3 | 3 | **15** |
| Express (JavaScript) | 2 | 3 | 2 | 3 | 3 | 13 |
| Django (Python) | 3 | 1 | 3 | 3 | 2 | 12 |
| Spring Boot (Java) | 3 | 1 | 3 | 3 | 1 | 11 |

**Elegido: NestJS.** Usa TypeScript y comparte el cálculo con el frontend (C2). Trae de fábrica validación de datos, guards para roles y Swagger para documentar la API (C3). Express es más simple, pero obliga a armar a mano la estructura y los controles de seguridad.

### Base de datos

| Opción | C1 | C2 | C3 | C4 | C5 | Total |
|---|---|---|---|---|---|---|
| **PostgreSQL** | 3 | 2 | 3 | 3 | 3 | **14** |
| MySQL | 3 | 2 | 2 | 3 | 3 | 13 |
| MongoDB | 2 | 2 | 2 | 3 | 2 | 11 |

**Elegido: PostgreSQL.** Los datos son relacionales (cursos, materias, matrículas, notas) y las notas exigen consistencia. Tiene transacciones, restricciones de integridad y tipos `JSONB` para guardar las semanas de la planificación sin perder el control del esquema.

### Acceso a datos (ORM)

ORM significa *Object-Relational Mapping*: permite trabajar con la base de datos usando objetos del lenguaje en lugar de escribir SQL a mano.

| Opción | Motivo |
|---|---|
| **Prisma** (elegido) | Esquema único en un archivo, migraciones versionadas y tipos generados para TypeScript. Las consultas parametrizadas evitan la inyección SQL |
| TypeORM | Válido, pero sus migraciones y tipos son menos estrictos |

### Frontend

| Opción | C1 | C2 | C3 | C4 | C5 | Total |
|---|---|---|---|---|---|---|
| **React + Vite (PWA)** | 3 | 3 | 2 | 3 | 3 | **14** |
| Angular | 3 | 2 | 3 | 3 | 1 | 12 |
| Aplicación nativa (Flutter) | 3 | 3 | 2 | 3 | 1 | 12 |
| Mantener HTML + JS del prototipo | 2 | 1 | 1 | 3 | 3 | 10 |

**Elegido: React + Vite como PWA.** Una PWA (*Progressive Web App*) es una página web que se instala como aplicación y funciona sin internet. Respeta la restricción de "sin app nativa" del alcance y cubre el RNF-01. Para el trabajo sin conexión se usan **Workbox**, que guarda la aplicación en caché, y **Dexie**, una capa sobre IndexedDB (la base de datos del navegador) para la cola de cambios. **Tailwind** mantiene el diseño del prototipo que ya aprobó el cliente.

### Contenedores y CI/CD

| Herramienta | Uso | Por qué |
|---|---|---|
| **Docker + docker-compose** | Levantar api, web y base de datos igual en los tres computadores y en el servidor | Evita el "en mi máquina sí funciona" |
| **GitHub Actions** | CI/CD con una etapa por control | Gratis en repositorios públicos e integrado con las reglas de las ramas |
| **Telegram** | Un único mensaje con el progreso del pipeline | Aviso inmediato al equipo sin costo |

### Seguridad y calidad

| Herramienta | Qué revisa |
|---|---|
| Gitleaks | Secretos (claves, tokens) en el código |
| npm audit y Trivy | Dependencias e imágenes con vulnerabilidades conocidas |
| SonarQube Cloud | Calidad y seguridad del código (quality gate) |
| OWASP ZAP | Análisis dinámico de la aplicación en ejecución |

### Pruebas

| Herramienta | Tipo de prueba |
|---|---|
| Jest | Unitarias del backend y del cálculo de notas |
| Vitest | Unitarias de los componentes del frontend |
| Playwright | Extremo a extremo (e2e), incluido el modo sin conexión |
| k6 | Carga: 60 docentes y 400 estudiantes simultáneos (RNF-06) |

### Notificaciones

| Opción | Decisión |
|---|---|
| **WhatsApp Cloud API (Meta)** | Elegida: es el proveedor oficial, tiene número de prueba gratuito para el desarrollo y plantillas aprobadas |
| Proveedores intermediarios (Twilio y otros) | Descartados por costo adicional por mensaje |

Se programa con un **adaptador**: una interfaz común con dos implementaciones, el proveedor real y un proveedor simulado. Así las pruebas no envían mensajes reales y se puede cambiar de proveedor sin tocar el resto del sistema.

## 4. Stack final

| Capa | Tecnología |
|---|---|
| Microservicios | `ms-identidad` (Spring Boot · Java 21) · `ms-academico` (NestJS · TypeScript · Prisma) · `ms-notificaciones` (FastAPI · Python · SQLAlchemy) |
| Base de datos y eventos | PostgreSQL (3 bases: `db_identidad`, `db_academico`, `db_notificaciones`) · RabbitMQ |
| Gateway | Traefik (TLS y límite de peticiones) |
| Frontend | React · Vite · TypeScript · Tailwind · Workbox · Dexie |
| Interfaz y gráficos | Framer Motion (animaciones) · Recharts (gráficos) · lucide-react (íconos); ver [guia_visual.md](guia_visual.md) |
| Código compartido | `packages/calculo` (TypeScript) |
| Contratos API | OpenAPI 3.1 (`openapi/`) |
| Contenedores | Docker · docker-compose · Nginx |
| CI/CD | GitHub Actions · Telegram |
| Seguridad | Gitleaks · Dependency-Check · npm audit · pip-audit · Trivy · SonarQube · OWASP ZAP |
| Pruebas | JUnit 5 · Jest · Vitest · pytest · Playwright · k6 |
| Notificaciones | Web Push · WhatsApp asistido (`wa.me`) · WhatsApp Cloud API (opcional) |

## 5. Estructura del monorepo (T1026-C)

Un **monorepo** es un solo repositorio que agrupa las aplicaciones, microservicios, paquetes compartidos, contratos, infraestructura y pruebas del sistema. Se eligió porque `ms-academico`, la PWA y `packages/calculo` comparten tipos y lógica, los contratos OpenAPI se versionan junto con los servicios y el pipeline de CI/CD verifica todo en conjunto.

```
apps/
  pwa/                   PWA en React + Vite + TypeScript (interfaz por rol y modo sin conexión)
services/
  ms-identidad/          Microservicio de identidad (Spring Boot 4 + Java 21 + Flyway)
  ms-academico/          Microservicio académico (NestJS + TypeScript + Prisma)
  ms-notificaciones/     Microservicio de notificaciones (FastAPI + Python + Alembic)
packages/
  calculo/               Motor de cálculo de notas compartido en TypeScript
openapi/
  ms-identidad.yaml      Contrato OpenAPI 3.1 v0 de ms-identidad
  ms-academico.yaml      Contrato OpenAPI 3.1 v0 de ms-academico
  ms-notificaciones.yaml Contrato OpenAPI 3.1 v0 de ms-notificaciones
infra/                   docker-compose, Traefik, PostgreSQL y despliegue
tests/
  e2e/                   Pruebas extremo a extremo con Playwright
  carga/                 Pruebas de carga y rendimiento con k6
prototipo/               Prototipo navegable con datos ficticios
docs/                    Documentación del proyecto
scripts/                 Scripts de apoyo (backlog y tareas en GitHub)
.github/                 CODEOWNERS, plantilla de PR, rulesets y workflows
```
