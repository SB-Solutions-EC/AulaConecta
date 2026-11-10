# Retroalimentación recibida y plan de corrección

Observaciones del ingeniero sobre los Entregables 1, 2 y 3 y la exposición, comparadas con lo que hoy tenemos en el repositorio. Cada fila dice dónde está el problema, qué hay que cambiar y quién lo corrige. Se aplican en la **siguiente entrega**, que usa el formato integrado *Definición del proyecto y especificación de requisitos* (sección final de este documento).

**Revisado:** 10/11/2026 · **Notas:** Modelos de gestión 9/10 · Vulnerabilidades, riesgos y seguridad 10/10

Estado: ❌ falta · ⚠️ parcial · ✅ resuelto

## 1. Entregable 1: problemática y ciclo de vida (SDLC)

| # | Observación | Qué tenemos hoy | Qué hay que hacer | Estado |
|---|---|---|---|---|
| E1-1 | Completar las 9 fases del SDLC y separar Operación y Mantenimiento en la matriz y en el diagrama | El E1 entregado tiene 8 fases ("8. Operación y mantenimiento" juntas). La v2 (`docs/analisis/Problematica_Matriz_SDLC_v2.docx`) tiene 9, pero **cambió Despliegue por Retiro** y pone Mantenimiento *antes* de Operación | Usar las 9 fases que se piden, en este orden: Necesidad, Requisitos, Análisis, Diseño, Construcción, Pruebas, **Despliegue, Operación, Mantenimiento**. Retiro se puede mencionar como nota, no como fase. Rehacer el diagrama con las 9 | ⚠️ |
| E1-2 | Diferenciar actividades: Operación = registro habitual de notas, asistencia y planificaciones; Mantenimiento = corrección de errores y actualización de reglas académicas | Operación habla de "soporte, respaldos, monitoreo"; Mantenimiento de "evaluar microservicios" (ya decidido) y "generador de horarios" | **Operación:** uso diario por docentes (notas, asistencia, planificaciones), secretaría (matrícula) y vicerrector (revisión); soporte y respaldos. **Mantenimiento:** corrección de errores reportados, actualización de ponderaciones, escalas y fórmulas cuando cambie la normativa (RNF-10), parches de seguridad. Quitar lo de "evaluar microservicios" | ❌ |
| E1-3 | En Diseño dicen cuatro roles pero enumeran cinco | El E1 dice "Prototipo navegable de los cuatro roles"; el SRS RF-01 también dice "cuatro roles" (sin Representante). El E3 ya dice cinco | Usar **cinco roles** en todo: Administrador, Secretaría, Docente, Estudiante y Representante (SDLC, SRS RF-01, E3 y prototipo) | ⚠️ |
| E1-4 | Qué funciones están disponibles sin conexión y cómo se sincroniza cuando varios usuarios modifican datos | Está bien resuelto en `docs/arquitectura/Diagramas/trabajo_sin_conexion.md` (tabla de capacidades offline, cola local, política de conflictos por tipo de dato), pero **no está en ningún entregable** | Llevar a la entrega una tabla corta "Funciona sin conexión / No funciona" y la regla de conflictos por dato (asistencia y notas = conflicto manual; planificación = combinar por campo; estados de aprobación = gana el servidor). Agregar el diagrama de sincronización | ⚠️ |

## 2. Entregable 2: procesos, stakeholders y casos de uso

| # | Observación | Qué tenemos hoy | Qué hay que hacer | Estado |
|---|---|---|---|---|
| E2-1 | Un solo verbo por objetivo | "Permitir elaborar, revisar y aprobar…", "Garantizar el registro… y su sincronización" | Reescribir cada objetivo con un verbo, por ejemplo: *Digitalizar la planificación curricular con revisión por campo*; *Automatizar el cálculo de notas y reportes de logros*; *Notificar a los representantes el bajo rendimiento y las faltas*; *Asegurar el registro de notas y asistencia sin conexión*; *Reducir el tiempo docente en tareas administrativas*. Cada uno con indicador (formato, sección 2) | ❌ |
| E2-2 | Representar el servicio externo de WhatsApp como participante receptor del mensaje | En el BPMN (`docs/modelos/Proceso_Gestion_Academica.bpmn`) el flujo "Aviso por WhatsApp" va directo al pool del Representante | Agregar un **pool "Servicio de WhatsApp"** (caja negra) que recibe el mensaje desde la Plataforma y lo entrega al Representante. Con CR-01 agregar también el canal push | ❌ |
| E2-3 | Precisar cómo se gestionan las notificaciones sin internet | Solo una frase: "queda en cola y se envía al volver la conexión" | En el BPMN: evento intermedio de espera "¿Hay conexión?" con la cola de avisos (patrón outbox). En el texto: el aviso se guarda en la misma transacción que la nota, se reintenta, no se duplica (RF-34, RF-35) y queda registrado | ⚠️ |
| E2-4 | Justificar la matriz poder–interés, sobre todo el proveedor de WhatsApp y los docentes | La tabla ubica a cada stakeholder sin explicar por qué | Agregar los criterios (poder = capacidad de aprobar, financiar o bloquear; interés = cuánto le afecta el sistema) y una línea por stakeholder. Revisar a los **docentes**: son los usuarios principales y su adopción decide el éxito (riesgo R13), así que conviene subirlos a "poder medio" o justificar por qué quedan en bajo. El **proveedor de WhatsApp** tiene poder porque puede rechazar plantillas o cobrar, pero desde CR-01 el sistema funciona sin él, así que su poder baja | ❌ |
| E2-5 | Usar asociaciones UML entre actores y casos de uso e incorporar «Registrar tareas» | El diagrama de casos de uso no está versionado en el repo (`casos_de_uso.puml` no existe; la carpeta `01_Modelos/Casos_de_uso` del Drive está vacía) | Rehacer el diagrama en PlantUML dentro del repo: asociaciones simples (línea sin flecha) actor–caso; «include»/«extend» solo entre casos; agregar **Registrar tareas** (RF-19) para el Docente y **Consultar tareas** para Estudiante; el Servicio de WhatsApp como actor secundario | ❌ |

## 3. Entregable 3: metodología, planificación y requisitos

| # | Observación | Qué tenemos hoy | Qué hay que hacer | Estado |
|---|---|---|---|---|
| E3-1 | Unificar el cronograma y el Product Backlog (pág. 4-7): diferencias en autenticación, planificación curricular y trabajo sin conexión; definir 9 o 10 sprints | En el .docx del repo coinciden (10 sprints; autenticación sprint 4, planificación 7, offline 9), así que la diferencia está en el PDF entregado o en otra parte del texto (ver nota abajo) | Una sola tabla maestra de sprints y que el backlog, el Gantt, el texto de Wiegers y el Excel la copien. **10 sprints**. Revisar que ninguna frase diga "sprints de una a dos semanas" sin precisar y que el Gantt muestre los 10 | ⚠️ |
| E3-2 | Corregir RF-03: contraseña temporal aleatoria o enlace de activación de un solo uso | SRS y E3: "clave inicial = cédula". **El código ya lo implementa así**: ms-identidad (T1105-A, T1106-A) y la PWA (`PantallaCambioClaveInicial.tsx`) piden la cédula | Nuevo RF-03: *El sistema debe generar una contraseña temporal aleatoria de un solo uso, válida por 72 horas, y obligar a cambiarla en el primer ingreso.* Registrar como **CR-02** y cambiar ms-identidad y la PWA (Abner y Christian) | ❌ |
| E3-3 | Hacer verificables RNF-06 y RNF-08 | RNF-06: "el cálculo de notas es inmediato". RNF-08: "respaldar periódicamente" | **RNF-06:** con 60 docentes y 400 estudiantes simultáneos, el 95 % de las peticiones responde en ≤ 0,5 s y el cálculo de la nota final se muestra en ≤ 1 s, con < 1 % de errores (prueba k6). **RNF-08:** respaldo automático diario de las 3 bases a las 02:00, retención 30 días, **RPO ≤ 24 h y RTO ≤ 4 h**, con una prueba de restauración por sprint desde el 9 | ❌ |
| E3-4 | Para la entrega final incluir paginación y filtros | Los contratos OpenAPI v0 no tienen parámetros de página ni filtros en los listados | Nuevo RNF o RF transversal: todo listado devuelve páginas de 20 a 100 registros (`pagina`, `tamano`, total) y filtros por curso, materia, trimestre, estado y texto. Agregarlo a `openapi/*.yaml` y a las tablas de la PWA | ❌ |

## 4. Exposición

| # | Observación | Qué hay que hacer |
|---|---|---|
| X-1 | Evidenciar el registro y la verificación de cuentas | En la demo mostrar: la secretaría crea la cuenta → se genera usuario y clave temporal → primer ingreso con cambio obligatorio → bloqueo tras 3 intentos. Esto depende de E3-2 |
| X-2 | Precisar la sincronización sin conexión | Mostrar en la demo: modo avión → registrar asistencia → indicador "pendiente" → volver la red → "sincronizado"; y un conflicto entre dos docentes resuelto |
| X-3 | Priorizar problema, solución y aporte; no profundizar en tecnologías del siguiente parcial | Quitar o resumir las diapositivas 9 y 10 (arquitectura y CI/CD) y dar ese tiempo al problema, la novedad y la demo |

## 5. Cómo encaja en el formato nuevo

El formato *Definición del proyecto y especificación de requisitos* integra en un solo documento lo que hoy está repartido en el E1, E2, E3 y el SRS. Lo que ya tenemos sirve casi todo, pero el formato exige piezas nuevas:

| Sección del formato | Lo tenemos en | Falta |
|---|---|---|
| Identificación y control de versiones | — | Código `#GRUPO_NRC`, tabla de versiones 0.1 / 1.0 |
| 1. Necesidad, problema y oportunidad | E1 y E2 (problemática) | Separar **hechos comprobados** de hipótesis, y **alternativas actuales** (cómo lo resuelven hoy y soluciones similares) |
| 2. Objetivos medibles (OBJ-xx) | E2 objetivos, E3 indicadores I-01 a I-11 | Un verbo por objetivo (E2-1), indicador, línea base y fuente de comprobación |
| 3. Alcance, exclusiones y entregables | E2 y SRS 1.2 | Criterio global de aceptación; justificar exclusiones que tocan objetivos |
| 4. Procesos AS-IS / TO-BE (PR-xx) y reglas de negocio (RN-xx) | BPMN y E2 sección 7 | Convertir las "consideraciones" en reglas **RN-xx** con excepción y validación (p. ej. RN: nota entre 0 y 10; promedio < 7 dispara aviso; planificación en revisión no se edita) |
| 5. Interesados, poder–interés y permisos por rol | E2 stakeholders y usuarios vs actores | Justificación (E2-4) y **matriz de permisos** Ver / Crear / Modificar–aprobar por cada uno de los 5 roles; diagrama UML corregido (E2-5) |
| 6. RF con **ficha individual** | SRS y E3 5.1 | Una ficha por cada RF (38) y RNF (15): origen, prioridad Must/Should/Could, criterios Dado/Cuando/Entonces, verificación, validación y trazabilidad. Es el trabajo más grande |
| 7. RNF cuantificados y verificación vs validación | E3 5.2 | Umbrales (E3-3), paginación (E3-4) y tabla de verificación y validación con el vicerrector |
| 8. Solución conceptual e interfaces | Prototipo, C4, offline | **Sin fijar tecnologías**: módulos, flujo de datos, dependencias (WhatsApp, push) y contingencia; tabla offline (E1-4) |
| 9. Organización y plan de entrega (H-xx) | E3 metodología, RACI y cronograma | Justificar más el método (la nota de modelos fue 9/10) e hitos H-xx con incremento demostrable |
| 10. Riesgos (RSK-xx), vulnerabilidades y KPI | Taller de riesgos (10/10) e indicadores | Renombrar a RSK-xx y KPI-xx; ya está bien evaluado |

## 6. Reparto propuesto

| Responsable | Puntos |
|---|---|
| Marcelo | E1-1, E1-2, E1-3, E2-1, E3-1, E3-3, secciones 1 a 3 y 9 del formato, fichas de RF del módulo académico |
| Abner | E3-2 en ms-identidad (CR-02), RNF-08 respaldos, sección 10, fichas de RNF de seguridad, X-1 |
| Christian | E2-2, E2-3 (BPMN), E2-5 (casos de uso), E1-4 y X-2 (offline), E3-4 en la PWA, fichas de RF de la interfaz |
| Todos | E2-4 (poder–interés), fichas individuales restantes, validación con el vicerrector |

## Nota sobre E3-1

El .docx del Entregable 3 en el repositorio es idéntico al que está en `Documentacion/` (21/10) y su backlog coincide con la tabla de sprints y con `Planificacion.xlsx`. Antes de corregir, hay que abrir el **PDF entregado** en las páginas 4 a 7 y anotar cuáles son exactamente las diferencias que se señalaron.
