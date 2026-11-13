#!/bin/sh
# Genera el certificado autofirmado del gateway para el trabajo local.
# Se guarda en un volumen de Docker: nunca en el repositorio.
set -eu

CERT=/certificados/gateway.pem
KEY=/certificados/gateway.key

# Se conserva el certificado mientras le quede al menos un día de vigencia
if [ -f "$CERT" ] && openssl x509 -checkend 86400 -noout -in "$CERT" >/dev/null 2>&1; then
  echo "Certificado vigente"
  exit 0
fi

openssl req -x509 -newkey ec -pkeyopt ec_paramgen_curve:prime256v1 -nodes -sha256 -days 365 \
  -keyout "$KEY" -out "$CERT" \
  -subj "/O=AulaConecta (local)/CN=localhost" \
  -addext "subjectAltName=DNS:localhost,IP:127.0.0.1"

# El gateway corre con este usuario y solo él puede leer la clave privada
chown 65532:65532 "$CERT" "$KEY"
chmod 644 "$CERT"
chmod 600 "$KEY"
echo "Certificado generado"
