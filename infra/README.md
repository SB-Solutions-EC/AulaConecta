# infra — infraestructura

Archivos para levantar y desplegar AulaConecta.

| Archivo (cuando exista) | Para qué |
|---|---|
| `docker-compose.yml` | Levanta en local el gateway, los 3 microservicios, la PWA, RabbitMQ y PostgreSQL (sprint 3) |
| `traefik/` | Configuración del gateway: TLS, rutas y límite de peticiones |
| `postgres/init.sql` | Crea las tres bases y un usuario por servicio |
| `nginx/` | Servidor de la PWA con cabeceras de seguridad |
| `despliegue/` | Ambiente de pruebas con despliegue continuo desde `test` (sprint 5) |

Contenedores, redes y puertos: [docs/arquitectura/c4.md](../docs/arquitectura/c4.md).

Responsable del área: @adarboleda.
