/*==============================================================*/
/* Base de datos: AulaConecta (U. E. "Andoas")                  */
/* DBMS: MySQL 5.0  ·  Uso: ingeniería inversa en PowerDesigner */
/* Claves primarias: código hexadecimal único CHAR(32)          */
/* (UUID v4 sin guiones) generado por la aplicación.            */
/* Generado: 2026-11-12                                         */
/*==============================================================*/

drop database if exists aulaconecta;
create database aulaconecta default character set utf8 collate utf8_spanish_ci;
use aulaconecta;

/*==============================================================*/
/* Tabla: persona                                              */
/*==============================================================*/
create table persona
(
   id_persona                   char(32)       not null comment 'Código hexadecimal único de persona (UUID v4 sin guiones). Lo genera la aplicación, también sin conexión.',
   cedula                       varchar(10)    not null comment 'Número de cédula ecuatoriana.',
   nombres                      varchar(80)    not null comment 'Nombres de la persona.',
   apellidos                    varchar(80)    not null comment 'Apellidos de la persona.',
   fecha_nacimiento             date           null comment 'Fecha de nacimiento.',
   sexo                         char(1)        null comment 'Sexo registrado.',
   telefono                     varchar(10)    null comment 'Teléfono de contacto general.',
   correo                       varchar(120)   null comment 'Correo electrónico.',
   direccion                    varchar(200)   null comment 'Dirección domiciliaria.',
   activo                       tinyint(1)     not null default 1 comment 'Borrado lógico: 1 activo, 0 inactivo.',
   version                      int            not null default 1 comment 'Versión del registro; sube en 1 con cada cambio. Base de la sincronización sin conexión.',
   creado_en                    datetime       not null comment 'Fecha y hora de creación.',
   actualizado_en               datetime       null comment 'Fecha y hora de la última modificación.',
   primary key (id_persona),
   unique key uk_persona_cedula (cedula),
   unique key uk_persona_correo (correo)
)
engine = InnoDB
default charset = utf8
comment = 'Datos personales de toda persona del colegio: docentes, estudiantes, representantes, secretaría y autoridades.';

/*==============================================================*/
/* Tabla: usuario                                              */
/*==============================================================*/
create table usuario
(
   id_usuario                   char(32)       not null comment 'Código hexadecimal único de usuario (UUID v4 sin guiones). Lo genera la aplicación, también sin conexión.',
   id_persona                   char(32)       not null comment 'Persona dueña de la cuenta. Único: una persona tiene una sola cuenta (relación 1 a 1).',
   nombre_usuario               varchar(60)    not null comment 'Usuario de ingreso: nombre.apellido y un número si ya existe (RF-02).',
   password_hash                varchar(255)   null comment 'Hash seguro de la contraseña (Argon2id). Nunca se almacena en texto plano. Nulo hasta activar la cuenta.',
   clave_temporal_hash          varchar(255)   null comment 'Hash de la clave temporal aleatoria de un solo uso (RF-03).',
   vence_clave_temporal         datetime       null comment 'Vencimiento de la clave temporal: 72 horas después de generarla (RN-13).',
   debe_cambiar_clave           tinyint(1)     not null default 1 comment 'Obliga a crear la contraseña en el primer ingreso.',
   intentos_fallidos            tinyint        not null default 0 comment 'Intentos fallidos seguidos; se reinicia al ingresar.',
   bloqueado_hasta              datetime       null comment 'Fin del bloqueo de 15 minutos tras 3 intentos fallidos (RNF-12).',
   ultimo_acceso                datetime       null comment 'Fecha y hora del último ingreso.',
   estado                       varchar(15)    not null comment 'Estado de la cuenta.',
   version                      int            not null default 1 comment 'Versión del registro; sube en 1 con cada cambio. Base de la sincronización sin conexión.',
   creado_en                    datetime       not null comment 'Fecha y hora de creación.',
   actualizado_en               datetime       null comment 'Fecha y hora de la última modificación.',
   primary key (id_usuario),
   unique key uk_usuario_id_persona (id_persona),
   unique key uk_usuario_nombre_usuario (nombre_usuario)
)
engine = InnoDB
default charset = utf8
comment = 'Cuenta de acceso de una persona: usuario y contraseña. Relación 1 a 1 con persona.';

/*==============================================================*/
/* Tabla: rol                                                  */
/*==============================================================*/
create table rol
(
   id_rol                       char(32)       not null comment 'Código hexadecimal único de rol (UUID v4 sin guiones). Lo genera la aplicación, también sin conexión.',
   codigo                       varchar(20)    not null comment 'Código del rol.',
   nombre                       varchar(50)    not null comment 'Nombre visible del rol.',
   descripcion                  varchar(200)   null comment 'Qué puede hacer el rol.',
   estado                       varchar(10)    not null default 'ACTIVO' comment 'Disponibilidad del rol.',
   version                      int            not null default 1 comment 'Versión del registro; sube en 1 con cada cambio. Base de la sincronización sin conexión.',
   creado_en                    datetime       not null comment 'Fecha y hora de creación.',
   actualizado_en               datetime       null comment 'Fecha y hora de la última modificación.',
   primary key (id_rol),
   unique key uk_rol_codigo (codigo)
)
engine = InnoDB
default charset = utf8
comment = 'Catálogo de los cinco roles del sistema. Los permisos de cada rol siguen la matriz de permisos del Taller 2.';

/*==============================================================*/
/* Tabla: usuario_rol                                          */
/*==============================================================*/
create table usuario_rol
(
   id_usuario_rol               char(32)       not null comment 'Código hexadecimal único de usuario rol (UUID v4 sin guiones). Lo genera la aplicación, también sin conexión.',
   id_usuario                   char(32)       not null comment 'Usuario al que se asigna el rol.',
   id_rol                       char(32)       not null comment 'Rol asignado.',
   fecha_asignacion             datetime       not null comment 'Fecha y hora de la asignación.',
   estado                       varchar(10)    not null default 'ACTIVO' comment 'Vigencia de la asignación; al retirar un rol no se borra la fila.',
   primary key (id_usuario_rol),
   unique key uk_usuario_rol_1 (id_usuario, id_rol)
)
engine = InnoDB
default charset = utf8
comment = 'Tabla intermedia de la relación muchos a muchos entre usuario y rol.';

/*==============================================================*/
/* Tabla: anio_lectivo                                         */
/*==============================================================*/
create table anio_lectivo
(
   id_anio_lectivo              char(32)       not null comment 'Código hexadecimal único de anio lectivo (UUID v4 sin guiones). Lo genera la aplicación, también sin conexión.',
   nombre                       varchar(20)    not null comment 'Nombre del año lectivo.',
   fecha_inicio                 date           not null comment 'Inicio de clases.',
   fecha_fin                    date           not null comment 'Fin de clases.',
   activo                       tinyint(1)     not null default 0 comment 'Año en curso.',
   version                      int            not null default 1 comment 'Versión del registro; sube en 1 con cada cambio. Base de la sincronización sin conexión.',
   creado_en                    datetime       not null comment 'Fecha y hora de creación.',
   actualizado_en               datetime       null comment 'Fecha y hora de la última modificación.',
   primary key (id_anio_lectivo),
   unique key uk_anio_lectivo_nombre (nombre)
)
engine = InnoDB
default charset = utf8
comment = 'Año escolar con sus fechas.';

/*==============================================================*/
/* Tabla: periodo                                              */
/*==============================================================*/
create table periodo
(
   id_periodo                   char(32)       not null comment 'Código hexadecimal único de periodo (UUID v4 sin guiones). Lo genera la aplicación, también sin conexión.',
   id_anio_lectivo              char(32)       not null comment 'Año lectivo al que pertenece.',
   numero                       tinyint        not null comment 'Número de trimestre.',
   fecha_inicio                 date           not null comment 'Inicio del trimestre.',
   fecha_fin                    date           not null comment 'Fin del trimestre.',
   cerrado                      tinyint(1)     not null default 0 comment 'Al cerrarse se bloquean las notas (RN-18).',
   version                      int            not null default 1 comment 'Versión del registro; sube en 1 con cada cambio. Base de la sincronización sin conexión.',
   creado_en                    datetime       not null comment 'Fecha y hora de creación.',
   actualizado_en               datetime       null comment 'Fecha y hora de la última modificación.',
   primary key (id_periodo),
   unique key uk_periodo_1 (id_anio_lectivo, numero)
)
engine = InnoDB
default charset = utf8
comment = 'Trimestre del año lectivo.';

/*==============================================================*/
/* Tabla: curso                                                */
/*==============================================================*/
create table curso
(
   id_curso                     char(32)       not null comment 'Código hexadecimal único de curso (UUID v4 sin guiones). Lo genera la aplicación, también sin conexión.',
   id_anio_lectivo              char(32)       not null comment 'Año lectivo del curso.',
   id_tutor                     char(32)       null comment 'Docente tutor del curso.',
   nivel                        varchar(20)    not null comment 'Nivel o grado.',
   paralelo                     char(1)        not null comment 'Paralelo.',
   version                      int            not null default 1 comment 'Versión del registro; sube en 1 con cada cambio. Base de la sincronización sin conexión.',
   creado_en                    datetime       not null comment 'Fecha y hora de creación.',
   actualizado_en               datetime       null comment 'Fecha y hora de la última modificación.',
   primary key (id_curso),
   unique key uk_curso_1 (id_anio_lectivo, nivel, paralelo)
)
engine = InnoDB
default charset = utf8
comment = 'Curso y paralelo de un año lectivo.';

/*==============================================================*/
/* Tabla: materia                                              */
/*==============================================================*/
create table materia
(
   id_materia                   char(32)       not null comment 'Código hexadecimal único de materia (UUID v4 sin guiones). Lo genera la aplicación, también sin conexión.',
   codigo                       varchar(10)    not null comment 'Código corto de la asignatura.',
   nombre                       varchar(80)    not null comment 'Nombre de la asignatura.',
   area                         varchar(60)    null comment 'Área de conocimiento.',
   version                      int            not null default 1 comment 'Versión del registro; sube en 1 con cada cambio. Base de la sincronización sin conexión.',
   creado_en                    datetime       not null comment 'Fecha y hora de creación.',
   actualizado_en               datetime       null comment 'Fecha y hora de la última modificación.',
   primary key (id_materia),
   unique key uk_materia_codigo (codigo)
)
engine = InnoDB
default charset = utf8
comment = 'Catálogo de asignaturas.';

/*==============================================================*/
/* Tabla: asignacion                                           */
/*==============================================================*/
create table asignacion
(
   id_asignacion                char(32)       not null comment 'Código hexadecimal único de asignacion (UUID v4 sin guiones). Lo genera la aplicación, también sin conexión.',
   id_docente                   char(32)       not null comment 'Docente que dicta la materia.',
   id_materia                   char(32)       not null comment 'Materia dictada.',
   id_curso                     char(32)       not null comment 'Curso donde se dicta.',
   horario_resumen              varchar(150)   null comment 'Días y horas de clase semanales (RF-37).',
   version                      int            not null default 1 comment 'Versión del registro; sube en 1 con cada cambio. Base de la sincronización sin conexión.',
   creado_en                    datetime       not null comment 'Fecha y hora de creación.',
   actualizado_en               datetime       null comment 'Fecha y hora de la última modificación.',
   primary key (id_asignacion),
   unique key uk_asignacion_1 (id_materia, id_curso)
)
engine = InnoDB
default charset = utf8
comment = 'Tabla intermedia muchos a muchos entre docente (persona), materia y curso: quién dicta qué materia en qué curso, con su horario.';

/*==============================================================*/
/* Tabla: matricula                                            */
/*==============================================================*/
create table matricula
(
   id_matricula                 char(32)       not null comment 'Código hexadecimal único de matricula (UUID v4 sin guiones). Lo genera la aplicación, también sin conexión.',
   id_estudiante                char(32)       not null comment 'Estudiante matriculado.',
   id_curso                     char(32)       not null comment 'Curso en el que se matricula.',
   codigo_matricula             varchar(15)    not null comment 'Código visible de la matrícula.',
   fecha_matricula              date           not null comment 'Fecha de matrícula.',
   estado                       varchar(10)    not null comment 'Estado de la matrícula.',
   version                      int            not null default 1 comment 'Versión del registro; sube en 1 con cada cambio. Base de la sincronización sin conexión.',
   creado_en                    datetime       not null comment 'Fecha y hora de creación.',
   actualizado_en               datetime       null comment 'Fecha y hora de la última modificación.',
   primary key (id_matricula),
   unique key uk_matricula_codigo_matricula (codigo_matricula),
   unique key uk_matricula_1 (id_estudiante, id_curso)
)
engine = InnoDB
default charset = utf8
comment = 'Tabla intermedia muchos a muchos entre estudiante (persona) y curso.';

/*==============================================================*/
/* Tabla: representacion                                       */
/*==============================================================*/
create table representacion
(
   id_representacion            char(32)       not null comment 'Código hexadecimal único de representacion (UUID v4 sin guiones). Lo genera la aplicación, también sin conexión.',
   id_representante             char(32)       not null comment 'Padre, madre o tutor legal.',
   id_estudiante                char(32)       not null comment 'Estudiante representado.',
   parentesco                   varchar(20)    not null comment 'Relación con el estudiante.',
   es_principal                 tinyint(1)     not null default 0 comment 'Representante principal para avisos.',
   telefono_whatsapp            varchar(10)    null comment 'Celular para avisos por WhatsApp (RF-29); puede faltar.',
   verificado                   tinyint(1)     not null default 0 comment 'Número confirmado por la secretaría.',
   autoriza_avisos              tinyint(1)     not null default 0 comment 'Autorización firmada para recibir avisos (RN-06).',
   fecha_autorizacion           datetime       null comment 'Fecha en que firmó la autorización.',
   fecha_baja                   datetime       null comment 'Fecha en que pidió no recibir avisos (RNF-05).',
   version                      int            not null default 1 comment 'Versión del registro; sube en 1 con cada cambio. Base de la sincronización sin conexión.',
   creado_en                    datetime       not null comment 'Fecha y hora de creación.',
   actualizado_en               datetime       null comment 'Fecha y hora de la última modificación.',
   primary key (id_representacion),
   unique key uk_representacion_1 (id_representante, id_estudiante)
)
engine = InnoDB
default charset = utf8
comment = 'Tabla intermedia muchos a muchos entre representante y estudiante (ambos persona). Guarda también el celular y la autorización de avisos de ese representante para ese estudiante.';

/*==============================================================*/
/* Tabla: planificacion                                        */
/*==============================================================*/
create table planificacion
(
   id_planificacion             char(32)       not null comment 'Código hexadecimal único de planificacion (UUID v4 sin guiones). Lo genera la aplicación, también sin conexión.',
   id_asignacion                char(32)       not null comment 'Materia y curso planificados.',
   id_periodo                   char(32)       not null comment 'Trimestre de la planificación.',
   id_revisor                   char(32)       null comment 'Usuario que aprobó o devolvió.',
   unidad                       tinyint        not null comment 'Número de unidad didáctica.',
   titulo                       varchar(150)   not null comment 'Título de la unidad.',
   objetivos                    text           null comment 'Objetivos de aprendizaje (formato del Ministerio).',
   ejes_transversales           text           null comment 'Ejes transversales (formato del Ministerio).',
   estandar                     text           null comment 'Estándar de aprendizaje (formato del Ministerio).',
   adaptaciones_dua             text           null comment 'Adaptaciones curriculares (DUA).',
   estado                       varchar(20)    not null comment 'Estado de revisión (RF-10).',
   enviada_en                   datetime       null comment 'Envío a revisión.',
   revisada_en                  datetime       null comment 'Aprobación o devolución.',
   version                      int            not null default 1 comment 'Versión del registro; sube en 1 con cada cambio. Base de la sincronización sin conexión.',
   creado_en                    datetime       not null comment 'Fecha y hora de creación.',
   actualizado_en               datetime       null comment 'Fecha y hora de la última modificación.',
   primary key (id_planificacion),
   unique key uk_planificacion_1 (id_asignacion, id_periodo, unidad)
)
engine = InnoDB
default charset = utf8
comment = 'Planificación microcurricular (PUD) de una unidad, con su estado de revisión.';

/*==============================================================*/
/* Tabla: semana_planificacion                                 */
/*==============================================================*/
create table semana_planificacion
(
   id_semana_planificacion      char(32)       not null comment 'Código hexadecimal único de semana planificacion (UUID v4 sin guiones). Lo genera la aplicación, también sin conexión.',
   id_planificacion             char(32)       not null comment 'Planificación a la que pertenece.',
   numero                       tinyint        not null comment 'Número de semana.',
   fecha_inicio                 date           not null comment 'Inicio de la semana.',
   fecha_fin                    date           not null comment 'Fin de la semana.',
   destrezas                    text           null comment 'Destrezas con criterio de desempeño.',
   actividades_erca             text           null comment 'Experiencia, reflexión, conceptualización y aplicación.',
   recursos                     text           null comment 'Recursos e indicadores de evaluación.',
   version                      int            not null default 1 comment 'Versión del registro; sube en 1 con cada cambio. Base de la sincronización sin conexión.',
   creado_en                    datetime       not null comment 'Fecha y hora de creación.',
   actualizado_en               datetime       null comment 'Fecha y hora de la última modificación.',
   primary key (id_semana_planificacion),
   unique key uk_semana_planificacion_1 (id_planificacion, numero)
)
engine = InnoDB
default charset = utf8
comment = 'Semana de la tabla ERCA de una planificación.';

/*==============================================================*/
/* Tabla: observacion                                          */
/*==============================================================*/
create table observacion
(
   id_observacion               char(32)       not null comment 'Código hexadecimal único de observacion (UUID v4 sin guiones). Lo genera la aplicación, también sin conexión.',
   id_planificacion             char(32)       not null comment 'Planificación observada.',
   id_semana_planificacion      char(32)       null comment 'Semana observada, si aplica.',
   id_autor                     char(32)       not null comment 'Usuario que registró la observación.',
   ronda                        tinyint        not null comment 'Número de revisión en que se hizo (1, 2, 3…).',
   campo                        varchar(60)    not null comment 'Campo observado.',
   texto                        text           not null comment 'Texto de la observación.',
   resuelta                     tinyint(1)     not null default 0 comment 'Corregida por el docente.',
   version                      int            not null default 1 comment 'Versión del registro; sube en 1 con cada cambio. Base de la sincronización sin conexión.',
   creado_en                    datetime       not null comment 'Fecha y hora de creación.',
   actualizado_en               datetime       null comment 'Fecha y hora de la última modificación.',
   primary key (id_observacion)
)
engine = InnoDB
default charset = utf8
comment = 'Observación del vicerrector ligada a un campo o semana (RF-13). Las rondas forman el historial de revisiones (RF-14).';

/*==============================================================*/
/* Tabla: tarea                                                */
/*==============================================================*/
create table tarea
(
   id_tarea                     char(32)       not null comment 'Código hexadecimal único de tarea (UUID v4 sin guiones). Lo genera la aplicación, también sin conexión.',
   id_asignacion                char(32)       not null comment 'Materia y curso de la actividad.',
   id_periodo                   char(32)       not null comment 'Trimestre.',
   tipo                         varchar(15)    not null comment 'Tipo de actividad, alineado a los aportes de la hoja oficial.',
   bloque                       tinyint        null comment 'Bloque de aportes al que suma; nulo si no es aporte.',
   titulo                       varchar(150)   not null comment 'Título.',
   descripcion                  text           null comment 'Indicaciones.',
   fecha_entrega                date           not null comment 'Fecha límite.',
   enlace_recurso               varchar(255)   null comment 'Enlace de apoyo (no se suben archivos pesados).',
   version                      int            not null default 1 comment 'Versión del registro; sube en 1 con cada cambio. Base de la sincronización sin conexión.',
   creado_en                    datetime       not null comment 'Fecha y hora de creación.',
   actualizado_en               datetime       null comment 'Fecha y hora de la última modificación.',
   primary key (id_tarea)
)
engine = InnoDB
default charset = utf8
comment = 'Actividad evaluable con fecha de entrega (RF-19). Si tiene bloque, cuenta como aporte del trimestre (RF-17).';

/*==============================================================*/
/* Tabla: entrega                                              */
/*==============================================================*/
create table entrega
(
   id_entrega                   char(32)       not null comment 'Código hexadecimal único de entrega (UUID v4 sin guiones). Lo genera la aplicación, también sin conexión.',
   id_tarea                     char(32)       not null comment 'Actividad.',
   id_matricula                 char(32)       not null comment 'Estudiante matriculado.',
   estado                       varchar(12)    not null comment 'Estado de la entrega.',
   nota                         decimal(4,2)   null comment 'Nota de la actividad; vacía no entra al promedio (RN-01).',
   retroalimentacion            text           null comment 'Comentario del docente.',
   version                      int            not null default 1 comment 'Versión del registro; sube en 1 con cada cambio. Base de la sincronización sin conexión.',
   creado_en                    datetime       not null comment 'Fecha y hora de creación.',
   actualizado_en               datetime       null comment 'Fecha y hora de la última modificación.',
   primary key (id_entrega),
   unique key uk_entrega_1 (id_tarea, id_matricula)
)
engine = InnoDB
default charset = utf8
comment = 'Tabla intermedia muchos a muchos entre tarea y matrícula: la nota de cada estudiante en cada actividad.';

/*==============================================================*/
/* Tabla: calificacion                                         */
/*==============================================================*/
create table calificacion
(
   id_calificacion              char(32)       not null comment 'Código hexadecimal único de calificacion (UUID v4 sin guiones). Lo genera la aplicación, también sin conexión.',
   id_matricula                 char(32)       not null comment 'Estudiante matriculado.',
   id_asignacion                char(32)       not null comment 'Materia y curso.',
   id_periodo                   char(32)       not null comment 'Trimestre.',
   promedio_aportes             decimal(4,2)   null comment 'Promedio de los aportes de los dos bloques (entregas de tareas con bloque).',
   refuerzo                     decimal(4,2)   null comment 'Nota de refuerzo académico (opcional).',
   nota_proyecto                decimal(4,2)   null comment 'Nota del proyecto.',
   nota_examen                  decimal(4,2)   null comment 'Nota del examen.',
   nota_final                   decimal(4,2)   null comment 'Ponderación de aportes, proyecto y examen según parametro, truncada (RN-02).',
   cualitativo                  char(2)        null comment 'Equivalencia cualitativa.',
   version                      int            not null default 1 comment 'Versión del registro; sube en 1 con cada cambio. Base de la sincronización sin conexión.',
   creado_en                    datetime       not null comment 'Fecha y hora de creación.',
   actualizado_en               datetime       null comment 'Fecha y hora de la última modificación.',
   primary key (id_calificacion),
   unique key uk_calificacion_1 (id_matricula, id_asignacion, id_periodo)
)
engine = InnoDB
default charset = utf8
comment = 'Resumen trimestral de un estudiante en una materia; une matrícula, asignación y periodo.';

/*==============================================================*/
/* Tabla: asistencia                                           */
/*==============================================================*/
create table asistencia
(
   id_asistencia                char(32)       not null comment 'Código hexadecimal único de asistencia (UUID v4 sin guiones). Lo genera la aplicación, también sin conexión.',
   id_matricula                 char(32)       not null comment 'Estudiante matriculado.',
   id_asignacion                char(32)       not null comment 'Materia y curso.',
   id_registrado_por            char(32)       not null comment 'Docente que registró.',
   fecha                        date           not null comment 'Día de clase.',
   estado                       varchar(12)    not null comment 'Estado de asistencia.',
   justificacion                varchar(255)   null comment 'Motivo de la justificación.',
   estado_justificacion         varchar(12)    null comment 'Trámite pedido por el estudiante (CU-19).',
   version                      int            not null default 1 comment 'Versión del registro; sube en 1 con cada cambio. Base de la sincronización sin conexión.',
   creado_en                    datetime       not null comment 'Fecha y hora de creación.',
   actualizado_en               datetime       null comment 'Fecha y hora de la última modificación.',
   primary key (id_asistencia),
   unique key uk_asistencia_1 (id_matricula, id_asignacion, fecha)
)
engine = InnoDB
default charset = utf8
comment = 'Asistencia diaria de un estudiante en una materia, con su justificación (RF-21).';

/*==============================================================*/
/* Tabla: comportamiento                                       */
/*==============================================================*/
create table comportamiento
(
   id_comportamiento            char(32)       not null comment 'Código hexadecimal único de comportamiento (UUID v4 sin guiones). Lo genera la aplicación, también sin conexión.',
   id_matricula                 char(32)       not null comment 'Estudiante matriculado.',
   id_periodo                   char(32)       not null comment 'Trimestre.',
   id_tutor                     char(32)       not null comment 'Docente tutor que evalúa.',
   cognitivo_1                  char(1)        null comment 'Indicador cognitivo 1 del registro de comportamiento del Ministerio (RN-16).',
   cognitivo_2                  char(1)        null comment 'Indicador cognitivo 2 del registro de comportamiento del Ministerio (RN-16).',
   cognitivo_3                  char(1)        null comment 'Indicador cognitivo 3 del registro de comportamiento del Ministerio (RN-16).',
   cognitivo_4                  char(1)        null comment 'Indicador cognitivo 4 del registro de comportamiento del Ministerio (RN-16).',
   social_1                     char(1)        null comment 'Indicador social 1 del registro de comportamiento del Ministerio (RN-16).',
   social_2                     char(1)        null comment 'Indicador social 2 del registro de comportamiento del Ministerio (RN-16).',
   social_3                     char(1)        null comment 'Indicador social 3 del registro de comportamiento del Ministerio (RN-16).',
   social_4                     char(1)        null comment 'Indicador social 4 del registro de comportamiento del Ministerio (RN-16).',
   social_5                     char(1)        null comment 'Indicador social 5 del registro de comportamiento del Ministerio (RN-16).',
   nota                         decimal(4,2)   null comment 'Nota calculada de comportamiento.',
   cualitativo                  char(1)        null comment 'Equivalencia cualitativa.',
   descripcion                  varchar(255)   null comment 'Descripción del comportamiento.',
   version                      int            not null default 1 comment 'Versión del registro; sube en 1 con cada cambio. Base de la sincronización sin conexión.',
   creado_en                    datetime       not null comment 'Fecha y hora de creación.',
   actualizado_en               datetime       null comment 'Fecha y hora de la última modificación.',
   primary key (id_comportamiento),
   unique key uk_comportamiento_1 (id_matricula, id_periodo)
)
engine = InnoDB
default charset = utf8
comment = 'Evaluación trimestral de comportamiento de un estudiante por su tutor, con los nueve indicadores (RF-22).';

/*==============================================================*/
/* Tabla: parametro                                            */
/*==============================================================*/
create table parametro
(
   id_parametro                 char(32)       not null comment 'Código hexadecimal único de parametro (UUID v4 sin guiones). Lo genera la aplicación, también sin conexión.',
   id_anio_lectivo              char(32)       not null comment 'Año lectivo en el que aplica.',
   clave                        varchar(50)    not null comment 'Nombre del parámetro.',
   valor                        varchar(100)   not null comment 'Valor del parámetro.',
   descripcion                  varchar(200)   null comment 'Uso del parámetro.',
   version                      int            not null default 1 comment 'Versión del registro; sube en 1 con cada cambio. Base de la sincronización sin conexión.',
   creado_en                    datetime       not null comment 'Fecha y hora de creación.',
   actualizado_en               datetime       null comment 'Fecha y hora de la última modificación.',
   primary key (id_parametro),
   unique key uk_parametro_1 (id_anio_lectivo, clave)
)
engine = InnoDB
default charset = utf8
comment = 'Ponderaciones y escalas que el Administrador ajusta sin cambiar el código (RNF-10).';

/*==============================================================*/
/* Tabla: plantilla                                            */
/*==============================================================*/
create table plantilla
(
   id_plantilla                 char(32)       not null comment 'Código hexadecimal único de plantilla (UUID v4 sin guiones). Lo genera la aplicación, también sin conexión.',
   codigo                       varchar(30)    not null comment 'Código del mensaje.',
   nombre                       varchar(80)    not null comment 'Nombre visible.',
   texto                        text           not null comment 'Texto con variables; nunca incluye la nota exacta (RSK-06).',
   activa                       tinyint(1)     not null default 1 comment 'Plantilla en uso.',
   version                      int            not null default 1 comment 'Versión del registro; sube en 1 con cada cambio. Base de la sincronización sin conexión.',
   creado_en                    datetime       not null comment 'Fecha y hora de creación.',
   actualizado_en               datetime       null comment 'Fecha y hora de la última modificación.',
   primary key (id_plantilla),
   unique key uk_plantilla_codigo (codigo)
)
engine = InnoDB
default charset = utf8
comment = 'Los tres mensajes permitidos para avisos (CR-01).';

/*==============================================================*/
/* Tabla: comunicado                                           */
/*==============================================================*/
create table comunicado
(
   id_comunicado                char(32)       not null comment 'Código hexadecimal único de comunicado (UUID v4 sin guiones). Lo genera la aplicación, también sin conexión.',
   id_autor                     char(32)       not null comment 'Usuario que publica el comunicado.',
   id_curso                     char(32)       null comment 'Curso destinatario; nulo si es para todo el colegio.',
   titulo                       varchar(150)   not null comment 'Título del comunicado.',
   contenido                    text           not null comment 'Texto del comunicado.',
   publicado_en                 datetime       not null comment 'Fecha y hora de publicación.',
   vigente_hasta                date           null comment 'Último día en que se muestra.',
   version                      int            not null default 1 comment 'Versión del registro; sube en 1 con cada cambio. Base de la sincronización sin conexión.',
   creado_en                    datetime       not null comment 'Fecha y hora de creación.',
   actualizado_en               datetime       null comment 'Fecha y hora de la última modificación.',
   primary key (id_comunicado)
)
engine = InnoDB
default charset = utf8
comment = 'Comunicado de la institución que se muestra dentro de la aplicación (RF-32); no se envía por WhatsApp.';

/*==============================================================*/
/* Tabla: notificacion                                         */
/*==============================================================*/
create table notificacion
(
   id_notificacion              char(32)       not null comment 'Código hexadecimal único de notificacion (UUID v4 sin guiones). Lo genera la aplicación, también sin conexión.',
   id_plantilla                 char(32)       not null comment 'Mensaje usado.',
   id_representacion            char(32)       not null comment 'Representante y estudiante del aviso; de aquí salen el celular y la autorización.',
   id_materia                   char(32)       null comment 'Materia, si aplica.',
   id_enviado_por               char(32)       null comment 'Quién lo envió en el WhatsApp asistido.',
   canal                        varchar(20)    not null comment 'Canal de envío.',
   estado                       varchar(20)    not null comment 'Estado del aviso.',
   clave_antiduplicado          varchar(120)   not null comment 'Representación + motivo + canal + periodo; impide repetir (RF-34).',
   fecha_evento                 date           not null comment 'Fecha de la nota o la falta.',
   intentos                     tinyint        not null default 0 comment 'Reintentos sin conexión (RF-35).',
   enviada_en                   datetime       null comment 'Fecha y hora de envío.',
   version                      int            not null default 1 comment 'Versión del registro; sube en 1 con cada cambio. Base de la sincronización sin conexión.',
   creado_en                    datetime       not null comment 'Fecha y hora de creación.',
   actualizado_en               datetime       null comment 'Fecha y hora de la última modificación.',
   primary key (id_notificacion),
   unique key uk_notificacion_clave_antiduplicado (clave_antiduplicado)
)
engine = InnoDB
default charset = utf8
comment = 'Historial y cola de cada aviso enviado o preparado a un representante (RF-33 a RF-35).';

/*==============================================================*/
/* Tabla: suscripcion_push                                     */
/*==============================================================*/
create table suscripcion_push
(
   id_suscripcion_push          char(32)       not null comment 'Código hexadecimal único de suscripcion push (UUID v4 sin guiones). Lo genera la aplicación, también sin conexión.',
   id_usuario                   char(32)       not null comment 'Usuario dueño del dispositivo.',
   endpoint                     text           not null comment 'Dirección push del navegador.',
   endpoint_hash                char(64)       not null comment 'Huella SHA-256 del endpoint para evitar duplicados.',
   clave_p256dh                 varchar(255)   not null comment 'Clave pública del dispositivo.',
   clave_auth                   varchar(100)   not null comment 'Secreto de autenticación del dispositivo.',
   activa                       tinyint(1)     not null default 1 comment 'Suscripción vigente.',
   version                      int            not null default 1 comment 'Versión del registro; sube en 1 con cada cambio. Base de la sincronización sin conexión.',
   creado_en                    datetime       not null comment 'Fecha y hora de creación.',
   actualizado_en               datetime       null comment 'Fecha y hora de la última modificación.',
   primary key (id_suscripcion_push),
   unique key uk_suscripcion_push_endpoint_hash (endpoint_hash)
)
engine = InnoDB
default charset = utf8
comment = 'Dispositivo registrado para recibir notificaciones push, el canal principal y gratuito (CR-01).';

/*==============================================================*/
/* Tabla: auditoria                                            */
/*==============================================================*/
create table auditoria
(
   id_auditoria                 char(32)       not null comment 'Código hexadecimal único de auditoria (UUID v4 sin guiones). Lo genera la aplicación, también sin conexión.',
   id_usuario                   char(32)       null comment 'Usuario que hizo el cambio o intentó ingresar; nulo si el usuario escrito no existe.',
   entidad                      varchar(40)    not null comment 'Tabla afectada (usuario en los eventos de acceso).',
   id_registro                  char(32)       null comment 'Código hexadecimal del registro afectado.',
   accion                       varchar(15)    not null comment 'Operación o evento.',
   valor_anterior               text           null comment 'Datos antes del cambio.',
   valor_nuevo                  text           null comment 'Datos después del cambio.',
   usuario_intentado            varchar(60)    null comment 'Usuario escrito en un intento de ingreso.',
   ip                           varchar(45)    null comment 'Dirección IP de origen.',
   ocurrido_en                  datetime       not null comment 'Fecha y hora del evento.',
   primary key (id_auditoria)
)
engine = InnoDB
default charset = utf8
comment = 'Quién cambió qué, con el valor anterior y el nuevo (RNF-09), incluidos los cambios de estado de la planificación (RF-14) y los accesos (RNF-12).';

/*==============================================================*/
/* Tabla: cambio_sincronizado                                  */
/*==============================================================*/
create table cambio_sincronizado
(
   id_cambio_sincronizado       char(32)       not null comment 'Código hexadecimal único de cambio sincronizado (UUID v4 sin guiones). Lo genera la aplicación, también sin conexión.',
   id_usuario                   char(32)       not null comment 'Usuario que hizo el cambio sin conexión.',
   clave_idempotencia           char(32)       not null comment 'Código único del cambio: si llega dos veces se aplica una sola.',
   entidad                      varchar(40)    not null comment 'Tabla afectada.',
   id_registro                  char(32)       not null comment 'Código hexadecimal del registro afectado.',
   version_base                 int            not null comment 'Versión sobre la que se hizo el cambio.',
   operacion                    varchar(10)    not null comment 'Operación.',
   datos                        text           not null comment 'Datos enviados.',
   estado                       varchar(12)    not null comment 'Resultado.',
   resolucion                   varchar(20)    null comment 'Cómo se resolvió el conflicto.',
   recibido_en                  datetime       not null comment 'Fecha y hora de llegada al servidor.',
   primary key (id_cambio_sincronizado),
   unique key uk_cambio_sincronizado_clave_idempotencia (clave_idempotencia)
)
engine = InnoDB
default charset = utf8
comment = 'Cambio recibido desde un equipo que trabajó sin conexión (RNF-01, RN-15).';

/*==============================================================*/
/* Claves foráneas                                              */
/*==============================================================*/
alter table usuario add constraint fk_usuario_persona foreign key (id_persona)
      references persona (id_persona) on delete restrict on update restrict;

alter table usuario_rol add constraint fk_usuario_rol_usuario foreign key (id_usuario)
      references usuario (id_usuario) on delete restrict on update restrict;

alter table usuario_rol add constraint fk_usuario_rol_rol foreign key (id_rol)
      references rol (id_rol) on delete restrict on update restrict;

alter table periodo add constraint fk_periodo_anio_lectivo foreign key (id_anio_lectivo)
      references anio_lectivo (id_anio_lectivo) on delete restrict on update restrict;

alter table curso add constraint fk_curso_anio_lectivo foreign key (id_anio_lectivo)
      references anio_lectivo (id_anio_lectivo) on delete restrict on update restrict;

alter table curso add constraint fk_curso_tutor foreign key (id_tutor)
      references persona (id_persona) on delete restrict on update restrict;

alter table asignacion add constraint fk_asignacion_docente foreign key (id_docente)
      references persona (id_persona) on delete restrict on update restrict;

alter table asignacion add constraint fk_asignacion_materia foreign key (id_materia)
      references materia (id_materia) on delete restrict on update restrict;

alter table asignacion add constraint fk_asignacion_curso foreign key (id_curso)
      references curso (id_curso) on delete restrict on update restrict;

alter table matricula add constraint fk_matricula_estudiante foreign key (id_estudiante)
      references persona (id_persona) on delete restrict on update restrict;

alter table matricula add constraint fk_matricula_curso foreign key (id_curso)
      references curso (id_curso) on delete restrict on update restrict;

alter table representacion add constraint fk_representacion_representante foreign key (id_representante)
      references persona (id_persona) on delete restrict on update restrict;

alter table representacion add constraint fk_representacion_estudiante foreign key (id_estudiante)
      references persona (id_persona) on delete restrict on update restrict;

alter table planificacion add constraint fk_planificacion_asignacion foreign key (id_asignacion)
      references asignacion (id_asignacion) on delete restrict on update restrict;

alter table planificacion add constraint fk_planificacion_periodo foreign key (id_periodo)
      references periodo (id_periodo) on delete restrict on update restrict;

alter table planificacion add constraint fk_planificacion_revisor foreign key (id_revisor)
      references usuario (id_usuario) on delete restrict on update restrict;

alter table semana_planificacion add constraint fk_semana_planificacion_planificacion foreign key (id_planificacion)
      references planificacion (id_planificacion) on delete restrict on update restrict;

alter table observacion add constraint fk_observacion_planificacion foreign key (id_planificacion)
      references planificacion (id_planificacion) on delete restrict on update restrict;

alter table observacion add constraint fk_observacion_semana_planificacion foreign key (id_semana_planificacion)
      references semana_planificacion (id_semana_planificacion) on delete restrict on update restrict;

alter table observacion add constraint fk_observacion_autor foreign key (id_autor)
      references usuario (id_usuario) on delete restrict on update restrict;

alter table tarea add constraint fk_tarea_asignacion foreign key (id_asignacion)
      references asignacion (id_asignacion) on delete restrict on update restrict;

alter table tarea add constraint fk_tarea_periodo foreign key (id_periodo)
      references periodo (id_periodo) on delete restrict on update restrict;

alter table entrega add constraint fk_entrega_tarea foreign key (id_tarea)
      references tarea (id_tarea) on delete restrict on update restrict;

alter table entrega add constraint fk_entrega_matricula foreign key (id_matricula)
      references matricula (id_matricula) on delete restrict on update restrict;

alter table calificacion add constraint fk_calificacion_matricula foreign key (id_matricula)
      references matricula (id_matricula) on delete restrict on update restrict;

alter table calificacion add constraint fk_calificacion_asignacion foreign key (id_asignacion)
      references asignacion (id_asignacion) on delete restrict on update restrict;

alter table calificacion add constraint fk_calificacion_periodo foreign key (id_periodo)
      references periodo (id_periodo) on delete restrict on update restrict;

alter table asistencia add constraint fk_asistencia_matricula foreign key (id_matricula)
      references matricula (id_matricula) on delete restrict on update restrict;

alter table asistencia add constraint fk_asistencia_asignacion foreign key (id_asignacion)
      references asignacion (id_asignacion) on delete restrict on update restrict;

alter table asistencia add constraint fk_asistencia_registrado_por foreign key (id_registrado_por)
      references usuario (id_usuario) on delete restrict on update restrict;

alter table comportamiento add constraint fk_comportamiento_matricula foreign key (id_matricula)
      references matricula (id_matricula) on delete restrict on update restrict;

alter table comportamiento add constraint fk_comportamiento_periodo foreign key (id_periodo)
      references periodo (id_periodo) on delete restrict on update restrict;

alter table comportamiento add constraint fk_comportamiento_tutor foreign key (id_tutor)
      references persona (id_persona) on delete restrict on update restrict;

alter table parametro add constraint fk_parametro_anio_lectivo foreign key (id_anio_lectivo)
      references anio_lectivo (id_anio_lectivo) on delete restrict on update restrict;

alter table comunicado add constraint fk_comunicado_autor foreign key (id_autor)
      references usuario (id_usuario) on delete restrict on update restrict;

alter table comunicado add constraint fk_comunicado_curso foreign key (id_curso)
      references curso (id_curso) on delete restrict on update restrict;

alter table notificacion add constraint fk_notificacion_plantilla foreign key (id_plantilla)
      references plantilla (id_plantilla) on delete restrict on update restrict;

alter table notificacion add constraint fk_notificacion_representacion foreign key (id_representacion)
      references representacion (id_representacion) on delete restrict on update restrict;

alter table notificacion add constraint fk_notificacion_materia foreign key (id_materia)
      references materia (id_materia) on delete restrict on update restrict;

alter table notificacion add constraint fk_notificacion_enviado_por foreign key (id_enviado_por)
      references usuario (id_usuario) on delete restrict on update restrict;

alter table suscripcion_push add constraint fk_suscripcion_push_usuario foreign key (id_usuario)
      references usuario (id_usuario) on delete restrict on update restrict;

alter table auditoria add constraint fk_auditoria_usuario foreign key (id_usuario)
      references usuario (id_usuario) on delete restrict on update restrict;

alter table cambio_sincronizado add constraint fk_cambio_sincronizado_usuario foreign key (id_usuario)
      references usuario (id_usuario) on delete restrict on update restrict;

