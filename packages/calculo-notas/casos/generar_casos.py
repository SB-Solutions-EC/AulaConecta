"""Hoja oficial anonimizada para las pruebas del cálculo de notas (T1117-A, indicador I-05).

Reproduce las fórmulas del libro de calificaciones oficial del colegio (CALIFICACIONES 2025-2026.xlsx,
validado con el cliente en el prototipo) con aritmética EXACTA de fracciones, sin coma flotante:

    promedio de cada bloque   = PROMEDIO(aportes)                (las celdas vacías no cuentan)
    promedio general          = PROMEDIO(bloque 1; bloque 2)
    con refuerzo (opcional)   = PROMEDIO(promedio general; refuerzo)
    70 %                      = TRUNCAR(con refuerzo × 0,70; 2)
    proyecto 15 %             = TRUNCAR(proyecto × 0,15; 2)
    examen 15 %               = TRUNCAR(examen × 0,15; 2)
    nota final                = TRUNCAR(70 % + proyecto + examen; 2)
    cualitativo               = A+ (10) · A- (≥9) · B+ (≥8) · B- (≥7) · C+ (≥6) · C- (≥5) · D+ (≥4) · D- (≥3) · E+ (≥2) · E- (<2)
    estándar                  = DA (A) · AA (B) · PA (C) · NA (D y E)

Es un oráculo independiente: no comparte código con packages/calculo-notas/src, así que una
diferencia entre los dos (por ejemplo, un error de redondeo de coma flotante) hace fallar la prueba.

Las notas NO se transcriben de las hojas reales: se generan con una semilla fija
(criterio de anonimización, docs/seguridad/datos_sensibles.md, sección 3). Los estudiantes no tienen
nombre, solo un código.

Uso:
    python casos/generar_casos.py              # escribe hoja-oficial-anonimizada.json
    python casos/generar_casos.py --verificar  # falla si el archivo no coincide con lo que genera este script
"""

import argparse
import json
import random
import sys
from fractions import Fraction
from pathlib import Path
from typing import Any

SEMILLA = 20261117
ARCHIVO = Path(__file__).with_name("hoja-oficial-anonimizada.json")
CURSOS = ["8vo EGB A", "9no EGB A", "9no EGB B", "10mo EGB A"]
ESTUDIANTES_POR_CURSO = 30
APORTES_POR_BLOQUE = 5
ESCALA = [(10, "A+"), (9, "A-"), (8, "B+"), (7, "B-"), (6, "C+"), (5, "C-"), (4, "D+"), (3, "D-"), (2, "E+"), (0, "E-")]
ESTANDAR = {"A": "DA", "B": "AA", "C": "PA", "D": "NA", "E": "NA"}

Nota = Fraction | None


# ---------------------------- Fórmulas del libro oficial ----------------------------


def truncar(valor: Fraction) -> Fraction:
    """TRUNCAR(valor; 2): hacia cero, a centésimas. int() de una fracción trunca hacia cero."""
    return Fraction(int(valor * 100), 100)


def promedio(valores: list[Nota]) -> Nota:
    """PROMEDIO de Excel: ignora las celdas vacías; sin ninguna, la celda queda vacía."""
    presentes = [v for v in valores if v is not None]
    return sum(presentes, Fraction(0)) / len(presentes) if presentes else None


def cualitativo(nota_final: Nota) -> str | None:
    if nota_final is None:
        return None
    return next(etiqueta for minimo, etiqueta in ESCALA if nota_final >= minimo)


def calcular(entrada: dict[str, Any]) -> dict[str, Any]:
    """Una fila del libro: devuelve cada columna calculada."""
    bloque1 = promedio(entrada["aportesBloque1"])
    bloque2 = promedio(entrada["aportesBloque2"])
    general = promedio([bloque1, bloque2])
    con_refuerzo = promedio([general, entrada["refuerzo"]]) if entrada["refuerzo"] is not None else general
    c70 = truncar(con_refuerzo * Fraction(70, 100)) if con_refuerzo is not None else None
    proyecto = truncar(entrada["notaProyecto"] * Fraction(15, 100)) if entrada["notaProyecto"] is not None else None
    examen = truncar(entrada["notaExamen"] * Fraction(15, 100)) if entrada["notaExamen"] is not None else None
    final = truncar(c70 + proyecto + examen) if None not in (c70, proyecto, examen) else None
    letra = cualitativo(final)
    return {
        "promedioBloque1": bloque1,
        "promedioBloque2": bloque2,
        "promedioGeneral": general,
        "promedioConRefuerzo": con_refuerzo,
        "componente70": c70,
        "componenteProyecto15": proyecto,
        "componenteExamen15": examen,
        "notaFinal": final,
        "cualitativo": letra,
        "estandar": ESTANDAR[letra[0]] if letra else None,
        "requiereRefuerzo": general is not None and general < 7,
        "alertaPromedioBajo": final is not None and final < 7,
    }


# ---------------------------- Notas generadas (no reales) ----------------------------


def nota(texto: str | None) -> Nota:
    return Fraction(texto) if texto is not None else None


def generar_nota(azar: random.Random, base: float, dispersion: float) -> Fraction:
    """Nota de 0 a 10 con 1 o 2 decimales alrededor del nivel del estudiante."""
    valor = min(10.0, max(0.0, base + azar.uniform(-dispersion, dispersion)))
    decimales = azar.choice([1, 2, 2])
    return Fraction(round(valor * 10**decimales), 10**decimales)


def generar_estudiante(azar: random.Random) -> dict[str, Any]:
    # Nivel del estudiante: la mayoría entre 6 y 9,5, algunos con promedio bajo
    base = azar.triangular(3.0, 10.0, 7.8)
    bloques = []
    for _ in range(2):
        aportes: list[Nota] = [generar_nota(azar, base, 1.5) for _ in range(APORTES_POR_BLOQUE)]
        # Algún aporte sin registrar: la celda queda vacía y no cuenta en el promedio
        if azar.random() < 0.08:
            aportes[azar.randrange(APORTES_POR_BLOQUE)] = None
        bloques.append(aportes)
    general = promedio([promedio(bloques[0]), promedio(bloques[1])])
    refuerzo = generar_nota(azar, base + 1.5, 1.0) if general is not None and general < 7 and azar.random() < 0.8 else None
    examen = generar_nota(azar, base, 1.5) if azar.random() > 0.04 else None
    return {
        "aportesBloque1": bloques[0],
        "aportesBloque2": bloques[1],
        "refuerzo": refuerzo,
        "notaProyecto": generar_nota(azar, base, 1.2),
        "notaExamen": examen,
    }


def casos_limite() -> list[tuple[str, dict[str, Any]]]:
    """Filas escritas a mano para los bordes de las fórmulas."""

    def fila(b1, b2, refuerzo=None, proyecto=None, examen=None) -> dict[str, Any]:
        return {
            "aportesBloque1": [nota(v) for v in b1],
            "aportesBloque2": [nota(v) for v in b2],
            "refuerzo": nota(refuerzo),
            "notaProyecto": nota(proyecto),
            "notaExamen": nota(examen),
        }

    casos = [
        ("8,2 × 0,70 = 5,74 exacto (en coma flotante da 5,7399…)", fila(["8.2"] * 5, ["8.2"] * 5, None, "8.2", "8.2")),
        ("Todo 10: nota final 10, A+", fila(["10"] * 5, ["10"] * 5, None, "10", "10")),
        ("Todo 0: nota final 0, E-", fila(["0"] * 5, ["0"] * 5, None, "0", "0")),
        ("Bloques con 3 aportes: promedio periódico (8,333…)", fila(["8", "8", "9"], ["9", "8", "8"], None, "8.5", "8")),
        ("Un solo aporte por bloque", fila(["6.5"], ["7.25"], None, "7", "6.75")),
        ("Promedio general exactamente 7: no requiere refuerzo", fila(["7"] * 5, ["7"] * 5, None, "7", "7")),
        ("Promedio general 6,99: requiere refuerzo", fila(["6.99"] * 5, ["6.99"] * 5, None, "8", "8")),
        ("Refuerzo que sube la nota sobre 7", fila(["5.5"] * 5, ["6"] * 5, "9.5", "7", "7")),
        ("Refuerzo con promedio 0", fila(["0"] * 5, ["0"] * 5, "10", "5", "5")),
        ("Refuerzo sin aportes registrados: cuenta solo el refuerzo", fila([None] * 5, [None] * 5, "8", "8", "8")),
        ("Bloque 2 vacío: el promedio general es el del bloque 1", fila(["9", "8.5", "9.5", "8", "9"], [None] * 5, None, "9", "9")),
        ("Sin proyecto: no hay nota final", fila(["8"] * 5, ["8"] * 5, None, None, "8")),
        ("Sin examen: no hay nota final", fila(["8"] * 5, ["8"] * 5, None, "8", None)),
        ("Fila vacía (estudiante retirado)", fila([None] * 5, [None] * 5)),
        ("Aportes con un decimal y con dos decimales", fila(["7.5", "8.25", "9", "6.75", "8.5"], ["8.1", "7.95", "9.4", "8.05", "7"], None, "8.35", "7.85")),
    ]

    # Nota final justo en cada umbral de la escala y una centésima debajo (todas las celdas con el mismo valor
    # no bastan: los TRUNCAR intermedios pierden centésimas, así que se busca la combinación exacta)
    objetivos = [900, 899, 800, 799, 700, 699, 600, 599, 500, 499, 400, 399, 300, 299, 200, 199]
    for objetivo in objetivos:
        aporte, proyecto = buscar_combinacion(objetivo)
        texto = f"{objetivo / 100:.2f}".replace(".", ",")
        casos.append(
            (
                f"Nota final {texto}: umbral de la escala cualitativa",
                fila([f"{aporte / 100:.2f}"] * 5, [f"{aporte / 100:.2f}"] * 5, None, f"{proyecto / 100:.2f}", f"{proyecto / 100:.2f}"),
            )
        )
    return casos


def buscar_combinacion(objetivo: int) -> tuple[int, int]:
    """Aporte y proyecto (= examen), en centésimas, cuya nota final es exactamente `objetivo` centésimas."""
    for aporte in range(1001):
        c70 = aporte * 70 // 100
        for proyecto in range(1001):
            if c70 + 2 * (proyecto * 15 // 100) == objetivo:
                return aporte, proyecto
    raise ValueError(f"Ninguna combinación da {objetivo}")


# ---------------------------- Archivo de casos ----------------------------


def a_json(valor: Any) -> Any:
    """Fracciones como número: exacto si cabe en 2 decimales, con 12 decimales si es periódico."""
    if isinstance(valor, Fraction):
        return float(valor) if (valor * 100).denominator == 1 else round(float(valor), 12)
    if isinstance(valor, list):
        return [a_json(v) for v in valor]
    if isinstance(valor, dict):
        return {clave: a_json(v) for clave, v in valor.items()}
    return valor


def construir() -> dict[str, Any]:
    azar = random.Random(SEMILLA)
    casos: list[dict[str, Any]] = []
    cursos: list[dict[str, Any]] = []
    for numero_curso, curso in enumerate(CURSOS, start=1):
        ids = []
        for numero in range(1, ESTUDIANTES_POR_CURSO + 1):
            entrada = generar_estudiante(azar)
            identificador = f"C{numero_curso}-E{numero:02d}"
            ids.append(identificador)
            casos.append({"id": identificador, "grupo": curso, "descripcion": f"Estudiante {numero:02d}",
                          "entrada": entrada, "esperado": calcular(entrada)})
        resultados = [c["esperado"] for c in casos if c["id"] in ids]
        calificados = [r for r in resultados if r["notaFinal"] is not None]
        conteo = {clave: sum(1 for r in calificados if r["estandar"] == clave) for clave in ("DA", "AA", "PA", "NA")}
        cursos.append({
            "curso": curso,
            "casos": ids,
            "esperado": {
                "totalEstudiantes": len(resultados),
                "calificados": len(calificados),
                "requierenRefuerzo": sum(1 for r in resultados if r["requiereRefuerzo"]),
                "conteo": conteo,
            },
        })

    for numero, (descripcion, entrada) in enumerate(casos_limite(), start=1):
        casos.append({"id": f"L{numero:02d}", "grupo": "Casos límite", "descripcion": descripcion,
                      "entrada": entrada, "esperado": calcular(entrada)})

    return a_json({
        "descripcion": "Hoja oficial anonimizada: fórmulas del libro de calificaciones del colegio con notas generadas",
        "origen": "Fórmulas de CALIFICACIONES 2025-2026.xlsx; notas generadas con semilla fija, nunca transcritas "
                  "(docs/seguridad/datos_sensibles.md, sección 3)",
        "generadoPor": "packages/calculo-notas/casos/generar_casos.py",
        "semilla": SEMILLA,
        "totalCasos": len(casos),
        "casos": casos,
        "cursos": cursos,
    })


def principal() -> None:
    parser = argparse.ArgumentParser(description=__doc__.splitlines()[0])
    parser.add_argument("--verificar", action="store_true", help="comprobar el archivo sin escribirlo")
    contenido = json.dumps(construir(), ensure_ascii=False, indent=1) + "\n"
    if parser.parse_args().verificar:
        if not ARCHIVO.exists() or ARCHIVO.read_text(encoding="utf-8") != contenido:
            sys.exit(f"{ARCHIVO.name} no coincide con generar_casos.py: vuelve a generarlo")
        print(f"{ARCHIVO.name} está al día")
        return
    ARCHIVO.write_text(contenido, encoding="utf-8", newline="\n")
    print(f"{ARCHIVO.name}: {json.loads(contenido)['totalCasos']} casos")


if __name__ == "__main__":
    principal()
