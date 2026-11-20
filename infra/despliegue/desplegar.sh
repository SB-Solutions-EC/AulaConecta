#!/usr/bin/env bash
# Despliega una versión de AulaConecta en el ambiente de pruebas (T1116-A).
# Lo ejecuta el workflow cd-pruebas.yml por SSH en el servidor; también sirve a mano.
#
# Uso: desplegar.sh <versión> [carpeta de la versión]
#   <versión>  etiqueta de las imágenes en GHCR, por ejemplo sha-1a2b3c4
#   carpeta    donde está la copia de infra/ de esa versión (por defecto $DIR_DESPLIEGUE/versiones/<versión>)
#
# Variables opcionales:
#   DIR_DESPLIEGUE   raíz del ambiente (por defecto /opt/aulaconecta); ahí vive .env, que nunca se versiona
#   OMITIR_DESCARGA  1 = usar imágenes que ya están en el equipo (prueba local)
#   REGISTRO         prefijo de las imágenes (por defecto ghcr.io/sb-solutions-ec/aulaconecta)
#   PROYECTO         nombre del proyecto de Docker Compose (por defecto aulaconecta)
#   PODAR_IMAGENES   0 = no borrar imágenes sin uso (prueba local en un equipo personal)
set -euo pipefail

VERSION="${1:?Uso: desplegar.sh <versión> [carpeta de la versión]}"
DIR_DESPLIEGUE="${DIR_DESPLIEGUE:-/opt/aulaconecta}"
CARPETA="${2:-$DIR_DESPLIEGUE/versiones/$VERSION}"
ARCHIVO_ENV="$DIR_DESPLIEGUE/.env"
export VERSION

paso() { printf '\n==> %s\n' "$*"; }

[[ "$VERSION" =~ ^[A-Za-z0-9._-]+$ ]] || { echo "Versión inválida: $VERSION" >&2; exit 2; }
[[ -f "$CARPETA/infra/docker-compose.yml" ]] || { echo "No existe $CARPETA/infra/docker-compose.yml" >&2; exit 2; }
[[ -f "$ARCHIVO_ENV" ]] || { echo "Falta $ARCHIVO_ENV con las claves del ambiente" >&2; exit 2; }

compose() {
  docker compose --project-name "${PROYECTO:-aulaconecta}" \
    --project-directory "$CARPETA/infra" \
    -f "$CARPETA/infra/docker-compose.yml" \
    -f "$CARPETA/infra/despliegue/docker-compose.pruebas.yml" \
    --env-file "$ARCHIVO_ENV" "$@"
}

paso "Validar la configuración de la versión $VERSION"
compose config --quiet

if [[ "${OMITIR_DESCARGA:-0}" != "1" ]]; then
  paso "Descargar las imágenes publicadas por el CI"
  compose pull --quiet --ignore-buildable
fi

paso "Construir la imagen de migraciones de db_academico"
compose build --quiet migraciones-academico

paso "Levantar el stack y esperar a que todos los servicios estén sanos"
compose up --detach --wait --wait-timeout 300 --remove-orphans

paso "Cargar los datos de prueba ficticios (T1116-M)"
for semilla in semilla-identidad semilla-academico semilla-notificaciones; do
  compose --profile datos-prueba run --rm --no-deps "$semilla"
done

paso "Comprobar las rutas a través del gateway"
for ruta in /health /api/identidad/health /api/academico/health /api/notificaciones/health; do
  for intento in 1 2 3 4 5 6; do
    if curl --silent --show-error --fail --insecure --max-time 5 "https://localhost$ruta" >/dev/null; then
      echo "OK  $ruta"
      break
    fi
    [[ $intento -eq 6 ]] && { echo "FALLA $ruta" >&2; exit 1; }
    sleep 5
  done
done

paso "Registrar la versión desplegada y limpiar"
echo "$VERSION $(date -u +%Y-%m-%dT%H:%M:%SZ)" >> "$DIR_DESPLIEGUE/historial.txt" 2>/dev/null || true
if [[ -d "$DIR_DESPLIEGUE/versiones" ]]; then
  # Se conservan las 3 versiones más recientes para poder volver atrás
  ls -1dt "$DIR_DESPLIEGUE"/versiones/*/ 2>/dev/null | tail -n +4 | xargs -r rm -rf
fi
if [[ "${PODAR_IMAGENES:-1}" == "1" ]]; then
  docker image prune --force --filter "until=168h" >/dev/null || true
fi

compose ps --format 'table {{.Service}}\t{{.Image}}\t{{.Status}}'
echo
echo "Versión $VERSION desplegada."
