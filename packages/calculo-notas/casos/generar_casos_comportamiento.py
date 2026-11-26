"""Hoja oficial anonimizada del comportamiento para las pruebas del cálculo (T1124-A, RF-22).

Reproduce la hoja «Registro de comportamiento» del colegio con aritmética EXACTA de fracciones, sin coma flotante:

    puntaje de cada indicador = Siempre 10 · Frecuentemente 8 · Ocasionalmente 6 · Nunca 2
    nota                      = TRUNCAR(PROMEDIO(puntajes de los indicadores marcados); 2)
    cualitativo               = A (≥ 9) · B (≥ 7,5) · C (≥ 6) · D (≥ 4) · E (< 4)    (se compara la nota ya truncada)
    descripción               = una frase por cualitativo

Los nueve indicadores son cuatro cognitivos (cog1 a cog4) y cinco sociales (soc1 a soc5). Con los nueve marcados
la evaluación es oficial; con menos solo es una vista previa (la PWA la muestra mientras el docente marca, y el
servidor no la guarda, RF-22: «indicadores incompletos → Incompleto»).

Es un oráculo independiente: no comparte código con packages/calculo-notas/src, así que una diferencia entre los
dos (por ejemplo, un error de redondeo de coma flotante) hace fallar la prueba.

Los indicadores NO se transcriben de las hojas reales (docs/seguridad/datos_sensibles.md, sección 3): se generan
con una semilla fija. Los estudiantes no tienen nombre, solo un código.

Pendiente de validar con el colegio: los puntajes por escala y los cortes del cualitativo salen de la implementación
de la PWA (T1124-C); el documento del proyecto solo dice «nueve indicadores en escala Siempre, Frecuentemente,
Ocasionalmente y Nunca». Si el colegio los cambia, se cambian aquí y en src/comportamiento.ts, y la prueba falla
hasta que coincidan.

Uso:
    python casos/generar_casos_comportamiento.py              # escribe comportamiento-hoja-oficial.json
    python casos/generar_casos_comportamiento.py --verificar  # falla si el archivo no coincide con este script
"""

import argparse
import json
import random
import sys
from fractions import Fraction
from itertools import product
from pathlib import Path
from typing import Any

SEMILLA = 20261124
ARCHIVO = Path(__file__).with_name("comportamiento-hoja-oficial.json")
CURSOS = ["8vo EGB A", "9no EGB A", "9no EGB B", "10mo EGB A"]
ESTUDIANTES_POR_CURSO = 30

INDICADORES = ["cog1", "cog2", "cog3", "cog4", "soc1", "soc2", "soc3", "soc4", "soc5"]
PUNTAJE = {"SIEMPRE": 10, "FRECUENTEMENTE": 8, "OCASIONALMENTE": 6, "NUNCA": 2}
TRAMOS = [
    (Fraction(9), "A", "Muy satisfactorio", "Lidera el cumplimiento de los compromisos establecidos para la sana convivencia social."),
    (Fraction(15, 2), "B", "Satisfactorio", "Cumple con los compromisos establecidos para la sana convivencia social."),
    (Fraction(6), "C", "Poco satisfactorio", "Falla ocasionalmente en el cumplimiento de los compromisos establecidos para la sana convivencia social."),
    (Fraction(4), "D", "Mejorable", "Falla reiteradamente en el cumplimiento de los compromisos establecidos para la sana convivencia social."),
    (Fraction(0), "E", "Insatisfactorio", "No cumple con los compromisos establecidos para la sana convivencia social."),
]

Indicadores = dict[str, str]


# ---------------------------- Fórmulas de la hoja de comportamiento ----------------------------


def truncar(valor: Fraction) -> Fraction:
    """TRUNCAR(valor; 2): hacia cero, a centésimas."""
    return Fraction(int(valor * 100), 100)


def calcular(indicadores: Indicadores) -> dict[str, Any]:
    """Una fila de la hoja: devuelve cada columna calculada."""
    puntajes = [PUNTAJE[indicadores[clave]] for clave in INDICADORES if clave in indicadores]
    base = {"completados": len(puntajes), "total": len(INDICADORES), "completo": len(puntajes) == len(INDICADORES)}
    if not puntajes:
        return {**base, "nota": None, "cualitativo": None, "etiqueta": None, "descripcion": None}
    nota = truncar(Fraction(sum(puntajes), len(puntajes)))
    _, letra, etiqueta, descripcion = next(tramo for tramo in TRAMOS if nota >= tramo[0])
    return {**base, "nota": nota, "cualitativo": letra, "etiqueta": etiqueta, "descripcion": descripcion}


# ---------------------------- Evaluaciones generadas (no reales) ----------------------------


def generar_estudiante(azar: random.Random) -> Indicadores:
    """Un docente suele marcar casi todo igual con alguna excepción: se parte de una escala dominante."""
    dominante = azar.choices(list(PUNTAJE), weights=[5, 4, 2, 1])[0]
    return {
        clave: dominante if azar.random() < 0.7 else azar.choice(list(PUNTAJE))
        for clave in INDICADORES
    }


def con_escalas(escalas: list[str]) -> Indicadores:
    return dict(zip(INDICADORES, escalas, strict=True))


def casos_limite() -> list[tuple[str, Indicadores]]:
    """Filas escritas a mano para los bordes de la hoja."""
    todos = lambda escala: {clave: escala for clave in INDICADORES}  # noqa: E731
    casos: list[tuple[str, Indicadores]] = [
        ("Los nueve en Siempre: 10, A", todos("SIEMPRE")),
        ("Los nueve en Frecuentemente: 8, B", todos("FRECUENTEMENTE")),
        ("Los nueve en Ocasionalmente: 6, C (el corte es inclusivo)", todos("OCASIONALMENTE")),
        ("Los nueve en Nunca: 2, E", todos("NUNCA")),
        ("Ningún indicador marcado: sin nota", {}),
        ("Un solo indicador marcado: vista previa", {"cog1": "SIEMPRE"}),
        ("Cuatro cognitivos marcados, sociales sin marcar", {clave: "FRECUENTEMENTE" for clave in INDICADORES[:4]}),
        ("Ocho de nueve marcados: falta uno, no es oficial", {clave: "SIEMPRE" for clave in INDICADORES[:8]}),
        ("Promedio periódico 8,666…: se trunca a 8,66 y no se redondea a 8,67", con_escalas(["SIEMPRE"] * 6 + ["FRECUENTEMENTE"] * 3)),
        ("Cinco marcados, 46 ÷ 5 = 9,2 exacto (en coma flotante se trunca a 9,19)", {clave: escala for clave, escala in zip(INDICADORES, ["SIEMPRE"] * 3 + ["FRECUENTEMENTE"] * 2)}),
        ("Promedio 4,22 (38 ÷ 9 = 4,2222…): D", con_escalas(["OCASIONALMENTE"] * 5 + ["NUNCA"] * 4)),
        ("Mismos indicadores en otro orden: misma nota", con_escalas(["NUNCA"] * 4 + ["OCASIONALMENTE"] * 5)),
    ]

    # Cada corte del cualitativo: una combinación que da justo el corte y la que da la nota más alta por debajo de
    # él. La nota solo toma valores de la forma s/n (con n entre 1 y 9 indicadores), así que «una centésima por
    # debajo» no existe: lo más cerca que se puede estar es el valor discreto anterior. Se prefieren los casos con
    # los nueve indicadores (los oficiales) y, si no hay, los de menos indicadores.
    cortes = (Fraction(9), Fraction(15, 2), Fraction(6), Fraction(4))
    justo: dict[Fraction, tuple[int, Indicadores]] = {}
    debajo: dict[Fraction, tuple[Fraction, int, Indicadores]] = {}
    for cantidad in range(len(INDICADORES), 0, -1):
        for escalas in product(PUNTAJE, repeat=cantidad):
            ind = dict(zip(INDICADORES, escalas))
            nota = calcular(ind)["nota"]
            for corte in cortes:
                if nota == corte and corte not in justo:
                    justo[corte] = (cantidad, ind)
                if nota < corte and (corte not in debajo or nota > debajo[corte][0]):
                    debajo[corte] = (nota, cantidad, ind)
    for corte in cortes:
        cantidad, ind = justo[corte]
        casos.append((f"Nota {float(corte):g} justo en el corte (con {cantidad} indicadores marcados)", ind))
        nota, cantidad, ind = debajo[corte]
        casos.append((f"Nota {float(nota):.2f}, la más cercana por debajo del corte {float(corte):g} (con {cantidad} indicadores marcados)", ind))
    return casos


# ---------------------------- Archivo de casos ----------------------------


def a_json(valor: Any) -> Any:
    """Fracciones como número: exacto si cabe en 2 decimales (la nota siempre está truncada)."""
    if isinstance(valor, Fraction):
        return float(valor)
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
            indicadores = generar_estudiante(azar)
            identificador = f"C{numero_curso}-E{numero:02d}"
            ids.append(identificador)
            casos.append({"id": identificador, "grupo": curso, "descripcion": f"Estudiante {numero:02d}",
                          "indicadores": indicadores, "esperado": calcular(indicadores)})
        resultados = [c["esperado"] for c in casos if c["id"] in ids]
        cursos.append({
            "curso": curso,
            "casos": ids,
            "esperado": {letra: sum(1 for r in resultados if r["cualitativo"] == letra) for _, letra, _, _ in TRAMOS},
        })

    for numero, (descripcion, indicadores) in enumerate(casos_limite(), start=1):
        casos.append({"id": f"L{numero:02d}", "grupo": "Casos límite", "descripcion": descripcion,
                      "indicadores": indicadores, "esperado": calcular(indicadores)})

    return a_json({
        "descripcion": "Hoja oficial de comportamiento anonimizada: nueve indicadores, nota truncada y cualitativo",
        "origen": "Fórmulas de la hoja «Registro de comportamiento»; indicadores generados con semilla fija, nunca "
                  "transcritos (docs/seguridad/datos_sensibles.md, sección 3)",
        "generadoPor": "packages/calculo-notas/casos/generar_casos_comportamiento.py",
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
            sys.exit(f"{ARCHIVO.name} no coincide con generar_casos_comportamiento.py: vuelve a generarlo")
        print(f"{ARCHIVO.name} está al día")
        return
    ARCHIVO.write_text(contenido, encoding="utf-8", newline="\n")
    print(f"{ARCHIVO.name}: {json.loads(contenido)['totalCasos']} casos")


if __name__ == "__main__":
    principal()
