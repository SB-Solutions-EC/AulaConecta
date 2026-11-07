# ms-identidad

Microservicio de usuarios, roles y autenticación de AulaConecta, en **Spring Boot 4 + Java 21**. Implementa el contrato [openapi/ms-identidad.yaml](../../openapi/ms-identidad.yaml); diseño y modelo de datos en [docs/arquitectura/c4.md](../../docs/arquitectura/c4.md).

| Cuándo | Qué se construye |
|---|---|
| Sprint 3 (27/10) | Esqueleto con `/health` y publicación por el gateway |
| Sprint 3 (28/10) | `db_identidad` con Flyway |
| Sprint 4 (05/11) | Inicio de sesión, JWT RS256, JWKS, Argon2id y cambio obligatorio de la clave inicial |
| Sprint 4 (06/11) | Creación de usuarios, bloqueo tras 3 intentos y auditoría de accesos |

## Endpoints implementados

Por el gateway llevan el prefijo `/api/identidad`.

| Método y ruta | Acceso | Qué hace |
|---|---|---|
| `GET /health` | Público | Estado del servicio |
| `GET /.well-known/jwks.json` | Público | Clave pública para validar los tokens en los otros servicios |
| `POST /auth/login` | Público | Devuelve un token de acceso de 15 minutos |
| `GET /auth/me` | Token | Datos de la cuenta de la sesión |
| `POST /auth/cambiar-clave` | Token | Cambia la clave y devuelve un token nuevo |

## Seguridad

| Tema | Decisión |
|---|---|
| Tokens | JWT RS256 con `sub` (id), `roles`, `debe_cambiar_clave`, `iss`, `aud`, `exp` y `kid`. Sin datos personales |
| Clave de firma | RSA de 2048 bits o más, leída de un archivo-secreto (`AULACONECTA_JWT_CLAVE_PRIVADA`), nunca de la base ni del repositorio. El `kid` es la huella de la clave |
| Claves de usuario | Argon2id con los parámetros mínimos de OWASP. Un hash BCrypt heredado sigue funcionando y se migra a Argon2id en el siguiente inicio de sesión |
| Clave inicial (RF-03) | Con `debe_cambiar_clave = true` el token solo sirve para `/auth/me` y `/auth/cambiar-clave`; cualquier otra ruta responde 403 |
| Errores | Usuario inexistente, clave incorrecta y cuenta inactiva responden igual y tardan lo mismo; una cuenta bloqueada responde 423 con o sin la clave correcta |

Los otros servicios deben validar los tokens con el JWKS, comprobar `iss` y `aud`, y **rechazar los que traigan `debe_cambiar_clave = true`**.

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
