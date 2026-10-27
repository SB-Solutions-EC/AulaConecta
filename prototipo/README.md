# prototipo — prototipo navegable

Prototipo validado con el cliente (HTML + JavaScript, datos en el navegador), versión "demo v2", **con datos ficticios**. Se anonimizó y revisó con Gitleaks antes de subirlo (tarea T1022-A); el criterio y la verificación están en [docs/seguridad/datos_sensibles.md](../docs/seguridad/datos_sensibles.md).

El original con datos reales queda solo en la carpeta local `privado/`, que nunca se sube.

## Cómo abrirlo

Abrir `index.html` en el navegador (necesita internet para cargar Tailwind, Chart.js, docx y SheetJS desde CDN). El selector **Vista** de la barra superior cambia entre Administrador, Docente y Estudiante.

Los datos se generan la primera vez y se guardan en el `localStorage` del navegador. Para volver a los datos iniciales, borrar el almacenamiento del sitio en las herramientas del navegador.

Capturas del prototipo con datos ficticios: [docs/prototipo/capturas](../docs/prototipo/capturas).
