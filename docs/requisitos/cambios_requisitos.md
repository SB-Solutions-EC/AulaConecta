# Control de cambios de requisitos

Cada cambio a un requisito ya acordado se registra aquí, con su motivo y su impacto, y lo aprueba el Product Owner (vicerrector) antes de pasar al SRS.

| ID | Fecha | Requisitos | Estado |
|---|---|---|---|
| CR-01 | 26/10/2026 | RF-30, RF-31, RF-32, RF-33, RF-35 | Propuesta, pendiente de aprobación del vicerrector |

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
