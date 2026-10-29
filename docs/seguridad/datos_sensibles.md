# Inventario de datos sensibles y criterio de anonimización

**Tarea:** T1022-A · **Responsable:** Abner David Arboleda Roman · **Fecha:** 26/10/2026 (planificada el 22/10) · **Sprint 3**

AulaConecta maneja datos de menores de edad y el repositorio es público. Este documento lista qué datos personales maneja el sistema, cómo se protege cada uno y con qué criterio se anonimizó el prototipo antes de subirlo a [prototipo/](../../prototipo). Parte del [taller de vulnerabilidades y riesgos](../analisis) (V1 a V5) y de los requisitos RNF-04 y RNF-05 del SRS.

## 1. Inventario de datos del sistema

Los controles son los previstos en el Product Backlog, cada uno en su sprint. Clasificación: **Crítica** = da acceso al sistema · **Alta** = dato de un menor o que revela su rendimiento · **Media** = dato personal de un adulto · **Pública** = información institucional ya publicada.

| Dato | Titular | Dónde vive | Clasificación | Riesgo del taller | Control |
|---|---|---|---|---|---|
| Contraseñas y tokens (JWT, refresh) | Todos los usuarios | ms-identidad (`db_identidad`) | Crítica | V5 | Hash Argon2/BCrypt, bloqueo tras 3 intentos, límite de peticiones en el gateway |
| Secretos de infraestructura (Telegram, SonarQube, WhatsApp API) | Equipo | GitHub Secrets | Crítica | — | Nunca en el código; Gitleaks en local y en el CI |
| Nombres y apellidos de estudiantes | Menor | ms-academico (`PERSONA`) | Alta | — | Acceso por rol (RNF-04); datos ficticios en el repositorio |
| Cédula | Estudiante, docente, representante | ms-academico; ms-identidad la usa solo como clave inicial | Alta | — | Se muestra enmascarada; la clave inicial se cambia en el primer ingreso |
| Calificaciones, asistencia y comportamiento | Menor | ms-academico | Alta | V4 | Auditoría de cambios (RNF-09); el estudiante y el representante solo ven lo suyo |
| Número de WhatsApp y autorización de avisos | Representante | ms-notificaciones | Alta | V3 | Solo números verificados y autorizados (RNF-05); solo el servicio que envía ve los teléfonos |
| Historial de avisos (destinatario y motivo) | Menor y representante | ms-notificaciones | Alta | V3 | Plantillas sin detalle de notas; acceso solo de docente y administrador |
| Datos guardados en el dispositivo (modo sin conexión) | Menor | PWA (IndexedDB) | Alta | V1 | Cifrado AES-GCM con WebCrypto y borrado al cerrar sesión (sprint 9) |
| Nombre, correo y materias de docentes | Docente | ms-academico y ms-identidad | Media | — | Acceso por rol |
| Nombre de representantes | Representante | ms-academico | Media | — | Acceso por rol |
| Planificaciones y observaciones | Docente | ms-academico | Media | — | El contenido curricular es público; la autoría y las observaciones son internas |
| Nombre, logo, lema y ubicación del colegio | Institución | Repositorio | Pública | — | Se pueden publicar |

## 2. Documentos recibidos del colegio

Los documentos reales se usan para entender los formatos oficiales y validar el cálculo, pero **nunca se suben al repositorio**. Se guardan en la carpeta local `privado/` (excluida en [.gitignore](../../.gitignore)) o en la carpeta restringida del Drive del equipo.

| Documento | Datos personales que contiene |
|---|---|
| Libro de calificaciones 2025-2026 (Excel) | Nómina y notas reales de varios cursos |
| Comportamiento CAI de 9no EGB "A" (Excel) | Nómina y evaluación de comportamiento |
| Valoración de logros de 3ros (Excel) | Resultados por curso |
| Dos planificaciones microcurriculares (Word) | Nombre del docente que las elaboró |

Cuando una prueba necesite una hoja oficial (por ejemplo, la coincidencia del cálculo, indicador I-05), se usa una copia anonimizada con el criterio de la sección 3.

## 3. Criterio de anonimización

| Tipo de dato | Criterio |
|---|---|
| Nombres de personas | Reemplazo total por nombres ficticios. No se usan seudónimos reversibles y **no se publica la tabla de correspondencia**. Ningún par nombre–apellido ficticio puede coincidir con uno de los documentos reales |
| Cédulas, teléfonos y correos | No se incluyen reales; los correos usan el dominio `ejemplo.ec` |
| Calificaciones, asistencia y comportamiento | Se generan; no se transcriben de las hojas reales, aunque se omita el nombre |
| Contenido curricular (objetivos, destrezas, indicadores del Ministerio) | Se mantiene porque es público; se quita el nombre del autor |
| Datos institucionales (nombre del colegio, logo, ubicación) | Se mantienen porque son públicos |

## 4. Aplicación al prototipo

El prototipo navegable (versión "demo v2" validada con el cliente) tenía datos reales en el código. El original queda solo en `privado/prototipo_original/`; en [prototipo/](../../prototipo) está la versión anonimizada.

| Hallazgo en el original | Cambio en la versión publicada |
|---|---|
| 8 docentes, 2 de ellos con su nombre real | 8 docentes ficticios (los mismos de las [capturas](../prototipo/capturas)) |
| Nómina real completa de 9no EGB "A" (30 estudiantes) y 6 estudiantes con apellidos tomados de la nómina | 36 estudiantes ficticios |
| Libro de calificaciones real de 9no EGB "A" transcrito de la hoja oficial | Notas ficticias generadas con semilla fija |
| Correos con un dominio institucional | Correos `estudianteN@ejemplo.ec` y `@ejemplo.ec` |
| Mensaje de chat y ejemplo del formulario con el nombre de una estudiante | Nombre ficticio |
| Comentarios del código que indicaban "nómina real" y "datos reales" | Eliminados |
| Datos guardados en `localStorage` con la clave anterior | Clave nueva: quien abrió el original no vuelve a ver sus datos |

## 5. Verificación

| Revisión | Herramienta | Resultado |
|---|---|---|
| Ninguna persona del prototipo coincide con los documentos reales ni con el original (pares nombre–apellido) | Script de cruce local | 0 coincidencias en 44 personas |
| No quedan las filas de notas reales | Script de cruce local | 0 de 30 filas |
| No hay cédulas, celulares ni correos reales | Gitleaks + script | 0 hallazgos |
| Secretos y datos personales en los archivos nuevos | Gitleaks 8.30.1 con [.gitleaks.toml](../../.gitleaks.toml) | `no leaks found` |
| Las reglas de datos personales funcionan | Gitleaks sobre un archivo de control con una cédula, un celular y un token inventados | 3 de 3 detectados |
| Historial de la rama | `gitleaks detect` | 16 commits, `no leaks found` |

Comandos para repetir la revisión:

```bash
gitleaks detect --no-git --source prototipo -v   # archivos antes del commit
gitleaks detect --source . -v                    # historial después del commit
```

**Límites:** Gitleaks no reconoce nombres de personas ni lee archivos binarios (Word, Excel, PDF, imágenes). Por eso el cruce de nombres se hace aparte y las capturas y documentos se revisan a mano antes de subirlos.

## 6. Antes de subir algo con datos

- [ ] ¿Viene de un documento del colegio? Entonces va a `privado/` o se anonimiza con la sección 3.
- [ ] ¿Las capturas muestran solo datos ficticios?
- [ ] `gitleaks detect --no-git --source <carpeta>` sin hallazgos.
- [ ] Ningún secreto en el código: va en GitHub Secrets.
