#!/usr/bin/env bash
# Prueba negativa del CI (T1030-A): abre un PR hacia test con un secreto falso y una dependencia
# vulnerable, y comprueba que el pipeline lo bloquea. El PR nunca se fusiona.
#
# Uso:  bash scripts/github/prueba_negativa_ci.sh           crea la rama y el PR
#       bash scripts/github/prueba_negativa_ci.sh limpiar   cierra el PR y borra la rama
#
# Requisitos: gh autenticado y el repositorio sin cambios pendientes.
set -euo pipefail

REPO="SB-Solutions-EC/AulaConecta"
RAMA="prueba/ci-negativa"

if [ "${1:-}" = "limpiar" ]; then
  gh pr close "$RAMA" --repo "$REPO" --delete-branch --comment "Prueba negativa terminada: el PR se cierra sin fusionar."
  git branch -D "$RAMA" 2>/dev/null || true
  echo "Listo: PR cerrado y rama borrada."
  exit 0
fi

if [ -n "$(git status --porcelain)" ]; then
  echo "Hay cambios sin confirmar. Guárdalos antes de ejecutar la prueba." >&2
  exit 1
fi

git fetch -q origin dev
git switch -q -c "$RAMA" origin/dev

# Valor inventado. Se arma por partes para que este script no active Gitleaks en dev.
mkdir -p prueba-negativa
{
  echo "# Valor falso de la prueba negativa del CI: no da acceso a nada."
  echo "api_key = \"k8Zq3vN7xW2mP9tL""4rY6bH1cF5dJ0sGa\""
} > prueba-negativa/credenciales.properties

# log4j-core 2.14.1 tiene Log4Shell (CVE-2021-44228, CVSS 10)
sed -i '0,/<dependencies>/s//&\n        <dependency>\n            <groupId>org.apache.logging.log4j<\/groupId>\n            <artifactId>log4j-core<\/artifactId>\n            <version>2.14.1<\/version>\n        <\/dependency>/' \
  services/ms-identidad/pom.xml

git add prueba-negativa services/ms-identidad/pom.xml
git commit -q -m "Prueba negativa del CI: secreto falso y dependencia vulnerable (no fusionar)"
git push -q -u origin "$RAMA"

gh pr create --repo "$REPO" --base test --head "$RAMA" \
  --title "[NO FUSIONAR] Prueba negativa del CI" \
  --body "Prueba de la tarea T1030-A: este PR agrega a propósito un secreto falso y \`log4j-core\` 2.14.1. El pipeline debe bloquearlo. Se cierra sin fusionar."

git switch -q -
echo "Revisa el PR en unos minutos: gitleaks e identidad / ms-identidad deben fallar."
