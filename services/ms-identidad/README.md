# ms-identidad

Microservicio de usuarios, roles y autenticación de AulaConecta, en **Spring Boot 4 + Java 21**. Por ahora es el esqueleto: expone `/health` y crea su esquema en `db_identidad` con Flyway al arrancar. Diseño y modelo de datos en [docs/arquitectura/c4.md](../../docs/arquitectura/c4.md).

| Cuándo | Qué se construye |
|---|---|
| Sprint 3 (27/10) | Esqueleto con `/health` y publicación por el gateway |
| Sprint 3 (28/10) | `db_identidad` con Flyway |
| Sprint 4 | Inicio de sesión, JWT, JWKS, usuarios, bloqueo de cuenta y auditoría de accesos |

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

Las pruebas de la migración usan un PostgreSQL real con Testcontainers. Si no hay Docker, se omiten y las demás siguen corriendo.

Sin Java 21, con Docker:

```bash
docker run --rm -v "$PWD:/app" -v //var/run/docker.sock:/var/run/docker.sock \
  -e TESTCONTAINERS_HOST_OVERRIDE=host.docker.internal -e TESTCONTAINERS_RYUK_DISABLED=true \
  -w /app maven:3.9.16-eclipse-temurin-21-alpine mvn -B verify
```

Las migraciones van en `src/main/resources/db/migration` y son inmutables: un cambio de esquema siempre es un archivo `V2__...sql` nuevo, nunca una edición de uno ya aplicado.

Responsable del área: @adarboleda.
