#!/usr/bin/env bash
# Notificador de Telegram v0: envía un mensaje con el resultado de cada etapa del pipeline.
# Uso: notificar_telegram.sh "Título" "Etapa=resultado" ["Etapa=resultado"...]
# Un fallo de Telegram nunca detiene el pipeline, y el mensaje no lleva datos personales ni secretos.
set -uo pipefail

API="${TELEGRAM_API:-https://api.telegram.org}"

if [ -z "${TELEGRAM_BOT_TOKEN:-}" ] || [ -z "${TELEGRAM_CHAT_ID:-}" ]; then
  echo "::warning::Sin secretos de Telegram (normal en PR desde forks): no se envía el aviso."
  exit 0
fi

icono() {
  case "$1" in
    success) echo "✅" ;;
    failure) echo "❌" ;;
    cancelled) echo "⏹️" ;;
    skipped) echo "⏭️" ;;
    *) echo "❔" ;;
  esac
}

titulo="$1"
shift

mensaje="AulaConecta · ${titulo}"$'\n'
for etapa in "$@"; do
  mensaje+="$(icono "${etapa##*=}") ${etapa%=*}"$'\n'
done
mensaje+=$'\n'"Rama: ${RAMA:-?}"$'\n'
mensaje+="Commit: ${COMMIT:0:7}"$'\n'
mensaje+="${URL_EJECUCION:-}"

respuesta=$(jq -n --arg chat_id "$TELEGRAM_CHAT_ID" --arg text "$mensaje" \
    '{chat_id: $chat_id, text: $text, disable_web_page_preview: true}' |
  curl -sS --max-time 15 --retry 2 -H "Content-Type: application/json" -d @- \
    "${API}/bot${TELEGRAM_BOT_TOKEN}/sendMessage" 2>&1)

if [ "$(jq -r '.ok // false' <<<"$respuesta" 2>/dev/null)" = "true" ]; then
  echo "Aviso enviado a Telegram."
else
  echo "::warning::Telegram no aceptó el aviso: $(jq -r '.description // "sin respuesta"' <<<"$respuesta" 2>/dev/null || echo "sin respuesta")"
fi
exit 0
