# Control de cambios de requisitos

Cada cambio a un requisito ya acordado se registra aquí, con su motivo y su impacto, y lo aprueba el Product Owner (vicerrector) antes de pasar al SRS.

**Línea base vigente:** el documento integrado v1.0 del 10/11/2026 ([Grupo01_Taller2_1.pdf](../analisis/Grupo01_Taller2_1.pdf)): 39 RF y 15 RNF con su ficha, cronograma único de 10 sprints y casos de prueba CP-01 a CP-39 y CP-N01 a CP-N15. Ya incluye CR-01 y CR-02 como «Propuesto». El [SRS v0.1](SRS_Plataforma_Gestion_Academica.docx) queda como histórico. La relación entre los casos de prueba y las pruebas automáticas está en [docs/pruebas/trazabilidad.md](../pruebas/trazabilidad.md).

| ID | Fecha | Requisitos | Estado |
|---|---|---|---|
| CR-01 | 26/10/2026 | RF-30, RF-31, RF-32, RF-33, RF-35 | Propuesta, pendiente de aprobación del vicerrector |
| CR-02 | 10/11/2026 | RF-03, RN-13 | Propuesta, pendiente de aprobación del vicerrector (revisión del sprint 4, `T1113-M`). Implementada en ms-identidad y ms-academico; falta la PWA |

## CR-01 · Avisos a representantes por niveles y solo tres mensajes

**Solicitado por:** equipo SB Solutions · **Fecha:** 26/10/2026

### Motivo

La restricción 2.3 del SRS indica que WhatsApp depende de un proveedor autorizado (WhatsApp Cloud API de Meta), con **costo por mensaje** y **plantillas aprobadas**. El colegio no tiene un presupuesto asignado para ese costo, y las alternativas gratuitas no oficiales (librerías que automatizan WhatsApp Web) violan los términos de WhatsApp y exponen datos de menores, por lo que se descartan.

### Cambio propuesto

| Requisito | Texto actual (SRS v0.1) | Texto propuesto |
|---|---|---|
| RF-30 | El sistema debe enviar automáticamente un mensaje de WhatsApp al representante cuando el promedio de su representado en una materia baje de 7. | El sistema debe avisar automáticamente al representante, mediante notificación push de la aplicación, cuando el promedio de su representado en una materia baje de 7, y dejar preparado el aviso por WhatsApp para que el docente o la secretaría lo envíe con un clic. Si el colegio activa el proveedor de WhatsApp, el envío por WhatsApp también será automático. |
| RF-31 | El sistema debe enviar un mensaje de WhatsApp al representante cuando su representado registre una falta o atraso sin justificar. | Igual que RF-30, para las **faltas sin justificar**. Los atrasos se muestran en la aplicación y no generan aviso externo. |
| RF-32 | (Media) Avisos de tareas próximas y comunicados por WhatsApp. | Las tareas próximas y los comunicados se muestran dentro de la aplicación; no se envían por WhatsApp. |
| RF-33 | Registrar cada notificación con fecha, destinatario, motivo y estado. | Igual, agregando el **canal** usado (push, WhatsApp asistido o WhatsApp automático) y, en el WhatsApp asistido, **quién** lo envió. |
| RF-35 | Si no hay conexión, guardar el aviso y enviarlo al recuperarla. | Sin cambio: aplica a los tres canales. |

Mensajes externos permitidos: **confirmación de autorización, promedio bajo y falta sin justificar**.

### Impacto

| Aspecto | Impacto |
|---|---|
| Costo para el colegio | Ninguno obligatorio. El WhatsApp automático queda como opción de pago |
| Innovación del Entregable 2 | Se mantiene el aviso inmediato a la familia; el WhatsApp sigue presente (asistido o automático) |
| Cronograma | Sin cambio de fechas: el sprint 8 implementa los tres canales con el mismo adaptador |
| Modelo de datos | Nueva tabla `SUSCRIPCION_PUSH` y campo `canal` en `NOTIFICACION` ([modelo_datos.md](../arquitectura/modelo_datos.md)) |
| Riesgo R10 (costo o demora del proveedor) | Se reduce: el sistema funciona aunque el proveedor no esté activo |

### Aprobación

| Rol | Nombre | Decisión | Fecha |
|---|---|---|---|
| Product Owner | Vicerrector de la U. E. "Andoas" | Pendiente | |

## CR-02 · Clave temporal aleatoria en lugar de la cédula

**Solicitado por:** retroalimentación de la docente (E3-2, [retroalimentacion_docente.md](../entregables/retroalimentacion_docente.md)) · **Fecha:** 10/11/2026

### Motivo

La cédula es un dato que conocen terceros (compañeros, familiares, la misma institución). Usarla como clave inicial permite entrar a una cuenta que todavía no se activó (vulnerabilidad V-06, riesgo RSK-09).

### Cambio

| Requisito | Antes (SRS v0.1) | Ahora (documento integrado v1.0) |
|---|---|---|
| RF-03 | La clave inicial es la cédula y debe cambiarse en el primer ingreso. | El sistema debe generar una contraseña temporal aleatoria de un solo uso, válida por 72 horas, y exigir su cambio en el primer ingreso. |
| RN-13 | — | Vencida o usada, la secretaría genera otra. |

### Implementación (16/11/2026)

| Componente | Qué cambió |
|---|---|
| ms-identidad | `POST /usuarios` genera una clave de 10 caracteres sin símbolos ambiguos (unos 57 bits) y la devuelve una sola vez; guarda solo su hash Argon2id y su vencimiento (migración V3). Sirve para un único inicio de sesión: después responde `CLAVE_TEMPORAL_USADA` o `CLAVE_TEMPORAL_VENCIDA` sin sumar intentos fallidos. `POST /usuarios/{id}/clave-temporal` (secretaría o administrador) genera otra. La cédula ya no se recibe |
| ms-academico | `ClienteIdentidad` ya no envía la cédula y entrega la clave temporal a la secretaría en la respuesta del alta, sin guardarla (`credenciales` en `POST /personas`) |
| Contratos | `openapi/ms-identidad.yaml` y `openapi/ms-academico.yaml` |
| Pruebas | `ClaveTemporalTests` (CP-03) y la prueba de integración contra ms-identidad real |
| Pendiente | PWA: textos de inicio de sesión y cambio de clave que mencionan la cédula, y la pantalla que muestra la clave temporal a la secretaría (Christian) |

### Impacto

| Aspecto | Impacto |
|---|---|
| Seguridad | Elimina V-06: la clave inicial ya no se puede deducir |
| Privacidad | La cédula deja de viajar a ms-identidad (RNF-04) |
| Operación | La secretaría entrega la clave impresa o en persona; si pasan 72 horas, genera otra |
| Cronograma | Sin cambio: se cerró dentro del sprint 4 (HU-01) |

### Aprobación

| Rol | Nombre | Decisión | Fecha |
|---|---|---|---|
| Product Owner | Vicerrector de la U. E. "Andoas" | Pendiente | |
