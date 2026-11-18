# Datos de prueba ficticios (T1116-M)

Datos inventados para el ambiente de pruebas, las pruebas e2e y las demostraciones. **Nunca se cargan en producción**: los tres scripts se niegan a correr con `NODE_ENV=production` o `ENTORNO=production`.

[datos.json](datos.json) es la única fuente: los mismos UUID enlazan la cuenta de ms-identidad (`usuario.id`), la persona de ms-academico (`persona.usuario_id`) y el contacto de ms-notificaciones (`representante_id`, `estudiante_id`).

| Qué hay | Cantidad |
|---|---|
| Año lectivo 2026-2027 con sus 3 trimestres (régimen Sierra-Amazonía) | 1 |
| Materias (MAT, LEN, CCNN, EESS, ING, EF, ECA) | 7 |
| Cursos: 8vo A, 9no A, 9no B y 10mo EGB A, cada uno con su tutor | 4 |
| Docentes | 4 |
| Estudiantes matriculados (3 por curso) | 12 |
| Representantes (cada uno con 2 representados) y contactos de WhatsApp con autorización | 6 / 12 |
| Cuentas: administrador, secretaría y una por cada persona | 24 |

## Por qué nadie es real

- **Cédulas:** empiezan con 99, una provincia que no existe, así que no coinciden con ninguna persona.
- **Correos:** usan el dominio `ejemplo.test`, reservado para pruebas (RFC 2606).
- **WhatsApp:** usan la serie `+1 202 555-01XX`, reservada para ficción, así que ningún aviso llega a alguien.
- **Nombres y apellidos:** son combinaciones como "Prueba", "Ficticia" o "Demo".

Las pruebas automáticas revisan estas reglas. Los datos reales del colegio nunca entran al repositorio.

## Cómo cargarlos

Primero se aplican las migraciones de cada servicio. Los tres scripts se pueden ejecutar varias veces: crean o actualizan cada registro por su id.

```bash
# db_identidad: cuentas con la clave de pruebas (solo se guarda su hash Argon2id)
pip install "psycopg[binary]" argon2-cffi
DATABASE_URL=postgresql://usr_identidad:...@localhost:5432/db_identidad \
CLAVE_DATOS_PRUEBA=<clave de al menos 12 caracteres> python infra/datos-prueba/sembrar_identidad.py

# db_academico
cd services/ms-academico && DATABASE_URL=postgresql://usr_academico:...@localhost:5432/db_academico npm run datos-prueba

# db_notificaciones
cd services/ms-notificaciones && DATABASE_URL=postgresql+psycopg://usr_notificaciones:...@localhost:5432/db_notificaciones python -m app.semilla
```

La clave de pruebas se comparte por el canal del equipo, nunca en el repositorio. Las cuentas quedan con la clave inicial ya cambiada para que la demostración entre directo.

| Cuenta | Rol |
|---|---|
| `rosa.prueba` | ADMIN (vicerrector) |
| `luis.prueba` | SECRETARIA |
| `marta.ficticia`, `jorge.ejemplo`, `elena.prueba`, `pablo.demo` | DOCENTE |
| `carmen.simulada`, `diego.inventado`, `lucia.ficticia`, `hector.ejemplo`, `sonia.demo`, `raul.prueba` | REPRESENTANTE |
| `ana.simulada`, `bruno.simulada`, `camila.inventado` y 9 más (ver `datos.json`) | ESTUDIANTE |
