# apps/pwa — PWA de AulaConecta

Aplicación web instalable (**PWA**) en **React + Vite + TypeScript** con Tailwind CSS, Workbox y Dexie (IndexedDB). Por ahora es el esqueleto (T1027-C): aplica la identidad visual de la **Unidad Educativa "Andoas"** (`primary` `#1E3A5F`, `accent` `#E8833A`, `surface` `#F6F7FB`), verifica en tiempo real el estado `/health` de los 3 microservicios a través del Gateway Traefik, detecta el estado de conexión de red y expone su propio `/health` (`{"status":"UP"}`).

| Cuándo | Qué se construye |
|---|---|
| Sprint 3 (27/10) | Esqueleto con los colores del colegio, conectado a `/health` de los 3 servicios |
| Sprint 4 | Layout por rol, rutas protegidas, inicio de sesión y pantallas académicas |
| Sprint 9 | Service worker (Workbox), almacenamiento local cifrado (Dexie + WebCrypto) y sincronización con resolución de conflictos |

## Cómo ejecutarla

En desarrollo local (Node.js 22+):

```bash
cd apps/pwa
npm install
npm run dev
```

Ejecutar verificación de tipos y pruebas unitarias con Vitest:

```bash
npm run typecheck
npm test
```

Construir para producción:

```bash
npm run build
```

Con Docker, junto con el gateway (ver [infra/](../../infra)):

```bash
cp infra/.env.example infra/.env     # solo la primera vez
docker compose -f infra/docker-compose.yml up --build
curl -k https://localhost/health
```

Diseño y cola local: [docs/arquitectura/Diagramas/trabajo_sin_conexion.md](../../docs/arquitectura/Diagramas/trabajo_sin_conexion.md) y [docs/arquitectura/guia_visual.md](../../docs/arquitectura/guia_visual.md).

Responsable del área: @cmbonifaz.
