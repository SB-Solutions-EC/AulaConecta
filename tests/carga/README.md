# tests/carga — Pruebas de rendimiento y carga (k6)

Scripts de **k6** para validar el cumplimiento de **RNF-06** (60 docentes y 400 estudiantes simultáneos):

- `baseline.js`: línea base con 100 usuarios virtuales en login y libreta de calificaciones (Sprint 5).
- Carga del tablero del estudiante con 400 usuarios virtuales (Sprint 6).
- Escenarios de carga, pico, estrés y resistencia monitoreados con Prometheus y Grafana (Sprint 9).

