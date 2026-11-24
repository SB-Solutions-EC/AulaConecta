# packages/calculo-notas: cálculo de notas compartido

Cálculo de notas idéntico al libro de calificaciones oficial del colegio (RF-17, RF-18, RNF-02). Es el mismo código en la PWA (cálculo inmediato y sin conexión) y en ms-academico (cálculo oficial al guardar).

| Regla | Fórmula del libro oficial |
|---|---|
| Aportes | Dos bloques de 5 aportes. Cada bloque se promedia y las celdas vacías no cuentan |
| Refuerzo académico (opcional) | Se promedia con el promedio general |
| Ponderación | `TRUNCAR(aportes × 0,70; 2) + TRUNCAR(proyecto × 0,15; 2) + TRUNCAR(examen × 0,15; 2)`, y el total también se trunca a 2 decimales |
| Escala cualitativa | A+ (10) · A- (≥ 9) · B+ (≥ 8) · B- (≥ 7) · C+ (≥ 6) · C- (≥ 5) · D+ (≥ 4) · D- (≥ 3) · E+ (≥ 2) · E- (< 2) |
| Estándares | DA (A) · AA (B) · PA (C) · NA (D y E). Refuerzo si el promedio general es menor que 7 |

## Uso

```ts
import { calcularCalificacionInmediata } from '@aulaconecta/calculo-notas';

const { notaFinal, cualitativo } = calcularCalificacionInmediata({
  aportesBloque1: [8, 9, 8.5, 8.5, 9],
  aportesBloque2: [8, 8, 9, 8, 9],
  notaProyecto: 9,
  notaExamen: 8.5,
}); // 8.57, 'B+'
```

**En la PWA:** el alias `@aulaconecta/calculo-notas` está en `vite.config.ts` y `tsconfig.json`. La imagen Docker recibe el paquete como contexto adicional de BuildKit, sin ampliar su contexto a todo el repositorio:

```bash
docker build --build-context calculo-notas=packages/calculo-notas apps/pwa
```

`infra/docker-compose.yml` y el CI (`ci-imagen.yml`) ya lo pasan. Sin ese contexto, la construcción falla en el `COPY --from=calculo-notas`.

**En ms-academico (T1117-M):** como el servicio usa CommonJS, su `postinstall` copia `src/index.ts` a `services/ms-academico/src/generado/calculo-notas.ts` (ignorado por git) y se compila junto con el servicio. Así no hay una segunda copia del código en el repositorio. La imagen recibe el paquete con el mismo contexto adicional: `docker build --build-context calculo-notas=packages/calculo-notas services/ms-academico`.

## Pruebas: hoja oficial anonimizada (T1117-A, indicador I-05)

| Archivo | Qué es |
|---|---|
| [casos/generar_casos.py](casos/generar_casos.py) | **Oráculo independiente**: reproduce las fórmulas del libro oficial con aritmética exacta de fracciones (Python, sin coma flotante) y no comparte código con `src/` |
| [casos/hoja-oficial-anonimizada.json](casos/hoja-oficial-anonimizada.json) | 151 filas: 4 cursos de 30 estudiantes con notas **generadas** (semilla fija) y 31 casos límite |
| [test/hoja-oficial.test.ts](test/hoja-oficial.test.ts) | Prueba parametrizada: cada fila es un caso, y se comparan las 12 columnas calculadas. Más la hoja de estándares de cada curso |
| [test/calculo.test.ts](test/calculo.test.ts) | Pruebas unitarias de cada función |

Los casos límite cubren:
- `8,2 × 0,70`, que en coma flotante da `5,7399…` y el libro trunca a `5,74`;
- promedios periódicos (`8,333…`), celdas vacías y bloques incompletos;
- el refuerzo, también sin aportes;
- filas sin proyecto o sin examen;
- cada umbral de la escala, justo en el umbral y una centésima por debajo.

Las notas **no se transcriben de las hojas reales**, se generan, como pide el criterio de anonimización ([datos_sensibles.md](../../docs/seguridad/datos_sensibles.md), sección 3). Los estudiantes solo tienen un código.

```bash
npm ci
npm test                        # 163 pruebas
npm run test:cov                # cobertura: el mínimo es 100 % de líneas, ramas y funciones
npm run casos                   # regenera la hoja desde el oráculo
npm run casos:verificar         # falla si la hoja no coincide con su generador (lo corre el CI)
```

El job `calculo / calculo-notas` del CI ([ci-calculo.yml](../../.github/workflows/ci-calculo.yml)) publica en el resumen el indicador I-05 (casos que coinciden ÷ casos de la hoja) y guarda el reporte JUnit y JSON en el artefacto `calculo-resultados`.

## Pendiente de validar con el colegio (T1117-M)

- **Promedio del curso en la hoja de estándares:** el código lo **trunca** a 2 decimales y el prototipo lo **redondeaba** al mostrarlo. Hay que confirmar la regla del colegio; mientras tanto la prueba compara los conteos, no ese promedio.
- **Notas con más de 2 decimales:** la entrada acepta cualquier número de 0 a 10, pero el libro usa 1 o 2 decimales.
