# C4: contexto y contenedores

**Proyecto:** AulaConecta  
**Versión:** arquitectura inicial v2  
**Fecha:** 26/10/2026

## Alcance

AulaConecta permite al personal docente y administrativo gestionar
planificaciones, calificaciones, asistencia y avisos a representantes. La PWA
debe seguir permitiendo registrar notas y asistencia cuando la conectividad es
intermitente; los cambios se sincronizan cuando vuelve la red.

Los diagramas representan la arquitectura acordada en
[seleccion_tecnologias.md](../seleccion_tecnologias.md) y
[modelo_datos.md](../modelo_datos.md): tres microservicios, una base por
servicio, Gateway, RabbitMQ y el paquete compartido de cálculo.

## Nivel 1: contexto del sistema

```mermaid
C4Context
    title AulaConecta - Diagrama de contexto

    Person(admin, "Administrador", "Configura parámetros, revisa planificaciones y consulta indicadores.")
    Person(secretaria, "Secretaría", "Gestiona matrículas, nóminas y avisos asistidos.")
    Person(docente, "Docente", "Registra planificación, calificaciones y asistencia; trabaja offline.")
    Person(estudiante, "Estudiante", "Consulta calificaciones, tareas y asistencia.")
    Person(representante, "Representante", "Consulta información del representado y recibe avisos.")

    System(aula, "AulaConecta", "Plataforma académica web instalable para gestión institucional, trabajo offline y notificaciones.")

    System_Ext(whatsapp, "WhatsApp Cloud API", "Canal opcional para avisos automáticos mediante plantillas aprobadas.")
    System_Ext(telegram, "Telegram", "Canal operativo para avisos del CI/CD al equipo.")
    System_Ext(sonarqube, "SonarQube local", "Analiza calidad y seguridad del código durante el CI.")

    Rel(admin, aula, "Administra y revisa", "HTTPS/PWA")
    Rel(secretaria, aula, "Gestiona y consulta", "HTTPS/PWA")
    Rel(docente, aula, "Registra y sincroniza datos", "HTTPS/PWA")
    Rel(estudiante, aula, "Consulta información", "HTTPS/PWA")
    Rel(representante, aula, "Consulta y recibe avisos", "HTTPS/Web Push")

    Rel(aula, whatsapp, "Envía avisos opcionales", "HTTPS/API")
    Rel(aula, telegram, "Notifica resultados del CI", "HTTPS/Bot API")
    Rel(aula, sonarqube, "Publica análisis de calidad", "Scanner/API local")
```

### Límites del sistema

- Los usuarios interactúan con AulaConecta mediante la PWA; no conocen las
  bases de datos ni la mensajería interna.
- WhatsApp Cloud API es opcional: el nivel gratuito principal es Web Push y
  el canal asistido abre un mensaje preparado para que lo envíe una persona.
- Telegram y SonarQube pertenecen a la operación del proyecto, no al dominio
  académico ni al almacenamiento de datos de estudiantes.
- Los datos reales de estudiantes no se incluyen en el repositorio ni en
  Telegram.

## Nivel 2: contenedores

```mermaid
C4Container
    title AulaConecta - Diagrama de contenedores

    Person(user, "Usuario", "Administrador, secretaría, docente, estudiante o representante")

    System_Boundary(aula, "AulaConecta") {
        Container(pwa, "PWA web", "React + Vite + TypeScript, Workbox, Dexie/IndexedDB", "Interfaz por rol, caché offline, cola local y sincronización.")
        Container(gateway, "Gateway", "Traefik", "TLS, límite de peticiones y enrutamiento hacia los servicios.")

        Container(identity, "ms-identidad", "Spring Boot + Java 21 + Spring Security", "Usuarios, roles, autenticación y emisión/validación de JWT.")
        ContainerDb(identityDb, "db_identidad", "PostgreSQL + Flyway", "Credenciales, roles y sesiones según el contrato de identidad.")

        Container(academic, "ms-academico", "NestJS + TypeScript + Prisma", "Planificaciones, cursos, matrículas, calificaciones, asistencia, auditoría y sincronización académica.")
        ContainerDb(academicDb, "dbAcademico", "PostgreSQL + Prisma", "Datos académicos; incluye OUTBOX y CAMBIO_SINCRONIZADO.")

        Container(notifications, "ms-notificaciones", "FastAPI + Python + SQLAlchemy/Alembic", "Consentimientos, Web Push y avisos por WhatsApp.")
        ContainerDb(notificationsDb, "dbNotificaciones", "PostgreSQL + Alembic", "Contactos, plantillas, eventos recibidos y notificaciones.")

        Container(queue, "Bus de eventos", "RabbitMQ", "Entrega eventos de dominio publicados mediante el patrón outbox.")
        Container(calculation, "Paquete de cálculo", "TypeScript compartido", "Calcula nota final y valoración de logros de forma consistente en PWA y ms-academico.")
    }

    System_Ext(push, "Web Push", "Notificaciones del navegador.")
    System_Ext(whatsapp, "WhatsApp Cloud API", "Canal opcional de pago.")

    Rel(user, pwa, "Usa", "HTTPS / PWA")
    Rel(pwa, gateway, "Consume API y sincroniza cambios", "HTTPS + JWT")
    Rel(gateway, identity, "Enruta autenticación", "HTTP interno")
    Rel(gateway, academic, "Enruta operaciones académicas", "HTTP interno")
    Rel(gateway, notifications, "Enruta preferencias y avisos", "HTTP interno")

    Rel(identity, identityDb, "Lee y escribe", "SQL")
    Rel(academic, academicDb, "Lee y escribe", "SQL")
    Rel(notifications, notificationsDb, "Lee y escribe", "SQL")
    Rel(academic, queue, "Publica eventos desde OUTBOX", "AMQP")
    Rel(queue, notifications, "Entrega eventos", "AMQP")
    Rel(pwa, calculation, "Calcula notas offline", "Importación TS")
    Rel(academic, calculation, "Calcula notas al guardar", "Importación TS")
    Rel(notifications, push, "Envía avisos nivel 1", "Web Push")
    Rel(notifications, whatsapp, "Envía avisos nivel 3 si está habilitado", "HTTPS/API")
```

## Reglas de comunicación y propiedad de datos

1. La PWA solo consume el Gateway; nunca conecta directamente con PostgreSQL o
   RabbitMQ.
2. Cada microservicio es dueño de su base. Las referencias entre servicios son
   UUID, no claves foráneas cruzadas.
3. `ms-academico` publica eventos en su `OUTBOX` dentro de la misma transacción
   que el cambio académico. Un publicador posterior los entrega a RabbitMQ.
4. `ms-notificaciones` registra `EVENTO_RECIBIDO` antes de procesarlo para
   evitar duplicados.
5. El JWT identifica al usuario y sus roles; la autorización se aplica en el
   servicio dueño del recurso, no solo en la PWA.
6. El paquete de cálculo no es un servicio ni una base de datos: es una
   dependencia compartida versionada con el monorepo.

## Flujos principales

### Registro académico online

```mermaid
sequenceDiagram
    actor D as Docente
    participant P as PWA
    participant G as Gateway
    participant A as ms-academico
    participant DB as db_academico

    D->>P: Registra nota o asistencia
    P->>G: Envía operación con JWT e idempotency key
    G->>A: Enruta la solicitud
    A->>DB: Valida versión y guarda cambio
    A-->>G: Devuelve recurso y nueva versión
    G-->>P: Confirma sincronización
    P-->>D: Muestra estado "Sincronizado"
```

### Evento de bajo rendimiento o falta

```mermaid
sequenceDiagram
    participant A as ms-academico
    participant O as OUTBOX
    participant R as RabbitMQ
    participant N as ms-notificaciones
    participant C as db_notificaciones
    participant P as Web Push / WhatsApp

    A->>O: Guarda cambio y evento en la misma transacción
    O->>R: Publica evento pendiente
    R->>N: Entrega evento
    N->>C: Registra EVENTO_RECIBIDO
    N->>C: Crea NOTIFICACION con clave antiduplicado
    N->>P: Envía según canal habilitado
    N->>C: Actualiza estado e historial
```

## Decisiones pendientes de implementación

- Definir contratos exactos de sincronización (`GET /sync/pull` y
  `POST /sync/push`) junto con los contratos OpenAPI de cada servicio.
- Registrar el dispositivo y la versión de esquema de la PWA para controlar
  migraciones de IndexedDB.
- Definir límites de tamaño y retención para la cola local.
- Implementar el publicador de `OUTBOX` y reintentos con backoff.
