# infra — infraestructura

Archivos para levantar y desplegar AulaConecta.

| Archivo | Para qué |
|---|---|
| `docker-compose.yml` | Levanta en local el gateway, los microservicios, la PWA, RabbitMQ y PostgreSQL (sprint 3) |
| `traefik/` | Configuración del gateway: TLS, rutas y límite de peticiones (sprint 3) |
| `postgres/init.sql` | Crea las tres bases y un usuario por servicio |
| `rabbitmq/` | Configuración e inicialización de RabbitMQ (`aulaconecta.eventos`, `notificaciones.avisos` y DLQ) |
| `despliegue/` | Ambiente de pruebas con despliegue continuo desde `test` (sprint 5) |

## Levantar el stack local

Solo se necesita Docker. Desde la raíz del repositorio:

```bash
cp infra/.env.example infra/.env                         # solo la primera vez; cambia las claves
docker compose -f infra/docker-compose.yml up --build -d
curl -k https://localhost/api/identidad/health           # {"status":"UP"}
curl -k https://localhost/api/notificaciones/health      # {"status":"UP"}
curl -k https://localhost/health                         # {"status":"UP"}
docker compose -f infra/docker-compose.yml down
```

Usa los puertos 80 y 443 del equipo; si otro programa los ocupa, hay que cerrarlo. El certificado de `localhost` es autofirmado: `curl` necesita `-k` y el navegador muestra una advertencia. Lo genera el servicio `certificados` al arrancar y queda en un volumen de Docker, nunca en el repositorio.

## PostgreSQL

Un servidor con tres bases y un usuario por servicio (`usr_identidad`, `usr_academico` y `usr_notificaciones`). Cada usuario solo puede conectarse a su base y ninguno puede crear bases ni usuarios. No publica puertos: solo se llega desde la red interna.

| Tema | Decisión |
|---|---|
| Claves | Por variables de entorno desde `infra/.env` (ignorado por git). `postgres/init.sql` las lee con `\getenv` |
| Creación | `postgres/init.sql` corre **una sola vez**, con el volumen vacío. Para aplicar un cambio en ese archivo o en las claves hay que borrar los datos: `docker compose -f infra/docker-compose.yml down -v` |
| Autenticación | Toda conexión exige contraseña (SCRAM-SHA-256), incluso dentro del contenedor |
| Migraciones | Las aplica cada servicio al arrancar, con su propio usuario: Flyway en ms-identidad, Prisma en ms-academico y Alembic en ms-notificaciones |
| Prisma | `usr_academico` no puede crear bases, así que `prisma migrate dev` necesita una `shadowDatabaseUrl`; `prisma migrate deploy` funciona sin cambios |

Para abrir una consola en una base:

```bash
docker compose -f infra/docker-compose.yml exec postgres sh -c 'PGPASSWORD=$POSTGRES_PASSWORD psql -U postgres -d db_identidad'
```

## RabbitMQ

El broker de eventos corre en la red `interna` (`rabbitmq:5672`) y carga automáticamente `infra/rabbitmq/definitions.json` al iniciar:

- **Exchange:** `aulaconecta.eventos` (tipo `topic`, durable).
- **Cola principal:** `notificaciones.avisos` (enlazada a `academico.promedio_bajo` y `academico.falta_registrada`).
- **Cola de mensajes fallidos (DLQ):** `notificaciones.avisos.dlq`.
- **Panel de administración local:** `http://127.0.0.1:15672` (ligado únicamente a `127.0.0.1`, con las credenciales `RABBITMQ_USER` y `RABBITMQ_PASSWORD` de `infra/.env`).

## Gateway

| Tema | Decisión |
|---|---|
| Configuración | `traefik/traefik.yml` (puntos de entrada) y `traefik/dinamico.yml` (rutas, middlewares y TLS) |
| Proveedor | Archivo, no Docker: el gateway no necesita acceso a `docker.sock` |
| Límite de peticiones | 100 por segundo por IP, con ráfaga de 200. Es alto porque todo el colegio puede salir por una misma IP; se ajusta con las pruebas de k6. El límite por usuario llega con la autenticación (T1105-A) |
| TLS | Solo TLS 1.2 o superior; HTTP redirige a HTTPS |

Para publicar otro servicio, agrega en `traefik/dinamico.yml` un router con su prefijo, un middleware `stripPrefix` y el servicio, y conéctalo en `docker-compose.yml` a la red `interna`, sin publicar puertos.

Contenedores, redes y puertos: [docs/arquitectura/c4.md](../docs/arquitectura/c4.md).

Responsable del área: @adarboleda.
