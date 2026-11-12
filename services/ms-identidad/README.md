# ms-identidad

Microservicio de usuarios, roles y autenticación de AulaConecta, en **Spring Boot 4 + Java 21**. Implementa el contrato [openapi/ms-identidad.yaml](../../openapi/ms-identidad.yaml); diseño y modelo de datos en [docs/arquitectura/c4.md](../../docs/arquitectura/c4.md).

| Cuándo | Qué se construye |
|---|---|
| Sprint 3 (27/10) | Esqueleto con `/health` y publicación por el gateway |
| Sprint 3 (28/10) | `db_identidad` con Flyway |
| Sprint 4 (05/11) | Inicio de sesión, JWT RS256, JWKS, Argon2id y cambio obligatorio de la clave inicial |
| Sprint 4 (06/11) | Creación de usuarios, bloqueo tras 3 intentos y auditoría de accesos |
| Sprint 4 (10/11) | Token de servicio (client credentials) para que ms-academico cree cuentas (T1110-A) |

## Endpoints implementados

Por el gateway llevan el prefijo `/api/identidad`.

| Método y ruta | Acceso | Qué hace |
|---|---|---|
| `GET /health` | Público | Estado del servicio |
| `GET /.well-known/jwks.json` | Público | Clave pública para validar los tokens en los otros servicios |
| `POST /auth/login` | Público | Devuelve un token de acceso de 15 minutos |
| `GET /auth/me` | Token | Datos de la cuenta de la sesión |
| `POST /auth/cambiar-clave` | Token | Cambia la clave y devuelve un token nuevo |
| `POST /oauth/token` | Credenciales del servicio | Token de servicio de 5 minutos (client credentials). Solo por la red interna: el gateway responde 403 |
| `POST /usuarios` | Administrador o servicio con `usuarios:crear` | Crea la cuenta: genera el nombre de usuario (RF-02) y usa la cédula como clave inicial (RF-03) |
| `POST /usuarios/{id}/desbloquear` | Administrador | Levanta el bloqueo; opcionalmente restablece la clave inicial |
| `GET /auditoria-accesos` | Administrador | Bitácora de accesos, con filtros por usuario, evento, fechas y límite (máximo 200) |

"Administrador" significa el rol `ADMIN` con la clave inicial ya cambiada. "Token" es un token de usuario: un token de servicio no sirve en `/auth/*`, el desbloqueo ni la bitácora (403).

## Seguridad

| Tema | Decisión |
|---|---|
| Tokens | JWT RS256 con `sub` (id), `tipo`, `roles`, `debe_cambiar_clave`, `iss`, `aud`, `exp` y `kid`. Sin datos personales |
| Tokens de servicio | `tipo: servicio`, `client_id` y `scope`, sin roles; `sub` es el id del cliente en `cliente_servicio` y queda como responsable de las cuentas que crea. Un token de usuario no puede traer alcances ni uno de servicio, roles: el reclamo `tipo` decide cuál de los dos se lee |
| Secretos de servicio | 256 bits al azar; ms-identidad solo recibe su SHA-256 (`AULACONECTA_CLIENTES_SERVICIO_HASHES`) y al iniciar deja `cliente_servicio` igual a `aulaconecta.clientes-servicio`: registra, rota o desactiva. Se comparan en tiempo constante, y un cliente inexistente, inactivo o con el secreto equivocado recibe el mismo 401 |
| Clave de firma | RSA de 2048 bits o más, leída de un archivo-secreto (`AULACONECTA_JWT_CLAVE_PRIVADA`), nunca de la base ni del repositorio. El `kid` es la huella de la clave |
| Claves de usuario | Argon2id con los parámetros mínimos de OWASP. Un hash BCrypt heredado sigue funcionando y se migra a Argon2id en el siguiente inicio de sesión |
| Clave inicial (RF-03) | Con `debe_cambiar_clave = true` el token solo sirve para `/auth/me` y `/auth/cambiar-clave`; cualquier otra ruta responde 403 |
| Errores | Usuario inexistente, clave incorrecta y cuenta inactiva responden igual y tardan lo mismo; una cuenta bloqueada responde 423 con o sin la clave correcta |
| Nombre de usuario (RF-02) | Primer nombre y primer apellido sin tildes ni símbolos (`ana.perez`); los apellidos compuestos se conservan (`camila.delatorre`). Si ya existe, se agrega un número: `ana.perez2`. Los nombres y la cédula no se guardan en `db_identidad` |
| Bloqueo | Tras 3 intentos fallidos seguidos, la cuenta se bloquea 15 minutos (`aulaconecta.bloqueo`). El conteo se hace en una sola sentencia SQL: intentos simultáneos no pueden saltarse ni deshacer el bloqueo. Un acceso correcto reinicia el contador |
| Auditoría | Cada acceso, fallo, bloqueo, desbloqueo, cambio de clave, asignación de rol y token de servicio (emitido o rechazado) queda en `auditoria_acceso` con la IP del cliente. Los fallos se registran aunque la respuesta sea un error, porque el inicio de sesión no corre en una transacción que se deshaga. La tabla no admite cambios ni borrados (trigger de V1) |
| IP del cliente | La pone el gateway: Traefik descarta los `X-Forwarded-For` que manda el cliente, y ms-identidad solo confía en proxies de redes privadas (`server.forward-headers-strategy: native`) |

Los otros servicios deben validar los tokens con el JWKS, comprobar `iss` y `aud`, **rechazar los que traigan `debe_cambiar_clave = true`** y aceptar un token de servicio (`tipo: servicio`) solo donde esperan uno.

## Cómo ejecutarlo

Con Docker, junto con el gateway (ver [infra/](../../infra)):

```bash
cp infra/.env.example infra/.env     # solo la primera vez
docker compose -f infra/docker-compose.yml up --build
curl -k https://localhost/api/identidad/health
```

Pruebas, con Java 21 instalado:

```bash
./mvnw verify        # en Windows: mvnw.cmd verify
```

Las pruebas de integración usan un PostgreSQL real con Testcontainers y generan su propia clave de firma; si no hay Docker, se omiten.

El CI ([ci-identidad.yml](../../.github/workflows/ci-identidad.yml)) ejecuta además JaCoCo y Dependency-Check. Para revisar las dependencias en local:

```bash
./mvnw org.owasp:dependency-check-maven:check   # la primera vez descarga la base de la NVD (unos 7 minutos)
```

Sin Java 21, con Docker:

```bash
docker run --rm -v "$PWD:/app" -v //var/run/docker.sock:/var/run/docker.sock \
  -e TESTCONTAINERS_HOST_OVERRIDE=host.docker.internal -e TESTCONTAINERS_RYUK_DISABLED=true \
  -w /app maven:3.9.16-eclipse-temurin-21-alpine mvn -B verify
```

Las migraciones van en `src/main/resources/db/migration` y son inmutables: un cambio de esquema siempre es un archivo `V2__...sql` nuevo, nunca una edición de uno ya aplicado.

Responsable del área: @adarboleda.
