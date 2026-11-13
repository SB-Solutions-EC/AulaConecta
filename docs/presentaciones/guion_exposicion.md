# Guion de la exposición: Propuesta de SI, Plataforma Académica "Andoas"

Presentación: [Propuesta_SI_Plataforma_Academica_Andoas.pptx](Propuesta_SI_Plataforma_Academica_Andoas.pptx) · 20 diapositivas.

**Tiempo total: 14 minutos** (menos de 15): unos 10 minutos de diapositivas y 4 de demo. Las preguntas van al final.

## Reparto: bloques de 3 diapositivas en rotación

| Ronda | Marcelo Acuña | Abner Arboleda | Christian Bonifaz |
|---|---|---|---|
| 1 | 1–3 | 4–6 | 7–9 |
| 2 | 10–12 | 13–15 | 16–18 |
| 3 | 19, **demo** y 20 | | |

| Bloque | Duración | Reloj al terminar |
|---|---|---|
| Marcelo 1–3 | 1:25 | 1:25 |
| Abner 4–6 | 1:35 | 3:00 |
| Christian 7–9 | 1:45 | 4:45 |
| Marcelo 10–12 | 1:30 | 6:15 |
| Abner 13–15 | 1:25 | 7:40 |
| Christian 16–18 | 1:20 | 9:00 |
| Marcelo 19 + demo + 20 | 4:50 | **13:50** |

Reglas para no pasarse:

- No lean las tablas. Digan la idea y pasen a la siguiente diapositiva.
- Las diapositivas 14 y 16 se pasan rápido, en unos 20 segundos.
- Si van atrasados, salten la 16.
- Cada uno cierra su bloque con la frase que da paso al siguiente (marcada con →).

---

## Ronda 1

### Marcelo · 1–3 (1:25)

**1. Portada (0:20)**
"Buenos dias ingeniera y compañeros, Somos Marcelo Acuña, Abner Arboleda y Christian Bonifaz. Les presentamos una plataforma para la Unidad Educativa Andoas que digitaliza la planificación, las notas y avisa a los representantes el mismo día"

**2. El problema (0:30)**
"Hoy todo depende del papel y del Excel: la planificación se rehace cada trimestre, las notas se calculan a mano y, con un internet inestable, no se registra nada. Lo que más afectactando a los representates es que se enteran tarde."

**3. Nuestra novedad (0:35)**
"Nuestra novedad: cuando el promedio baja de 7 o hay una falta sin justificar, el representante se entera ese mismo día, con una notificación gratis en el celular por via el WhatsApp."
→ *"Abner les explica cómo funciona el aviso."*

### Abner · 4–6 (1:35)

**4. Cómo funciona el aviso (0:35)**
"El docente registra la nota y el sistema detecta el caso. Luego verifica que haya autorización y que el aviso no se repita, lo envía sin la nota exacta y lo guarda en el historial. Si no hay internet, el aviso espera en cola."

**5. Objetivos (0:30)**
"Queremos digitalizar la planificación, el cálculo de notas y la comunicación con los representantes. La meta medible es reducir al menos un 30 % el tiempo del docente en planificaciones y reportes."

**6. Alcance (0:30)**
"Incluye matrícula, planificación, notas, asistencia, el acceso del representante, el trabajo sin conexión y los avisos. Quedan fuera los pagos en línea y la app nativa."
→ *"Christian, cómo lo vamos a construir."*

### Christian · 7–9 (1:45)

**7. Metodología (0:30)**
"Trabajamos con Scrum y DevSecOps: entregas cortas que el vicerrector valida y cada cambio con pruebas de seguridad automáticas. La fecha del 15 de enero no se mueve."

**8. Cronograma (0:30)**
"Son 10 sprints con un hito verificable cada uno. Los avisos van en el sprint 8, porque necesitan que las notas y la asistencia ya existan."

**9. Arquitectura (0:45)**
"Son tres microservicios, cada uno con su base de datos: identidad en Java, académico en TypeScript y notificaciones en Python. Notificaciones está separado para que, si WhatsApp falla, las notas sigan funcionando."
→ *"Marcelo, las tecnologías."*

## Ronda 2

### Marcelo · 10–12 (1:30)

**10. Tecnologías y CI/CD (0:30)**
"Cada cambio pasa por revisión de secrets, pruebas, SonarQube y escaneo de imágenes, y el equipo recibe el aviso por Telegram."

**11. Requisitos (0:30)**
"Tenemos 38 requisitos funcionales y 15 no funcionales, validados con el colegio. Los de la novedad son del RF-29 al RF-35." LEER LOS REQUISITOS

**12. Casos de uso (0:30)**
"En verde está el caso novedoo de notificar por whatsapp" EXPLICAR EL FLUJO DEL BOTON PARA NOTIFICAR ESO HACE EL DOCENTE
→ *"Abner, la seguridad."*

### Abner · 13–15 (1:25)

**13. Seguridad (0:35)**
"Encontramos cinco vulnerabilidades y cada una tiene su control. La más delicada es un número equivocado: por eso el mensaje nunca dice la nota."

**14. Política de seguridad (0:20)**
"Cinco reglas que se cumplen siempre y que el pipeline revisa en cada cambio."

**15. Restricciones (0:30)**
"La restricción clave es que el WhatsApp automático cobra por mensaje. Por eso el canal principal es gratis: la notificación push y el WhatsApp con un clic."
→ *"Christian, los supuestos y los riesgos."*

### Christian · 16–18 (1:20)

**16. Supuestos (0:20)**
"Si el proveedor de WhatsApp no aprueba las plantillas, igual avisamos por push y por WhatsApp asistido."

**17. Riesgos (0:35)**
"Los riesgos más altos son el retraso, la pérdida de notas al sincronizar y el aviso equivocado, y cada uno tiene su respuesta. Si falta tiempo, se recorta primero lo de prioridad media."

**18. Calidad y pruebas (0:25)**
"Nuestras metas son 460 usuarios simultáneos, 100 % de coincidencia con la hoja oficial y respuestas de menos de medio segundo."
→ *"Marcelo, los mensajes y la demo."*

## Ronda 3

### Marcelo · 19, demo y 20 (4:50)

**19. Tres mensajes, tres canales (0:30)**
"Solo enviamos tres mensajes: la autorización, el promedio bajo y la falta. Ninguno dice la nota. Salen por push, por WhatsApp con un clic o, si el colegio lo paga, por WhatsApp automático. Ahora se los mostramos funcionando."

**Demo (4:00)**
Tengan la demo abierta antes de empezar y no la expliquen, muéstrenla. Si algo falla, tengan listo un video de respaldo.

**20. En resumen (0:20)**
"Menos papel para el docente y padres informados el mismo día, gratis y sin depender del internet. Gracias, ¿preguntas?"

---

## Preguntas probables y quién responde

| Pregunta | Responde | Respuesta corta |
|---|---|---|
| ¿Cuánto cuesta WhatsApp? | Abner | Nada obligatorio: el push y el WhatsApp asistido son gratis; el automático es opcional |
| ¿Qué pasa si el padre no autoriza? | Marcelo | No se envía nada; el aviso queda en el tablero |
| ¿Por qué tres microservicios? | Christian | Para aislar el proveedor externo y los datos de identidad, y porque lo pide la materia |
| ¿Cómo funciona sin internet? | Christian | Guarda los datos en el equipo y los sincroniza al volver la conexión, sin sobrescribir cambios |
| ¿Cómo protegen los datos de los menores? | Abner | El número se verifica, hay autorización, el mensaje no dice la nota y todo queda auditado |
