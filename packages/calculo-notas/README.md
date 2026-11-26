# packages/calculo-notas: cálculo de notas compartido

Cálculo de notas idéntico al libro de calificaciones oficial del colegio (RF-17, RF-18, RNF-02). Es el mismo código en la PWA (cálculo inmediato y sin conexión) y en ms-academico (cálculo oficial al guardar).

| Regla | Fórmula del libro oficial |
|---|---|
| Aportes | Dos bloques de 5 aportes. Cada bloque se promedia y las celdas vacías no cuentan |
| Refuerzo académico (opcional) | Se promedia con el promedio general |
| Ponderación | `TRUNCAR(aportes × 0,70; 2) + TRUNCAR(proyecto × 0,15; 2) + TRUNCAR(examen × 0,15; 2)`, y el total también se trunca a 2 decimales. Los porcentajes (70/15/15) los cambia el administrador ([ver ponderaciones configurables](#ponderaciones-configurables-t1125-a-rnf-10)) |
| Escala cualitativa | A+ (10) · A- (≥ 9) · B+ (≥ 8) · B- (≥ 7) · C+ (≥ 6) · C- (≥ 5) · D+ (≥ 4) · D- (≥ 3) · E+ (≥ 2) · E- (< 2) |
| Estándares | DA (A) · AA (B) · PA (C) · NA (D y E). Refuerzo si el promedio general es menor que 7 |
| Comportamiento (RF-22) | Nueve indicadores en 4 escalas (10 · 8 · 6 · 2): nota = promedio truncado a 2 decimales y cualitativo A a E. Ver [la sección de comportamiento](#pruebas-hoja-de-comportamiento-t1124-a-rf-22) |

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

**En ms-academico (T1117-M):** como el servicio usa CommonJS, su `postinstall` copia los `.ts` de `src/` a `services/ms-academico/src/generado/` (`index.ts` queda como `calculo-notas.ts`; ignorado por git) y se compila junto con el servicio. Así no hay una segunda copia del código en el repositorio. La imagen recibe el paquete con el mismo contexto adicional: `docker build --build-context calculo-notas=packages/calculo-notas services/ms-academico`.

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
npm test                        # 1059 pruebas
npm run test:cov                # cobertura: el mínimo es 100 % de líneas, ramas y funciones
npm run casos                   # regenera las hojas (notas, comportamiento y ponderaciones) desde sus oráculos
npm run casos:verificar         # falla si alguna hoja no coincide con su generador (lo corre el CI)
```

El job `calculo / calculo-notas` del CI ([ci-calculo.yml](../../.github/workflows/ci-calculo.yml)) publica en el resumen el indicador I-05 (casos que coinciden ÷ casos de la hoja) y guarda el reporte JUnit y JSON en el artefacto `calculo-resultados`.

## Pruebas: hoja de comportamiento (T1124-A, RF-22)

El comportamiento se evalúa con nueve indicadores (cuatro cognitivos y cinco sociales) en la escala Siempre, Frecuentemente, Ocasionalmente y Nunca. La función `calcularComportamiento` salió de la pantalla de la PWA (T1124-C) a este paquete para que ms-academico (T1124-M) use el mismo código y no una segunda copia (RNF-02).

| Archivo | Qué es |
|---|---|
| [casos/generar_casos_comportamiento.py](casos/generar_casos_comportamiento.py) | **Oráculo independiente** con fracciones exactas: promedio de los puntajes, `TRUNCAR(…; 2)` y cualitativo. No comparte código con `src/` |
| [casos/comportamiento-hoja-oficial.json](casos/comportamiento-hoja-oficial.json) | 140 filas: 4 cursos de 30 estudiantes con indicadores **generados** (semilla fija) y 20 casos límite |
| [test/comportamiento.test.ts](test/comportamiento.test.ts) | Cada fila es un caso (nota, cualitativo, etiqueta, descripción, indicadores completados). Más el resumen por cualitativo de cada curso y las propiedades de abajo |

Reglas que fija la prueba:

| Regla | Valor |
|---|---|
| Puntaje por escala | Siempre 10 · Frecuentemente 8 · Ocasionalmente 6 · Nunca 2 |
| Nota | Promedio de los indicadores marcados, **truncado** a 2 decimales (8,666… → 8,66, no 8,67) |
| Cualitativo | A (≥ 9) · B (≥ 7,5) · C (≥ 6) · D (≥ 4) · E (< 4), comparando la nota ya truncada |
| Evaluación oficial | Solo con los nueve indicadores. Con menos es una **vista previa** (`completo: false`): la PWA la muestra mientras el docente marca y el servidor no la guarda (RF-22: «indicadores incompletos → Incompleto») |

Además de la hoja, la prueba recorre **las 715 combinaciones posibles** de escalas (cuántos indicadores hay en cada una y cuántos faltan) contra aritmética de enteros, y comprueba que el orden en que se marcan no cambia el resultado. Un detalle que esta prueba hizo visible: sin la tolerancia de `1e-9` en la función, la coma flotante trunca mal algunas notas (`46 ÷ 5 = 9,2` daría `9,19`, y ese caso está en la hoja).

Los indicadores **no se transcriben de las hojas reales**, se generan (misma regla que las notas).

**Comprobación de la prueba.** Se debilitó la función de 12 maneras, una por vez, y todas hicieron fallar pruebas: redondear en vez de truncar (55), quitar la tolerancia de coma flotante (2), dividir entre 9 con indicadores sin marcar (7), cada corte del cualitativo (20, 15, 15 y 1), cambiar el puntaje de Frecuentemente (86) o de Nunca (79), dar por completa una evaluación de 8 indicadores (3), ignorar un indicador (145) y cambiar una descripción (40).

## Ponderaciones configurables (T1125-A, RNF-10)

RNF-10: el Administrador cambia una ponderación (o una escala, o un texto de comportamiento) sin modificar código y las notas del trimestre abierto se recalculan. Su escenario de medición es «cambiar 70/15/15 por 60/20/20». Para que eso sea posible, `calcularCalificacionInmediata(entrada, ponderaciones)` acepta las ponderaciones como segundo parámetro; si no se indican, usa las oficiales (`PONDERACIONES_OFICIALES`, 70/15/15), así que nada cambia para quien no las pase. `validarPonderaciones` es el validador que usan el servidor y la PWA: cada porcentaje de 0 a 100 con hasta 2 decimales y los tres suman exactamente 100 % (la suma se hace en centésimas, porque en coma flotante `18,08 + 0,07 + 81,85` da 99,99999999999999).

| Archivo | Qué es |
|---|---|
| [casos/generar_casos_ponderaciones.py](casos/generar_casos_ponderaciones.py) | Vuelve a calcular cada fila de la hoja oficial con otras ponderaciones, con el mismo oráculo de fracciones exactas de `generar_casos.py` (que ahora acepta las ponderaciones). Tiene `--verificar` |
| [casos/ponderaciones-hoja-oficial.json](casos/ponderaciones-hoja-oficial.json) | 5 escenarios (60/20/20, 50/25/25, 80/10/10, 100/0/0 y 33,33/33,33/33,34) por 143 filas: las que tienen proyecto y examen. Con 60/20/20 cambia la nota de 128 de las 143 filas y el cualitativo de 17 |
| [test/ponderaciones.test.ts](test/ponderaciones.test.ts) | Cada fila de cada escenario contra el oráculo; que sin indicar ponderaciones se usen las oficiales; que volver a 70/15/15 devuelva las notas de antes; y la validación (acepta y rechaza) |

**Comprobación de la prueba.** Se debilitó el cálculo y la validación de 10 maneras, una por vez, y todas hicieron fallar pruebas: ignorar la ponderación de los aportes (696) o del examen (712), usar la del examen en el proyecto (48), cambiar las ponderaciones por defecto (3), no exigir que sumen 100 (2), sumar en coma flotante (1), aceptar negativos (1), más de 100 (1), más de 2 decimales (1) o NaN e infinito (1).

La prueba del servidor (`services/ms-academico/test/seguridad/verificar-parametros.ts`) hace lo mismo por la API: el administrador cambia `ponderaciones_calificaciones` y las notas ya guardadas se recalculan.

## Pendiente de validar con el colegio (T1117-M y T1124-M)

- **Promedio del curso en la hoja de estándares:** el código lo **trunca** a 2 decimales y el prototipo lo **redondeaba** al mostrarlo. Hay que confirmar la regla del colegio; mientras tanto la prueba compara los conteos, no ese promedio.
- **Comportamiento:** los puntajes por escala (10 · 8 · 6 · 2) y los cortes del cualitativo (9 · 7,5 · 6 · 4) salen de la implementación de la PWA (T1124-C); el documento del proyecto solo dice «nueve indicadores en escala Siempre, Frecuentemente, Ocasionalmente y Nunca». Si el colegio los cambia, hay que cambiarlos en `src/comportamiento.ts` y en `casos/generar_casos_comportamiento.py`; la prueba falla hasta que coincidan.
- **Notas con más de 2 decimales:** la entrada acepta cualquier número de 0 a 10, pero el libro usa 1 o 2 decimales.
