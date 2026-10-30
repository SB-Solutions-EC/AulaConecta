# tests — Pruebas transversales del monorepo

Suite de pruebas transversales de **AulaConecta** que verifican el sistema integrado a través del Gateway (`https://localhost`). Las pruebas unitarias y de integración propias de cada microservicio viven dentro de su carpeta en `services/<servicio>/`.

| Carpeta | Herramienta | Propósito | Sprint |
|---|---|---|---|
| [e2e/](e2e) | Playwright | Pruebas extremo a extremo de flujos por rol y del modo sin conexión | Sprints 4, 5, 7 y 9 |
| [carga/](carga) | k6 | Pruebas de línea base (100 VU) y escenarios de carga, pico, estrés y resistencia (400 estudiantes y 60 docentes, RNF-06) | Sprints 5, 6 y 9 |

Documentación y reportes: [docs/pruebas/](../docs/pruebas).

