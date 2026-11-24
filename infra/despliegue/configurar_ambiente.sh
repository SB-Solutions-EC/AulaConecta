#!/usr/bin/env bash
# Configura el GitHub Environment "pruebas" (T1116-A). Se ejecuta en tu equipo, con gh autenticado
# y permiso de administrador en el repositorio. Nunca escribe una clave en el repositorio ni en disco.
#
# Paso 1, antes de crear la VM:   bash infra/despliegue/configurar_ambiente.sh claves
#   Crea el environment (solo despliega la rama test), genera las claves de PostgreSQL y RabbitMQ,
#   la clave de los datos de prueba y una llave SSH de despliegue. Imprime la llave pública para la VM.
#
# Paso 2, con la VM ya preparada: bash infra/despliegue/configurar_ambiente.sh servidor <IP o host> [dominio]
#   Guarda la dirección, el usuario, las huellas SSH del servidor y la URL del ambiente.
set -euo pipefail

REPO="${REPO:-SB-Solutions-EC/AulaConecta}"
AMBIENTE=pruebas

uso() { sed -n '2,12p' "$0" | sed 's/^# \{0,1\}//'; exit 1; }
existe() { gh secret list --repo "$REPO" --env "$AMBIENTE" --json name -q '.[].name' | grep -qx "$1"; }
aleatoria() { openssl rand -hex 24; }

paso_claves() {
  echo "==> Environment '$AMBIENTE' (solo la rama test puede desplegar)"
  gh api --silent -X PUT "repos/$REPO/environments/$AMBIENTE" --input - <<'EOF'
{"deployment_branch_policy": {"protected_branches": false, "custom_branch_policies": true}}
EOF
  gh api --silent -X POST "repos/$REPO/environments/$AMBIENTE/deployment-branch-policies" \
    -f name=test -f type=branch 2>/dev/null || echo "    (la regla para test ya existía)"

  # Las claves de PostgreSQL solo se crean una vez: init.sql las aplica al crear el volumen de datos
  # y cambiarlas después deja a los servicios sin acceso (infra/README.md, sección PostgreSQL).
  echo "==> Claves de PostgreSQL y RabbitMQ (solo las que faltan)"
  for nombre in POSTGRES_PASSWORD POSTGRES_IDENTIDAD_PASSWORD POSTGRES_ACADEMICO_PASSWORD \
                POSTGRES_NOTIFICACIONES_PASSWORD RABBITMQ_PASSWORD; do
    if existe "$nombre"; then
      echo "    $nombre ya existe, se conserva"
    else
      aleatoria | gh secret set "$nombre" --repo "$REPO" --env "$AMBIENTE"
      echo "    $nombre creada"
    fi
  done

  echo "==> Clave de las cuentas de prueba (infra/datos-prueba)"
  if existe CLAVE_DATOS_PRUEBA; then
    echo "    CLAVE_DATOS_PRUEBA ya existe, se conserva"
  else
    # Si el equipo ya acordó una, pásala en CLAVE_DATOS_PRUEBA; si no, se genera y se muestra una vez
    clave="${CLAVE_DATOS_PRUEBA:-$(openssl rand -base64 18 | tr -d '/+=' | cut -c1-16)}"
    printf '%s' "$clave" | gh secret set CLAVE_DATOS_PRUEBA --repo "$REPO" --env "$AMBIENTE"
    [[ -n "${CLAVE_DATOS_PRUEBA:-}" ]] || echo "    Clave generada (compártela solo por el canal del equipo): $clave"
  fi

  echo "==> Llave SSH de despliegue"
  if existe SSH_CLAVE_PRIVADA; then
    echo "    SSH_CLAVE_PRIVADA ya existe. Llave pública guardada en la variable SSH_CLAVE_PUBLICA:"
    gh variable get SSH_CLAVE_PUBLICA --repo "$REPO" --env "$AMBIENTE" 2>/dev/null || true
    return
  fi
  temporal="$(mktemp -d)"
  trap 'rm -rf "$temporal"' EXIT
  ssh-keygen -q -t ed25519 -N "" -C "despliegue-aulaconecta" -f "$temporal/llave"
  gh secret set SSH_CLAVE_PRIVADA --repo "$REPO" --env "$AMBIENTE" < "$temporal/llave"
  gh variable set SSH_CLAVE_PUBLICA --repo "$REPO" --env "$AMBIENTE" < "$temporal/llave.pub"
  gh variable set SSH_USUARIO --repo "$REPO" --env "$AMBIENTE" --body despliegue
  echo
  echo "Llave pública para preparar_servidor.sh (la privada ya está en GitHub y no queda en tu equipo):"
  cat "$temporal/llave.pub"
}

paso_servidor() {
  local host="${1:?Falta la IP o el nombre del servidor}"
  local dominio="${2:-$1}"
  echo "==> Huellas SSH de $host"
  local huellas
  huellas="$(ssh-keyscan -T 10 -t ed25519,ecdsa,rsa "$host" 2>/dev/null)"
  [[ -n "$huellas" ]] || { echo "No se pudo leer la huella de $host (¿el puerto 22 está abierto?)" >&2; exit 1; }
  # Compara estas huellas con las que imprimió preparar_servidor.sh en la VM
  printf '%s\n' "$huellas" | ssh-keygen -lf -
  gh variable set SSH_HUELLAS --repo "$REPO" --env "$AMBIENTE" --body "$huellas"
  gh variable set SSH_HOST --repo "$REPO" --env "$AMBIENTE" --body "$host"
  gh variable set URL_PRUEBAS --repo "$REPO" --env "$AMBIENTE" --body "https://$dominio"
  echo "Ambiente configurado: https://$dominio"
}

command -v gh >/dev/null || { echo "Instala GitHub CLI (gh) y ejecuta gh auth login" >&2; exit 1; }
case "${1:-}" in
  claves) paso_claves ;;
  servidor) shift; paso_servidor "$@" ;;
  *) uso ;;
esac
