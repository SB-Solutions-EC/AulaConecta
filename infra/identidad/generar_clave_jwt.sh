#!/bin/sh
# Genera la clave RSA con la que ms-identidad firma los tokens, solo para el entorno local.
# Se guarda en un volumen de Docker, nunca en el repositorio. En los ambientes desplegados llega como secreto.
set -eu

CLAVE=/clave-jwt/privada.pem

# Se conserva entre reinicios para que los tokens emitidos sigan siendo válidos
if [ -f "$CLAVE" ]; then
  echo "Clave de firma existente"
  exit 0
fi

openssl genpkey -algorithm RSA -pkeyopt rsa_keygen_bits:3072 -out "$CLAVE"

# Solo el usuario de ms-identidad (10001) puede leerla
chown 10001:10001 "$CLAVE"
chmod 400 "$CLAVE"
echo "Clave de firma generada"
