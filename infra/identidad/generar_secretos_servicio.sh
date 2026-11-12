#!/bin/sh
# Genera el secreto de cada cliente de servicio (client credentials, T1110-A), solo para el entorno local.
# Uso: generar_secretos_servicio.sh ms-academico [otro-cliente ...]
#
#  - /secretos/<cliente>/secreto  → volumen que solo monta ese cliente (por ejemplo ms-academico)
#  - /hashes/<cliente>.sha256     → volumen que monta ms-identidad: guarda el SHA-256, nunca el secreto
#
# Se guarda en volúmenes de Docker, nunca en el repositorio. En los ambientes desplegados llega como secreto.
set -eu

for cliente in "$@"; do
  case "$cliente" in
    *[!a-z0-9-]* | "") echo "client_id inválido: $cliente" >&2; exit 1 ;;
  esac
  secreto="/secretos/$cliente/secreto"
  hash="/hashes/$cliente.sha256"

  # Se conserva entre reinicios; para rotarlo basta con borrar el volumen del cliente
  if [ ! -f "$secreto" ]; then
    # 32 bytes al azar (256 bits) en base64url sin relleno: 43 caracteres
    openssl rand -base64 32 | tr '+/' '-_' | tr -d '=\n' > "$secreto"
    echo "Secreto de $cliente generado"
  fi

  # El hash se recalcula siempre, así ms-identidad recibe el nuevo si el secreto cambió
  openssl dgst -sha256 -r "$secreto" | cut -d' ' -f1 > "$hash"

  # Los dos servicios corren con el usuario 10001; solo el cliente puede leer su secreto
  chown 10001:10001 "$secreto" "$hash"
  chmod 400 "$secreto"
  chmod 444 "$hash"
done
echo "Secretos de servicio listos: $*"
