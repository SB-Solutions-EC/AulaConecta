# Guía visual de la interfaz

**Objetivo:** que AulaConecta termine con un dashboard moderno, limpio y animado, inspirado en el estilo "Modern Admin Dashboard" (tema blanco y naranja, tarjetas de analítica, gráficos interactivos y animaciones suaves) que el equipo tomó como referencia el 24/10/2026. Se toma solo como inspiración visual: el código se escribe desde cero.

## Identidad

Los colores del colegio ya calzan con la referencia, así que se conservan los del prototipo validado por el cliente:

| Uso | Color | Token |
|---|---|---|
| Acento principal (botones, gráficos, resaltados) | Naranja `#E8833A` | `accent` |
| Acento suave (fondos de tarjetas destacadas) | `#FDECE0` | `accent-light` |
| Texto y barra principal | Azul marino `#1E3A5F` | `primary` |
| Fondo general | `#F6F7FB` | `surface` |
| Tarjetas | Blanco `#FFFFFF` con sombra suave | `card` |
| Estados | Verde (DA / al día), ámbar (PA), rojo (NA / alerta < 7) | `success`, `warning`, `danger` |

Tipografía: **Quicksand** para títulos y **Inter** para el texto, igual que el prototipo.

## Componentes

| Componente | Cómo se ve | Dónde se usa |
|---|---|---|
| Barra superior con pestañas tipo "píldora" | Pestañas redondeadas; la activa en azul marino | Navegación por rol |
| Tarjeta KPI | Número grande, etiqueta pequeña y variación (↑ / ↓) | Estudiantes, promedio, asistencia, planificaciones por revisar |
| Tarjeta de gráfico | Esquinas de 20 px, título y filtro | Rendimiento por curso, DA/AA/PA/NA, asistencia en el tiempo |
| Lista con avance | Fila con avatar o ícono, texto y barra de progreso | Tareas, materias del estudiante, planificaciones |
| Alerta | Tarjeta roja suave con ícono | Promedio menor a 7 (RF-28) |
| Estado sin conexión | Pastilla gris o ámbar con cambios pendientes | Trabajo sin conexión (RNF-01) |

## Animaciones

- Entrada de tarjetas en cascada (aparecen de abajo hacia arriba, 50 ms entre cada una).
- Los números de las tarjetas KPI cuentan desde 0 hasta su valor.
- Los gráficos se dibujan al cargar.
- Hover suave en tarjetas y botones.
- Todas respetan `prefers-reduced-motion`: si el usuario desactivó las animaciones en su sistema, no se muestran.

## Librerías de interfaz

| Librería | Uso |
|---|---|
| Tailwind CSS | Estilos y tokens de color |
| Framer Motion | Animaciones de entrada, conteo y transiciones |
| Recharts | Gráficos de barras, líneas y anillos |
| lucide-react | Íconos |

## Dashboards por rol

| Rol | Contenido principal | Sprint |
|---|---|---|
| Administrador (vicerrector) | KPIs institucionales, rendimiento por curso y materia, planificaciones por revisar | 6 |
| Docente | Mis materias, tareas próximas, estudiantes en riesgo, valoración de logros | 5 y 6 |
| Estudiante | Promedio, asistencia, materias con avance, próximas actividades y alerta < 7 | 6 |
| Representante | Notas y asistencia del representado, avisos recibidos | 6 |
| Secretaría | Matrículas, importación de nóminas | 4 |

## Criterios de aceptación visual

- Se ve bien en celular (360 px), tablet y computadora (RNF-07).
- Contraste suficiente para leer: texto sobre blanco con relación de al menos 4.5:1.
- Las acciones frecuentes siguen en tres pasos o menos (RNF-03); la animación no debe estorbar.
