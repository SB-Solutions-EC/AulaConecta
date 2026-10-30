# ms-identidad

Microservicio de usuarios, roles y autenticación de AulaConecta, en **Spring Boot 4 + Java 21**. Por ahora es el esqueleto (T1027-A): solo expone `/health`. Diseño y modelo de datos en [docs/arquitectura/c4.md](../../docs/arquitectura/c4.md).

| Cuándo | Qué se construye |
|---|---|
| Sprint 3 (27/10) | Esqueleto con `/health` y publicación por el gateway |
| Sprint 3 (28/10) | `db_identidad` con Flyway |
| Sprint 4 | Inicio de sesión, JWT, JWKS, usuarios, bloqueo de cuenta y auditoría de accesos |

## Cómo ejecutarlo

Con Docker, junto con el gateway (ver [infra/](../../infra)):

```bash
docker compose -f infra/docker-compose.yml up --build
curl -k https://localhost/api/identidad/health
```

Pruebas, con Java 21 instalado:

```bash
./mvnw verify        # en Windows: mvnw.cmd verify
```

Sin Java 21, con Docker:

```bash
docker run --rm -v "$PWD:/app" -w /app maven:3.9.16-eclipse-temurin-21-alpine mvn -B verify
```

Responsable del área: @adarboleda.
