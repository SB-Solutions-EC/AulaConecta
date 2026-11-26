"""Notas esperadas al cambiar las ponderaciones del colegio (T1125-A, RNF-10).

RNF-10: el Administrador cambia una ponderación sin modificar código y las notas del trimestre abierto se
recalculan. Su escenario de medición es «cambiar 70/15/15 por 60/20/20 en un ambiente de prueba».

Toma cada fila de la hoja oficial anonimizada (casos/hoja-oficial-anonimizada.json) y la vuelve a calcular con
otras ponderaciones, con el mismo oráculo de fracciones exactas de generar_casos.py:

    70 % → aportes · 15 % → proyecto · 15 % → examen          (oficial)
    nota final = TRUNCAR(TRUNCAR(aportes × a%; 2) + TRUNCAR(proyecto × p%; 2) + TRUNCAR(examen × e%; 2); 2)

No comparte código con packages/calculo-notas/src. Solo se guardan las columnas que dependen de las
ponderaciones (componentes, nota final, cualitativo, estándar y alerta de promedio bajo); las entradas se toman de
la hoja por su id. Las filas sin proyecto o sin examen no tienen nota final y no entran.

Uso:
    python casos/generar_casos_ponderaciones.py              # escribe ponderaciones-hoja-oficial.json
    python casos/generar_casos_ponderaciones.py --verificar  # falla si el archivo no coincide con este script
"""

import argparse
import json
import sys
from fractions import Fraction
from pathlib import Path
from typing import Any

import generar_casos as hoja

ARCHIVO = Path(__file__).with_name("ponderaciones-hoja-oficial.json")

# (nombre, aportes, proyecto, examen) en porcentaje. Se escriben como texto para que 33.33 sea exacto.
ESCENARIOS = [
    ("60 / 20 / 20: el cambio de RNF-10", "60", "20", "20"),
    ("50 / 25 / 25", "50", "25", "25"),
    ("80 / 10 / 10", "80", "10", "10"),
    ("100 / 0 / 0: solo cuentan los aportes", "100", "0", "0"),
    ("33,33 / 33,33 / 33,34: con decimales", "33.33", "33.33", "33.34"),
]

COLUMNAS = ["componente70", "componenteProyecto15", "componenteExamen15", "notaFinal", "cualitativo", "estandar", "alertaPromedioBajo"]


def entrada_de_la_hoja(fila: dict[str, Any]) -> dict[str, Any]:
    """Vuelve a Fraction las notas de la hoja (todas tienen 1 o 2 decimales, así que son exactas)."""

    def nota(valor: Any) -> Fraction | None:
        return Fraction(str(valor)) if valor is not None else None

    entrada = fila["entrada"]
    return {
        "aportesBloque1": [nota(v) for v in entrada["aportesBloque1"]],
        "aportesBloque2": [nota(v) for v in entrada["aportesBloque2"]],
        "refuerzo": nota(entrada["refuerzo"]),
        "notaProyecto": nota(entrada["notaProyecto"]),
        "notaExamen": nota(entrada["notaExamen"]),
    }


def construir() -> dict[str, Any]:
    filas = [f for f in hoja.construir()["casos"] if f["esperado"]["notaFinal"] is not None]
    escenarios = []
    for nombre, aportes, proyecto, examen in ESCENARIOS:
        pesos = (Fraction(aportes), Fraction(proyecto), Fraction(examen))
        assert sum(pesos) == 100, nombre
        calculadas = {}
        for fila in filas:
            esperado = hoja.a_json(hoja.calcular(entrada_de_la_hoja(fila), pesos))
            calculadas[fila["id"]] = {columna: esperado[columna] for columna in COLUMNAS}
        escenarios.append({
            "nombre": nombre,
            "ponderaciones": {"aportes": float(Fraction(aportes)), "proyecto": float(Fraction(proyecto)), "examen": float(Fraction(examen))},
            "filas": calculadas,
        })
    return {
        "descripcion": "Notas esperadas de la hoja oficial anonimizada con otras ponderaciones (RNF-10)",
        "origen": "Oráculo de fracciones exactas de generar_casos.py con las ponderaciones de cada escenario",
        "generadoPor": "packages/calculo-notas/casos/generar_casos_ponderaciones.py",
        "totalFilas": len(filas),
        "escenarios": escenarios,
    }


def a_texto(datos: dict[str, Any]) -> str:
    """JSON con una fila por línea: el archivo tiene cientos de filas y así se revisa mejor."""
    lineas = ["{"]
    for clave in ("descripcion", "origen", "generadoPor", "totalFilas"):
        lineas.append(f" {json.dumps(clave)}: {json.dumps(datos[clave], ensure_ascii=False)},")
    lineas.append(' "escenarios": [')
    for numero, escenario in enumerate(datos["escenarios"]):
        lineas.append("  {")
        lineas.append(f'   "nombre": {json.dumps(escenario["nombre"], ensure_ascii=False)},')
        lineas.append(f'   "ponderaciones": {json.dumps(escenario["ponderaciones"])},')
        lineas.append('   "filas": {')
        ids = list(escenario["filas"])
        for posicion, identificador in enumerate(ids):
            coma = "," if posicion < len(ids) - 1 else ""
            lineas.append(f"    {json.dumps(identificador)}: {json.dumps(escenario['filas'][identificador], ensure_ascii=False)}{coma}")
        lineas.append("   }")
        lineas.append("  }" + ("," if numero < len(datos["escenarios"]) - 1 else ""))
    lineas.append(" ]")
    lineas.append("}")
    return "\n".join(lineas) + "\n"


def principal() -> None:
    parser = argparse.ArgumentParser(description=__doc__.splitlines()[0])
    parser.add_argument("--verificar", action="store_true", help="comprobar el archivo sin escribirlo")
    contenido = a_texto(construir())
    json.loads(contenido)  # el formato propio sigue siendo JSON válido
    if parser.parse_args().verificar:
        if not ARCHIVO.exists() or ARCHIVO.read_text(encoding="utf-8") != contenido:
            sys.exit(f"{ARCHIVO.name} no coincide con generar_casos_ponderaciones.py: vuelve a generarlo")
        print(f"{ARCHIVO.name} está al día")
        return
    ARCHIVO.write_text(contenido, encoding="utf-8", newline="\n")
    print(f"{ARCHIVO.name}: {len(ESCENARIOS)} escenarios")


if __name__ == "__main__":
    principal()
