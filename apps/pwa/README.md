# apps/pwa — PWA de AulaConecta

Aplicación web instalable (**PWA**) en **React + Vite + TypeScript** con Tailwind CSS, Workbox y Dexie (IndexedDB). Permite operar en computadora y celular, registrar notas y asistencia sin conexión a internet y sincronizar cambios con `ms-academico` (`/sync/pull` y `/sync/push`) al recuperar la red.

| Cuándo | Qué se construye |
|---|---|
| Sprint 3 (27/10) | Esqueleto con los colores del colegio, conectado a `/health` |
| Sprint 4 | Layout por rol, rutas protegidas, inicio de sesión y pantallas académicas |
| Sprint 9 | Service worker (Workbox), almacenamiento local cifrado (Dexie + WebCrypto) y sincronización con resolución de conflictos |

Diseño y cola local: [docs/arquitectura/Diagramas/trabajo_sin_conexion.md](../../docs/arquitectura/Diagramas/trabajo_sin_conexion.md) y [docs/arquitectura/guia_visual.md](../../docs/arquitectura/guia_visual.md).

Responsable del área: @cmbonifaz.

