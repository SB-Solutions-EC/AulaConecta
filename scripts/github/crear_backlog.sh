#!/usr/bin/env bash
# Crea el Product Backlog de AulaConecta en GitHub:
#   - etiquetas (tipo, prioridad y área)
#   - un milestone por sprint (3 a 10) con su fecha de cierre
#   - las 15 historias de usuario como issues, con su puesto en la matriz de Wiegers
#   - el tablero "AulaConecta – Product Backlog" en GitHub Projects con todas las historias
# Se puede ejecutar más de una vez: lo que ya existe no se duplica.
# Requisitos: gh autenticado con los permisos repo y project (gh auth refresh -s project).
set -euo pipefail

ORG="SB-Solutions-EC"
REPO="$ORG/AulaConecta"
TITULO_PROYECTO="AulaConecta – Product Backlog"

echo "== Etiquetas"
etiqueta() { gh label create "$1" --repo "$REPO" --color "$2" --description "$3" --force >/dev/null; echo "  $1"; }
etiqueta "historia"        "1D76DB" "Historia de usuario del Product Backlog"
etiqueta "prioridad:alta"  "B60205" "Necesaria en la primera versión"
etiqueta "prioridad:media" "FBCA04" "Deseable en la primera versión"
etiqueta "opcional"        "C5DEF5" "Se hace solo si el tiempo alcanza"
etiqueta "area:backend"    "5319E7" "API, base de datos y cálculo"
etiqueta "area:frontend"   "0E8A16" "PWA y trabajo sin conexión"
etiqueta "area:devsecops"  "D93F0B" "CI/CD, seguridad y despliegue"
etiqueta "defecto"         "E11D21" "Error encontrado en pruebas o en la revisión"

echo "== Milestones (sprints)"
milestone() {
  local titulo="$1" fecha="$2" desc="$3"
  if gh api "repos/$REPO/milestones?state=all&per_page=100" --jq '.[].title' | grep -Fxq "$titulo"; then
    echo "  ya existe: $titulo"
  else
    gh api "repos/$REPO/milestones" -f title="$titulo" -f due_on="${fecha}T23:59:59Z" -f description="$desc" >/dev/null
    echo "  $titulo"
  fi
}
milestone "Sprint 3 – Repositorio y CI/CD básico"   2026-10-30 "Organización, ramas protegidas, backlog, tecnologías y CI con avisos en Telegram"
milestone "Sprint 4 – Autenticación y matrícula"     2026-11-13 "Inicio de sesión por rol, gestión académica y matrícula"
milestone "Sprint 5 – Calificaciones"                2026-11-27 "Ambiente de pruebas, notas, tareas, asistencia y comportamiento"
milestone "Sprint 6 – Reportes y tableros"           2026-12-08 "Estándares, valoración de logros, tableros y vista del representante"
milestone "Sprint 7 – Planificación curricular"      2026-12-18 "Planificación con revisión, Word/PDF y calendario"
milestone "Sprint 8 – Notificaciones por WhatsApp"   2026-12-29 "Avisos con consentimiento, antiduplicados e historial"
milestone "Sprint 9 – Trabajo sin conexión"          2027-01-08 "PWA instalable, sincronización y prueba de carga"
milestone "Sprint 10 – Aceptación y entrega"         2027-01-15 "Criterios de aceptación y versión v1.0.0"

echo "== Historias de usuario"
URLS=()
historia() {
  local id="$1" texto="$2" reqs="$3" prio="$4" wiegers="$5" sprint="$6" area="$7"
  local titulo="$id · $texto"
  local existente
  existente=$(gh issue list --repo "$REPO" --state all --search "\"$id ·\" in:title" --json title,url --jq ".[] | select(.title | startswith(\"$id ·\")) | .url" | head -n1)
  if [ -n "$existente" ]; then
    echo "  ya existe: $id"; URLS+=("$existente"); return
  fi
  local etiquetas="historia,prioridad:$prio,area:$area"
  # Responsable del área (coordina la historia; las subactividades rotan entre los tres)
  local responsable
  case "$area" in
    backend) responsable="cmacuna7" ;;
    frontend) responsable="cmbonifaz" ;;
    devsecops) responsable="adarboleda" ;;
  esac
  local args=(--repo "$REPO" --title "$titulo" --label "$etiquetas" --assignee "$responsable")
  if [ "$sprint" = "opcional" ]; then
    args[5]="$etiquetas,opcional"
  else
    args+=(--milestone "$sprint")
  fi
  local cuerpo
  cuerpo=$(printf '**Historia:** %s\n\n**Requisitos:** %s\n\n**Prioridad:** %s · puesto %s en la matriz de Wiegers\n\n**Criterios de aceptación:** los de los requisitos indicados en el SRS (`docs/requisitos`).\n\n**Definición de terminado:** código en `dev`, pruebas y CI en verde, sin vulnerabilidades críticas o altas, evidencia registrada y aceptada en la revisión del sprint.' "$texto" "$reqs" "$prio" "$wiegers")
  local url
  url=$(gh issue create "${args[@]}" --body "$cuerpo")
  echo "  $id -> $url"; URLS+=("$url")
}
historia "HU-15" "Como equipo queremos un pipeline con pruebas y análisis de seguridad que avise por Telegram" "RNF-12 a RNF-15" alta "—" "Sprint 3 – Repositorio y CI/CD básico" devsecops
historia "HU-01" "Como usuario quiero iniciar sesión y ver solo las opciones de mi rol" "RF-01 a RF-03" alta 1 "Sprint 4 – Autenticación y matrícula" backend
historia "HU-03" "Como administrador quiero gestionar docentes, cursos, materias y año lectivo" "RF-05 a RF-07 (RF-08 opcional)" alta 2 "Sprint 4 – Autenticación y matrícula" backend
historia "HU-02" "Como secretaría quiero matricular estudiantes e importar la nómina desde Excel" "RF-04, RF-29" alta 6 "Sprint 4 – Autenticación y matrícula" backend
historia "HU-07" "Como docente quiero registrar los aportes y que la nota final se calcule igual que la hoja oficial" "RF-17, RF-18, RF-27" alta 5 "Sprint 5 – Calificaciones" backend
historia "HU-08" "Como docente quiero crear tareas y registrar asistencia y comportamiento" "RF-19 a RF-22" alta 8 "Sprint 5 – Calificaciones" frontend
historia "HU-11" "Como estudiante o representante quiero ver notas, asistencia, horario y alertas" "RF-28, RF-37, RF-38" alta 3 "Sprint 6 – Reportes y tableros" frontend
historia "HU-09" "Como docente quiero obtener la hoja de estándares y la valoración de logros sin cálculos manuales" "RF-23, RF-24, RF-26" alta 4 "Sprint 6 – Reportes y tableros" backend
historia "HU-10" "Como vicerrector quiero ver un tablero con el rendimiento de todos los cursos" "RF-25" alta 4 "Sprint 6 – Reportes y tableros" frontend
historia "HU-05" "Como vicerrector quiero aprobar o devolver la planificación con observaciones por campo" "RF-10, RF-12 a RF-14" alta 7 "Sprint 7 – Planificación curricular" backend
historia "HU-06" "Como docente quiero exportar la planificación aprobada a Word y PDF y ver su calendario" "RF-15, RF-16" alta 9 "Sprint 7 – Planificación curricular" frontend
historia "HU-04" "Como docente quiero llenar la planificación en la plantilla del Ministerio y enviarla a revisión" "RF-09, RF-11" alta 10 "Sprint 7 – Planificación curricular" frontend
historia "HU-14" "Como representante quiero recibir un WhatsApp cuando mi representado baje de 7 o falte" "RF-29 a RF-35" alta 13 "Sprint 8 – Notificaciones por WhatsApp" backend
historia "HU-13" "Como docente quiero registrar notas y asistencia sin internet y que se sincronicen después" "RNF-01, RF-35" alta 15 "Sprint 9 – Trabajo sin conexión" frontend
historia "HU-12" "Como docente quiero mensajería y recursos de estudio por materia" "RF-36" media 14 opcional frontend

echo "== Corresponsable de seguridad (Abner) en las historias con más riesgo"
for id in HU-01 HU-02 HU-13 HU-14; do
  n=$(gh issue list --repo "$REPO" --state all --search "\"$id ·\" in:title" --json number,title --jq ".[] | select(.title | startswith(\"$id ·\")) | .number" | head -n1)
  [ -n "$n" ] && gh issue edit "$n" --repo "$REPO" --add-assignee adarboleda >/dev/null && echo "  $id (#$n) + adarboleda"
done

echo "== Tablero en GitHub Projects"
NUM=$(gh project list --owner "$ORG" --format json --jq ".projects[] | select(.title == \"$TITULO_PROYECTO\") | .number" | head -n1)
if [ -z "$NUM" ]; then
  NUM=$(gh project create --owner "$ORG" --title "$TITULO_PROYECTO" --format json --jq '.number')
  echo "  creado: proyecto #$NUM"
else
  echo "  ya existe: proyecto #$NUM"
fi
gh project link "$NUM" --owner "$ORG" --repo "$REPO" >/dev/null 2>&1 || true
for url in "${URLS[@]}"; do
  gh project item-add "$NUM" --owner "$ORG" --url "$url" >/dev/null && echo "  agregado: $url"
done
echo "Listo: https://github.com/orgs/$ORG/projects/$NUM"
