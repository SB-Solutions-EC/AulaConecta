# Modelo de base de datos

| Archivo | Qué es |
|---|---|
| [aulaconecta_mysql50.sql](aulaconecta_mysql50.sql) | Script SQL (MySQL 5.0) para la **ingeniería inversa en PowerDesigner**: 27 tablas (incluye `outbox`), claves primarias hexadecimales, claves únicas, 43 claves foráneas y comentarios. Validado en MySQL 5.7 |
| [Modelo_ER_Diccionario_Datos.docx](Modelo_ER_Diccionario_Datos.docx) | Diagramas entidad–relación y diccionario de datos completo |
| `er_*.png` / `er_*.mmd` | Diagramas por módulo y general (imagen y fuente Mermaid) |

## Reglas del modelo

- **Persona 1 a 1 usuario:** `usuario.id_persona` es clave foránea **y** única.
- **Rol N a N usuario:** tabla intermedia `usuario_rol`.
- **Toda relación muchos a muchos usa otra tabla:** `usuario_rol`, `asignacion`, `matricula`, `representacion`, `entrega`, `calificacion`.
- **Claves primarias:** `id_<tabla>` CHAR(32), código hexadecimal único (UUID v4 sin guiones) generado por la aplicación, también sin conexión. Los códigos visibles (cédula, usuario, código de matrícula) son claves únicas aparte.
- Diccionario en el formato de la guía (Campo, Tipo sugerido, Restricción, Descripción) y cada diagrama con su ficha breve.
- RF-08 y RF-36 (prioridad Could) quedan fuera de la versión 1.0.

## Modelo lógico y bases físicas

Este es el **modelo lógico** (un solo esquema, como pide la guía). La implementación lo reparte en tres bases PostgreSQL, una por microservicio, y las relaciones entre bases se guardan como UUID sin llave foránea. La tabla de reparto y las diferencias físicas (por ejemplo `persona.usuario_id` en lugar de `usuario.id_persona`, o el celular para avisos en `contacto`) están en [modelo_datos.md](../../arquitectura/modelo_datos.md#0-modelo-lógico-y-su-reparto-en-las-tres-bases).

> **Pendiente:** el diccionario del `.docx` ya incluye `clave_temporal_usada`, `motivo_fallo`, el estado `POR_REVISAR` y la tabla `outbox`, pero las imágenes `er_*.png` (y las figuras dentro del `.docx`) son anteriores a esos cambios. Hay que regenerarlas desde los `.mmd`, por ejemplo con `npx @mermaid-js/mermaid-cli -i er_general.mmd -o er_general.png`, y reemplazarlas en el `.docx`.

## Ingeniería inversa en PowerDesigner

1. **File › Reverse Engineer › Database…**
2. DBMS: **MySQL 5.0**.
3. **Using script files** → agregar `aulaconecta_mysql50.sql` → Aceptar.
4. Ordenar con **Symbol › Auto-Layout**. Para el modelo conceptual: **Tools › Generate Conceptual Data Model…**
