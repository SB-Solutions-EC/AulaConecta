#!/usr/bin/env bash
# Prepara una VM Ubuntu (22.04 o 24.04, x86-64) como servidor del ambiente de pruebas (T1116-A).
# Se ejecuta UNA vez, en la VM, con un usuario administrador:
#   sudo bash preparar_servidor.sh "ssh-ed25519 AAAA... despliegue-aulaconecta"
# La clave pública la imprime configurar_ambiente.sh (paso 1 de infra/despliegue/README.md).
#
# Deja: Docker Engine con el plugin de Compose, el usuario "despliegue" (solo entra con esa llave),
# la carpeta /opt/aulaconecta, el firewall con 22, 80 y 443, y 2 GB de swap si la VM no tiene.
set -euo pipefail

CLAVE_PUBLICA="${1:?Uso: sudo bash preparar_servidor.sh \"<clave pública SSH de despliegue>\"}"
USUARIO=despliegue
DIR_DESPLIEGUE=/opt/aulaconecta

[[ $EUID -eq 0 ]] || { echo "Ejecuta con sudo" >&2; exit 1; }
[[ "$CLAVE_PUBLICA" =~ ^ssh-(ed25519|rsa)\ [A-Za-z0-9+/=]+ ]] || { echo "La clave pública no es válida" >&2; exit 1; }
# shellcheck source=/dev/null
. /etc/os-release
[[ "$ID" == "ubuntu" ]] || { echo "Este script es para Ubuntu (encontrado: $ID)" >&2; exit 1; }

echo "==> Docker Engine y Compose desde el repositorio oficial de Docker"
export DEBIAN_FRONTEND=noninteractive
apt-get update -qq
apt-get install -y -qq ca-certificates curl ufw >/dev/null
install -m 0755 -d /etc/apt/keyrings
curl -fsSL https://download.docker.com/linux/ubuntu/gpg -o /etc/apt/keyrings/docker.asc
chmod a+r /etc/apt/keyrings/docker.asc
echo "deb [arch=$(dpkg --print-architecture) signed-by=/etc/apt/keyrings/docker.asc] https://download.docker.com/linux/ubuntu ${VERSION_CODENAME} stable" \
  > /etc/apt/sources.list.d/docker.list
apt-get update -qq
apt-get install -y -qq docker-ce docker-ce-cli containerd.io docker-buildx-plugin docker-compose-plugin >/dev/null
systemctl enable --now docker >/dev/null

echo "==> Usuario $USUARIO (solo con la llave de despliegue)"
id "$USUARIO" >/dev/null 2>&1 || useradd --create-home --shell /bin/bash "$USUARIO"
# El grupo docker equivale a root en esta VM: por eso el usuario solo entra con la llave del workflow
usermod -aG docker "$USUARIO"
install -d -m 700 -o "$USUARIO" -g "$USUARIO" "/home/$USUARIO/.ssh"
printf '%s\n' "$CLAVE_PUBLICA" > "/home/$USUARIO/.ssh/authorized_keys"
chown "$USUARIO:$USUARIO" "/home/$USUARIO/.ssh/authorized_keys"
chmod 600 "/home/$USUARIO/.ssh/authorized_keys"
install -d -m 750 -o "$USUARIO" -g "$USUARIO" "$DIR_DESPLIEGUE"

echo "==> SSH solo con llaves y sin root"
cat > /etc/ssh/sshd_config.d/10-aulaconecta.conf <<'EOF'
PasswordAuthentication no
KbdInteractiveAuthentication no
PermitRootLogin no
EOF
systemctl reload ssh 2>/dev/null || systemctl reload sshd

echo "==> Firewall: SSH, HTTP (redirige a HTTPS) y HTTPS"
ufw allow OpenSSH >/dev/null
ufw allow 80/tcp >/dev/null
ufw allow 443/tcp >/dev/null
ufw --force enable >/dev/null

if ! swapon --show | grep -q .; then
  echo "==> 2 GB de swap (ms-identidad, PostgreSQL y RabbitMQ en una VM de 4 GB)"
  fallocate -l 2G /swapfile
  chmod 600 /swapfile
  mkswap /swapfile >/dev/null
  swapon /swapfile
  echo '/swapfile none swap sw 0 0' >> /etc/fstab
fi

echo
echo "Servidor listo: $(docker --version), $(docker compose version)"
echo "Huellas SSH de esta VM (compáralas con las que guarda configurar_ambiente.sh en SSH_HUELLAS):"
for archivo in /etc/ssh/ssh_host_*_key.pub; do
  ssh-keygen -lf "$archivo"
done
