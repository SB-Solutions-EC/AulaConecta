# Modelo de datos por servicio v2

**Tarea:** T1026-M · **Responsable:** Christian Marcelo Acuña Gamboa · **Fecha:** 26/10/2026 · **Sprint 3**
**Cambia respecto a la v1 (23/10):** la arquitectura pasó de un solo backend a **3 microservicios** (planificación v2). Cada servicio tiene su propia base de datos y no lee las tablas de los otros.

| Servicio | Tecnología | Base de datos | Modelo de datos |
|---|---|---|---|
| ms-identidad | Spring Boot (Java 21) | `db_identidad` (Flyway) | Abner (T1026-A) |
| **ms-academico** | NestJS (TypeScript) | `db_academico` (Prisma) | Este documento |
| **ms-notificaciones** | FastAPI (Python) | `db_notificaciones` (SQLAlchemy + Alembic) | Este documento |

## 1. Reglas comunes a todas las tablas

| Regla | Para qué | Requisito |
|---|---|---|
| **`id` UUID** generado por quien crea el registro (incluida la PWA sin conexión) | Dos docentes sin internet pueden crear registros a la vez sin chocar en el número de ID; al sincronizar, el ID ya es único | RNF-01 |
| **`version` entero**, que sube en 1 con cada cambio | Base de la sincronización: si llega un cambio hecho sobre una versión vieja, hay conflicto y se resuelve con la regla por campo | RNF-01 |
| `creado_en`, `actualizado_en`, `actualizado_por` | Saber quién cambió qué y cuándo | RNF-09 |
| Referencias a otro servicio solo por UUID, **sin llave foránea** | Cada servicio es dueño de sus datos; las personas se identifican con el `usuario_id` del token emitido por ms-identidad | Arquitectura v2 |
| Borrado lógico (`activo` o `estado`) en lugar de borrar filas | Conservar el historial académico | RNF-09 |

En los diagramas, `ref` marca un UUID que apunta a otro servicio.

## 2. ms-academico (`db_academico`)

```mermaid
erDiagram
    ANIO_LECTIVO ||--o{ CURSO : "organiza"
    ANIO_LECTIVO ||--o{ DIA_NO_DICTADO : "registra"
    CURSO ||--o{ MATRICULA : "recibe"
    PERSONA ||--o{ MATRICULA : "se matricula"
    PERSONA ||--o{ REPRESENTACION : "representa o es representado"
    MATERIA ||--o{ ASIGNACION : "se dicta en"
    CURSO ||--o{ ASIGNACION : "incluye"
    PERSONA ||--o{ ASIGNACION : "dicta"
    ASIGNACION ||--o{ HORARIO : "ocupa"
    ASIGNACION ||--o{ PLANIFICACION : "se planifica"
    PLANIFICACION ||--o{ SEMANA_PLANIFICACION : "contiene"
    PLANIFICACION ||--o{ OBSERVACION : "recibe"
    ASIGNACION ||--o{ CALIFICACION : "califica"
    MATRICULA ||--o{ CALIFICACION : "obtiene"
    ASIGNACION ||--o{ TAREA : "asigna"
    TAREA ||--o{ ENTREGA : "recibe"
    MATRICULA ||--o{ ENTREGA : "realiza"
    ASIGNACION ||--o{ ASISTENCIA : "registra"
    MATRICULA ||--o{ ASISTENCIA : "tiene"
    MATRICULA ||--o{ COMPORTAMIENTO : "tiene"

    PERSONA {
        uuid id PK
        uuid usuario_id UK "ref: ms-identidad"
        string tipo "DOCENTE, ESTUDIANTE, REPRESENTANTE"
        string nombres
        string apellidos
        string area "solo docentes"
        int version
    }
    REPRESENTACION {
        uuid id PK
        uuid estudiante_id FK
        uuid representante_id FK
        string parentesco
        int version
    }
    ANIO_LECTIVO {
        uuid id PK
        string nombre "2026-2027"
        date inicio
        date fin
        boolean activo
        int version
    }
    DIA_NO_DICTADO {
        uuid id PK
        uuid anio_lectivo_id FK
        date fecha
        string motivo "RF-08 (opcional)"
        int version
    }
    CURSO {
        uuid id PK
        uuid anio_lectivo_id FK
        string nivel
        string paralelo
        int version
    }
    MATERIA {
        uuid id PK
        string nombre
        string area
        int version
    }
    ASIGNACION {
        uuid id PK
        uuid docente_id FK
        uuid materia_id FK
        uuid curso_id FK
        int version
    }
    HORARIO {
        uuid id PK
        uuid asignacion_id FK
        int dia "1 a 5"
        string hora "h1 a h5"
        int version
    }
    MATRICULA {
        uuid id PK
        uuid estudiante_id FK
        uuid curso_id FK
        string estado "ACTIVA, RETIRADA"
        int version
    }
    PLANIFICACION {
        uuid id PK
        uuid asignacion_id FK
        int unidad
        string titulo
        string estado "BORRADOR, EN_REVISION, APROBADA, CON_OBSERVACIONES"
        jsonb datos_informativos
        datetime enviada_en
        datetime revisada_en
        int version "documento único con historial (RF-14)"
    }
    SEMANA_PLANIFICACION {
        uuid id PK
        uuid planificacion_id FK
        int numero
        date inicio
        date fin
        jsonb contenido "destrezas, ERCA, recursos, indicador"
        int version
    }
    OBSERVACION {
        uuid id PK
        uuid planificacion_id FK
        uuid autor_usuario_id "ref: ms-identidad"
        string campo "RF-13"
        string texto
        boolean resuelta
        int version
    }
    CALIFICACION {
        uuid id PK
        uuid asignacion_id FK
        uuid matricula_id FK
        int trimestre
        jsonb aportes_bloque1
        jsonb aportes_bloque2
        decimal refuerzo
        decimal nota_proyecto
        decimal nota_examen
        decimal nota_final "packages/calculo, truncada a 2 decimales"
        string cualitativo "A+ a E-"
        int version
    }
    TAREA {
        uuid id PK
        uuid asignacion_id FK
        string tipo "TAREA, PRUEBA, PROYECTO"
        string titulo
        date fecha_entrega
        string enlace_recurso
        int version
    }
    ENTREGA {
        uuid id PK
        uuid tarea_id FK
        uuid matricula_id FK
        decimal nota
        string retroalimentacion
        int version
    }
    ASISTENCIA {
        uuid id PK
        uuid asignacion_id FK
        uuid matricula_id FK
        date fecha
        string estado "PRESENTE, FALTA, ATRASO, JUSTIFICADA"
        string justificacion
        int version
    }
    COMPORTAMIENTO {
        uuid id PK
        uuid matricula_id FK
        int trimestre
        jsonb indicadores "9 indicadores"
        decimal nota
        string cualitativo
        int version
    }
```

Tablas de soporte de ms-academico (sin relaciones en el diagrama para no saturarlo):

| Tabla | Para qué | Requisito |
|---|---|---|
| `PARAMETRO` | Ponderaciones, escalas y textos de comportamiento editables por el administrador | RNF-10 |
| `AUDITORIA` | Quién cambió qué, con valor anterior y nuevo | RNF-09 |
| `OUTBOX` | Eventos pendientes de publicar en RabbitMQ (`promedio_bajo`, `falta_registrada`). Se escriben en la **misma transacción** que el cambio, así no se pierde ningún aviso aunque RabbitMQ esté caído | RF-30, RF-31, RF-35 |
| `CAMBIO_SINCRONIZADO` | Registro de cada cambio recibido desde la PWA, con su clave de idempotencia: el mismo cambio enviado dos veces se guarda una sola vez | RNF-01 |

## 3. ms-notificaciones (`db_notificaciones`)

```mermaid
erDiagram
    CONTACTO ||--o{ NOTIFICACION : "recibe"
    PLANTILLA ||--o{ NOTIFICACION : "da formato a"
    EVENTO_RECIBIDO ||--o| NOTIFICACION : "genera"

    CONTACTO {
        uuid id PK
        uuid representante_id "ref: ms-academico PERSONA"
        uuid estudiante_id "ref: ms-academico PERSONA"
        string whatsapp "formato E.164, verificado"
        boolean autoriza_avisos "consentimiento (RF-29, RNF-05)"
        datetime fecha_autorizacion
        datetime fecha_baja "el representante deja de recibir avisos"
        int version
    }
    PLANTILLA {
        uuid id PK
        string codigo UK "CONFIRMACION_AUTORIZACION, PROMEDIO_BAJO, FALTA_SIN_JUSTIFICAR"
        string nombre_meta "plantilla aprobada por WhatsApp"
        string idioma
        boolean activa
        int version
    }
    EVENTO_RECIBIDO {
        uuid id PK "id del evento publicado por ms-academico"
        string tipo
        jsonb datos "sin notas detalladas ni datos de otros estudiantes"
        datetime recibido_en
        boolean procesado
    }
    NOTIFICACION {
        uuid id PK
        uuid contacto_id FK
        uuid plantilla_id FK
        uuid evento_id FK
        string motivo "CONFIRMACION_AUTORIZACION, PROMEDIO_BAJO, FALTA_SIN_JUSTIFICAR"
        string clave_antiduplicado UK "contacto + motivo + periodo (RF-34)"
        string estado "EN_COLA, ENVIADA, ENTREGADA, FALLIDA"
        int intentos
        string id_mensaje_proveedor
        datetime creada_en
        datetime enviada_en
        int version
    }
```

## 4. Cómo viaja un aviso entre los dos servicios

```mermaid
sequenceDiagram
    participant D as Docente (PWA)
    participant A as ms-academico
    participant Q as RabbitMQ
    participant N as ms-notificaciones
    participant W as WhatsApp Cloud API
    D->>A: Registra nota o falta
    A->>A: Guarda el cambio y el evento en OUTBOX (misma transacción)
    A->>Q: Publica promedio_bajo / falta_registrada
    Q->>N: Entrega el evento
    N->>N: EVENTO_RECIBIDO evita procesarlo dos veces
    N->>N: Busca CONTACTO autorizado y arma la clave antiduplicado
    N->>W: Envía la plantilla aprobada
    W-->>N: Estado de entrega
    N->>N: Actualiza NOTIFICACION (historial, RF-33)
```

## 5. Decisiones

| Decisión | Motivo |
|---|---|
| Docentes, estudiantes y representantes se modelan como `PERSONA` en ms-academico, ligada al `usuario_id` de ms-identidad | ms-identidad solo guarda credenciales y roles; los datos académicos no salen de ms-academico |
| El número de WhatsApp y el consentimiento viven en ms-notificaciones | Solo el servicio que envía mensajes ve los teléfonos (principio de mínimo privilegio, RNF-04) |
| Patrón *outbox* + tabla de eventos recibidos | Garantiza que cada aviso se envíe una sola vez aunque fallen la red o RabbitMQ (RF-34, RF-35) |
| `CALIFICACION` guarda la nota final ya calculada | Se calcula con `packages/calculo` al guardar; los reportes no recalculan (RNF-02) |
| Calificaciones, asistencia y comportamiento cuelgan de `MATRICULA` | Conservan el historial si el estudiante cambia de curso o se retira (RF-24) |

## 6. En qué sprint se crea cada tabla

| Sprint | ms-academico | ms-notificaciones |
|---|---|---|
| 3 (28/10) | ANIO_LECTIVO, CURSO, MATERIA, MATRICULA (migración inicial) | Base vacía con Alembic |
| 4 | PERSONA, REPRESENTACION, ASIGNACION, HORARIO, DIA_NO_DICTADO, AUDITORIA | — |
| 5 | CALIFICACION, TAREA, ENTREGA, ASISTENCIA, COMPORTAMIENTO, PARAMETRO, OUTBOX | — |
| 7 | PLANIFICACION, SEMANA_PLANIFICACION, OBSERVACION | — |
| 8 | — | CONTACTO, PLANTILLA, EVENTO_RECIBIDO, NOTIFICACION |
| 9 | CAMBIO_SINCRONIZADO | — |
