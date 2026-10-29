# Diagramas de arquitectura

Estos diagramas describen la arquitectura inicial de AulaConecta y el diseño
del trabajo sin conexión. Se mantienen en Mermaid para que puedan revisarse
directamente en GitHub y editarse junto con el código.

| Documento | Contenido |
|---|---|
| [c4_contexto_contenedores.md](c4_contexto_contenedores.md) | Diagrama C4 de contexto y contenedores |
| [trabajo_sin_conexion.md](trabajo_sin_conexion.md) | Cola local, sincronización y resolución de conflictos |

## Decisiones que reflejan los diagramas

- La PWA es el único cliente y puede trabajar con datos previamente
  sincronizados cuando no hay red.
- `ms-identidad`, `ms-academico` y `ms-notificaciones` son dueños de sus
  propios datos y bases de datos.
- La PWA se conecta al Gateway; no accede directamente a las bases ni a
  RabbitMQ.
- Los cambios offline usan UUID, `version` y una clave de idempotencia.
- Un conflicto no se resuelve silenciosamente: se registra y se muestra al
  usuario cuando la política automática no es segura.
