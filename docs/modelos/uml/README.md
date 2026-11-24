# Diagramas UML

Diagramas de la guía del segundo parcial, construidos sobre el modelo entidad–relación de 27 tablas ([../bd](../bd)).

| Archivo | Diagrama |
|---|---|
| [Diagramas_UML_AulaConecta.docx](Diagramas_UML_AulaConecta.docx) | Documento con los cuatro diagramas, la ficha de la guía de cada uno y la verificación |
| `componentes.png` | Componentes: PWA, API Gateway, 3 microservicios, bus de eventos, bases e integraciones |
| `estados_planificacion.png` | Estados de la planificación (RF-10 a RF-14) |
| `estados_notificacion.png` | Estados del aviso al representante (RF-30 a RF-35, CR-01) |
| `objeto_estado.png` | Objeto-estado con instancias ficticias del 9no EGB «A» |
| `clases_academico.png` | Clases de identidad y gestión académica |
| `clases_avisos.png` | Clases de avisos, auditoría y sincronización |

Los archivos `.mmd` son la fuente en Mermaid de cada imagen.

> **Pendiente:** los `.mmd` y los textos del `.docx` ya incluyen los cambios (año lectivo y trimestre en las clases, estado `POR_REVISAR` y fin del WhatsApp asistido en el aviso, autocorrección en la planificación, `laura : Persona` en el objeto-estado, token de servicio y outbox en los componentes), pero las imágenes `.png` y las figuras dentro del `.docx` son anteriores. Hay que regenerarlas desde los `.mmd` y reemplazarlas en el `.docx`.
