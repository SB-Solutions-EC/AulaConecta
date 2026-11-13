# prototipo — prototipo navegable

Prototipo validado con el cliente (HTML + JavaScript, datos en el navegador), **con datos ficticios**. Se anonimizó y revisó con Gitleaks antes de subirlo (tarea T1022-A); el criterio y la verificación están en [docs/seguridad/datos_sensibles.md](../docs/seguridad/datos_sensibles.md).

El original con datos reales queda solo en la carpeta local `privado/`, que nunca se sube.

## Cómo abrirlo

Servir la carpeta con cualquier servidor estático y abrir `index.html` (necesita internet para cargar Tailwind y docx desde CDN). Por ejemplo:

```bash
npx serve prototipo
```

Los datos se generan la primera vez y se guardan en el `localStorage` del navegador. Para volver a los datos iniciales, borrar el almacenamiento del sitio en las herramientas del navegador.

## Versión 3 (10/11/2026): cambios por la retroalimentación

Los cambios están en [aulaconecta_v3.js](aulaconecta_v3.js), con pequeños ganchos en `script.js`.

| Cambio | Requisitos | Dónde se ve |
|---|---|---|
| Inicio de sesión; las cuentas nuevas usan una **clave temporal aleatoria de un solo uso** (72 h) y obligan a crear la contraseña; bloqueo de 15 min tras 3 intentos | RF-02, RF-03, RNF-12 | Pantalla inicial; «Cuentas y Accesos» |
| **Cinco roles**: se agregan Secretaría y Representante | RF-01 | Cuentas de prueba en la pantalla inicial |
| **Avisos por niveles**: push automático y WhatsApp con un clic; solo 3 mensajes y sin la nota exacta; respeta la autorización y evita duplicados; la falta genera aviso y el atraso no | RF-29 a RF-35, CR-01 | Docente: registrar una falta o una nota menor a 7 → «Avisos a Representantes» |
| Registro de representantes y autorización con mensaje de confirmación | RF-29, RNF-05 | Secretaría → «Representantes» |
| Vista del representante: detalle de notas, asistencia, avisos recibidos y baja de avisos | RF-38, RNF-05 | Representante |
| **Paginación y filtros** | RF-39 | Estudiantes, Cuentas, Representantes, Avisos |
| **Trabajo sin conexión**: cola de cambios, avisos en cola y conflicto entre dos usuarios resuelto por el docente | RNF-01, RF-35, RN-15 | Botón «🌐 En línea / 📴 Sin conexión» de la barra superior |

### Cuentas de prueba

Todas las cuentas activas usan la contraseña que se muestra en la pantalla inicial. La última estudiante de la lista tiene una cuenta **sin activar** para demostrar el flujo de la clave temporal.

| Rol | Usuario |
|---|---|
| Administrador | `vicerrector` |
| Secretaría | `rosa.paredes` |
| Docente | `laura.mendoza` |
| Estudiante | `ana.perez` |
| Representante | `maria.perez` |

### Guion corto para la demostración

1. Entrar con la cuenta sin activar → crear la contraseña.
2. Secretaría: matricular un estudiante → aparecen sus credenciales temporales.
3. Docente (9no EGB "A"): marcar una falta → notificación push y botón «Avisar por WhatsApp».
4. Pasar a «Sin conexión», marcar asistencia, «Simular cambio de otro docente» y volver «En línea» → resolver el conflicto.
5. Representante: ver el detalle y el aviso recibido; probar «No recibir avisos».

Capturas del prototipo con datos ficticios: [docs/prototipo/capturas](../docs/prototipo/capturas).
