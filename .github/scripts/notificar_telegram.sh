#!/usr/bin/env bash
# Notificador de Telegram v1: un único mensaje por ejecución que se actualiza con cada etapa.
# Uso: notificar_telegram.sh iniciar "Etapa=pendiente" ...      envía el mensaje y guarda su id en GITHUB_OUTPUT
#      notificar_telegram.sh actualizar "Etapa=resultado" ...   edita el mensaje MENSAJE_ID
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
    pendiente) echo "⏳" ;;
    *) echo "❔" ;;
  esac
}

llamar() {
  local metodo="$1"
  curl -sS --max-time 15 --retry 2 -H "Content-Type: application/json" -d @- "${API}/bot${TELEGRAM_BOT_TOKEN}/${metodo}" 2>&1
}

enviar() {
  jq -n --arg chat_id "$TELEGRAM_CHAT_ID" --arg text "$mensaje" \
    '{chat_id: $chat_id, text: $text, disable_web_page_preview: true}' | llamar sendMessage
}

editar() {
  jq -n --arg chat_id "$TELEGRAM_CHAT_ID" --argjson message_id "$MENSAJE_ID" --arg text "$mensaje" \
    '{chat_id: $chat_id, message_id: $message_id, text: $text, disable_web_page_preview: true}' | llamar editMessageText
}

campo() { jq -r "$1" <<<"$2" 2>/dev/null || echo "sin respuesta"; }

accion="$1"
shift

estado="✅ aprobado"
etapas=""
for etapa in "$@"; do
  resultado="${etapa##*=}"
  etapas+="$(icono "$resultado") ${etapa%=*}"$'\n'
  [ "$resultado" = "pendiente" ] && [ "$estado" != "❌ falló" ] && estado="⏳ en curso"
  case "$resultado" in failure | cancelled) estado="❌ falló" ;; esac
done

inicio="${INICIO:-$(date +%s)}"
segundos=$(($(date +%s) - inicio))

mensaje="AulaConecta · CI ${estado}"$'\n'"${etapas}"$'\n'
mensaje+="Rama: ${RAMA:-?}"$'\n'
mensaje+="Commit: ${COMMIT:0:7}"$'\n'
mensaje+="Duración: $((segundos / 60)) min $((segundos % 60)) s"$'\n'
mensaje+="${URL_EJECUCION:-}"

if [ "$accion" = "actualizar" ] && [ -n "${MENSAJE_ID:-}" ]; then
  respuesta=$(editar)
  # Telegram rechaza una edición sin cambios: el mensaje ya está al día
  if [ "$(campo '.ok // false' "$respuesta")" = "true" ] || [[ "$(campo '.description // ""' "$respuesta")" == *"not modified"* ]]; then
    echo "Mensaje de Telegram actualizado."
    exit 0
  fi
  echo "::warning::No se pudo editar el mensaje ($(campo '.description // "sin respuesta"' "$respuesta")): se envía uno nuevo."
fi

respuesta=$(enviar)
if [ "$(campo '.ok // false' "$respuesta")" = "true" ]; then
  echo "Aviso enviado a Telegram."
  [ -n "${GITHUB_OUTPUT:-}" ] && {
    echo "mensaje-id=$(campo '.result.message_id' "$respuesta")"
    echo "inicio=$inicio"
  } >>"$GITHUB_OUTPUT"
else
  echo "::warning::Telegram no aceptó el aviso: $(campo '.description // "sin respuesta"' "$respuesta")"
fi
exit 0
