/* =========================================================================
   PORTAL EDUCATIVO — Unidad Educativa "Andoas" (Puyo)
   Demo/MVP funcional: Tailwind CDN + JS vanilla + localStorage.
   ========================================================================= */

/* ---------------------------- UTILIDADES ------------------------------ */
function uid(prefix) { return prefix + '_' + Math.random().toString(36).slice(2, 9); }
function pad2(n) { return String(n).padStart(2, '0'); }
function toISO(d) { return `${d.getFullYear()}-${pad2(d.getMonth() + 1)}-${pad2(d.getDate())}`; }
function todayISO() { return toISO(new Date()); }
function addDays(iso, n) { const d = new Date(iso + 'T00:00:00'); d.setDate(d.getDate() + n); return toISO(d); }
function fmtDate(iso) {
  if (!iso) return '—';
  const d = new Date(iso + 'T00:00:00');
  return d.toLocaleDateString('es-EC', { day: '2-digit', month: 'short', year: 'numeric' });
}
function capitalize(s) { return s ? s.charAt(0).toUpperCase() + s.slice(1) : s; }
function firstName(name) { return (name || '').split(' ')[0]; }
function initials(name) {
  return (name || '').split(' ').filter(Boolean).slice(0, 2).map(w => w[0]).join('').toUpperCase();
}
function escapeHtml(str) {
  return String(str == null ? '' : str)
    .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;').replace(/'/g, '&#39;');
}
function slugifyEmail(name) {
  const norm = (name || '').normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase();
  const parts = norm.split(/\s+/).filter(Boolean);
  const first = parts[0] || 'estudiante';
  const last = parts.length > 1 ? parts[parts.length - 1] : '';
  return `${first}${last ? '.' + last : ''}@ejemplo.ec`.replace(/[^a-z.@]/g, '');
}
function nowLabel() {
  return new Date().toLocaleTimeString('es-EC', { hour: '2-digit', minute: '2-digit' });
}

/* ------------------------------ ESTILOS -------------------------------- */
const CARD = 'bg-white border border-slate-200 rounded-2xl shadow-sm';
const BTN_PRIMARY = 'inline-flex items-center justify-center gap-2 bg-accent hover:bg-accent-dark text-white font-semibold rounded-lg px-4 py-2.5 text-sm transition-colors cursor-pointer';
const BTN_SECONDARY = 'inline-flex items-center justify-center gap-2 bg-white border border-slate-300 hover:bg-slate-50 text-slate-700 font-semibold rounded-lg px-4 py-2.5 text-sm transition-colors cursor-pointer';
const BTN_DANGER_TEXT = 'text-red-500 hover:text-red-700 text-xs font-semibold cursor-pointer';
const INPUT = 'w-full rounded-lg border border-slate-300 px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-primary/25 focus:border-primary';
const LABEL = 'block text-xs font-semibold text-slate-600 mb-1.5';

const SUBJECT_HUES = [
  { sched: 'sched-c0', badge: 'bg-indigo-50 text-indigo-700 border-indigo-200', bar: 'bg-indigo-500' },
  { sched: 'sched-c1', badge: 'bg-violet-50 text-violet-700 border-violet-200', bar: 'bg-violet-500' },
  { sched: 'sched-c2', badge: 'bg-emerald-50 text-emerald-700 border-emerald-200', bar: 'bg-emerald-500' },
  { sched: 'sched-c3', badge: 'bg-amber-50 text-amber-700 border-amber-200', bar: 'bg-amber-500' },
  { sched: 'sched-c4', badge: 'bg-pink-50 text-pink-700 border-pink-200', bar: 'bg-pink-500' },
  { sched: 'sched-c5', badge: 'bg-blue-50 text-blue-700 border-blue-200', bar: 'bg-blue-500' },
  { sched: 'sched-c6', badge: 'bg-teal-50 text-teal-700 border-teal-200', bar: 'bg-teal-500' },
];
function subjectHue(name) {
  let h = 0;
  for (let i = 0; i < name.length; i++) h = (h * 31 + name.charCodeAt(i)) >>> 0;
  return SUBJECT_HUES[h % SUBJECT_HUES.length];
}

const HOUR_ROWS = [
  { key: 'h1', label: '1°', time: '07:15 - 08:00', isRecreo: false },
  { key: 'h2', label: '2°', time: '08:00 - 08:45', isRecreo: false },
  { key: 'h3', label: '3°', time: '08:45 - 09:30', isRecreo: false },
  { key: 'recreo', label: 'RECREO', time: '09:30 - 10:00', isRecreo: true },
  { key: 'h4', label: '4°', time: '10:00 - 10:45', isRecreo: false },
  { key: 'h5', label: '5°', time: '10:45 - 11:30', isRecreo: false },
];
const WEEKDAYS = [1, 2, 3, 4, 5];
const WEEKDAY_LABELS = { 1: 'Lunes', 2: 'Martes', 3: 'Miércoles', 4: 'Jueves', 5: 'Viernes' };
const TYPE_ICON = { Tarea: '📝', Prueba: '🧪', Proyecto: '🎯', Evento: '📌', Clase: '📖' };
const ADMIN_TITLES = { inicio: 'Panel de Control', estandares: 'Rendimiento Académico', revision: 'Revisión de Planificaciones', anio: 'Año Lectivo', cursos: 'Cursos y Materias', docentes: 'Gestión de Docentes', estudiantes: 'Gestión de Estudiantes', reprogramaciones: 'Reprogramaciones' };
const STUDENT_TITLES = { dashboard: 'Mi Dashboard', horario: 'Horario y Calendario', materias: 'Mis Materias', mensajeria: 'Mensajería', reporte: 'Reportes' };
const TEACHER_TITLES = { inicio: 'Mis Materias', planificacion: 'Planificación Microcurricular', asistencia: 'Tomar Asistencia', notas: 'Libro de Calificaciones', calificaciones: 'Calificar Tareas', recursos: 'Recursos de Estudio', mensajeria: 'Mensajería' };

/* --------------------------- ESTADO GLOBAL ----------------------------- */
const DB_KEY = 'demo_ficticia_v2';
let db = null;
const ui = {
  role: 'admin',
  adminScreen: 'inicio',
  studentScreen: 'dashboard',
  studentId: null,
  selectedSubjectId: null,
  subjectTab: 'calificaciones',
  chatTeacherId: null,
  sidebarOpen: false,
  studentModalOpen: false,
  editingStudentId: null,
  studentDraft: null,
  justifyModalOpen: false,
  justifyAttendanceId: null,
  teacherModalOpen: false,
  editingTeacherId: null,
  teacherDraft: null,
  teacherId: null,
  teacherScreen: 'inicio',
  teacherSubjectId: null,
  teacherAssignmentId: null,
  teacherChatStudentId: null,
  planDraft: null,
  reviewingPlanId: null,
  obsModalOpen: false,
  obsPlanId: null,
  obsField: null,
  obsFieldLabel: '',
  assignmentModalOpen: false,
  editingAssignmentId: null,
  assignmentDraft: null,
};

/* ----------------------------- PERSISTENCIA ---------------------------- */
function saveDB() { localStorage.setItem(DB_KEY, JSON.stringify(db)); }
function loadDB() {
  const raw = localStorage.getItem(DB_KEY);
  if (raw) {
    try { db = JSON.parse(raw); return db; } catch (e) { /* datos corruptos: se regeneran */ }
  }
  seedDB();
  saveDB();
  return db;
}

/* ------------------------- CONSULTAS / DERIVADOS ------------------------ */
function getCourse(id) { return db.courses.find(c => c.id === id); }
function getSubject(id) { return db.subjects.find(s => s.id === id); }
function getTeacher(id) { return db.teachers.find(t => t.id === id); }
function getStudent(id) { return db.students.find(s => s.id === id); }
function subjectsOfCourse(courseId) { return db.subjects.filter(s => s.courseId === courseId); }
function studentsOfCourse(courseId) { return db.students.filter(s => s.courseId === courseId); }
function assignmentsOfSubject(subjectId) {
  return db.assignments.filter(a => a.subjectId === subjectId).sort((a, b) => a.dueDate.localeCompare(b.dueDate));
}
function submissionsOf(assignmentId, studentId) {
  return db.submissions.find(s => s.assignmentId === assignmentId && s.studentId === studentId);
}
function attendanceOf(studentId, subjectId) {
  return db.attendance.filter(a => a.studentId === studentId && a.subjectId === subjectId).sort((a, b) => b.date.localeCompare(a.date));
}
function subjectAverage(studentId, subjectId) {
  const grades = assignmentsOfSubject(subjectId)
    .map(a => submissionsOf(a.id, studentId))
    .filter(s => s && s.status === 'calificado' && typeof s.grade === 'number')
    .map(s => s.grade);
  if (!grades.length) return null;
  return grades.reduce((a, b) => a + b, 0) / grades.length;
}
function subjectProgress(studentId, subjectId) {
  const asgs = assignmentsOfSubject(subjectId);
  if (!asgs.length) return 0;
  const done = asgs.filter(a => {
    const s = submissionsOf(a.id, studentId);
    return s && (s.status === 'entregado' || s.status === 'calificado');
  }).length;
  return Math.round((done / asgs.length) * 100);
}
function studentOverallAverage(studentId) {
  const st = getStudent(studentId); if (!st) return null;
  const avgs = st.subjectIds.map(id => subjectAverage(studentId, id)).filter(v => v !== null);
  if (!avgs.length) return null;
  return avgs.reduce((a, b) => a + b, 0) / avgs.length;
}
function studentAttendancePct(studentId) {
  const recs = db.attendance.filter(a => a.studentId === studentId);
  if (!recs.length) return null;
  const present = recs.filter(r => r.status === 'presente' || r.status === 'justificado').length;
  return Math.round((present / recs.length) * 100);
}
function subjectAttendancePct(studentId, subjectId) {
  const recs = attendanceOf(studentId, subjectId);
  if (!recs.length) return null;
  const present = recs.filter(r => r.status === 'presente' || r.status === 'justificado').length;
  return Math.round((present / recs.length) * 100);
}
function upcomingForStudent(studentId, limit) {
  const st = getStudent(studentId); if (!st) return [];
  const today = todayISO();
  const items = [];
  db.assignments.forEach(a => {
    if (a.type === 'Clase') return;
    const belongs = a.subjectId ? st.subjectIds.includes(a.subjectId) : a.courseId === st.courseId;
    if (!belongs) return;
    if (a.subjectId) {
      const sub = submissionsOf(a.id, studentId);
      if (sub && sub.status !== 'pendiente') return;
    }
    if (a.dueDate < addDays(today, -30) || a.dueDate > addDays(today, 90)) return;
    items.push(a);
  });
  items.sort((a, b) => a.dueDate.localeCompare(b.dueDate));
  return typeof limit === 'number' ? items.slice(0, limit) : items;
}
function pendingCountForStudent(studentId) {
  return upcomingForStudent(studentId).filter(a => a.dueDate >= todayISO()).length;
}
function weekdaysForSubject(courseId, subjectId) {
  return [...new Set(db.schedule.filter(s => s.courseId === courseId && s.subjectId === subjectId).map(s => s.day))];
}

/* ------------------------- LIBRO DE CALIFICACIONES -------------------------
   Replica el libro de notas real del colegio: 2 bloques de 5 "aportes" cada
   uno, promediados y combinados con refuerzo académico opcional (70%),
   más nota de proyecto (15%) y examen (15%). Los umbrales cualitativos y los
   TRUNC(,2) replican exactamente las fórmulas de CALIFICACIONES 2025-2026.xlsx. */
const BLOQUE1_FIELDS = [
  { key: 'deberes', label: 'Deberes' },
  { key: 'leccionesOrales', label: 'Lecciones Orales' },
  { key: 'pruebasEscritas', label: 'Pruebas Escritas' },
  { key: 'tareasClase', label: 'Tareas en Clase' },
  { key: 'exposiciones1', label: 'Exposiciones' },
];
const BLOQUE2_FIELDS = [
  { key: 'trabajosClase', label: 'Trabajos en Clase' },
  { key: 'lecciones2', label: 'Lecciones' },
  { key: 'pruebas2', label: 'Pruebas' },
  { key: 'demostraciones', label: 'Demostraciones' },
  { key: 'exposiciones2', label: 'Exposiciones' },
];
const CUALITATIVO_SCALE = [
  { min: 10, label: 'A+' }, { min: 9, label: 'A-' }, { min: 8, label: 'B+' }, { min: 7, label: 'B-' },
  { min: 6, label: 'C+' }, { min: 5, label: 'C-' }, { min: 4, label: 'D+' }, { min: 3, label: 'D-' },
  { min: 2, label: 'E+' }, { min: 0, label: 'E-' },
];
function trunc2(n) {
  // Excel's TRUNC(,2) truncates toward zero; nudge by a tiny epsilon first so
  // values that should land exactly on a hundredth (e.g. 8.2*0.7=5.74) aren't
  // clipped to 5.73 by IEEE-754 representation error (5.739999999999999...).
  const eps = n >= 0 ? 1e-9 : -1e-9;
  return Math.trunc(n * 100 + eps) / 100;
}
function avgOf(values) {
  const nums = values.map(v => (v === null || v === undefined || v === '') ? NaN : Number(v)).filter(v => !isNaN(v));
  if (!nums.length) return null;
  return nums.reduce((a, b) => a + b, 0) / nums.length;
}
function cualitativoFor(nota) {
  if (nota === null) return null;
  for (const t of CUALITATIVO_SCALE) if (nota >= t.min) return t.label;
  return 'E-';
}
function computeGradeEntry(entry) {
  const p1 = avgOf(BLOQUE1_FIELDS.map(f => entry[f.key]));
  const p2 = avgOf(BLOQUE2_FIELDS.map(f => entry[f.key]));
  const general = avgOf([p1, p2]);
  const hasRef = entry.refuerzoAcademico !== null && entry.refuerzoAcademico !== undefined && entry.refuerzoAcademico !== '';
  const conRef = hasRef ? avgOf([general, Number(entry.refuerzoAcademico)]) : general;
  const comp70 = conRef !== null ? trunc2(conRef * 0.7) : null;
  const hasProyecto = entry.notaProyecto !== null && entry.notaProyecto !== undefined && entry.notaProyecto !== '';
  const hasExamen = entry.notaExamen !== null && entry.notaExamen !== undefined && entry.notaExamen !== '';
  const compProyecto = hasProyecto ? trunc2(Number(entry.notaProyecto) * 0.15) : null;
  const compExamen = hasExamen ? trunc2(Number(entry.notaExamen) * 0.15) : null;
  const notaFinal = (comp70 !== null && compProyecto !== null && compExamen !== null) ? trunc2(comp70 + compProyecto + compExamen) : null;
  return { promedio1: p1, promedio2: p2, promedioGeneral: general, promedioConRef: conRef, comp70, compProyecto, compExamen, notaFinal, cualitativo: cualitativoFor(notaFinal) };
}
function getGradebook(subjectId) { return db.gradebooks.find(g => g.subjectId === subjectId); }
function ensureGradebook(subjectId) {
  let gb = getGradebook(subjectId);
  if (!gb) { gb = { id: uid('gb'), subjectId, entries: [] }; db.gradebooks.push(gb); }
  return gb;
}
function blankGradeEntry(studentId) {
  return {
    studentId, deberes: null, leccionesOrales: null, pruebasEscritas: null, tareasClase: null, exposiciones1: null,
    trabajosClase: null, lecciones2: null, pruebas2: null, demostraciones: null, exposiciones2: null,
    refuerzoAcademico: null, notaProyecto: null, notaExamen: null,
  };
}
function getGradeEntry(subjectId, studentId) {
  const gb = getGradebook(subjectId);
  return gb ? (gb.entries.find(e => e.studentId === studentId) || null) : null;
}
function ensureGradeEntry(subjectId, studentId) {
  const gb = ensureGradebook(subjectId);
  let e = gb.entries.find(x => x.studentId === studentId);
  if (!e) { e = blankGradeEntry(studentId); gb.entries.push(e); }
  return e;
}
function estandaresForSubject(subjectId) {
  const gb = getGradebook(subjectId);
  const students = studentsOfSubject(subjectId);
  const counts = { DA: 0, AA: 0, PA: 0, NA: 0 };
  let sum = 0, graded = 0, refuerzo = 0;
  students.forEach(st => {
    const e = gb ? gb.entries.find(x => x.studentId === st.id) : null;
    if (!e) return;
    const r = computeGradeEntry(e);
    if (r.notaFinal === null) return;
    graded++; sum += r.notaFinal;
    if (r.cualitativo === 'A+' || r.cualitativo === 'A-') counts.DA++;
    else if (r.cualitativo === 'B+' || r.cualitativo === 'B-') counts.AA++;
    else if (r.cualitativo === 'C+' || r.cualitativo === 'C-') counts.PA++;
    else counts.NA++;
    if (r.promedioGeneral !== null && r.promedioGeneral < 7) refuerzo++;
  });
  const total = students.length;
  return {
    counts, total, graded, refuerzo, average: graded ? sum / graded : null,
    pct: { DA: total ? counts.DA / total : 0, AA: total ? counts.AA / total : 0, PA: total ? counts.PA / total : 0, NA: total ? counts.NA / total : 0 },
  };
}
function subjectsOfTeacher(teacherId) { return db.subjects.filter(s => s.teacherId === teacherId); }
function studentsOfSubject(subjectId) {
  const subject = getSubject(subjectId); if (!subject) return [];
  return studentsOfCourse(subject.courseId).filter(st => st.subjectIds.includes(subjectId));
}
function getPlanForSubject(subjectId) { return db.plans.find(p => p.subjectId === subjectId); }
function blankPlanWeek(numero, fechaInicio, fechaFin) {
  return {
    id: uid('wk'), numero, fechaInicio, fechaFin, temaConceptos: '', destrezas: '',
    experiencia: '', reflexion: '', conceptualizacion: '', aplicacion: '',
    recursos: '', indicadorEvaluacion: '', instrumentoEvaluacion: '',
  };
}
function blankPlan(subjectId) {
  const today = todayISO();
  return {
    id: uid('plan'), subjectId, unidadNumero: 1, tituloUnidad: '',
    fechaInicio: today, fechaFin: addDays(today, 56),
    objetivoUnidad: '', objetivoAprendizaje: '', ejesTransversales: '', estandarAprendizaje: '',
    semanas: [blankPlanWeek(1, today, addDays(today, 6))],
    status: 'borrador', submittedAt: null, reviewedAt: null, observations: [],
  };
}
const PLAN_FIELD_LABELS = {
  tituloUnidad: 'Título de la Unidad', objetivoUnidad: 'Objetivo de la Unidad',
  objetivoAprendizaje: 'Objetivo de Aprendizaje', ejesTransversales: 'Ejes Transversales',
  estandarAprendizaje: 'Estándar de Aprendizaje', general: 'Observación general del documento',
};
const PLAN_STATUS_META = {
  borrador: { label: 'Borrador', cls: 'bg-slate-100 text-slate-500' },
  en_revision: { label: 'En Revisión', cls: 'bg-amber-50 text-amber-700 border border-amber-200' },
  aprobado: { label: 'Aprobado', cls: 'bg-emerald-50 text-emerald-700 border border-emerald-200' },
  con_observaciones: { label: 'Con Observaciones', cls: 'bg-red-50 text-red-600 border border-red-200' },
};
function syncPlanCalendar(plan) {
  db.assignments = db.assignments.filter(a => a.sourcePlanId !== plan.id);
  plan.semanas.forEach(sem => {
    if (!sem.fechaInicio) return;
    db.assignments.push({
      id: uid('cls'), subjectId: plan.subjectId, courseId: null,
      title: `Semana ${sem.numero}${sem.temaConceptos ? ': ' + sem.temaConceptos : ''}`,
      type: 'Clase', dueDate: sem.fechaInicio, dueDateEnd: sem.fechaFin || sem.fechaInicio,
      originalDueDate: sem.fechaInicio, rescheduled: false, rescheduleReason: null,
      description: sem.destrezas || '', sourcePlanId: plan.id, sourceWeekId: sem.id,
    });
  });
}
function upsertAttendanceToday(studentId, subjectId, status) {
  const date = todayISO();
  let rec = db.attendance.find(a => a.studentId === studentId && a.subjectId === subjectId && a.date === date);
  if (rec) { rec.status = status; if (status !== 'falta') rec.justification = null; }
  else { db.attendance.push({ id: uid('att'), studentId, subjectId, date, status, justification: null }); }
  saveDB();
}

/* --------------------------- GENERADORES DE DATOS ------------------------ */
const ASSIGNMENT_TITLES = {
  'Matemática': ['Ecuaciones lineales', 'Operaciones con fracciones', 'Geometría: áreas y perímetros', 'Razones y proporciones', 'Prueba parcial de álgebra'],
  'Lengua y Literatura': ['Ensayo argumentativo', 'Análisis de cuento corto', 'Ortografía y acentuación', 'Ficha de lectura', 'Prueba de comprensión lectora'],
  'Ciencias Naturales': ['Informe de laboratorio: la célula', 'Cadena alimenticia', 'El ciclo del agua', 'Investigación sobre ecosistemas', 'Prueba de biología'],
  'Estudios Sociales': ['Línea de tiempo histórica', 'Mapa político del Ecuador', 'Investigación: culturas ancestrales', 'Ensayo sobre ciudadanía', 'Prueba de historia'],
  'Inglés': ['Vocabulary quiz', 'Reading comprehension', 'Present simple worksheet', 'Speaking practice', 'Grammar test'],
  'Educación Física': ['Rutina de calentamiento', 'Prácticas gimnastas: rol adelante', 'Evaluación de condición física', 'Juegos coordinativos', 'Ficha de hábitos saludables'],
  'Educación Cultural y Artística': ['Collage temático', 'Exposición de técnicas de color', 'Proyecto de reciclaje artístico', 'Mural colaborativo', 'Muestra de talleres'],
};
const ASSIGNMENT_OFFSETS = [
  { offset: -16, type: 'Prueba' },
  { offset: -9, type: 'Tarea' },
  { offset: -3, type: 'Tarea' },
  { offset: 4, type: 'Tarea' },
  { offset: 11, type: 'Proyecto' },
];
const FEEDBACKS = [
  '¡Buen trabajo, sigue así!', 'Revisa la ortografía en el punto 2.', 'Excelente argumentación.',
  'Falta profundizar en la conclusión.', 'Muy buena participación en clase.', 'Cuida la presentación del trabajo.',
];

function generateAssignmentsForSubject(subject) {
  const titles = ASSIGNMENT_TITLES[subject.name] || ['Actividad 1', 'Actividad 2', 'Actividad 3', 'Actividad 4', 'Actividad 5'];
  const today = todayISO();
  ASSIGNMENT_OFFSETS.forEach((cfg, i) => {
    const dueDate = addDays(today, cfg.offset);
    db.assignments.push({
      id: uid('asg'), subjectId: subject.id, courseId: null,
      title: titles[i % titles.length], type: cfg.type,
      dueDate, originalDueDate: dueDate, rescheduled: false, rescheduleReason: null,
      description: `${cfg.type} de ${subject.name}.`,
    });
  });
}
function statusForDueDate(dueDate) {
  const today = todayISO();
  if (dueDate < addDays(today, -5)) return Math.random() < 0.88 ? 'calificado' : 'entregado';
  if (dueDate < today) return Math.random() < 0.45 ? 'calificado' : (Math.random() < 0.55 ? 'entregado' : 'pendiente');
  return 'pendiente';
}
function generateSubmissionsForStudentSubject(studentId, subjectId) {
  assignmentsOfSubject(subjectId).forEach(a => {
    if (submissionsOf(a.id, studentId)) return;
    const status = statusForDueDate(a.dueDate);
    const sub = { id: uid('sub'), assignmentId: a.id, studentId, status, grade: null, feedback: null, submittedText: null, submittedAt: null };
    if (status === 'entregado' || status === 'calificado') {
      sub.submittedText = 'Entrega realizada a tiempo por el estudiante.';
      sub.submittedAt = a.dueDate;
    }
    if (status === 'calificado') {
      sub.grade = Math.round((6 + Math.random() * 4) * 10) / 10;
      sub.feedback = FEEDBACKS[Math.floor(Math.random() * FEEDBACKS.length)];
    }
    db.submissions.push(sub);
  });
}
function generateAttendanceForStudentSubject(studentId, subjectId, courseId) {
  const days = weekdaysForSubject(courseId, subjectId);
  if (!days.length) return;
  if (attendanceOf(studentId, subjectId).length) return;
  let count = 0;
  const cursor = new Date();
  const records = [];
  let guard = 0;
  while (count < 10 && guard < 200) {
    cursor.setDate(cursor.getDate() - 1);
    guard++;
    if (days.includes(cursor.getDay())) {
      const r = Math.random();
      let status = 'presente';
      if (r > 0.94) status = 'falta';
      else if (r > 0.87) status = 'atraso';
      records.push({ id: uid('att'), studentId, subjectId, date: toISO(cursor), status, justification: null });
      count++;
    }
  }
  const firstFalta = records.findIndex(r => r.status === 'falta');
  if (firstFalta > 2) { records[firstFalta].status = 'justificado'; records[firstFalta].justification = 'Certificado médico presentado en secretaría.'; }
  db.attendance.push(...records);
}
function rebuildScheduleForCourse(courseId) {
  db.schedule = db.schedule.filter(s => s.courseId !== courseId);
  const subs = subjectsOfCourse(courseId);
  if (!subs.length) return;
  const classRows = HOUR_ROWS.filter(r => !r.isRecreo);
  let idx = 0;
  WEEKDAYS.forEach(day => {
    classRows.forEach(row => {
      const subject = subs[idx % subs.length];
      db.schedule.push({ id: uid('sch'), courseId, day, hourKey: row.key, subjectId: subject.id });
      idx++;
    });
  });
}
function isHolidayDate(iso) { return db.holidays.some(h => h.date === iso); }
function nextValidSchoolDay(iso) {
  const d = new Date(iso + 'T00:00:00');
  let guard = 0;
  do { d.setDate(d.getDate() + 1); guard++; } while (guard < 60 && ([0, 6].includes(d.getDay()) || isHolidayDate(toISO(d))));
  return toISO(d);
}
function rescheduleAssignments(date, courseId, reason) {
  let moved = 0;
  db.assignments.forEach(a => {
    if (a.type === 'Clase') return;
    if (a.dueDate !== date) return;
    const belongsCourse = a.subjectId ? (getSubject(a.subjectId) || {}).courseId : a.courseId;
    if (courseId !== 'all' && belongsCourse !== courseId) return;
    a.dueDate = nextValidSchoolDay(date);
    a.rescheduled = true;
    a.rescheduleReason = reason;
    moved++;
  });
  return moved;
}
function nextMatricula() {
  const year = new Date(db.meta.yearStart).getFullYear();
  return `AND-${year}-${String(db.students.length + 1).padStart(4, '0')}`;
}

/* --------------------------------- SEED --------------------------------- */
function seedDB() {
  const today = todayISO();
  db = {
    meta: {
      schoolName: 'Unidad Educativa "Andoas"',
      motto: 'Ciencia · Virtud',
      location: 'Puyo, Pastaza — Ecuador',
      founded: 1949,
      yearLabel: '',
      yearStart: addDays(today, -150),
      yearEnd: addDays(today, 150),
      currentPeriodLabel: 'Trimestre Actual',
    },
    courses: [], subjects: [], teachers: [], students: [], gradebooks: [],
    schedule: [], assignments: [], submissions: [], attendance: [],
    resources: [], messages: [], holidays: [], plans: [],
  };
  { const y1 = new Date(db.meta.yearStart).getFullYear(), y2 = new Date(db.meta.yearEnd).getFullYear(); db.meta.yearLabel = y1 === y2 ? String(y1) : `${y1} - ${y2}`; }

  db.teachers = [
    { id: uid('t'), name: 'Lic. Laura Mendoza', area: 'Matemática' },
    { id: uid('t'), name: 'Lic. Raúl Ponce', area: 'Lengua y Literatura' },
    { id: uid('t'), name: 'Ing. Carmen Vela', area: 'Ciencias Naturales' },
    { id: uid('t'), name: 'Lic. Hugo Arias', area: 'Estudios Sociales' },
    { id: uid('t'), name: 'Prof. Nora Benítez', area: 'Inglés' },
    { id: uid('t'), name: 'Lic. Iván Cordero', area: 'Educación Física' },
    { id: uid('t'), name: 'Lic. Elena Ríos', area: 'Educación Cultural y Artística' },
    { id: uid('t'), name: 'Lic. Tomás Salgado', area: 'Educación Física' },
  ].map(t => ({ ...t, email: slugifyEmail(t.name) }));
  const [tMat, tLen, tCien, tSoc, tIng, tEfi, tArt, tEf9] = db.teachers;

  db.courses = [
    { id: uid('c'), name: '7mo EGB "A"', level: '7mo EGB', paralelo: 'A' },
    { id: uid('c'), name: '7mo EGB "B"', level: '7mo EGB', paralelo: 'B' },
    { id: uid('c'), name: '8vo EGB "A"', level: '8vo EGB', paralelo: 'A' },
    { id: uid('c'), name: '8vo EGB "B"', level: '8vo EGB', paralelo: 'B' },
    { id: uid('c'), name: '8vo EGB "C"', level: '8vo EGB', paralelo: 'C' },
    { id: uid('c'), name: '9no EGB "A"', level: '9no EGB', paralelo: 'A' },
  ];

  const SUBJECT_DEFS = [
    { name: 'Matemática', teacher: tMat },
    { name: 'Lengua y Literatura', teacher: tLen },
    { name: 'Ciencias Naturales', teacher: tCien },
    { name: 'Estudios Sociales', teacher: tSoc },
    { name: 'Inglés', teacher: tIng },
    { name: 'Educación Física', teacher: tEfi },
    { name: 'Educación Cultural y Artística', teacher: tArt },
  ];
  db.courses.forEach(course => {
    SUBJECT_DEFS.forEach(def => {
      db.subjects.push({ id: uid('subj'), name: def.name, courseId: course.id, teacherId: def.teacher.id });
    });
  });

  const nuevoA = db.courses.find(c => c.level === '9no EGB' && c.paralelo === 'A');
  const efNuevoA = db.subjects.find(s => s.courseId === nuevoA.id && s.name === 'Educación Física');
  if (efNuevoA) efNuevoA.teacherId = tEf9.id;

  db.subjects.forEach(generateAssignmentsForSubject);
  db.courses.forEach(c => rebuildScheduleForCourse(c.id));

  const STUDENT_DEFS = [
    { name: 'Ana Carla Pérez Mora', level: '8vo EGB', paralelo: 'A' },
    { name: 'Luis Andrés López Castro', level: '8vo EGB', paralelo: 'A' },
    { name: 'Mariela Inés Gómez Reyes', level: '8vo EGB', paralelo: 'B' },
    { name: 'Carlos Javier Ruiz Cruz', level: '7mo EGB', paralelo: 'A' },
    { name: 'Sofía Elena Díaz León', level: '7mo EGB', paralelo: 'B' },
    { name: 'Diego Julián Mora Pérez', level: '8vo EGB', paralelo: 'C' },
    // 9no EGB "A": curso completo con datos ficticios para la sábana de calificaciones
    { name: 'Valeria Paola Vega Ruiz', level: '9no EGB', paralelo: 'A' },
    { name: 'Mateo Pablo Rojas Vega', level: '9no EGB', paralelo: 'A' },
    { name: 'Camila Andrea Castro Ortiz', level: '9no EGB', paralelo: 'A' },
    { name: 'Sebastián Andrés Molina Paredes', level: '9no EGB', paralelo: 'A' },
    { name: 'Isabella Fernanda Herrera Luna', level: '9no EGB', paralelo: 'A' },
    { name: 'Nicolás Emilio Aguirre Salas', level: '9no EGB', paralelo: 'A' },
    { name: 'Daniela Sofía Navarro Ríos', level: '9no EGB', paralelo: 'A' },
    { name: 'Joaquín Esteban Fuentes Lara', level: '9no EGB', paralelo: 'A' },
    { name: 'Martina Alejandra Campos Ibarra', level: '9no EGB', paralelo: 'A' },
    { name: 'Tomás Ignacio Bravo Medina', level: '9no EGB', paralelo: 'A' },
    { name: 'Renata Gabriela Silva Montes', level: '9no EGB', paralelo: 'A' },
    { name: 'Santiago Felipe Núñez Rosales', level: '9no EGB', paralelo: 'A' },
    { name: 'Emilia Victoria Cárdenas Soto', level: '9no EGB', paralelo: 'A' },
    { name: 'Lucas Mateo Espinoza Varela', level: '9no EGB', paralelo: 'A' },
    { name: 'Antonella Paz Guzmán Rivas', level: '9no EGB', paralelo: 'A' },
    { name: 'Benjamín David Ortega Prado', level: '9no EGB', paralelo: 'A' },
    { name: 'Valentina Isabel Rendón Mejía', level: '9no EGB', paralelo: 'A' },
    { name: 'Gabriel Alonso Sandoval Cueva', level: '9no EGB', paralelo: 'A' },
    { name: 'Mía Carolina Salinas Arteaga', level: '9no EGB', paralelo: 'A' },
    { name: 'Adrián Leonardo Peña Robles', level: '9no EGB', paralelo: 'A' },
    { name: 'Paula Daniela Quiroga Benavides', level: '9no EGB', paralelo: 'A' },
    { name: 'Samuel Ricardo Montalvo Duarte', level: '9no EGB', paralelo: 'A' },
    { name: 'Luciana Belén Figueroa Zamora', level: '9no EGB', paralelo: 'A' },
    { name: 'Julián Andrés Carrillo Estrada', level: '9no EGB', paralelo: 'A' },
    { name: 'Victoria Elena Maldonado Cisneros', level: '9no EGB', paralelo: 'A' },
    { name: 'Emiliano José Vásquez Pineda', level: '9no EGB', paralelo: 'A' },
    { name: 'Sara Lucía Palacios Tapia', level: '9no EGB', paralelo: 'A' },
    { name: 'Matías Alejandro Gallegos Rosero', level: '9no EGB', paralelo: 'A' },
    { name: 'Abigail Nicole Proaño Velasco', level: '9no EGB', paralelo: 'A' },
    { name: 'Thiago Manuel Cevallos Mena', level: '9no EGB', paralelo: 'A' },
  ];
  STUDENT_DEFS.forEach(def => {
    const course = db.courses.find(c => c.level === def.level && c.paralelo === def.paralelo);
    const subjectIds = subjectsOfCourse(course.id).map(s => s.id);
    db.students.push({
      id: uid('st'), name: def.name, email: `estudiante${db.students.length + 1}@ejemplo.ec`,
      matricula: nextMatricula(), courseId: course.id, subjectIds,
    });
  });

  db.students.forEach(student => {
    student.subjectIds.forEach(subId => {
      generateSubmissionsForStudentSubject(student.id, subId);
      generateAttendanceForStudentSubject(student.id, subId, student.courseId);
    });
  });

  // Libro de calificaciones de ejemplo (Educación Física — 9no EGB "A") con notas ficticias.
  // Se generan con semilla fija para que la demo muestre siempre los mismos valores.
  if (efNuevoA) {
    let semilla = 2026;
    const aleatorio = () => { semilla = (semilla * 16807) % (2 ** 31 - 1); return semilla / (2 ** 31 - 1); };
    const roster9noA = studentsOfCourse(nuevoA.id);
    roster9noA.forEach(student => {
      const base = 7 + Math.floor(aleatorio() * 3);
      const row = Array.from({ length: 12 }, () => Math.min(10, base + Math.floor(aleatorio() * 2)));
      const e = ensureGradeEntry(efNuevoA.id, student.id);
      [e.deberes, e.leccionesOrales, e.pruebasEscritas, e.tareasClase, e.exposiciones1,
        e.trabajosClase, e.lecciones2, e.pruebas2, e.demostraciones, e.exposiciones2,
        e.notaProyecto, e.notaExamen] = row;
    });
  }

  db.subjects.forEach(subj => {
    db.resources.push(
      { id: uid('res'), subjectId: subj.id, title: `Video de repaso — ${subj.name}`, description: 'Material audiovisual de apoyo recomendado por el docente para reforzar los temas vistos en clase.', type: 'video' },
      { id: uid('res'), subjectId: subj.id, title: `Guía de estudio — ${subj.name}`, description: 'Documento con ejercicios y lecturas complementarias para practicar en casa.', type: 'link' }
    );
  });

  const primerEst = db.students[0];
  const matePrimerEst = db.subjects.find(s => s.courseId === primerEst.courseId && s.name === 'Matemática');
  if (matePrimerEst) {
    db.messages.push(
      { id: uid('msg'), studentId: primerEst.id, teacherId: matePrimerEst.teacherId, sender: 'student', text: 'Buenas tardes, licenciada. Tengo una duda sobre la tarea de ecuaciones.', time: '09:14' },
      { id: uid('msg'), studentId: primerEst.id, teacherId: matePrimerEst.teacherId, sender: 'teacher', text: `Buenas tardes ${firstName(primerEst.name)}, claro, dime qué parte no te quedó clara.`, time: '09:20' },
      { id: uid('msg'), studentId: primerEst.id, teacherId: matePrimerEst.teacherId, sender: 'student', text: 'El ejercicio 4, no sé cómo despejar la incógnita.', time: '09:21' }
    );
  }

  const ochoA = db.courses.find(c => c.level === '8vo EGB' && c.paralelo === 'A');

  const efOchoA = db.subjects.find(s => s.courseId === ochoA.id && s.name === 'Educación Física');
  if (efOchoA) {
    const plan = {
      id: uid('plan'), subjectId: efOchoA.id, unidadNumero: 3, tituloUnidad: 'Prácticas Gimnastas',
      fechaInicio: addDays(today, -56), fechaFin: addDays(today, 7),
      status: 'aprobado', submittedAt: addDays(today, -55), reviewedAt: addDays(today, -50), observations: [],
      objetivoUnidad: 'O.EF.4.8. Sensibilizarse frente al entorno que lo rodea, para reconocerlo como espacio propio y vital que necesita de cuidado durante su participación en diversas prácticas corporales.',
      objetivoAprendizaje: 'Los estudiantes comprenderán que ciertas acciones de los seres humanos inciden de manera negativa y directa en los fenómenos que ocurren en la naturaleza y que recrudecen los problemas ambientales como el calentamiento global, para la concientización y la toma de decisiones asertivas y responsables con el entorno inmediato.',
      ejesTransversales: 'Educación Ambiental; Educación para la Salud y el Bienestar; Interculturalidad; Educación Sexual; Educación Vial y del Transporte',
      estandarAprendizaje: 'E.EF.4.3.1. Establece diferencias entre habilidades motrices básicas de ejercicios construidos que le permiten transferir a otras prácticas corporales de manera eficaz y segura, ejercicios, destrezas y acrobacias gimnásticas.',
      semanas: [
        {
          id: uid('wk'), numero: 1, fechaInicio: addDays(today, -56), fechaFin: addDays(today, -43),
          temaConceptos: 'Prácticas Gimnastas. Secuencias gimnásticas sin implementos. Secuencias gimnásticas con implementos. Ejercicios construidos. Condición física (flexibilidad). Gimnasia manos libres y en aparatos: adecuación de implementos deportivos (colchoneta, pica, galleta, barra, paralelas, potro con arzones).',
          destrezas: 'EF.3.2.2. Crear secuencias gimnásticas individuales y grupales con diferentes destrezas (y sus variantes), utilizando como recursos los saltos, giros y desplazamientos para enlazarlas.',
          experiencia: 'Observa láminas y videos sobre ROLES (roles adelante, atrás, A-B). Importancia de mantener limpio y seguro el lugar.',
          reflexion: 'Contesta bajo la ayuda de tu docente las siguientes interrogantes: ¿Qué es el rol adelante y atrás A-B? ¿Cuáles son los beneficios de hacer las rodadas? Explicar por qué es importante hacer ejercicios de rotación del cuerpo temporo-espacial. Lugar cómodo y seguro.',
          conceptualizacion: 'Lee o pide que te lean la siguiente información: identificar los lugares seguros e inseguros, áreas verdes inseguras. Mingas con los estudiantes para mejorar los implementos. Autogestión con los alumnos para la adecuación y mantenimiento de los implementos y áreas de trabajo pedagógico. Reconoce e identifica la importancia de hacer deporte en lugares seguros y cómodos.',
          aplicacion: 'Participa en juegos coordinativos con y sin implemento.',
          recursos: 'Silbato, colchoneta, pica, galleta, cajoneta, potro con arzones, canchas, áreas verdes.',
          indicadorEvaluacion: 'Construye colectivamente secuencias gimnásticas individuales y grupales, realizando el acondicionamiento corporal necesario.',
          instrumentoEvaluacion: 'Técnica: Observación. Instrumento: Lista de cotejo.',
        },
        {
          id: uid('wk'), numero: 2, fechaInicio: addDays(today, -42), fechaFin: addDays(today, -29),
          temaConceptos: 'Gimnasia manos libres y en aparatos: rol adelante y atrás agrupado.',
          destrezas: 'EF.3.2.2. Crear secuencias gimnásticas individuales y grupales con diferentes destrezas (y sus variantes).',
          experiencia: 'Observa láminas y videos sobre ROLES (roles adelante, atrás, A). Importancia de mantener limpio y seguro el lugar.',
          reflexion: '¿Cómo puedo mejorar el rol adelante y atrás A? ¿Cuáles son los beneficios de hacer las rodadas? Explicar por qué es importante hacer ejercicios de rotación del cuerpo temporo-espacial. Lugar cómodo y seguro.',
          conceptualizacion: 'Realizar un calentamiento previo general y específico de los grupos musculares a desarrollar en la clase. Dialogar sobre los beneficios de la actividad física y el buen calentamiento para no sufrir lesiones. Ubicación de manos y cuerpo sobre la colchoneta, técnica del movimiento. Corregir errores y repetir varias veces hasta lograr el objetivo del movimiento.',
          aplicacion: 'Ejecutar el movimiento del rol a su máxima perfección. Vuelta a la calma: estiramiento e hidratación. Participa de la clase con mucha responsabilidad.',
          recursos: 'Colchonetas, silbato, canchas.',
          indicadorEvaluacion: 'Reconoce e identifica la importancia de hacer deporte en lugares seguros y cómodos.',
          instrumentoEvaluacion: 'Técnica: Observación. Instrumento: Lista de cotejo.',
        },
        {
          id: uid('wk'), numero: 3, fechaInicio: addDays(today, -28), fechaFin: addDays(today, -15),
          temaConceptos: 'Gimnasia manos libres y en aparatos: media luna, parada de manos y parada de cabeza.',
          destrezas: 'EF.3.2.2. Crear secuencias gimnásticas individuales y grupales con diferentes destrezas, utilizando planos verticales.',
          experiencia: 'Observa láminas y videos sobre media luna, parada de cabeza y de manos. Importancia de mantener limpio y seguro el lugar.',
          reflexion: '¿Cómo puedo mejorar la media luna, parada de cabeza y de manos? ¿Cuáles son los beneficios de trabajar en planos verticales? Explicar por qué es importante hacer estos ejercicios. Lugar cómodo y seguro.',
          conceptualizacion: 'Realizar un calentamiento previo general y específico de los grupos musculares a desarrollar en la clase. Dialogar sobre los beneficios de la actividad física y el buen calentamiento para no sufrir lesiones. Ejecución guiada de la técnica, corrigiendo errores progresivamente.',
          aplicacion: 'Ejecutar el movimiento a su máxima perfección. Vuelta a la calma: estiramiento e hidratación. Participa de la clase con mucha responsabilidad.',
          recursos: 'Colchonetas, silbato, áreas verdes.',
          indicadorEvaluacion: 'Reconoce e identifica la importancia de hacer deporte en lugares seguros y cómodos.',
          instrumentoEvaluacion: 'Técnica: Observación. Instrumento: Lista de cotejo.',
        },
        {
          id: uid('wk'), numero: 4, fechaInicio: addDays(today, -14), fechaFin: addDays(today, -1),
          temaConceptos: 'Gimnasia en aparatos: rol en la cajoneta, pescadito, tijeras.',
          destrezas: 'EF.3.2.2. Crear secuencias gimnásticas utilizando la cajoneta como recurso.',
          experiencia: 'Observa láminas y videos sobre rol en la cajoneta, pescadito y tijeras. Importancia de mantener limpio y seguro el lugar.',
          reflexion: '¿Cómo puedo mejorar el rol en la cajoneta, pescadito y tijeras? ¿Cuáles son los beneficios de hacer estos ejercicios en planos verticales? Lugar cómodo y seguro.',
          conceptualizacion: 'Realizar un calentamiento previo general y específico de los grupos musculares a desarrollar en la clase. Ejecución del rol sobre el implemento cajoneta con acompañamiento docente, ubicación de manos y cuerpo, técnica del movimiento. Corregir errores y repetir varias veces.',
          aplicacion: 'Ejecutar el movimiento a su máxima perfección. Vuelta a la calma: estiramiento e hidratación. Participa de la clase con mucha responsabilidad.',
          recursos: 'Cajoneta, colchonetas, silbato.',
          indicadorEvaluacion: 'Reconoce e identifica la importancia de hacer deporte en lugares seguros y cómodos.',
          instrumentoEvaluacion: 'Técnica: Observación. Instrumento: Lista de cotejo.',
        },
        {
          id: uid('wk'), numero: 5, fechaInicio: today, fechaFin: addDays(today, 7),
          temaConceptos: 'Evaluación sumativa de la Unidad 3: examen del tercer trimestre.',
          destrezas: 'E.EF.4.3.1. Establece diferencias entre habilidades motrices básicas transfiriéndolas a otras prácticas corporales de manera eficaz y segura.',
          experiencia: '',
          reflexion: '',
          conceptualizacion: 'Repaso general de las destrezas gimnásticas trabajadas en la unidad.',
          aplicacion: 'Aplicación práctica evaluada de rol adelante/atrás, media luna, parada de manos y de cabeza, y rol en la cajoneta.',
          recursos: 'Colchonetas, cajoneta, potro con arzones, silbato.',
          indicadorEvaluacion: 'Aplica correctamente las destrezas gimnásticas aprendidas evidenciando control corporal y seguridad.',
          instrumentoEvaluacion: 'Técnica: Evaluación práctica. Instrumento: Rúbrica.',
        },
      ],
    };
    db.plans.push(plan);
    syncPlanCalendar(plan);
  }

  // Segundo ejemplo: planificación de Educación Física de 9no EGB "A" recién enviada
  // a revisión, para mostrar el flujo de aprobación del administrador en vivo.
  if (efNuevoA) {
    const planEf9noA = {
      id: uid('plan'), subjectId: efNuevoA.id, unidadNumero: 3, tituloUnidad: 'Deportes de Conjunto',
      fechaInicio: addDays(today, -14), fechaFin: addDays(today, 21),
      status: 'en_revision', submittedAt: today, reviewedAt: null, observations: [],
      objetivoUnidad: 'O.EF.4.5. Interactuar con otros de forma respetuosa evitando prácticas discriminatorias durante su participación en actividades corporales, reconociendo y aceptando las diferencias individuales y culturales.',
      objetivoAprendizaje: 'Los estudiantes comprenderán la importancia del trabajo en equipo y la cooperación como base para el logro de metas comunes dentro y fuera de las prácticas deportivas.',
      ejesTransversales: 'Educación para la Salud y el Bienestar; Interculturalidad',
      estandarAprendizaje: 'E.EF.4.1.1. Colabora en la resolución de situaciones de juego, aplicando principios tácticos ofensivos y defensivos básicos en prácticas deportivas de conjunto.',
      semanas: [
        {
          id: uid('wk'), numero: 1, fechaInicio: addDays(today, -14), fechaFin: addDays(today, -1),
          temaConceptos: 'Deportes de conjunto: fundamentos técnicos del voleibol (recepción, saque, colocación).',
          destrezas: 'EF.4.1.3. Reconocer los fundamentos técnicos básicos de deportes de conjunto para mejorar el desempeño individual y colectivo.',
          experiencia: 'Observa videos de partidos de voleibol escolar y comenta las jugadas más destacadas.',
          reflexion: '¿Qué fundamentos técnicos identificaste? ¿Por qué es importante dominar el saque y la recepción?',
          conceptualizacion: 'Explicación y demostración guiada de la postura, el saque de abajo y la recepción en parejas.',
          aplicacion: 'Práctica de saque y recepción en parejas, luego en grupos de 4 con rotación.',
          recursos: 'Balones de voleibol, red, cancha, silbato.',
          indicadorEvaluacion: 'Ejecuta el saque y la recepción con una técnica básica aceptable.',
          instrumentoEvaluacion: 'Técnica: Observación. Instrumento: Lista de cotejo.',
        },
        {
          id: uid('wk'), numero: 2, fechaInicio: today, fechaFin: addDays(today, 13),
          temaConceptos: 'Deportes de conjunto: juego reducido de voleibol aplicando reglas básicas.',
          destrezas: 'EF.4.1.4. Aplicar principios tácticos ofensivos y defensivos básicos en situaciones de juego real.',
          experiencia: 'Participa en un juego reducido (3 vs 3) aplicando lo practicado la semana anterior.',
          reflexion: '¿Qué decisiones tácticas tomaste durante el juego? ¿Cómo apoyaste a tu equipo?',
          conceptualizacion: 'Diálogo sobre reglas básicas del voleibol y rotación de posiciones.',
          aplicacion: 'Juego reducido con arbitraje estudiantil rotativo.',
          recursos: 'Balones de voleibol, red, cancha, silbato, petos.',
          indicadorEvaluacion: 'Aplica reglas básicas y colabora con su equipo durante el juego.',
          instrumentoEvaluacion: 'Técnica: Observación. Instrumento: Lista de cotejo.',
        },
        {
          id: uid('wk'), numero: 3, fechaInicio: addDays(today, 14), fechaFin: addDays(today, 21),
          temaConceptos: 'Evaluación práctica: mini-torneo de voleibol entre equipos del curso.',
          destrezas: 'EF.4.1.4. Aplicar principios tácticos ofensivos y defensivos básicos en situaciones de juego real.',
          experiencia: 'Organización de equipos y calentamiento previo al torneo.',
          reflexion: '¿Qué aprendiste sobre el trabajo en equipo durante el torneo?',
          conceptualizacion: 'Recordatorio de reglas oficiales y fair play.',
          aplicacion: 'Mini-torneo por equipos con evaluación de desempeño individual y colectivo.',
          recursos: 'Balones de voleibol, red, cancha, silbato, petos, marcador.',
          indicadorEvaluacion: 'Demuestra los fundamentos técnicos y tácticos trabajados en la unidad.',
          instrumentoEvaluacion: 'Técnica: Evaluación práctica. Instrumento: Rúbrica.',
        },
      ],
    };
    db.plans.push(planEf9noA);
    syncPlanCalendar(planEf9noA);
  }

  const pastHolidayDate = addDays(today, -20);
  const moved = rescheduleAssignments(pastHolidayDate, ochoA.id, 'Feriado local por fundación de Puyo');
  db.holidays.push({ id: uid('hol'), date: pastHolidayDate, courseId: ochoA.id, reason: 'Feriado local por fundación de Puyo', movedCount: moved });

  return db;
}

/* ---------------------------------- TOAST -------------------------------- */
function toast(msg, type) {
  const root = document.getElementById('toast-root');
  const el = document.createElement('div');
  el.className = `anim-slideup px-4 py-3 rounded-lg text-sm font-medium shadow-lg text-white ${type === 'error' ? 'bg-red-500' : 'bg-slate-800'}`;
  el.textContent = msg;
  root.appendChild(el);
  setTimeout(() => {
    el.style.transition = 'opacity .25s ease';
    el.style.opacity = '0';
    setTimeout(() => el.remove(), 250);
  }, 2800);
}

/* ------------------------------ RENDER: SHELL ---------------------------- */
function kpiCard(icon, label, value, hint) {
  return `<div class="${CARD} p-5">
    <div class="text-2xl mb-2">${icon}</div>
    <div class="text-2xl font-display font-bold text-primary-dark">${value}</div>
    <div class="text-[11px] font-bold text-slate-500 uppercase tracking-wide mt-1">${label}</div>
    <div class="text-[11px] text-slate-400 mt-1">${hint}</div>
  </div>`;
}
function emptyStudentState() {
  return `<div class="${CARD} p-10 text-center text-sm text-slate-400">No hay estudiantes matriculados todavía. Ve al panel de Administrador para crear el primero.</div>`;
}

function renderSidebar() {
  const el = document.getElementById('sidebar');
  const navAdmin = [
    { id: 'inicio', label: 'Inicio', icon: '🏠' },
    { id: 'estandares', label: 'Rendimiento Académico', icon: '📊' },
    { id: 'revision', label: 'Revisión Planificaciones', icon: '🗂️' },
    { id: 'anio', label: 'Año Lectivo', icon: '📅' },
    { id: 'cursos', label: 'Cursos y Materias', icon: '📚' },
    { id: 'docentes', label: 'Docentes', icon: '🧑‍🏫' },
    { id: 'estudiantes', label: 'Estudiantes', icon: '🎓' },
    { id: 'reprogramaciones', label: 'Reprogramaciones', icon: '🔁' },
  ];
  const navStudent = [
    { id: 'dashboard', label: 'Mi Dashboard', icon: '🏠' },
    { id: 'horario', label: 'Horario y Calendario', icon: '📅' },
    { id: 'materias', label: 'Mis Materias', icon: '📚' },
    { id: 'mensajeria', label: 'Mensajería', icon: '💬' },
    { id: 'reporte', label: 'Reportes', icon: '🖨️' },
  ];
  const navTeacher = [
    { id: 'inicio', label: 'Mis Materias', icon: '🏠' },
    { id: 'planificacion', label: 'Planificación', icon: '🗓️' },
    { id: 'asistencia', label: 'Tomar Asistencia', icon: '✅' },
    { id: 'notas', label: 'Libro de Calificaciones', icon: '📗' },
    { id: 'calificaciones', label: 'Calificar Tareas', icon: '📝' },
    { id: 'recursos', label: 'Recursos de Estudio', icon: '📎' },
    { id: 'mensajeria', label: 'Mensajería', icon: '💬' },
  ];
  const items = ui.role === 'admin' ? navAdmin : ui.role === 'docente' ? navTeacher : navStudent;
  const activeScreen = ui.role === 'admin' ? ui.adminScreen : ui.role === 'docente' ? ui.teacherScreen : ui.studentScreen;
  const setter = ui.role === 'admin' ? 'setAdminScreen' : ui.role === 'docente' ? 'setTeacherScreen' : 'setStudentScreen';

  el.className = `fixed inset-y-0 left-0 z-40 w-72 bg-primary flex flex-col transform transition-transform duration-200 lg:static lg:translate-x-0 lg:w-64 lg:flex-shrink-0 print:hidden ${ui.sidebarOpen ? 'translate-x-0' : '-translate-x-full'}`;
  el.innerHTML = `
    <div class="flex items-center gap-3 px-5 py-5 border-b border-white/10">
      <img src="assets/logo-andoas.jpg" alt="Escudo U.E. Andoas" class="w-11 h-11 rounded-full object-cover ring-2 ring-accent flex-shrink-0" />
      <div class="min-w-0">
        <div class="font-display font-bold text-white text-[15px] leading-tight truncate">U.E. "Andoas"</div>
        <div class="text-[11px] text-white/50 leading-tight mt-0.5">Portal Educativo · Puyo</div>
      </div>
      <button onclick="window.toggleSidebar(false)" class="ml-auto lg:hidden text-white/60 hover:text-white text-2xl leading-none">&times;</button>
    </div>
    <nav class="flex-1 overflow-y-auto py-3 px-2 flex flex-col gap-1">
      ${items.map(it => `
        <button onclick="window.${setter}('${it.id}')" class="flex items-center gap-3 px-3.5 py-2.5 rounded-lg text-sm font-medium transition-colors text-left ${activeScreen === it.id ? 'bg-white/10 text-white' : 'text-white/60 hover:bg-white/5 hover:text-white'}">
          <span class="text-base w-5 text-center">${it.icon}</span> ${it.label}
        </button>
      `).join('')}
    </nav>
    <div class="px-5 py-4 border-t border-white/10">
      <div class="text-[11px] text-white/40 leading-relaxed">"${escapeHtml(db.meta.motto)}"<br>Fundada en ${db.meta.founded} — Puyo, Pastaza</div>
    </div>
  `;
}

function renderTopbar() {
  const el = document.getElementById('topbar');
  el.className = 'h-16 flex-shrink-0 bg-white border-b border-slate-200 flex items-center gap-3 px-4 sm:px-6 print:hidden';
  const title = ui.role === 'admin' ? ADMIN_TITLES[ui.adminScreen] : ui.role === 'docente' ? TEACHER_TITLES[ui.teacherScreen] : STUDENT_TITLES[ui.studentScreen];
  el.innerHTML = `
    <button onclick="window.toggleSidebar(true)" class="lg:hidden text-slate-500 hover:text-primary flex-shrink-0">
      <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M3 6h18M3 12h18M3 18h18"/></svg>
    </button>
    <div class="font-display font-bold text-primary-dark text-lg truncate">${title}</div>
    <div class="ml-auto flex items-center gap-2 sm:gap-3 flex-wrap justify-end">
      ${ui.role === 'estudiante' && db.students.length ? `
        <select onchange="window.selectStudent(this.value)" class="text-xs sm:text-sm font-semibold text-primary-dark border border-slate-300 rounded-lg px-2.5 py-2 bg-white max-w-[160px] sm:max-w-none">
          ${db.students.map(s => `<option value="${s.id}" ${s.id === ui.studentId ? 'selected' : ''}>${escapeHtml(s.name)}</option>`).join('')}
        </select>
      ` : ''}
      ${ui.role === 'docente' && db.teachers.length ? `
        <select onchange="window.selectTeacher(this.value)" class="text-xs sm:text-sm font-semibold text-primary-dark border border-slate-300 rounded-lg px-2.5 py-2 bg-white max-w-[160px] sm:max-w-none">
          ${db.teachers.map(t => `<option value="${t.id}" ${t.id === ui.teacherId ? 'selected' : ''}>${escapeHtml(t.name)}</option>`).join('')}
        </select>
      ` : ''}
      <div class="flex items-center gap-1.5">
        <span class="text-[11px] font-bold text-slate-500 hidden sm:inline">Vista:</span>
        <select onchange="window.setRole(this.value)" class="text-xs sm:text-sm font-bold text-primary-dark border border-slate-300 rounded-lg px-2.5 py-2 bg-white">
          <option value="admin" ${ui.role === 'admin' ? 'selected' : ''}>Administrador</option>
          <option value="docente" ${ui.role === 'docente' ? 'selected' : ''}>Docente</option>
          <option value="estudiante" ${ui.role === 'estudiante' ? 'selected' : ''}>Estudiante</option>
        </select>
      </div>
      <div class="hidden md:flex items-center gap-1.5 bg-emerald-50 border border-emerald-200 text-emerald-700 text-[11px] font-bold px-2.5 py-1.5 rounded-md">
        🔒 SSL Activo
      </div>
    </div>
  `;
}

function render() {
  if (!db.students.length) ui.studentId = null;
  else if (!ui.studentId || !getStudent(ui.studentId)) ui.studentId = db.students[0].id;

  if (!db.teachers.length) ui.teacherId = null;
  else if (!ui.teacherId || !getTeacher(ui.teacherId)) ui.teacherId = db.teachers[0].id;

  renderSidebar();
  renderTopbar();

  let html = '';
  if (ui.role === 'admin') {
    switch (ui.adminScreen) {
      case 'inicio': html = screenAdminInicio(); break;
      case 'estandares': html = screenAdminEstandares(); break;
      case 'revision': html = ui.reviewingPlanId ? screenAdminRevisionDetalle() : screenAdminRevision(); break;
      case 'anio': html = screenAdminAnio(); break;
      case 'cursos': html = screenAdminCursos(); break;
      case 'docentes': html = screenAdminDocentes(); break;
      case 'estudiantes': html = screenAdminEstudiantes(); break;
      case 'reprogramaciones': html = screenAdminReprogramaciones(); break;
      default: html = screenAdminInicio();
    }
  } else if (ui.role === 'docente') {
    switch (ui.teacherScreen) {
      case 'inicio': html = screenTeacherInicio(); break;
      case 'planificacion': html = screenTeacherPlanificacion(); break;
      case 'asistencia': html = screenTeacherAsistencia(); break;
      case 'notas': html = screenTeacherNotas(); break;
      case 'calificaciones': html = screenTeacherCalificaciones(); break;
      case 'recursos': html = screenTeacherRecursos(); break;
      case 'mensajeria': html = screenTeacherMensajeria(); break;
      default: html = screenTeacherInicio();
    }
  } else {
    switch (ui.studentScreen) {
      case 'dashboard': html = screenStudentDashboard(); break;
      case 'horario': html = screenStudentHorario(); break;
      case 'materias': html = ui.selectedSubjectId ? screenSubjectDetail() : screenStudentMaterias(); break;
      case 'mensajeria': html = screenStudentMensajeria(); break;
      case 'reporte': html = screenStudentReporte(); break;
      default: html = screenStudentDashboard();
    }
  }

  document.getElementById('view-root').innerHTML = `<div class="anim-fade max-w-6xl mx-auto pb-10">${html}</div>`;
  document.getElementById('sidebar-backdrop').classList.toggle('hidden', !ui.sidebarOpen);
  renderModal();
}

/* ------------------------------ ADMIN: INICIO ---------------------------- */
function screenAdminInicio() {
  return `
    <div class="mb-6">
      <h1 class="font-display font-bold text-2xl text-primary-dark">Panel de Control Administrativo</h1>
      <p class="text-slate-500 text-sm mt-1">Resumen institucional — ${escapeHtml(db.meta.schoolName)}</p>
    </div>
    <div class="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-8">
      ${kpiCard('🎓', 'Estudiantes', db.students.length, 'Matriculados en el sistema')}
      ${kpiCard('🏫', 'Cursos', db.courses.length, 'Paralelos activos')}
      ${kpiCard('📚', 'Materias', db.subjects.length, 'Asignaturas configuradas')}
      ${kpiCard('🗂️', 'Por revisar', db.plans.filter(p => p.status === 'en_revision').length, 'Planificaciones pendientes')}
    </div>
    <div class="grid grid-cols-1 md:grid-cols-2 gap-5">
      <div class="${CARD} p-6">
        <div class="font-display font-bold text-primary-dark mb-1">Año Lectivo Actual</div>
        <div class="text-sm text-slate-500 mb-4">${escapeHtml(db.meta.yearLabel)} · ${escapeHtml(db.meta.currentPeriodLabel)}</div>
        <div class="flex items-center justify-between text-sm border-t border-slate-100 pt-3">
          <span class="text-slate-500">Inicio</span><span class="font-semibold text-slate-700">${fmtDate(db.meta.yearStart)}</span>
        </div>
        <div class="flex items-center justify-between text-sm border-t border-slate-100 pt-3 mt-3">
          <span class="text-slate-500">Fin</span><span class="font-semibold text-slate-700">${fmtDate(db.meta.yearEnd)}</span>
        </div>
        <button onclick="window.setAdminScreen('anio')" class="${BTN_SECONDARY} w-full mt-4">Editar Año Lectivo</button>
      </div>
      <div class="${CARD} p-6">
        <div class="font-display font-bold text-primary-dark mb-3">Accesos Rápidos</div>
        <div class="flex flex-col gap-2">
          <button onclick="window.openStudentModal()" class="${BTN_PRIMARY} justify-start">+ Matricular Nuevo Estudiante</button>
          <button onclick="window.openTeacherModal()" class="${BTN_SECONDARY} justify-start">+ Registrar Docente</button>
          <button onclick="window.setAdminScreen('revision')" class="${BTN_SECONDARY} justify-start">🗂️ Revisar Planificaciones ${db.plans.filter(p => p.status === 'en_revision').length ? `<span class="ml-auto bg-accent text-white text-[10px] font-bold px-1.5 py-0.5 rounded-full">${db.plans.filter(p => p.status === 'en_revision').length}</span>` : ''}</button>
          <button onclick="window.setAdminScreen('reprogramaciones')" class="${BTN_SECONDARY} justify-start">🔁 Marcar Día No Dictado</button>
          <button onclick="window.setAdminScreen('cursos')" class="${BTN_SECONDARY} justify-start">📚 Gestionar Cursos y Materias</button>
        </div>
      </div>
    </div>
    <div class="mt-6 text-right">
      <button onclick="window.confirmResetDB()" class="text-xs text-slate-400 hover:text-red-500 underline">Restaurar datos de ejemplo</button>
    </div>
  `;
}

/* --------------------------- ADMIN: RENDIMIENTO ACADÉMICO ------------------- */
function screenAdminEstandares() {
  const rows = db.subjects.map(s => ({ subject: s, course: getCourse(s.courseId), teacher: getTeacher(s.teacherId), r: estandaresForSubject(s.id) }))
    .filter(row => row.r.total > 0)
    .sort((a, b) => (a.course ? a.course.name : '').localeCompare(b.course ? b.course.name : '') || a.subject.name.localeCompare(b.subject.name));

  const totals = { DA: 0, AA: 0, PA: 0, NA: 0, total: 0, graded: 0, refuerzo: 0 };
  rows.forEach(row => {
    totals.DA += row.r.counts.DA; totals.AA += row.r.counts.AA; totals.PA += row.r.counts.PA; totals.NA += row.r.counts.NA;
    totals.total += row.r.total; totals.graded += row.r.graded; totals.refuerzo += row.r.refuerzo;
  });
  const pct = (n) => totals.total ? Math.round((n / totals.total) * 100) : 0;

  return `
    <div class="mb-6">
      <h1 class="font-display font-bold text-2xl text-primary-dark">Rendimiento Académico</h1>
      <p class="text-slate-500 text-sm mt-1">Hoja de estándares consolidada de todos los cursos y materias — se actualiza en vivo desde el libro de calificaciones de cada docente.</p>
    </div>
    <div class="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-8">
      ${kpiCard('🟢', 'Domina (DA)', `${totals.DA} · ${pct(totals.DA)}%`, '9,00 – 10,00')}
      ${kpiCard('🔵', 'Alcanza (AA)', `${totals.AA} · ${pct(totals.AA)}%`, '7,00 – 8,99')}
      ${kpiCard('🟠', 'Próximo (PA)', `${totals.PA} · ${pct(totals.PA)}%`, '4,01 – 6,99')}
      ${kpiCard('🔴', 'No Alcanza (NA)', `${totals.NA} · ${pct(totals.NA)}%`, '0 – 4,00')}
    </div>
    <div class="${CARD} overflow-hidden">
      <div class="grid grid-cols-[1fr_1fr_1fr_80px_70px_70px_70px_70px_80px] gap-2 px-5 py-3 text-[10.5px] font-bold text-slate-400 uppercase border-b border-slate-100 bg-slate-50">
        <div>Curso</div><div>Materia</div><div>Docente</div><div class="text-center">Prom.</div><div class="text-center">DA</div><div class="text-center">AA</div><div class="text-center">PA</div><div class="text-center">NA</div><div class="text-center">Refuerzo</div>
      </div>
      <div class="max-h-[560px] overflow-y-auto">
        ${rows.length ? rows.map(row => `
          <div class="grid grid-cols-[1fr_1fr_1fr_80px_70px_70px_70px_70px_80px] gap-2 px-5 py-3 items-center border-b border-slate-50 text-sm">
            <div class="font-semibold text-slate-700 truncate">${row.course ? escapeHtml(row.course.name) : '—'}</div>
            <div class="text-slate-600 truncate">${escapeHtml(row.subject.name)}</div>
            <div class="text-slate-500 text-xs truncate">${row.teacher ? escapeHtml(row.teacher.name) : 'Sin asignar'}</div>
            <div class="text-center font-bold text-primary-dark">${row.r.average !== null ? row.r.average.toFixed(2) : '—'}</div>
            <div class="text-center text-emerald-600 font-semibold">${row.r.counts.DA}</div>
            <div class="text-center text-sky font-semibold">${row.r.counts.AA}</div>
            <div class="text-center text-amber-600 font-semibold">${row.r.counts.PA}</div>
            <div class="text-center text-red-600 font-semibold">${row.r.counts.NA}</div>
            <div class="text-center ${row.r.refuerzo ? 'text-accent-dark font-bold' : 'text-slate-400'}">${row.r.refuerzo}</div>
          </div>
        `).join('') : `<div class="p-10 text-center text-sm text-slate-400">Aún no hay calificaciones registradas en ningún curso.</div>`}
      </div>
    </div>
  `;
}

/* ------------------------- ADMIN: REVISIÓN DE PLANIFICACIONES --------------- */
function screenAdminRevision() {
  const plansSorted = [...db.plans].sort((a, b) => {
    const order = { en_revision: 0, con_observaciones: 1, borrador: 2, aprobado: 3 };
    return (order[a.status] ?? 9) - (order[b.status] ?? 9) || (b.submittedAt || '').localeCompare(a.submittedAt || '');
  });
  return `
    <div class="mb-6">
      <h1 class="font-display font-bold text-2xl text-primary-dark">Revisión de Planificaciones</h1>
      <p class="text-slate-500 text-sm mt-1">Revisa cada unidad didáctica y deja observaciones exactas sobre el campo que necesita corrección.</p>
    </div>
    <div class="${CARD} overflow-hidden">
      <div class="grid grid-cols-[1fr_1fr_1fr_110px_120px] gap-2 px-5 py-3 text-[11px] font-bold text-slate-400 uppercase border-b border-slate-100 bg-slate-50">
        <div>Unidad</div><div>Materia</div><div>Docente</div><div>Enviado</div><div>Estado</div>
      </div>
      <div class="max-h-[560px] overflow-y-auto">
        ${plansSorted.length ? plansSorted.map(p => {
          const subject = getSubject(p.subjectId);
          const teacher = subject ? getTeacher(subject.teacherId) : null;
          const meta = PLAN_STATUS_META[p.status || 'borrador'];
          return `<button onclick="window.openPlanReview('${p.id}')" class="w-full text-left grid grid-cols-[1fr_1fr_1fr_110px_120px] gap-2 px-5 py-3.5 items-center border-b border-slate-50 text-sm hover:bg-slate-50">
            <div class="font-semibold text-slate-700 truncate">${escapeHtml(p.tituloUnidad || 'Sin título')}</div>
            <div class="text-slate-600 truncate">${subject ? escapeHtml(subject.name) : '—'}</div>
            <div class="text-slate-500 text-xs truncate">${teacher ? escapeHtml(teacher.name) : '—'}</div>
            <div class="text-slate-400 text-xs">${p.submittedAt ? fmtDate(p.submittedAt) : '—'}</div>
            <div><span class="text-[11px] font-bold px-2 py-1 rounded-md ${meta.cls}">${meta.label}</span></div>
          </button>`;
        }).join('') : `<div class="p-10 text-center text-sm text-slate-400">Ningún docente ha guardado una planificación todavía.</div>`}
      </div>
    </div>
  `;
}
window.openPlanReview = (planId) => { ui.reviewingPlanId = planId; render(); };
window.closePlanReview = () => { ui.reviewingPlanId = null; render(); };

function screenAdminRevisionDetalle() {
  const plan = db.plans.find(p => p.id === ui.reviewingPlanId);
  if (!plan) { ui.reviewingPlanId = null; return screenAdminRevision(); }
  const subject = getSubject(plan.subjectId);
  const course = subject ? getCourse(subject.courseId) : null;
  const teacher = subject ? getTeacher(subject.teacherId) : null;
  const meta = PLAN_STATUS_META[plan.status || 'borrador'];
  const obs = plan.observations || [];
  const obsBtn = (field, label) => `<button onclick="window.openObsModal('${plan.id}','${field}', '${escapeHtml(label).replace(/'/g, "\\'")}')" class="text-[11px] font-bold text-accent hover:underline whitespace-nowrap">💬 Observar</button>`;
  const fieldObsBox = (fieldKey) => {
    const matches = obs.filter(o => o.field === fieldKey);
    if (!matches.length) return '';
    return matches.map(o => `<div class="mt-1.5 flex items-start gap-2 ${o.resolved ? 'bg-slate-50 border-slate-200 text-slate-500' : 'bg-red-50 border-red-200 text-red-700'} border text-xs rounded-lg px-3 py-2"><span>💬</span><span class="flex-1">${escapeHtml(o.text)}</span>${o.resolved ? '<span class="text-[10px] font-bold">Resuelta</span>' : ''}</div>`).join('');
  };
  const fieldRow = (label, value, fieldKey) => `
    <div class="border-b border-slate-100 py-3">
      <div class="flex items-start justify-between gap-3">
        <div class="flex-1 min-w-0">
          <div class="text-[11px] font-bold text-slate-400 uppercase">${label}</div>
          <div class="text-sm text-slate-700 mt-0.5">${escapeHtml(value || '—')}</div>
        </div>
        ${obsBtn(fieldKey, label)}
      </div>
      ${fieldObsBox(fieldKey)}
    </div>
  `;

  return `
    <button onclick="window.closePlanReview()" class="text-xs font-bold text-slate-500 hover:text-primary mb-4 inline-flex items-center gap-1">← Volver a Revisión de Planificaciones</button>
    <div class="flex items-start justify-between gap-4 mb-5 flex-wrap">
      <div>
        <div class="flex items-center gap-2 flex-wrap mb-1">
          <h1 class="font-display font-bold text-2xl text-primary-dark">${escapeHtml(plan.tituloUnidad || 'Sin título')}</h1>
          <span class="text-[11px] font-bold px-2 py-1 rounded-md ${meta.cls}">${meta.label}</span>
        </div>
        <p class="text-slate-500 text-sm">${subject ? escapeHtml(subject.name) : ''} · ${course ? escapeHtml(course.name) : ''} · ${teacher ? escapeHtml(teacher.name) : ''}</p>
      </div>
      <div class="flex gap-2">
        <button onclick="window.exportPlanWordById('${plan.id}')" class="${BTN_SECONDARY} text-xs">📄 Word</button>
        <button onclick="window.exportPlanPDFById('${plan.id}')" class="${BTN_SECONDARY} text-xs">🖨️ PDF</button>
      </div>
    </div>

    <div class="${CARD} p-6 mb-5">
      <div class="grid grid-cols-2 sm:grid-cols-4 gap-3 mb-2 text-xs">
        <div><span class="font-bold text-slate-400 uppercase text-[10px]">Unidad N°</span><div class="text-slate-700 font-semibold mt-0.5">${escapeHtml(String(plan.unidadNumero))}</div></div>
        <div><span class="font-bold text-slate-400 uppercase text-[10px]">Fecha Inicio</span><div class="text-slate-700 font-semibold mt-0.5">${fmtDate(plan.fechaInicio)}</div></div>
        <div><span class="font-bold text-slate-400 uppercase text-[10px]">Fecha Fin</span><div class="text-slate-700 font-semibold mt-0.5">${fmtDate(plan.fechaFin)}</div></div>
        <div><span class="font-bold text-slate-400 uppercase text-[10px]">Semanas</span><div class="text-slate-700 font-semibold mt-0.5">${plan.semanas.length}</div></div>
      </div>
      ${fieldRow('Título de la Unidad', plan.tituloUnidad, 'tituloUnidad')}
      ${fieldRow('Objetivo de la Unidad', plan.objetivoUnidad, 'objetivoUnidad')}
      ${fieldRow('Objetivo de Aprendizaje', plan.objetivoAprendizaje, 'objetivoAprendizaje')}
      ${fieldRow('Ejes Transversales', plan.ejesTransversales, 'ejesTransversales')}
      ${fieldRow('Estándar de Aprendizaje', plan.estandarAprendizaje, 'estandarAprendizaje')}
    </div>

    <div class="font-display font-bold text-primary-dark mb-3">Semanas de la Unidad</div>
    <div class="flex flex-col gap-3 mb-6">
      ${plan.semanas.map(w => `
        <div class="${CARD} p-5">
          <div class="flex items-center justify-between mb-3">
            <div class="font-display font-bold text-primary-dark text-sm">Semana ${w.numero} · ${fmtDate(w.fechaInicio)} – ${fmtDate(w.fechaFin)}</div>
            ${obsBtn('semana:' + w.id, 'Semana ' + w.numero)}
          </div>
          <div class="grid grid-cols-1 sm:grid-cols-2 gap-3 text-xs text-slate-600">
            <div><b class="text-slate-400 uppercase text-[10px] block mb-0.5">Tema</b>${escapeHtml(w.temaConceptos || '—')}</div>
            <div><b class="text-slate-400 uppercase text-[10px] block mb-0.5">Destrezas</b>${escapeHtml(w.destrezas || '—')}</div>
            <div><b class="text-slate-400 uppercase text-[10px] block mb-0.5">Experiencia</b>${escapeHtml(w.experiencia || '—')}</div>
            <div><b class="text-slate-400 uppercase text-[10px] block mb-0.5">Reflexión</b>${escapeHtml(w.reflexion || '—')}</div>
            <div><b class="text-slate-400 uppercase text-[10px] block mb-0.5">Conceptualización</b>${escapeHtml(w.conceptualizacion || '—')}</div>
            <div><b class="text-slate-400 uppercase text-[10px] block mb-0.5">Aplicación</b>${escapeHtml(w.aplicacion || '—')}</div>
            <div><b class="text-slate-400 uppercase text-[10px] block mb-0.5">Recursos</b>${escapeHtml(w.recursos || '—')}</div>
            <div><b class="text-slate-400 uppercase text-[10px] block mb-0.5">Evaluación</b>${escapeHtml(w.indicadorEvaluacion || '—')} — ${escapeHtml(w.instrumentoEvaluacion || '—')}</div>
          </div>
          ${(obs.filter(o => o.field === 'semana:' + w.id)).map(o => `<div class="mt-3 flex items-start gap-2 ${o.resolved ? 'bg-slate-50 border-slate-200 text-slate-500' : 'bg-red-50 border-red-200 text-red-700'} border text-xs rounded-lg px-3 py-2"><span>💬</span><span class="flex-1">${escapeHtml(o.text)}</span>${o.resolved ? '<span class="text-[10px] font-bold">Resuelta</span>' : ''}</div>`).join('')}
        </div>
      `).join('')}
    </div>

    <div class="${CARD} p-5 mb-6">
      <div class="flex items-center justify-between mb-3">
        <div class="font-display font-bold text-primary-dark text-sm">Observación general del documento</div>
        ${obsBtn('general', 'Observación general')}
      </div>
      ${fieldObsBox('general') || `<div class="text-xs text-slate-400">Sin observaciones generales.</div>`}
    </div>

    ${plan.status === 'en_revision' ? `
      <div class="flex justify-end gap-3">
        <button onclick="window.sendWithObservations('${plan.id}')" class="${BTN_SECONDARY}">Enviar con Observaciones</button>
        <button onclick="window.approvePlan('${plan.id}')" class="${BTN_PRIMARY}">✅ Aprobar Planificación</button>
      </div>
    ` : plan.status === 'borrador' ? `<div class="${CARD} p-4 text-center text-xs text-slate-400">El docente todavía no ha enviado esta planificación a revisión.</div>` : ''}
  `;
}
window.openObsModal = (planId, field, fieldLabel) => {
  ui.obsModalOpen = true; ui.obsPlanId = planId; ui.obsField = field; ui.obsFieldLabel = fieldLabel;
  render();
};
window.closeObsModal = () => { ui.obsModalOpen = false; render(); };
window.saveObservationEntry = () => {
  const text = document.getElementById('obs-text').value.trim();
  if (!text) { toast('Escribe la observación.', 'error'); return; }
  const plan = db.plans.find(p => p.id === ui.obsPlanId);
  if (!plan) return;
  if (!plan.observations) plan.observations = [];
  plan.observations.push({ id: uid('obs'), field: ui.obsField, fieldLabel: ui.obsFieldLabel, text, createdAt: todayISO(), resolved: false });
  saveDB();
  ui.obsModalOpen = false;
  toast('Observación agregada.');
  render();
};
function obsModalHTML() {
  return `
  <div class="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/50 anim-fade" onclick="if(event.target===this) window.closeObsModal()">
    <div class="bg-white rounded-2xl w-full max-w-md p-6 anim-popin">
      <div class="font-display font-bold text-lg text-primary-dark mb-1">Observación: ${escapeHtml(ui.obsFieldLabel)}</div>
      <p class="text-xs text-slate-500 mb-4">Sé específico — el docente verá este mensaje pegado exactamente a este campo.</p>
      <textarea id="obs-text" class="${INPUT} h-24 resize-none mb-4" placeholder="Ej. Falta incluir la destreza con criterio de desempeño correspondiente al DUA..."></textarea>
      <div class="flex gap-3">
        <button onclick="window.closeObsModal()" class="${BTN_SECONDARY} flex-1">Cancelar</button>
        <button onclick="window.saveObservationEntry()" class="${BTN_PRIMARY} flex-1">Guardar Observación</button>
      </div>
    </div>
  </div>`;
}
window.approvePlan = (planId) => {
  const plan = db.plans.find(p => p.id === planId);
  if (!plan) return;
  plan.status = 'aprobado';
  plan.reviewedAt = todayISO();
  (plan.observations || []).forEach(o => { o.resolved = true; });
  saveDB();
  toast('Planificación aprobada.');
  render();
};
window.sendWithObservations = (planId) => {
  const plan = db.plans.find(p => p.id === planId);
  if (!plan) return;
  const hasOpen = (plan.observations || []).some(o => !o.resolved);
  if (!hasOpen) { toast('Agrega al menos una observación antes de enviar.', 'error'); return; }
  plan.status = 'con_observaciones';
  plan.reviewedAt = todayISO();
  saveDB();
  toast('Observaciones enviadas al docente.');
  ui.reviewingPlanId = null;
  render();
};
window.exportPlanWordById = async (planId) => {
  const plan = db.plans.find(p => p.id === planId);
  if (!plan) return;
  const subject = getSubject(plan.subjectId);
  const course = subject ? getCourse(subject.courseId) : null;
  const teacher = subject ? getTeacher(subject.teacherId) : null;
  try {
    const blob = await buildPlanWordBlob(plan, subject, course, teacher);
    downloadBlob(blob, `PUD_${slugFile(subject.name)}_${slugFile(course ? course.name : '')}.docx`);
  } catch (e) { toast('No se pudo generar el Word: ' + e.message, 'error'); }
};
window.exportPlanPDFById = (planId) => {
  const plan = db.plans.find(p => p.id === planId);
  if (!plan) return;
  const subject = getSubject(plan.subjectId);
  const course = subject ? getCourse(subject.courseId) : null;
  const teacher = subject ? getTeacher(subject.teacherId) : null;
  document.getElementById('printArea').innerHTML = buildPlanPrintHTML(plan, subject, course, teacher);
  window.print();
};

/* ------------------------------ ADMIN: AÑO ------------------------------- */
function screenAdminAnio() {
  return `
    <div class="mb-6">
      <h1 class="font-display font-bold text-2xl text-primary-dark">Configuración del Año Lectivo</h1>
      <p class="text-slate-500 text-sm mt-1">Estas fechas condicionan el calendario, horarios y fechas límite de todo el portal.</p>
    </div>
    <div class="${CARD} p-6 max-w-xl">
      <form onsubmit="return window.saveYearConfig(event)">
        <label class="${LABEL}">Etiqueta del período (ej. 2026 - 2027)</label>
        <input id="yf-label" type="text" value="${escapeHtml(db.meta.yearLabel)}" class="${INPUT} mb-4" required />
        <div class="grid grid-cols-1 sm:grid-cols-2 gap-4 mb-4">
          <div>
            <label class="${LABEL}">Fecha de inicio</label>
            <input id="yf-start" type="date" value="${db.meta.yearStart}" class="${INPUT}" required />
          </div>
          <div>
            <label class="${LABEL}">Fecha de finalización</label>
            <input id="yf-end" type="date" value="${db.meta.yearEnd}" class="${INPUT}" required />
          </div>
        </div>
        <label class="${LABEL}">Período / trimestre actual</label>
        <input id="yf-period" type="text" value="${escapeHtml(db.meta.currentPeriodLabel)}" class="${INPUT} mb-5" />
        <button type="submit" class="${BTN_PRIMARY}">Guardar Año Lectivo</button>
      </form>
    </div>
  `;
}
window.saveYearConfig = (e) => {
  e.preventDefault();
  const start = document.getElementById('yf-start').value;
  const end = document.getElementById('yf-end').value;
  if (!start || !end || start >= end) { toast('La fecha de inicio debe ser anterior a la fecha de fin.', 'error'); return false; }
  db.meta.yearLabel = document.getElementById('yf-label').value.trim() || db.meta.yearLabel;
  db.meta.yearStart = start;
  db.meta.yearEnd = end;
  db.meta.currentPeriodLabel = document.getElementById('yf-period').value.trim() || db.meta.currentPeriodLabel;
  saveDB();
  toast('Año lectivo actualizado.');
  render();
  return false;
};

/* --------------------------- ADMIN: CURSOS / MATERIAS --------------------- */
function screenAdminCursos() {
  return `
    <div class="mb-6">
      <h1 class="font-display font-bold text-2xl text-primary-dark">Cursos y Materias</h1>
      <p class="text-slate-500 text-sm mt-1">Administra paralelos, asignaturas y la asignación de docentes.</p>
    </div>
    <div class="grid grid-cols-1 lg:grid-cols-[1fr_320px] gap-5 mb-6">
      <div class="${CARD} overflow-hidden">
        <div class="grid grid-cols-[1fr_1fr_140px_70px] gap-2 px-5 py-3 text-[11px] font-bold text-slate-400 uppercase border-b border-slate-100 bg-slate-50">
          <div>Materia</div><div>Curso</div><div>Docente</div><div></div>
        </div>
        <div class="max-h-[480px] overflow-y-auto">
          ${db.subjects.map(s => {
            const course = getCourse(s.courseId);
            return `<div class="grid grid-cols-[1fr_1fr_140px_70px] gap-2 px-5 py-3 items-center border-b border-slate-50 text-sm">
              <div class="font-semibold text-slate-700 truncate">${escapeHtml(s.name)}</div>
              <div class="text-slate-500 truncate">${course ? escapeHtml(course.name) : '—'}</div>
              <select onchange="window.assignSubjectTeacher('${s.id}', this.value)" class="text-xs border border-slate-300 rounded-md px-2 py-1.5">
                <option value="" ${!s.teacherId ? 'selected' : ''}>-- Sin asignar --</option>
                ${db.teachers.map(t => `<option value="${t.id}" ${t.id === s.teacherId ? 'selected' : ''}>${escapeHtml(t.name)}</option>`).join('')}
              </select>
              <button onclick="window.deleteSubject('${s.id}')" class="${BTN_DANGER_TEXT} text-right">Eliminar</button>
            </div>`;
          }).join('')}
        </div>
      </div>
      <div class="flex flex-col gap-5">
        <div class="${CARD} p-5">
          <div class="font-display font-bold text-primary-dark mb-3 text-sm">+ Nueva Materia</div>
          <form onsubmit="return window.addSubject(event)">
            <label class="${LABEL}">Nombre</label>
            <input id="ns-name" type="text" placeholder="Ej. Filosofía" class="${INPUT} mb-3" required />
            <label class="${LABEL}">Curso</label>
            <select id="ns-course" class="${INPUT} mb-3">
              ${db.courses.map(c => `<option value="${c.id}">${escapeHtml(c.name)}</option>`).join('')}
            </select>
            <label class="${LABEL}">Docente</label>
            <select id="ns-teacher" class="${INPUT} mb-4">
              ${db.teachers.map(t => `<option value="${t.id}">${escapeHtml(t.name)}</option>`).join('')}
            </select>
            <button type="submit" class="${BTN_PRIMARY} w-full">Crear Materia</button>
          </form>
        </div>
        <div class="${CARD} p-5">
          <div class="font-display font-bold text-primary-dark mb-3 text-sm">+ Nuevo Curso</div>
          <form onsubmit="return window.addCourse(event)">
            <label class="${LABEL}">Nivel (ej. 9no EGB)</label>
            <input id="nc-level" type="text" placeholder="Ej. 9no EGB" class="${INPUT} mb-3" required />
            <label class="${LABEL}">Paralelo</label>
            <input id="nc-paralelo" type="text" placeholder="Ej. A" maxlength="2" class="${INPUT} mb-4" required />
            <button type="submit" class="${BTN_PRIMARY} w-full">Crear Curso</button>
          </form>
        </div>
      </div>
    </div>
    <div class="${CARD} p-5">
      <div class="font-display font-bold text-primary-dark mb-3 text-sm">Cursos Registrados</div>
      <div class="flex flex-wrap gap-2">
        ${db.courses.map(c => `
          <div class="flex items-center gap-2 bg-slate-50 border border-slate-200 rounded-lg pl-3 pr-1.5 py-1.5 text-sm">
            <span class="font-semibold text-slate-700">${escapeHtml(c.name)}</span>
            <span class="text-[11px] text-slate-400">${studentsOfCourse(c.id).length} est.</span>
            <button onclick="window.deleteCourse('${c.id}')" class="text-slate-300 hover:text-red-500 text-xs px-1">✕</button>
          </div>
        `).join('')}
      </div>
    </div>
  `;
}
window.assignSubjectTeacher = (subjectId, teacherId) => {
  const s = getSubject(subjectId); if (!s) return;
  s.teacherId = teacherId; saveDB(); toast('Docente actualizado.'); render();
};
window.deleteSubject = (id) => {
  if (!confirm('¿Eliminar esta materia? Se eliminarán también sus tareas y calificaciones asociadas.')) return;
  const asgIds = db.assignments.filter(a => a.subjectId === id).map(a => a.id);
  db.subjects = db.subjects.filter(s => s.id !== id);
  db.students.forEach(st => { st.subjectIds = st.subjectIds.filter(sid => sid !== id); });
  db.assignments = db.assignments.filter(a => a.subjectId !== id);
  db.submissions = db.submissions.filter(s => !asgIds.includes(s.assignmentId));
  db.attendance = db.attendance.filter(a => a.subjectId !== id);
  db.resources = db.resources.filter(r => r.subjectId !== id);
  db.schedule = db.schedule.filter(s => s.subjectId !== id);
  db.plans = db.plans.filter(p => p.subjectId !== id);
  db.gradebooks = db.gradebooks.filter(g => g.subjectId !== id);
  saveDB(); toast('Materia eliminada.'); render();
};
window.addSubject = (e) => {
  e.preventDefault();
  const name = document.getElementById('ns-name').value.trim();
  const courseId = document.getElementById('ns-course').value;
  const teacherId = document.getElementById('ns-teacher').value;
  if (!name || !courseId) return false;
  const subj = { id: uid('subj'), name, courseId, teacherId };
  db.subjects.push(subj);
  generateAssignmentsForSubject(subj);
  rebuildScheduleForCourse(courseId);
  studentsOfCourse(courseId).forEach(st => {
    if (!st.subjectIds.includes(subj.id)) st.subjectIds.push(subj.id);
    generateSubmissionsForStudentSubject(st.id, subj.id);
    generateAttendanceForStudentSubject(st.id, subj.id, courseId);
  });
  saveDB(); toast('Materia creada y sincronizada con los estudiantes del curso.'); render();
  return false;
};
window.addCourse = (e) => {
  e.preventDefault();
  const level = document.getElementById('nc-level').value.trim();
  const paralelo = document.getElementById('nc-paralelo').value.trim().toUpperCase();
  if (!level || !paralelo) return false;
  db.courses.push({ id: uid('c'), name: `${level} "${paralelo}"`, level, paralelo });
  saveDB(); toast('Curso creado.'); render();
  return false;
};
window.deleteCourse = (id) => {
  if (studentsOfCourse(id).length) { toast('No puedes eliminar un curso con estudiantes matriculados.', 'error'); return; }
  if (!confirm('¿Eliminar este curso y sus materias?')) return;
  const subjIds = subjectsOfCourse(id).map(s => s.id);
  db.assignments = db.assignments.filter(a => !(a.courseId === id) && !subjIds.includes(a.subjectId));
  db.subjects = db.subjects.filter(s => s.courseId !== id);
  db.schedule = db.schedule.filter(s => s.courseId !== id);
  db.courses = db.courses.filter(c => c.id !== id);
  saveDB(); toast('Curso eliminado.'); render();
};

/* ------------------------------ ADMIN: DOCENTES ----------------------------- */
function screenAdminDocentes() {
  return `
    <div class="flex items-start justify-between gap-4 mb-6 flex-wrap">
      <div>
        <h1 class="font-display font-bold text-2xl text-primary-dark">Gestión de Docentes</h1>
        <p class="text-slate-500 text-sm mt-1">Registra docentes y asígnalos a materias desde "Cursos y Materias".</p>
      </div>
      <button onclick="window.openTeacherModal()" class="${BTN_PRIMARY}">+ Nuevo Docente</button>
    </div>
    <div class="${CARD} overflow-hidden">
      <div class="grid grid-cols-[1.3fr_1fr_1fr_0.7fr_120px] gap-2 px-5 py-3 text-[11px] font-bold text-slate-400 uppercase border-b border-slate-100 bg-slate-50">
        <div>Docente</div><div>Área / Especialidad</div><div>Correo</div><div>Materias</div><div>Acciones</div>
      </div>
      <div class="max-h-[560px] overflow-y-auto">
        ${db.teachers.length ? db.teachers.map(t => {
          const count = subjectsOfTeacher(t.id).length;
          return `<div class="grid grid-cols-[1.3fr_1fr_1fr_0.7fr_120px] gap-2 px-5 py-3.5 items-center border-b border-slate-50 text-sm">
            <div class="flex items-center gap-2.5 min-w-0">
              <div class="w-8 h-8 rounded-full bg-primary text-white flex items-center justify-center font-bold text-xs flex-shrink-0">${initials(t.name)}</div>
              <span class="font-semibold text-slate-700 truncate">${escapeHtml(t.name)}</span>
            </div>
            <div class="text-slate-500 truncate text-xs">${escapeHtml(t.area)}</div>
            <div class="text-slate-500 truncate text-xs">${escapeHtml(t.email || '')}</div>
            <div><span class="text-xs font-bold bg-sky-light text-primary-dark px-2 py-1 rounded-md">${count}</span></div>
            <div class="flex gap-2.5">
              <button onclick="window.openTeacherModal('${t.id}')" class="text-xs font-semibold text-primary hover:underline">Editar</button>
              <button onclick="window.deleteTeacher('${t.id}')" class="${BTN_DANGER_TEXT}">Eliminar</button>
            </div>
          </div>`;
        }).join('') : `<div class="p-10 text-center text-sm text-slate-400">Aún no hay docentes registrados.</div>`}
      </div>
    </div>
  `;
}
window.openTeacherModal = (teacherId) => {
  if (teacherId) {
    const t = getTeacher(teacherId);
    ui.editingTeacherId = teacherId;
    ui.teacherDraft = { name: t.name, area: t.area, email: t.email || '' };
  } else {
    ui.editingTeacherId = null;
    ui.teacherDraft = { name: '', area: '', email: '' };
  }
  ui.teacherModalOpen = true;
  render();
};
window.closeTeacherModal = () => { ui.teacherModalOpen = false; render(); };
window.updateTeacherDraft = (field, value) => { ui.teacherDraft[field] = value; };
window.suggestTeacherEmail = () => {
  const name = document.getElementById('tf-name').value.trim();
  if (!name) { toast('Escribe primero el nombre del docente.', 'error'); return; }
  const email = slugifyEmail(name);
  document.getElementById('tf-email').value = email;
  ui.teacherDraft.email = email;
};
window.saveTeacherForm = () => {
  const d = ui.teacherDraft;
  if (!d.name.trim() || !d.area.trim()) { toast('Completa nombre y área/especialidad.', 'error'); return; }
  if (ui.editingTeacherId) {
    const t = getTeacher(ui.editingTeacherId);
    Object.assign(t, { name: d.name.trim(), area: d.area.trim(), email: d.email.trim() });
    toast('Docente actualizado.');
  } else {
    const teacher = { id: uid('t'), name: d.name.trim(), area: d.area.trim(), email: d.email.trim() };
    db.teachers.push(teacher);
    ui.teacherId = teacher.id;
    toast('Docente registrado — ya puedes asignarle materias en "Cursos y Materias".');
  }
  saveDB();
  ui.teacherModalOpen = false;
  render();
};
window.deleteTeacher = (id) => {
  if (!confirm('¿Eliminar este docente? Sus materias quedarán sin asignar.')) return;
  db.subjects.forEach(s => { if (s.teacherId === id) s.teacherId = null; });
  db.teachers = db.teachers.filter(t => t.id !== id);
  if (ui.teacherId === id) ui.teacherId = db.teachers[0] ? db.teachers[0].id : null;
  saveDB(); toast('Docente eliminado.'); render();
};
function teacherModalHTML() {
  const isEdit = !!ui.editingTeacherId;
  const d = ui.teacherDraft;
  return `
  <div class="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/50 anim-fade" onclick="if(event.target===this) window.closeTeacherModal()">
    <div class="bg-white rounded-2xl w-full max-w-md max-h-[92vh] overflow-y-auto anim-popin">
      <div class="px-6 py-5 border-b border-slate-100 flex items-center justify-between sticky top-0 bg-white rounded-t-2xl">
        <div class="font-display font-bold text-lg text-primary-dark">${isEdit ? 'Editar Docente' : 'Registrar Docente'}</div>
        <button onclick="window.closeTeacherModal()" class="text-slate-400 hover:text-slate-600 text-2xl leading-none">&times;</button>
      </div>
      <div class="p-6">
        <label class="${LABEL}">Nombre completo</label>
        <input id="tf-name" type="text" value="${escapeHtml(d.name)}" oninput="window.updateTeacherDraft('name', this.value)" placeholder="Ej. Lic. José Pérez" class="${INPUT} mb-4" required />

        <label class="${LABEL}">Área / Especialidad</label>
        <input id="tf-area" type="text" value="${escapeHtml(d.area)}" oninput="window.updateTeacherDraft('area', this.value)" placeholder="Ej. Literatura" class="${INPUT} mb-4" required />

        <label class="${LABEL}">Correo electrónico</label>
        <div class="flex gap-2 mb-5">
          <input id="tf-email" type="email" value="${escapeHtml(d.email)}" oninput="window.updateTeacherDraft('email', this.value)" placeholder="correo@ejemplo.ec" class="${INPUT}" />
          <button type="button" onclick="window.suggestTeacherEmail()" class="${BTN_SECONDARY} whitespace-nowrap px-3 text-xs">Sugerir</button>
        </div>

        <div class="flex gap-3">
          <button type="button" onclick="window.closeTeacherModal()" class="${BTN_SECONDARY} flex-1">Cancelar</button>
          <button type="button" onclick="window.saveTeacherForm()" class="${BTN_PRIMARY} flex-1">${isEdit ? 'Guardar Cambios' : 'Registrar Docente'}</button>
        </div>
      </div>
    </div>
  </div>`;
}

/* ----------------------------- ADMIN: ESTUDIANTES -------------------------- */
function screenAdminEstudiantes() {
  return `
    <div class="flex items-start justify-between gap-4 mb-6 flex-wrap">
      <div>
        <h1 class="font-display font-bold text-2xl text-primary-dark">Gestión de Estudiantes</h1>
        <p class="text-slate-500 text-sm mt-1">Matricula nuevos estudiantes y sincroniza su información académica.</p>
      </div>
      <button onclick="window.openStudentModal()" class="${BTN_PRIMARY}">+ Nuevo Estudiante</button>
    </div>
    <div class="${CARD} overflow-hidden">
      <div class="grid grid-cols-[1.4fr_1fr_1fr_0.8fr_120px] gap-2 px-5 py-3 text-[11px] font-bold text-slate-400 uppercase border-b border-slate-100 bg-slate-50">
        <div>Estudiante</div><div>Correo</div><div>Matrícula</div><div>Curso</div><div>Acciones</div>
      </div>
      <div class="max-h-[560px] overflow-y-auto">
        ${db.students.length ? db.students.map(s => {
          const course = getCourse(s.courseId);
          return `<div class="grid grid-cols-[1.4fr_1fr_1fr_0.8fr_120px] gap-2 px-5 py-3.5 items-center border-b border-slate-50 text-sm">
            <div class="flex items-center gap-2.5 min-w-0">
              <div class="w-8 h-8 rounded-full bg-primary text-white flex items-center justify-center font-bold text-xs flex-shrink-0">${initials(s.name)}</div>
              <span class="font-semibold text-slate-700 truncate">${escapeHtml(s.name)}</span>
            </div>
            <div class="text-slate-500 truncate text-xs">${escapeHtml(s.email)}</div>
            <div class="text-slate-500 text-xs">${escapeHtml(s.matricula)}</div>
            <div><span class="text-xs font-bold bg-sky-light text-primary-dark px-2 py-1 rounded-md">${course ? escapeHtml(course.name) : '—'}</span></div>
            <div class="flex gap-2.5">
              <button onclick="window.openStudentModal('${s.id}')" class="text-xs font-semibold text-primary hover:underline">Editar</button>
              <button onclick="window.deleteStudent('${s.id}')" class="${BTN_DANGER_TEXT}">Eliminar</button>
            </div>
          </div>`;
        }).join('') : `<div class="p-10 text-center text-sm text-slate-400">Aún no hay estudiantes matriculados.</div>`}
      </div>
    </div>
  `;
}
window.openStudentModal = (studentId) => {
  if (studentId) {
    const s = getStudent(studentId);
    ui.editingStudentId = studentId;
    ui.studentDraft = { name: s.name, email: s.email, matricula: s.matricula, courseId: s.courseId, subjectIds: [...s.subjectIds] };
  } else {
    ui.editingStudentId = null;
    const courseId = db.courses[0] ? db.courses[0].id : null;
    ui.studentDraft = { name: '', email: '', matricula: nextMatricula(), courseId, subjectIds: subjectsOfCourse(courseId).map(s => s.id) };
  }
  ui.studentModalOpen = true;
  render();
};
window.closeStudentModal = () => { ui.studentModalOpen = false; render(); };
window.updateStudentDraft = (field, value) => { ui.studentDraft[field] = value; };
window.onStudentCourseChange = (courseId) => {
  ui.studentDraft.courseId = courseId;
  ui.studentDraft.subjectIds = subjectsOfCourse(courseId).map(s => s.id);
  render();
};
window.toggleStudentSubject = (subjectId, checked) => {
  const arr = ui.studentDraft.subjectIds;
  if (checked && !arr.includes(subjectId)) arr.push(subjectId);
  if (!checked) ui.studentDraft.subjectIds = arr.filter(id => id !== subjectId);
};
window.suggestStudentEmail = () => {
  const name = document.getElementById('sf-name').value.trim();
  if (!name) { toast('Escribe primero el nombre del estudiante.', 'error'); return; }
  const email = slugifyEmail(name);
  document.getElementById('sf-email').value = email;
  ui.studentDraft.email = email;
};
window.saveStudentForm = () => {
  const d = ui.studentDraft;
  if (!d.name.trim() || !d.email.trim() || !d.matricula.trim()) { toast('Completa nombre, correo y matrícula.', 'error'); return; }
  if (!d.courseId) { toast('Crea primero un curso en "Cursos y Materias".', 'error'); return; }
  if (!d.subjectIds.length) { toast('Selecciona al menos una materia.', 'error'); return; }
  if (ui.editingStudentId) {
    const s = getStudent(ui.editingStudentId);
    Object.assign(s, { name: d.name.trim(), email: d.email.trim(), matricula: d.matricula.trim(), courseId: d.courseId, subjectIds: [...d.subjectIds] });
    d.subjectIds.forEach(subId => generateSubmissionsForStudentSubject(s.id, subId));
    d.subjectIds.forEach(subId => generateAttendanceForStudentSubject(s.id, subId, s.courseId));
    toast('Estudiante actualizado.');
  } else {
    const student = { id: uid('st'), name: d.name.trim(), email: d.email.trim(), matricula: d.matricula.trim(), courseId: d.courseId, subjectIds: [...d.subjectIds] };
    db.students.push(student);
    student.subjectIds.forEach(subId => {
      generateSubmissionsForStudentSubject(student.id, subId);
      generateAttendanceForStudentSubject(student.id, subId, student.courseId);
    });
    ui.studentId = student.id;
    toast('Estudiante matriculado — ya está disponible en la vista de Estudiante.');
  }
  saveDB();
  ui.studentModalOpen = false;
  render();
};
window.deleteStudent = (id) => {
  if (!confirm('¿Eliminar este estudiante y todos sus datos académicos?')) return;
  db.students = db.students.filter(s => s.id !== id);
  db.submissions = db.submissions.filter(s => s.studentId !== id);
  db.attendance = db.attendance.filter(a => a.studentId !== id);
  db.messages = db.messages.filter(m => m.studentId !== id);
  db.gradebooks.forEach(g => { g.entries = g.entries.filter(e => e.studentId !== id); });
  if (ui.studentId === id) ui.studentId = db.students[0] ? db.students[0].id : null;
  saveDB(); toast('Estudiante eliminado.'); render();
};

function studentModalHTML() {
  const isEdit = !!ui.editingStudentId;
  const d = ui.studentDraft;
  const courseSubjects = subjectsOfCourse(d.courseId);
  return `
  <div class="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/50 anim-fade" onclick="if(event.target===this) window.closeStudentModal()">
    <div class="bg-white rounded-2xl w-full max-w-lg max-h-[92vh] overflow-y-auto anim-popin">
      <div class="px-6 py-5 border-b border-slate-100 flex items-center justify-between sticky top-0 bg-white rounded-t-2xl">
        <div class="font-display font-bold text-lg text-primary-dark">${isEdit ? 'Editar Estudiante' : 'Matricular Nuevo Estudiante'}</div>
        <button onclick="window.closeStudentModal()" class="text-slate-400 hover:text-slate-600 text-2xl leading-none">&times;</button>
      </div>
      <div class="p-6">
        <label class="${LABEL}">Nombre completo</label>
        <input id="sf-name" type="text" value="${escapeHtml(d.name)}" oninput="window.updateStudentDraft('name', this.value)" placeholder="Ej. Ana Carla Pérez Mora" class="${INPUT} mb-4" required />

        <label class="${LABEL}">Correo electrónico</label>
        <div class="flex gap-2 mb-4">
          <input id="sf-email" type="email" value="${escapeHtml(d.email)}" oninput="window.updateStudentDraft('email', this.value)" placeholder="correo@ejemplo.ec" class="${INPUT}" required />
          <button type="button" onclick="window.suggestStudentEmail()" class="${BTN_SECONDARY} whitespace-nowrap px-3 text-xs">Sugerir</button>
        </div>

        <div class="grid grid-cols-2 gap-4 mb-4">
          <div>
            <label class="${LABEL}">Matrícula / ID</label>
            <input id="sf-matricula" type="text" value="${escapeHtml(d.matricula)}" oninput="window.updateStudentDraft('matricula', this.value)" class="${INPUT}" required />
          </div>
          <div>
            <label class="${LABEL}">Curso / Grado</label>
            <select id="sf-course" onchange="window.onStudentCourseChange(this.value)" class="${INPUT}">
              ${db.courses.map(c => `<option value="${c.id}" ${c.id === d.courseId ? 'selected' : ''}>${escapeHtml(c.name)}</option>`).join('')}
            </select>
          </div>
        </div>

        <label class="${LABEL}">Materias asignadas</label>
        <div id="materias-checklist" class="grid grid-cols-2 gap-2 mb-5 max-h-40 overflow-y-auto border border-slate-200 rounded-lg p-3">
          ${courseSubjects.map(s => `
            <label class="flex items-center gap-2 text-xs text-slate-600">
              <input type="checkbox" ${d.subjectIds.includes(s.id) ? 'checked' : ''} onchange="window.toggleStudentSubject('${s.id}', this.checked)" />
              ${escapeHtml(s.name)}
            </label>
          `).join('') || '<div class="text-xs text-slate-400 col-span-2">Este curso no tiene materias todavía.</div>'}
        </div>

        <div class="flex gap-3">
          <button type="button" onclick="window.closeStudentModal()" class="${BTN_SECONDARY} flex-1">Cancelar</button>
          <button type="button" onclick="window.saveStudentForm()" class="${BTN_PRIMARY} flex-1">${isEdit ? 'Guardar Cambios' : 'Matricular Estudiante'}</button>
        </div>
      </div>
    </div>
  </div>`;
}

/* --------------------------- ADMIN: REPROGRAMACIONES ----------------------- */
function screenAdminReprogramaciones() {
  const holidaysSorted = [...db.holidays].sort((a, b) => b.date.localeCompare(a.date));
  return `
    <div class="mb-6">
      <h1 class="font-display font-bold text-2xl text-primary-dark">Reprogramaciones</h1>
      <p class="text-slate-500 text-sm mt-1">Marca un día como "No dictado" (feriado o suspensión). El sistema reprogramará automáticamente las entregas afectadas al siguiente día hábil disponible.</p>
    </div>
    <div class="grid grid-cols-1 lg:grid-cols-[360px_1fr] gap-5">
      <div class="${CARD} p-6 h-fit">
        <div class="font-display font-bold text-primary-dark mb-4 text-sm">Marcar día no dictado</div>
        <form onsubmit="return window.addHoliday(event)">
          <label class="${LABEL}">Fecha</label>
          <input id="hd-date" type="date" value="${todayISO()}" min="${db.meta.yearStart}" max="${db.meta.yearEnd}" class="${INPUT} mb-4" required />
          <label class="${LABEL}">Curso afectado</label>
          <select id="hd-course" class="${INPUT} mb-4">
            <option value="all">Todos los cursos</option>
            ${db.courses.map(c => `<option value="${c.id}">${escapeHtml(c.name)}</option>`).join('')}
          </select>
          <label class="${LABEL}">Motivo</label>
          <select id="hd-reason" class="${INPUT} mb-5">
            <option>Feriado nacional/local</option>
            <option>Suspensión de clases</option>
            <option>Actividad institucional</option>
            <option>Otro</option>
          </select>
          <button type="submit" class="${BTN_PRIMARY} w-full">Reprogramar Automáticamente</button>
        </form>
      </div>
      <div class="${CARD} overflow-hidden">
        <div class="px-5 py-3 text-[11px] font-bold text-slate-400 uppercase border-b border-slate-100 bg-slate-50">Historial de días no dictados</div>
        <div class="max-h-[480px] overflow-y-auto">
          ${holidaysSorted.length ? holidaysSorted.map(h => `
            <div class="px-5 py-3.5 border-b border-slate-50 text-sm">
              <div class="flex items-center justify-between gap-2 flex-wrap">
                <span class="font-semibold text-slate-700">${fmtDate(h.date)}</span>
                <span class="text-[11px] font-bold text-accent-dark bg-accent-light px-2 py-0.5 rounded-md">${h.movedCount} actividad(es) reprogramada(s)</span>
              </div>
              <div class="text-xs text-slate-500 mt-1">${escapeHtml(h.reason)} · ${h.courseId === 'all' ? 'Todos los cursos' : (getCourse(h.courseId) ? escapeHtml(getCourse(h.courseId).name) : '—')}</div>
            </div>
          `).join('') : `<div class="p-10 text-center text-sm text-slate-400">Aún no se han registrado días no dictados.</div>`}
        </div>
      </div>
    </div>
  `;
}
window.addHoliday = (e) => {
  e.preventDefault();
  const date = document.getElementById('hd-date').value;
  const courseId = document.getElementById('hd-course').value;
  const reason = document.getElementById('hd-reason').value;
  if (!date) return false;
  const movedCount = rescheduleAssignments(date, courseId, reason);
  db.holidays.push({ id: uid('hol'), date, courseId, reason, movedCount });
  saveDB();
  toast(`Día marcado como no dictado. ${movedCount} actividad(es) reprogramada(s).`);
  render();
  return false;
};

/* ---------------------------------- DOCENTE --------------------------------- */
window.setTeacherScreen = (s) => { ui.teacherScreen = s; ui.sidebarOpen = false; render(); };
window.selectTeacher = (id) => { ui.teacherId = id; ui.teacherSubjectId = null; ui.teacherAssignmentId = null; ui.teacherChatStudentId = null; render(); };
window.setTeacherSubject = (id) => { ui.teacherSubjectId = id; ui.teacherAssignmentId = null; };
window.setTeacherAssignment = (id) => { ui.teacherAssignmentId = id; render(); };

function screenTeacherInicio() {
  const teacher = getTeacher(ui.teacherId);
  const subjects = subjectsOfTeacher(ui.teacherId);
  const studentCount = new Set(subjects.flatMap(s => studentsOfSubject(s.id).map(st => st.id))).size;
  return `
    <div class="mb-6">
      <h1 class="font-display font-bold text-2xl text-primary-dark">Hola, ${teacher ? escapeHtml(teacher.name) : ''}</h1>
      <p class="text-slate-500 text-sm mt-1">${escapeHtml(db.meta.schoolName)} · Año Lectivo ${escapeHtml(db.meta.yearLabel)}</p>
    </div>
    <div class="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-8">
      ${kpiCard('📚', 'Materias', subjects.length, 'Asignadas este período')}
      ${kpiCard('🏫', 'Cursos', new Set(subjects.map(s => s.courseId)).size, 'Paralelos a cargo')}
      ${kpiCard('🎓', 'Estudiantes', studentCount, 'En total')}
      ${kpiCard('🧑‍🏫', 'Especialidad', teacher ? escapeHtml(teacher.area) : '—', 'Área de formación')}
    </div>
    <div class="font-display font-bold text-primary-dark mb-3">Mis Materias</div>
    <div class="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
      ${subjects.map(s => {
        const course = getCourse(s.courseId);
        const hue = subjectHue(s.name);
        const count = studentsOfSubject(s.id).length;
        return `<div class="${CARD} p-5">
          <span class="text-[11px] font-bold ${hue.badge} border px-2 py-0.5 rounded-md uppercase">${escapeHtml(s.name)}</span>
          <div class="font-display font-bold text-primary-dark text-[15px] mt-2">${course ? escapeHtml(course.name) : ''}</div>
          <div class="text-xs text-slate-400 mt-0.5 mb-4">${count} estudiante(s)</div>
          <div class="flex gap-2">
            <button onclick="window.setTeacherSubject('${s.id}');window.setTeacherScreen('asistencia')" class="${BTN_SECONDARY} text-xs px-3 py-2 flex-1">Asistencia</button>
            <button onclick="window.setTeacherSubject('${s.id}');window.setTeacherScreen('calificaciones')" class="${BTN_PRIMARY} text-xs px-3 py-2 flex-1">Calificar</button>
          </div>
        </div>`;
      }).join('') || `<div class="${CARD} p-8 text-center text-sm text-slate-400 sm:col-span-2 lg:col-span-3">No tienes materias asignadas.</div>`}
    </div>
  `;
}

/* --------------------------- DOCENTE: PLANIFICACIÓN (PUD) ------------------- */
function calendarItemsForSubject(subjectId) {
  return db.assignments.filter(a => a.subjectId === subjectId).sort((a, b) => a.dueDate.localeCompare(b.dueDate));
}
function loadPlanDraft(subjectId) {
  const existing = getPlanForSubject(subjectId);
  ui.planDraft = existing ? JSON.parse(JSON.stringify(existing)) : blankPlan(subjectId);
}
window.setTeacherPlanSubject = (subjectId) => { ui.teacherSubjectId = subjectId; loadPlanDraft(subjectId); render(); };
window.updatePlanField = (field, value) => { ui.planDraft[field] = value; };
window.updatePlanWeekField = (weekId, field, value) => {
  const wk = ui.planDraft.semanas.find(w => w.id === weekId);
  if (wk) wk[field] = value;
};
window.addPlanWeek = () => {
  const semanas = ui.planDraft.semanas;
  const last = semanas[semanas.length - 1];
  const start = last ? addDays(last.fechaFin || last.fechaInicio, 1) : todayISO();
  semanas.push(blankPlanWeek(semanas.length + 1, start, addDays(start, 6)));
  render();
};
window.removePlanWeek = (weekId) => {
  if (ui.planDraft.semanas.length <= 1) { toast('La unidad debe tener al menos una semana.', 'error'); return; }
  ui.planDraft.semanas = ui.planDraft.semanas.filter(w => w.id !== weekId);
  ui.planDraft.semanas.forEach((w, i) => { w.numero = i + 1; });
  render();
};
function persistPlanDraft() {
  const toSave = JSON.parse(JSON.stringify(ui.planDraft));
  const idx = db.plans.findIndex(p => p.id === toSave.id);
  if (idx >= 0) db.plans[idx] = toSave; else db.plans.push(toSave);
  syncPlanCalendar(toSave);
  saveDB();
  return toSave;
}
window.savePlan = () => {
  const d = ui.planDraft;
  if (!d.tituloUnidad.trim()) { toast('Ingresa el título de la unidad.', 'error'); return; }
  if (!d.semanas.length) { toast('Agrega al menos una semana.', 'error'); return; }
  persistPlanDraft();
  toast('Planificación guardada — calendario sincronizado para docente y estudiantes.');
  render();
};
window.submitPlanForReview = () => {
  const d = ui.planDraft;
  if (!d.tituloUnidad.trim()) { toast('Ingresa el título de la unidad.', 'error'); return; }
  if (!d.semanas.length) { toast('Agrega al menos una semana.', 'error'); return; }
  d.status = 'en_revision';
  d.submittedAt = todayISO();
  (d.observations || []).forEach(o => { o.resolved = true; });
  persistPlanDraft();
  toast('Planificación enviada a revisión del administrador.');
  render();
};

function planWeekCard(w, total, openObs) {
  const weekObs = (openObs || []).filter(o => o.field === 'semana:' + w.id);
  return `
    <div class="${CARD} p-5 ${weekObs.length ? 'ring-2 ring-red-300' : ''}">
      <div class="flex items-center justify-between mb-4">
        <div class="font-display font-bold text-primary-dark text-sm">Semana ${w.numero}</div>
        ${total > 1 ? `<button onclick="window.removePlanWeek('${w.id}')" class="${BTN_DANGER_TEXT}">Eliminar</button>` : ''}
      </div>
      ${weekObs.map(o => `<div class="mb-4 flex items-start gap-2 bg-red-50 border border-red-200 text-red-700 text-xs rounded-lg px-3 py-2"><span>💬</span><span>${escapeHtml(o.text)}</span></div>`).join('')}
      <div class="grid grid-cols-1 sm:grid-cols-2 gap-3 mb-3">
        <div>
          <label class="${LABEL}">Fecha inicio</label>
          <input type="date" value="${w.fechaInicio}" onchange="window.updatePlanWeekField('${w.id}','fechaInicio', this.value)" class="${INPUT}" />
        </div>
        <div>
          <label class="${LABEL}">Fecha fin</label>
          <input type="date" value="${w.fechaFin}" onchange="window.updatePlanWeekField('${w.id}','fechaFin', this.value)" class="${INPUT}" />
        </div>
      </div>
      <label class="${LABEL}">Conceptos Esenciales / Tema</label>
      <textarea oninput="window.updatePlanWeekField('${w.id}','temaConceptos', this.value)" class="${INPUT} h-12 resize-none mb-3" placeholder="Ej. Gimnasia manos libres y en aparatos">${escapeHtml(w.temaConceptos)}</textarea>
      <label class="${LABEL}">Destrezas Con Criterio de Desempeño</label>
      <textarea oninput="window.updatePlanWeekField('${w.id}','destrezas', this.value)" class="${INPUT} h-16 resize-none mb-3" placeholder="Ej. EF.3.2.2. Crear secuencias gimnásticas individuales y grupales...">${escapeHtml(w.destrezas)}</textarea>

      <label class="${LABEL} mb-2">Actividades de Aprendizaje <span class="font-normal normal-case text-slate-400">(Ciclo ERCA — igual que en el Word)</span></label>
      <div class="grid grid-cols-1 sm:grid-cols-2 gap-3 mb-3 bg-slate-50 border border-slate-200 rounded-lg p-3">
        <div>
          <label class="${LABEL}">Experiencia</label>
          <textarea oninput="window.updatePlanWeekField('${w.id}','experiencia', this.value)" class="${INPUT} h-16 resize-none bg-white" placeholder="Observa, explora, vivencia...">${escapeHtml(w.experiencia)}</textarea>
        </div>
        <div>
          <label class="${LABEL}">Reflexión</label>
          <textarea oninput="window.updatePlanWeekField('${w.id}','reflexion', this.value)" class="${INPUT} h-16 resize-none bg-white" placeholder="Preguntas guía para el estudiante...">${escapeHtml(w.reflexion)}</textarea>
        </div>
        <div>
          <label class="${LABEL}">Conceptualización</label>
          <textarea oninput="window.updatePlanWeekField('${w.id}','conceptualizacion', this.value)" class="${INPUT} h-16 resize-none bg-white" placeholder="Explicación / construcción del concepto...">${escapeHtml(w.conceptualizacion)}</textarea>
        </div>
        <div>
          <label class="${LABEL}">Aplicación</label>
          <textarea oninput="window.updatePlanWeekField('${w.id}','aplicacion', this.value)" class="${INPUT} h-16 resize-none bg-white" placeholder="Práctica / transferencia del aprendizaje...">${escapeHtml(w.aplicacion)}</textarea>
        </div>
      </div>

      <label class="${LABEL}">Recursos</label>
      <input type="text" value="${escapeHtml(w.recursos)}" oninput="window.updatePlanWeekField('${w.id}','recursos', this.value)" placeholder="Ej. Colchoneta, silbato, canchas, áreas verdes" class="${INPUT} mb-3" />
      <div class="grid grid-cols-1 sm:grid-cols-2 gap-3">
        <div>
          <label class="${LABEL}">Indicador de Evaluación</label>
          <input type="text" value="${escapeHtml(w.indicadorEvaluacion)}" oninput="window.updatePlanWeekField('${w.id}','indicadorEvaluacion', this.value)" class="${INPUT}" />
        </div>
        <div>
          <label class="${LABEL}">Instrumento de Evaluación</label>
          <input type="text" value="${escapeHtml(w.instrumentoEvaluacion)}" oninput="window.updatePlanWeekField('${w.id}','instrumentoEvaluacion', this.value)" placeholder="Ej. Lista de cotejo" class="${INPUT}" />
        </div>
      </div>
    </div>
  `;
}

function screenTeacherPlanificacion() {
  const subjects = subjectsOfTeacher(ui.teacherId);
  if (!ui.teacherSubjectId || !subjects.find(s => s.id === ui.teacherSubjectId)) ui.teacherSubjectId = subjects[0] ? subjects[0].id : null;
  if (!ui.teacherSubjectId) {
    return `
      <div class="mb-6"><h1 class="font-display font-bold text-2xl text-primary-dark">Planificación Microcurricular</h1></div>
      <div class="${CARD} p-8 text-center text-sm text-slate-400">Este docente no tiene materias asignadas.</div>
    `;
  }
  if (!ui.planDraft || ui.planDraft.subjectId !== ui.teacherSubjectId) loadPlanDraft(ui.teacherSubjectId);
  const subject = getSubject(ui.teacherSubjectId);
  const course = getCourse(subject.courseId);
  const teacher = getTeacher(ui.teacherId);
  const d = ui.planDraft;
  const hasPlan = !!getPlanForSubject(ui.teacherSubjectId);
  const calendarItems = calendarItemsForSubject(ui.teacherSubjectId);
  const status = d.status || 'borrador';
  const locked = status === 'en_revision';
  const statusMeta = PLAN_STATUS_META[status];
  const obs = d.observations || [];
  const openObs = obs.filter(o => !o.resolved);
  const fieldObsBox = (fieldKey) => {
    const matches = openObs.filter(o => o.field === fieldKey);
    if (!matches.length) return '';
    return matches.map(o => `<div class="mt-1.5 mb-2 flex items-start gap-2 bg-red-50 border border-red-200 text-red-700 text-xs rounded-lg px-3 py-2"><span>💬</span><span>${escapeHtml(o.text)}</span></div>`).join('');
  };

  return `
    <div class="flex items-start justify-between gap-4 mb-4 flex-wrap">
      <div>
        <div class="flex items-center gap-2 mb-1 flex-wrap">
          <h1 class="font-display font-bold text-2xl text-primary-dark">Planificación Microcurricular (PUD)</h1>
          ${hasPlan ? `<span class="text-[11px] font-bold px-2 py-1 rounded-md ${statusMeta.cls}">${statusMeta.label}</span>` : ''}
        </div>
        <p class="text-slate-500 text-sm mt-1">Crea la unidad didáctica de tu materia — el calendario se genera automáticamente al guardar.</p>
      </div>
      <div class="flex gap-2 flex-wrap">
        <button onclick="window.exportPlanWord()" class="${BTN_SECONDARY} text-xs" ${hasPlan ? '' : 'disabled'} title="${hasPlan ? '' : 'Guarda la planificación primero'}">📄 Exportar Word</button>
        <button onclick="window.exportPlanPDF()" class="${BTN_SECONDARY} text-xs" ${hasPlan ? '' : 'disabled'} title="${hasPlan ? '' : 'Guarda la planificación primero'}">🖨️ Exportar PDF</button>
      </div>
    </div>

    ${locked ? `<div class="${CARD} border-amber-200 bg-amber-50 p-4 mb-5 flex items-center gap-3 text-sm text-amber-800"><span class="text-lg">⏳</span><div><b>En revisión.</b> El administrador está revisando esta planificación — no se puede editar hasta que responda.</div></div>` : ''}
    ${status === 'con_observaciones' && openObs.length ? `<div class="${CARD} border-red-200 bg-red-50 p-4 mb-5 flex items-start gap-3 text-sm text-red-700"><span class="text-lg">💬</span><div><b>El administrador dejó ${openObs.length} observación(es).</b> Corrige lo señalado en cada campo (resaltado abajo) y vuelve a enviar a revisión.</div></div>` : ''}
    ${status === 'aprobado' ? `<div class="${CARD} border-emerald-200 bg-emerald-50 p-4 mb-5 flex items-center gap-3 text-sm text-emerald-700"><span class="text-lg">✅</span><div><b>Planificación aprobada</b> por el administrador${d.reviewedAt ? ' el ' + fmtDate(d.reviewedAt) : ''}.</div></div>` : ''}

    ${subjects.length > 1 ? `<select onchange="window.setTeacherPlanSubject(this.value)" class="${INPUT} max-w-xs mb-5">
      ${subjects.map(s => `<option value="${s.id}" ${s.id === ui.teacherSubjectId ? 'selected' : ''}>${escapeHtml(s.name)} — ${escapeHtml((getCourse(s.courseId) || {}).name || '')}</option>`).join('')}
    </select>` : ''}

    <div class="${locked ? 'pointer-events-none opacity-60' : ''}">
    <div class="${CARD} p-6 mb-5">
      <div class="grid grid-cols-2 sm:grid-cols-4 gap-3 mb-5 pb-5 border-b border-slate-100 text-xs">
        <div><span class="font-bold text-slate-400 uppercase text-[10px]">Docente</span><div class="text-slate-700 font-semibold mt-0.5">${teacher ? escapeHtml(teacher.name) : ''}</div></div>
        <div><span class="font-bold text-slate-400 uppercase text-[10px]">Área / Asignatura</span><div class="text-slate-700 font-semibold mt-0.5">${escapeHtml(subject.name)}</div></div>
        <div><span class="font-bold text-slate-400 uppercase text-[10px]">Curso / Grado</span><div class="text-slate-700 font-semibold mt-0.5">${course ? escapeHtml(course.level) : ''}</div></div>
        <div><span class="font-bold text-slate-400 uppercase text-[10px]">Paralelo</span><div class="text-slate-700 font-semibold mt-0.5">${course ? escapeHtml(course.paralelo) : ''}</div></div>
      </div>
      <div class="grid grid-cols-1 sm:grid-cols-4 gap-3 mb-4">
        <div>
          <label class="${LABEL}">Unidad Didáctica N°</label>
          <input type="text" inputmode="numeric" value="${escapeHtml(String(d.unidadNumero))}" oninput="window.updatePlanField('unidadNumero', this.value)" class="${INPUT}" />
        </div>
        <div class="sm:col-span-3">
          <label class="${LABEL}">Título de la Unidad</label>
          <input type="text" value="${escapeHtml(d.tituloUnidad)}" oninput="window.updatePlanField('tituloUnidad', this.value)" placeholder="Ej. Prácticas Gimnastas" class="${INPUT}" />
          ${fieldObsBox('tituloUnidad')}
        </div>
      </div>
      <div class="grid grid-cols-1 sm:grid-cols-2 gap-3 mb-4">
        <div>
          <label class="${LABEL}">Fecha de inicio de la unidad</label>
          <input type="date" value="${d.fechaInicio}" onchange="window.updatePlanField('fechaInicio', this.value)" class="${INPUT}" />
        </div>
        <div>
          <label class="${LABEL}">Fecha de finalización de la unidad</label>
          <input type="date" value="${d.fechaFin}" onchange="window.updatePlanField('fechaFin', this.value)" class="${INPUT}" />
        </div>
      </div>
      <label class="${LABEL}">Objetivo de la Unidad</label>
      <textarea oninput="window.updatePlanField('objetivoUnidad', this.value)" class="${INPUT} h-16 resize-none mb-1" placeholder="Ej. O.EF.4.8. Sensibilizarse frente al entorno que lo rodea...">${escapeHtml(d.objetivoUnidad)}</textarea>
      ${fieldObsBox('objetivoUnidad')}
      <div class="mb-3"></div>
      <label class="${LABEL}">Objetivo de Aprendizaje</label>
      <textarea oninput="window.updatePlanField('objetivoAprendizaje', this.value)" class="${INPUT} h-16 resize-none mb-1" placeholder="Los estudiantes comprenderán que...">${escapeHtml(d.objetivoAprendizaje)}</textarea>
      ${fieldObsBox('objetivoAprendizaje')}
      <div class="grid grid-cols-1 sm:grid-cols-2 gap-4 mt-3">
        <div>
          <label class="${LABEL}">Ejes Transversales</label>
          <input type="text" value="${escapeHtml(d.ejesTransversales)}" oninput="window.updatePlanField('ejesTransversales', this.value)" placeholder="Ej. Educación Ambiental; Interculturalidad" class="${INPUT}" />
          ${fieldObsBox('ejesTransversales')}
        </div>
        <div>
          <label class="${LABEL}">Estándar de Aprendizaje</label>
          <input type="text" value="${escapeHtml(d.estandarAprendizaje)}" oninput="window.updatePlanField('estandarAprendizaje', this.value)" placeholder="Ej. E.EF.4.3.1..." class="${INPUT}" />
          ${fieldObsBox('estandarAprendizaje')}
        </div>
      </div>
      ${fieldObsBox('general')}
    </div>

    <div class="flex items-center justify-between mb-3">
      <div class="font-display font-bold text-primary-dark">Semanas de la Unidad</div>
      <button onclick="window.addPlanWeek()" class="${BTN_SECONDARY} text-xs px-3 py-2">+ Agregar Semana</button>
    </div>
    <div class="flex flex-col gap-4 mb-6">
      ${d.semanas.map(w => planWeekCard(w, d.semanas.length, openObs)).join('')}
    </div>
    </div>

    <div class="flex justify-end gap-3 mb-8">
      ${!locked ? `<button onclick="window.savePlan()" class="${BTN_SECONDARY}">Guardar Borrador</button>
      <button onclick="window.submitPlanForReview()" class="${BTN_PRIMARY}">${status === 'con_observaciones' ? 'Reenviar a Revisión' : 'Enviar a Revisión'}</button>` : ''}
    </div>

    <div class="font-display font-bold text-primary-dark mb-3">Calendario Generado — ${escapeHtml(subject.name)}</div>
    <p class="text-xs text-slate-400 mb-3">Este es exactamente lo que verán tú y tus estudiantes en "Horario y Calendario".</p>
    <div class="${CARD} overflow-hidden">
      ${calendarItems.length ? calendarItems.map(upcomingRow).join('') : `<div class="p-8 text-center text-sm text-slate-400">Guarda la planificación para generar el calendario de esta materia.</div>`}
    </div>
  `;
}

function teacherSubjectSelect(subjects) {
  return `<select onchange="window.setTeacherSubject(this.value); render();" class="${INPUT} max-w-xs mb-5">
    ${subjects.map(s => `<option value="${s.id}" ${s.id === ui.teacherSubjectId ? 'selected' : ''}>${escapeHtml(s.name)} — ${escapeHtml((getCourse(s.courseId) || {}).name || '')}</option>`).join('')}
  </select>`;
}

function renderPreservingScroll() {
  const scrollables = [...document.querySelectorAll('[data-preserve-scroll]')].map(el => [el.id, el.scrollLeft, el.scrollTop]);
  const winY = window.scrollY;
  render();
  scrollables.forEach(([id, left, top]) => { const el = document.getElementById(id); if (el) { el.scrollLeft = left; el.scrollTop = top; } });
  window.scrollTo(0, winY);
}

/* ---------------------------- LIBRO DE CALIFICACIONES ----------------------- */
window.updateGradeField = (subjectId, studentId, field, value) => {
  const e = ensureGradeEntry(subjectId, studentId);
  e[field] = value === '' ? null : value;
  saveDB();
  renderPreservingScroll();
};
function gradeNumInput(subjectId, studentId, field, value, extraClass) {
  const v = (value === null || value === undefined) ? '' : value;
  return `<input type="text" inputmode="decimal" value="${escapeHtml(String(v))}" onchange="window.updateGradeField('${subjectId}','${studentId}','${field}', this.value)" class="w-14 text-center border border-slate-300 rounded-md px-1 py-1.5 text-xs ${extraClass || ''}" placeholder="—" />`;
}
function computedCell(value, opts) {
  const text = value === null ? '—' : (typeof value === 'number' ? value.toFixed(2) : value);
  return `<div class="w-14 text-center text-xs font-bold ${opts || 'text-slate-500'} py-1.5">${text}</div>`;
}
const CUALITATIVO_BADGE = (l) => {
  if (!l) return 'bg-slate-100 text-slate-400';
  if (l[0] === 'A') return 'bg-emerald-50 text-emerald-700';
  if (l[0] === 'B') return 'bg-sky-light text-primary';
  if (l[0] === 'C') return 'bg-amber-50 text-amber-700';
  return 'bg-red-50 text-red-600';
};

function estandaresPanel(subjectId) {
  const r = estandaresForSubject(subjectId);
  const rows = [
    { label: 'DA — Domina los Aprendizajes', sub: '9,00 – 10,00', key: 'DA', cls: 'bg-emerald-500' },
    { label: 'AA — Alcanza los Aprendizajes', sub: '7,00 – 8,99', key: 'AA', cls: 'bg-sky' },
    { label: 'PA — Próximo a Alcanzar', sub: '4,01 – 6,99', key: 'PA', cls: 'bg-amber-500' },
    { label: 'NA — No Alcanza', sub: '0 – 4,00', key: 'NA', cls: 'bg-red-500' },
  ];
  return `
    <div class="${CARD} p-5">
      <div class="flex items-center justify-between mb-4 flex-wrap gap-2">
        <div class="font-display font-bold text-primary-dark text-sm">Hoja de Estándares — Rendimiento Académico</div>
        <div class="text-xs text-slate-500">Promedio: <b class="text-primary-dark">${r.average !== null ? r.average.toFixed(2) : '—'}</b> · Calificados: <b>${r.graded}/${r.total}</b> · Refuerzo: <b class="${r.refuerzo ? 'text-accent-dark' : ''}">${r.refuerzo}</b></div>
      </div>
      <div class="grid grid-cols-2 sm:grid-cols-4 gap-3">
        ${rows.map(row => `
          <div class="border border-slate-200 rounded-xl p-3">
            <div class="text-[11px] font-bold text-slate-500 leading-tight">${row.label}</div>
            <div class="text-[10px] text-slate-400 mb-2">${row.sub}</div>
            <div class="text-xl font-display font-bold text-primary-dark">${r.counts[row.key]}</div>
            <div class="w-full h-1.5 bg-slate-100 rounded-full overflow-hidden mt-1.5">
              <div class="h-full ${row.cls}" style="width:${Math.round(r.pct[row.key] * 100)}%"></div>
            </div>
            <div class="text-[11px] text-slate-400 mt-1">${Math.round(r.pct[row.key] * 100)}%</div>
          </div>
        `).join('')}
      </div>
    </div>
  `;
}

function screenTeacherNotas() {
  const subjects = subjectsOfTeacher(ui.teacherId);
  if (!ui.teacherSubjectId || !subjects.find(s => s.id === ui.teacherSubjectId)) ui.teacherSubjectId = subjects[0] ? subjects[0].id : null;
  const subject = ui.teacherSubjectId ? getSubject(ui.teacherSubjectId) : null;
  const students = subject ? studentsOfSubject(subject.id) : [];
  if (!subject) {
    return `<div class="mb-6"><h1 class="font-display font-bold text-2xl text-primary-dark">Libro de Calificaciones</h1></div>
      <div class="${CARD} p-8 text-center text-sm text-slate-400">Este docente no tiene materias asignadas.</div>`;
  }
  const course = getCourse(subject.courseId);
  const headGroup = (text, span) => `<div class="text-center font-bold text-slate-500 uppercase" style="grid-column: span ${span};">${text}</div>`;
  return `
    <div class="mb-6">
      <h1 class="font-display font-bold text-2xl text-primary-dark">Libro de Calificaciones</h1>
      <p class="text-slate-500 text-sm mt-1">Aportes del trimestre — se calcula automáticamente igual que la hoja de Excel del colegio.</p>
    </div>
    ${teacherSubjectSelect(subjects)}
    <div class="${CARD} p-2 mb-6 overflow-x-auto" id="gradebook-scroll" data-preserve-scroll>
      <div style="min-width:1500px;">
        <div class="grid gap-1 px-2 pt-3 pb-1 text-[10px]" style="grid-template-columns:28px 190px repeat(10,56px) 60px 56px 64px 60px 60px 60px 70px 70px;">
          <div></div><div></div>
          ${headGroup('Bloque 1 (Aportes)', 5)}
          ${headGroup('Bloque 2 (Aportes)', 5)}
          <div></div><div></div><div></div><div></div><div></div><div></div><div></div><div></div>
        </div>
        <div class="grid gap-1 px-2 pb-2 text-[9.5px] font-bold text-slate-400 uppercase border-b-2 border-slate-100" style="grid-template-columns:28px 190px repeat(10,56px) 60px 56px 64px 60px 60px 60px 70px 70px;">
          <div>N°</div><div>Estudiante</div>
          ${BLOQUE1_FIELDS.map(f => `<div class="text-center leading-tight">${f.label}</div>`).join('')}
          ${BLOQUE2_FIELDS.map(f => `<div class="text-center leading-tight">${f.label}</div>`).join('')}
          <div class="text-center">Prom.</div>
          <div class="text-center">Refuerzo</div>
          <div class="text-center">Prom c/Ref</div>
          <div class="text-center">70%</div>
          <div class="text-center">Proy. 15%</div>
          <div class="text-center">Exam. 15%</div>
          <div class="text-center">Nota Final</div>
          <div class="text-center">Cualitativo</div>
        </div>
        ${students.map((st, idx) => {
          const e = ensureGradeEntry(subject.id, st.id);
          const r = computeGradeEntry(e);
          return `<div class="grid gap-1 px-2 py-1.5 items-center border-b border-slate-50" style="grid-template-columns:28px 190px repeat(10,56px) 60px 56px 64px 60px 60px 60px 70px 70px;">
            <div class="text-[11px] text-slate-400">${idx + 1}</div>
            <div class="text-xs font-semibold text-slate-700 truncate">${escapeHtml(st.name)}</div>
            ${BLOQUE1_FIELDS.map(f => gradeNumInput(subject.id, st.id, f.key, e[f.key])).join('')}
            ${BLOQUE2_FIELDS.map(f => gradeNumInput(subject.id, st.id, f.key, e[f.key])).join('')}
            ${computedCell(r.promedioGeneral)}
            ${gradeNumInput(subject.id, st.id, 'refuerzoAcademico', e.refuerzoAcademico, 'border-accent/40')}
            ${computedCell(r.promedioConRef)}
            ${computedCell(r.comp70)}
            ${gradeNumInput(subject.id, st.id, 'notaProyecto', e.notaProyecto, 'border-primary/30')}
            ${gradeNumInput(subject.id, st.id, 'notaExamen', e.notaExamen, 'border-primary/30')}
            <div class="text-center text-sm font-bold text-primary-dark">${r.notaFinal !== null ? r.notaFinal.toFixed(2) : '—'}</div>
            <div class="flex justify-center"><span class="text-[11px] font-bold px-2 py-0.5 rounded-md ${CUALITATIVO_BADGE(r.cualitativo)}">${r.cualitativo || '—'}</span></div>
          </div>`;
        }).join('') || `<div class="p-8 text-center text-sm text-slate-400">No hay estudiantes matriculados en esta materia.</div>`}
      </div>
    </div>
    ${subject && students.length ? estandaresPanel(subject.id) : ''}
  `;
}

const ATT_MARK_OPTS = [
  { v: 'presente', label: 'Presente', cls: 'bg-emerald-500 text-white border-emerald-500' },
  { v: 'atraso', label: 'Atraso', cls: 'bg-amber-500 text-white border-amber-500' },
  { v: 'falta', label: 'Falta', cls: 'bg-red-500 text-white border-red-500' },
];
function screenTeacherAsistencia() {
  const subjects = subjectsOfTeacher(ui.teacherId);
  if (!ui.teacherSubjectId || !subjects.find(s => s.id === ui.teacherSubjectId)) ui.teacherSubjectId = subjects[0] ? subjects[0].id : null;
  const subject = ui.teacherSubjectId ? getSubject(ui.teacherSubjectId) : null;
  const students = subject ? studentsOfSubject(subject.id) : [];
  const today = todayISO();
  return `
    <div class="mb-6">
      <h1 class="font-display font-bold text-2xl text-primary-dark">Tomar Asistencia</h1>
      <p class="text-slate-500 text-sm mt-1">${fmtDate(today)} · Se guarda automáticamente en el historial del estudiante.</p>
    </div>
    ${subjects.length ? teacherSubjectSelect(subjects) : ''}
    <div class="${CARD} overflow-hidden">
      ${students.length ? students.map(st => {
        const rec = db.attendance.find(a => a.studentId === st.id && a.subjectId === subject.id && a.date === today);
        const current = rec ? rec.status : null;
        return `<div class="flex items-center gap-4 px-5 py-3.5 border-b border-slate-50 last:border-0 flex-wrap">
          <div class="w-9 h-9 rounded-full bg-primary text-white flex items-center justify-center font-bold text-xs flex-shrink-0">${initials(st.name)}</div>
          <div class="font-semibold text-slate-700 text-sm flex-1 min-w-[140px]">${escapeHtml(st.name)}</div>
          <div class="flex gap-2">
            ${ATT_MARK_OPTS.map(o => `<button onclick="window.markAttendance('${st.id}','${subject.id}','${o.v}')" class="text-xs font-bold px-3 py-1.5 rounded-full border transition-colors ${current === o.v ? o.cls : 'bg-white text-slate-500 border-slate-300 hover:bg-slate-50'}">${o.label}</button>`).join('')}
          </div>
        </div>`;
      }).join('') : `<div class="p-8 text-center text-sm text-slate-400">${subject ? 'No hay estudiantes matriculados en esta materia.' : 'Este docente no tiene materias asignadas.'}</div>`}
    </div>
  `;
}
window.markAttendance = (studentId, subjectId, status) => {
  upsertAttendanceToday(studentId, subjectId, status);
  toast('Asistencia registrada.');
  render();
};

const ASSIGNMENT_TYPE_OPTIONS = ['Tarea', 'Prueba', 'Proyecto', 'Evento'];
function screenTeacherCalificaciones() {
  const subjects = subjectsOfTeacher(ui.teacherId);
  if (!ui.teacherSubjectId || !subjects.find(s => s.id === ui.teacherSubjectId)) ui.teacherSubjectId = subjects[0] ? subjects[0].id : null;
  const subject = ui.teacherSubjectId ? getSubject(ui.teacherSubjectId) : null;
  const assignments = subject ? assignmentsOfSubject(subject.id).filter(a => a.type !== 'Clase') : [];
  if (!ui.teacherAssignmentId || !assignments.find(a => a.id === ui.teacherAssignmentId)) ui.teacherAssignmentId = assignments[0] ? assignments[0].id : null;
  const assignment = ui.teacherAssignmentId ? db.assignments.find(a => a.id === ui.teacherAssignmentId) : null;
  const students = subject ? studentsOfSubject(subject.id) : [];
  return `
    <div class="flex items-start justify-between gap-4 mb-6 flex-wrap">
      <div>
        <h1 class="font-display font-bold text-2xl text-primary-dark">Tareas y Calificaciones</h1>
        <p class="text-slate-500 text-sm mt-1">Crea tareas, pruebas y proyectos, y registra la nota de cada estudiante.</p>
      </div>
      <button onclick="window.openAssignmentModal()" class="${BTN_PRIMARY}" ${subject ? '' : 'disabled'}>+ Nueva Tarea</button>
    </div>
    ${subjects.length ? `<select onchange="window.setTeacherSubject(this.value); render();" class="${INPUT} max-w-xs mb-5">
      ${subjects.map(s => `<option value="${s.id}" ${s.id === ui.teacherSubjectId ? 'selected' : ''}>${escapeHtml(s.name)} — ${escapeHtml((getCourse(s.courseId) || {}).name || '')}</option>`).join('')}
    </select>` : ''}

    <div class="${CARD} overflow-hidden mb-6">
      <div class="grid grid-cols-[1.6fr_100px_110px_100px_130px] gap-2 px-5 py-3 text-[11px] font-bold text-slate-400 uppercase border-b border-slate-100 bg-slate-50">
        <div>Título</div><div>Tipo</div><div>Entrega</div><div>Calificadas</div><div>Acciones</div>
      </div>
      ${assignments.length ? assignments.map(a => {
        const subs = db.submissions.filter(s => s.assignmentId === a.id);
        const graded = subs.filter(s => s.status === 'calificado').length;
        const active = a.id === ui.teacherAssignmentId;
        return `<div class="grid grid-cols-[1.6fr_100px_110px_100px_130px] gap-2 px-5 py-3 items-center border-b border-slate-50 text-sm ${active ? 'bg-sky-light/40' : ''}">
          <button onclick="window.setTeacherAssignment('${a.id}')" class="text-left font-semibold ${active ? 'text-primary-dark' : 'text-slate-700'} hover:underline truncate">${escapeHtml(a.title)}</button>
          <div class="text-xs text-slate-500">${escapeHtml(a.type)}</div>
          <div class="text-xs text-slate-500">${fmtDate(a.dueDate)}</div>
          <div class="text-xs font-bold ${graded === subs.length && subs.length ? 'text-emerald-600' : 'text-slate-500'}">${graded}/${subs.length}</div>
          <div class="flex gap-2.5">
            <button onclick="window.openAssignmentModal('${a.id}')" class="text-xs font-semibold text-primary hover:underline">Editar</button>
            <button onclick="window.deleteAssignment('${a.id}')" class="${BTN_DANGER_TEXT}">Eliminar</button>
          </div>
        </div>`;
      }).join('') : `<div class="p-8 text-center text-sm text-slate-400">${subject ? 'Aún no has creado ninguna tarea para esta materia.' : 'Este docente no tiene materias asignadas.'}</div>`}
    </div>

    ${assignment ? `
    <div class="font-display font-bold text-primary-dark mb-3">Calificar: ${escapeHtml(assignment.title)}</div>
    <div class="${CARD} overflow-hidden">
      <div class="grid grid-cols-[1.4fr_110px_1fr_110px] gap-2 px-5 py-3 text-[11px] font-bold text-slate-400 uppercase border-b border-slate-100 bg-slate-50">
        <div>Estudiante</div><div>Nota</div><div>Retroalimentación</div><div></div>
      </div>
      ${students.map(st => {
        const sub = submissionsOf(assignment.id, st.id);
        if (!sub) return '';
        return `<div class="grid grid-cols-[1.4fr_110px_1fr_110px] gap-2 px-5 py-3 items-center border-b border-slate-50 text-sm">
          <div>
            <div class="font-semibold text-slate-700">${escapeHtml(st.name)}</div>
            <div class="text-[11px] font-bold ${STATUS_STYLE[sub.status]} inline-block px-2 py-0.5 rounded-md mt-1 border">${capitalize(sub.status)}</div>
          </div>
          <input id="gr-${sub.id}" type="text" inputmode="decimal" value="${sub.grade !== null ? sub.grade : ''}" placeholder="0-10" class="${INPUT} text-center" />
          <input id="fb-${sub.id}" type="text" value="${escapeHtml(sub.feedback || '')}" placeholder="Comentario..." class="${INPUT}" />
          <button onclick="window.saveGrade('${sub.id}')" class="${BTN_PRIMARY} text-xs px-3 py-2">Guardar</button>
        </div>`;
      }).join('') || `<div class="p-8 text-center text-sm text-slate-400">No hay estudiantes matriculados en esta materia.</div>`}
    </div>` : ''}
  `;
}
window.openAssignmentModal = (assignmentId) => {
  if (!ui.teacherSubjectId) return;
  if (assignmentId) {
    const a = db.assignments.find(x => x.id === assignmentId);
    ui.editingAssignmentId = assignmentId;
    ui.assignmentDraft = { title: a.title, type: a.type, dueDate: a.dueDate, description: a.description || '' };
  } else {
    ui.editingAssignmentId = null;
    ui.assignmentDraft = { title: '', type: 'Tarea', dueDate: todayISO(), description: '' };
  }
  ui.assignmentModalOpen = true;
  render();
};
window.closeAssignmentModal = () => { ui.assignmentModalOpen = false; render(); };
window.updateAssignmentDraft = (field, value) => { ui.assignmentDraft[field] = value; };
window.saveAssignmentForm = () => {
  const d = ui.assignmentDraft;
  if (!d.title.trim()) { toast('Ingresa un título.', 'error'); return; }
  if (!d.dueDate) { toast('Selecciona una fecha de entrega.', 'error'); return; }
  if (ui.editingAssignmentId) {
    const a = db.assignments.find(x => x.id === ui.editingAssignmentId);
    Object.assign(a, { title: d.title.trim(), type: d.type, dueDate: d.dueDate, description: d.description.trim() });
    toast('Tarea actualizada.');
  } else {
    const a = {
      id: uid('asg'), subjectId: ui.teacherSubjectId, courseId: null, title: d.title.trim(), type: d.type,
      dueDate: d.dueDate, originalDueDate: d.dueDate, rescheduled: false, rescheduleReason: null, description: d.description.trim(),
    };
    db.assignments.push(a);
    studentsOfSubject(a.subjectId).forEach(st => {
      db.submissions.push({ id: uid('sub'), assignmentId: a.id, studentId: st.id, status: 'pendiente', grade: null, feedback: null, submittedText: null, submittedAt: null });
    });
    ui.teacherAssignmentId = a.id;
    toast('Tarea creada y asignada a todos los estudiantes de la materia.');
  }
  saveDB();
  ui.assignmentModalOpen = false;
  render();
};
window.deleteAssignment = (assignmentId) => {
  if (!confirm('¿Eliminar esta tarea? Se perderán las calificaciones asociadas.')) return;
  db.submissions = db.submissions.filter(s => s.assignmentId !== assignmentId);
  db.assignments = db.assignments.filter(a => a.id !== assignmentId);
  if (ui.teacherAssignmentId === assignmentId) ui.teacherAssignmentId = null;
  saveDB();
  toast('Tarea eliminada.');
  render();
};
function assignmentModalHTML() {
  const isEdit = !!ui.editingAssignmentId;
  const d = ui.assignmentDraft;
  return `
  <div class="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/50 anim-fade" onclick="if(event.target===this) window.closeAssignmentModal()">
    <div class="bg-white rounded-2xl w-full max-w-md max-h-[92vh] overflow-y-auto anim-popin">
      <div class="px-6 py-5 border-b border-slate-100 flex items-center justify-between sticky top-0 bg-white rounded-t-2xl">
        <div class="font-display font-bold text-lg text-primary-dark">${isEdit ? 'Editar Tarea' : 'Nueva Tarea'}</div>
        <button onclick="window.closeAssignmentModal()" class="text-slate-400 hover:text-slate-600 text-2xl leading-none">&times;</button>
      </div>
      <div class="p-6">
        <label class="${LABEL}">Título</label>
        <input id="af-title" type="text" value="${escapeHtml(d.title)}" oninput="window.updateAssignmentDraft('title', this.value)" placeholder="Ej. Ensayo sobre ecosistemas" class="${INPUT} mb-4" required />

        <div class="grid grid-cols-2 gap-4 mb-4">
          <div>
            <label class="${LABEL}">Tipo</label>
            <select id="af-type" onchange="window.updateAssignmentDraft('type', this.value)" class="${INPUT}">
              ${ASSIGNMENT_TYPE_OPTIONS.map(t => `<option value="${t}" ${t === d.type ? 'selected' : ''}>${t}</option>`).join('')}
            </select>
          </div>
          <div>
            <label class="${LABEL}">Fecha de entrega</label>
            <input id="af-date" type="date" value="${d.dueDate}" onchange="window.updateAssignmentDraft('dueDate', this.value)" class="${INPUT}" />
          </div>
        </div>

        <label class="${LABEL}">Descripción (opcional)</label>
        <textarea id="af-desc" oninput="window.updateAssignmentDraft('description', this.value)" class="${INPUT} h-20 resize-none mb-5" placeholder="Instrucciones para el estudiante...">${escapeHtml(d.description)}</textarea>

        <div class="flex gap-3">
          <button type="button" onclick="window.closeAssignmentModal()" class="${BTN_SECONDARY} flex-1">Cancelar</button>
          <button type="button" onclick="window.saveAssignmentForm()" class="${BTN_PRIMARY} flex-1">${isEdit ? 'Guardar Cambios' : 'Crear Tarea'}</button>
        </div>
      </div>
    </div>
  </div>`;
}
window.saveGrade = (submissionId) => {
  const gradeEl = document.getElementById(`gr-${submissionId}`);
  const fbEl = document.getElementById(`fb-${submissionId}`);
  const grade = parseFloat(gradeEl.value.replace(',', '.'));
  if (isNaN(grade) || grade < 0 || grade > 10) { toast('Ingresa una nota válida entre 0 y 10.', 'error'); return; }
  const sub = db.submissions.find(s => s.id === submissionId);
  if (!sub) return;
  sub.grade = Math.round(grade * 10) / 10;
  sub.feedback = fbEl.value.trim();
  sub.status = 'calificado';
  if (!sub.submittedAt) sub.submittedAt = todayISO();
  saveDB();
  toast('Calificación guardada.');
  render();
};

function screenTeacherRecursos() {
  const subjects = subjectsOfTeacher(ui.teacherId);
  if (!ui.teacherSubjectId || !subjects.find(s => s.id === ui.teacherSubjectId)) ui.teacherSubjectId = subjects[0] ? subjects[0].id : null;
  const subject = ui.teacherSubjectId ? getSubject(ui.teacherSubjectId) : null;
  const resources = subject ? db.resources.filter(r => r.subjectId === subject.id) : [];
  return `
    <div class="mb-6">
      <h1 class="font-display font-bold text-2xl text-primary-dark">Recursos de Estudio</h1>
      <p class="text-slate-500 text-sm mt-1">Publica enlaces y videos de apoyo — se sincronizan al instante con tus estudiantes.</p>
    </div>
    ${subjects.length ? teacherSubjectSelect(subjects) : ''}
    <div class="grid grid-cols-1 lg:grid-cols-[1fr_320px] gap-5">
      <div class="${CARD} overflow-hidden">
        ${resources.length ? resources.map(r => `
          <div class="flex items-center gap-3 px-5 py-3.5 border-b border-slate-50 last:border-0">
            <span class="text-lg">${r.type === 'video' ? '🎬' : '🔗'}</span>
            <div class="flex-1 min-w-0">
              <div class="text-sm font-semibold text-slate-700 truncate">${escapeHtml(r.title)}</div>
              <div class="text-xs text-slate-400 truncate">${escapeHtml(r.description)}</div>
            </div>
            <button onclick="window.deleteResource('${r.id}')" class="${BTN_DANGER_TEXT}">Eliminar</button>
          </div>
        `).join('') : `<div class="p-8 text-center text-sm text-slate-400">${subject ? 'Aún no hay recursos publicados.' : 'Este docente no tiene materias asignadas.'}</div>`}
      </div>
      ${subject ? `
      <div class="${CARD} p-5">
        <div class="font-display font-bold text-primary-dark mb-3 text-sm">+ Publicar Recurso</div>
        <form onsubmit="return window.addResource(event)">
          <label class="${LABEL}">Título</label>
          <input id="rs-title" type="text" placeholder="Ej. Video: leyes de Newton" class="${INPUT} mb-3" required />
          <label class="${LABEL}">Descripción</label>
          <textarea id="rs-desc" class="${INPUT} h-20 resize-none mb-3" placeholder="Breve descripción del recurso..."></textarea>
          <label class="${LABEL}">Tipo</label>
          <select id="rs-type" class="${INPUT} mb-4">
            <option value="video">Video</option>
            <option value="link">Enlace / Documento</option>
          </select>
          <button type="submit" class="${BTN_PRIMARY} w-full">Publicar</button>
        </form>
      </div>` : ''}
    </div>
  `;
}
window.addResource = (e) => {
  e.preventDefault();
  if (!ui.teacherSubjectId) return false;
  const title = document.getElementById('rs-title').value.trim();
  const description = document.getElementById('rs-desc').value.trim();
  const type = document.getElementById('rs-type').value;
  if (!title) return false;
  db.resources.push({ id: uid('res'), subjectId: ui.teacherSubjectId, title, description, type });
  saveDB();
  toast('Recurso publicado y sincronizado con tus estudiantes.');
  render();
  return false;
};
window.deleteResource = (id) => {
  db.resources = db.resources.filter(r => r.id !== id);
  saveDB(); toast('Recurso eliminado.'); render();
};

function screenTeacherMensajeria() {
  const subjects = subjectsOfTeacher(ui.teacherId);
  const studentIds = [...new Set(subjects.flatMap(s => studentsOfSubject(s.id).map(st => st.id)))];
  if (!ui.teacherChatStudentId || !studentIds.includes(ui.teacherChatStudentId)) ui.teacherChatStudentId = studentIds[0] || null;
  const activeStudent = ui.teacherChatStudentId ? getStudent(ui.teacherChatStudentId) : null;
  const messages = ui.teacherChatStudentId ? db.messages.filter(m => m.studentId === ui.teacherChatStudentId && m.teacherId === ui.teacherId) : [];
  return `
    <div class="mb-6">
      <h1 class="font-display font-bold text-2xl text-primary-dark">Mensajería Interna</h1>
      <p class="text-slate-500 text-sm mt-1">Comunícate directamente con tus estudiantes.</p>
    </div>
    <div class="${CARD} grid grid-cols-1 sm:grid-cols-[220px_1fr] h-[560px] overflow-hidden">
      <div class="border-b sm:border-b-0 sm:border-r border-slate-100 bg-slate-50 overflow-x-auto sm:overflow-y-auto flex sm:flex-col flex-shrink-0">
        ${studentIds.map(sid => {
          const st = getStudent(sid);
          const course = st ? getCourse(st.courseId) : null;
          return `<button onclick="window.selectTeacherChatStudent('${sid}')" class="text-left px-4 py-3 flex-shrink-0 sm:border-b border-slate-100 min-w-[160px] sm:min-w-0 ${ui.teacherChatStudentId === sid ? 'bg-white border-l-4 border-l-accent' : 'border-l-4 border-l-transparent hover:bg-white/60'}">
            <div class="text-sm font-semibold text-slate-700 truncate">${st ? escapeHtml(st.name) : ''}</div>
            <div class="text-[11px] text-slate-400 truncate">${course ? escapeHtml(course.name) : ''}</div>
          </button>`;
        }).join('') || `<div class="p-4 text-xs text-slate-400">Sin estudiantes asignados.</div>`}
      </div>
      <div class="flex flex-col min-w-0">
        <div class="px-5 py-3.5 border-b border-slate-100 font-display font-bold text-primary-dark text-sm">${activeStudent ? escapeHtml(activeStudent.name) : 'Selecciona un estudiante'}</div>
        <div id="chat-scroll" class="flex-1 overflow-y-auto p-5 flex flex-col gap-3 bg-slate-50/50">
          ${messages.length ? messages.map(m => `
            <div class="max-w-[75%] px-4 py-2.5 rounded-2xl text-[13px] leading-snug ${m.sender === 'teacher' ? 'self-end bg-primary text-white rounded-br-sm' : 'self-start bg-white border border-slate-200 text-slate-700 rounded-bl-sm'}">
              <div>${escapeHtml(m.text)}</div>
              <div class="text-[10px] mt-1 ${m.sender === 'teacher' ? 'text-white/60' : 'text-slate-400'}">${escapeHtml(m.time)}</div>
            </div>
          `).join('') : `<div class="m-auto text-xs text-slate-400">Aún no hay mensajes.</div>`}
        </div>
        <div class="p-3.5 border-t border-slate-100 flex gap-2">
          <input id="chat-input" type="text" placeholder="Escribe un mensaje…" onkeydown="if(event.key==='Enter'){event.preventDefault();window.sendTeacherMessage();}" class="${INPUT}" ${activeStudent ? '' : 'disabled'} />
          <button onclick="window.sendTeacherMessage()" class="${BTN_PRIMARY} px-4" ${activeStudent ? '' : 'disabled'}>Enviar</button>
        </div>
      </div>
    </div>
  `;
}
window.selectTeacherChatStudent = (id) => { ui.teacherChatStudentId = id; render(); };
window.sendTeacherMessage = () => {
  const input = document.getElementById('chat-input');
  const text = input.value.trim();
  if (!text || !ui.teacherChatStudentId) return;
  const studentId = ui.teacherChatStudentId, teacherId = ui.teacherId;
  db.messages.push({ id: uid('msg'), studentId, teacherId, sender: 'teacher', text, time: nowLabel() });
  saveDB();
  render();
  scrollChatToBottom();
};

/* ------------------------- EXPORTACIÓN DE PLANIFICACIÓN --------------------- */
function downloadBlob(blob, filename) {
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url; a.download = filename;
  document.body.appendChild(a); a.click(); document.body.removeChild(a);
  setTimeout(() => URL.revokeObjectURL(url), 2000);
}
function slugFile(s) {
  return (s || 'documento').normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/[^a-zA-Z0-9]+/g, '_').replace(/^_+|_+$/g, '');
}

window.exportPlanWord = async () => {
  const plan = getPlanForSubject(ui.teacherSubjectId);
  if (!plan) { toast('Guarda la planificación primero.', 'error'); return; }
  if (!window.docx) { toast('No se pudo cargar el generador de Word (sin conexión a internet).', 'error'); return; }
  const subject = getSubject(plan.subjectId);
  const course = getCourse(subject.courseId);
  const teacher = getTeacher(subject.teacherId);
  try {
    const blob = await buildPlanWordBlob(plan, subject, course, teacher);
    downloadBlob(blob, `PUD_${slugFile(subject.name)}_${slugFile(course ? course.name : '')}.docx`);
    toast('Word generado y descargado.');
  } catch (e) {
    toast('No se pudo generar el Word: ' + e.message, 'error');
  }
};

async function buildPlanWordBlob(plan, subject, course, teacher) {
  const { Document, Packer, Paragraph, TextRun, Table, TableRow, TableCell, WidthType, ShadingType, AlignmentType, PageOrientation, HeadingLevel, BorderStyle } = window.docx;
  const NAVY = '1e3a5f', ORANGE = 'c25e17', LIGHT = 'eaf4fc';
  const infoColWidths = [3200, 9800];
  const infoTotal = infoColWidths[0] + infoColWidths[1];
  const weekColWidths = [2000, 2700, 3400, 1700, 1500, 1500];
  const weekTotal = weekColWidths.reduce((a, b) => a + b, 0);

  const noBorder = { style: BorderStyle.SINGLE, size: 2, color: 'CCCCCC' };
  const cellBorders = { top: noBorder, bottom: noBorder, left: noBorder, right: noBorder };

  function labelRow(label, value) {
    return new TableRow({ children: [
      new TableCell({ width: { size: infoColWidths[0], type: WidthType.DXA }, borders: cellBorders, shading: { type: ShadingType.CLEAR, fill: 'F1F5F9' }, children: [new Paragraph({ children: [new TextRun({ text: label, bold: true, size: 18, color: NAVY })] })] }),
      new TableCell({ width: { size: infoColWidths[1], type: WidthType.DXA }, borders: cellBorders, children: [new Paragraph({ children: [new TextRun({ text: value || '—', size: 18 })] })] }),
    ]});
  }
  function fieldParagraphs(label, value) {
    return [
      new Paragraph({ spacing: { before: 160, after: 40 }, children: [new TextRun({ text: label, bold: true, size: 19, color: NAVY })] }),
      new Paragraph({ children: [new TextRun({ text: value || '—', size: 19 })] }),
    ];
  }
  function weekHeaderCell(text) {
    return new TableCell({
      width: { size: 0, type: WidthType.DXA }, borders: cellBorders,
      shading: { type: ShadingType.CLEAR, fill: NAVY },
      verticalAlign: 'center',
      children: [new Paragraph({ alignment: AlignmentType.CENTER, children: [new TextRun({ text, bold: true, color: 'FFFFFF', size: 16 })] })],
    });
  }
  function weekDataCell(text, width) {
    return new TableCell({
      width: { size: width, type: WidthType.DXA }, borders: cellBorders,
      children: (text || '—').split('\n').map(line => new Paragraph({ children: [new TextRun({ text: line, size: 16 })] })),
    });
  }
  function activitiesCell(sem, width) {
    const moments = [
      ['EXPERIENCIA', sem.experiencia],
      ['REFLEXIÓN', sem.reflexion],
      ['CONCEPTUALIZACIÓN', sem.conceptualizacion],
      ['APLICACIÓN', sem.aplicacion],
    ];
    const children = [];
    moments.forEach(([label, text]) => {
      if (!text) return;
      children.push(new Paragraph({ spacing: { before: 60 }, children: [new TextRun({ text: label, bold: true, size: 15, color: NAVY })] }));
      text.split('\n').forEach(line => children.push(new Paragraph({ children: [new TextRun({ text: line, size: 16 })] })));
    });
    if (!children.length) children.push(new Paragraph({ children: [new TextRun({ text: '—', size: 16 })] }));
    return new TableCell({ width: { size: width, type: WidthType.DXA }, borders: cellBorders, children });
  }

  const headerRow = new TableRow({ tableHeader: true, children: [
    weekHeaderCell('Conceptos Esenciales'),
    weekHeaderCell('Destrezas con Criterio de Desempeño'),
    weekHeaderCell('Actividades de Aprendizaje'),
    weekHeaderCell('Recursos'),
    weekHeaderCell('Indicador de Evaluación'),
    weekHeaderCell('Instrumento de Evaluación'),
  ]});

  const weekRows = [];
  plan.semanas.forEach(sem => {
    weekRows.push(new TableRow({ children: [ new TableCell({
      width: { size: weekTotal, type: WidthType.DXA }, columnSpan: 6, borders: cellBorders,
      shading: { type: ShadingType.CLEAR, fill: 'fdece0' },
      children: [new Paragraph({ children: [new TextRun({ text: `SEMANA ${sem.numero}: ${fmtDate(sem.fechaInicio)} – ${fmtDate(sem.fechaFin)}`, bold: true, color: ORANGE, size: 17 })] })],
    })]}));
    weekRows.push(new TableRow({ children: [
      weekDataCell(sem.temaConceptos, weekColWidths[0]),
      weekDataCell(sem.destrezas, weekColWidths[1]),
      activitiesCell(sem, weekColWidths[2]),
      weekDataCell(sem.recursos, weekColWidths[3]),
      weekDataCell(sem.indicadorEvaluacion, weekColWidths[4]),
      weekDataCell(sem.instrumentoEvaluacion, weekColWidths[5]),
    ]}));
  });

  function signatureCell(role, name) {
    return new TableCell({
      width: { size: infoTotal / 3, type: WidthType.DXA }, borders: cellBorders,
      children: [
        new Paragraph({ spacing: { before: 400 }, alignment: AlignmentType.CENTER, border: { top: { style: BorderStyle.SINGLE, size: 6, color: '999999' } }, children: [new TextRun({ text: name || ' ', size: 17 })] }),
        new Paragraph({ alignment: AlignmentType.CENTER, children: [new TextRun({ text: role, bold: true, size: 15 })] }),
        new Paragraph({ alignment: AlignmentType.CENTER, children: [new TextRun({ text: `Fecha: ${fmtDate(todayISO())}`, size: 14, color: '6b7280' })] }),
      ],
    });
  }

  const doc = new Document({
    sections: [{
      properties: { page: { size: { orientation: PageOrientation.LANDSCAPE } }, margin: { top: 700, bottom: 700, left: 700, right: 700 } },
      children: [
        new Paragraph({ alignment: AlignmentType.CENTER, children: [new TextRun({ text: db.meta.schoolName, bold: true, size: 22, color: NAVY })] }),
        new Paragraph({ alignment: AlignmentType.CENTER, spacing: { after: 200 }, children: [new TextRun({ text: `${db.meta.location} · "${db.meta.motto}"`, size: 16, color: '6b7280' })] }),
        new Paragraph({ alignment: AlignmentType.CENTER, heading: HeadingLevel.HEADING_2, children: [new TextRun({ text: `PUD ${plan.unidadNumero} — ${db.meta.currentPeriodLabel} ${db.meta.yearLabel}`, bold: true, color: NAVY })] }),
        new Paragraph({ alignment: AlignmentType.CENTER, spacing: { after: 200 }, children: [new TextRun({ text: 'PLAN DE UNIDAD DIDÁCTICA — DATOS INFORMATIVOS', bold: true, size: 18 })] }),
        new Table({ width: { size: infoTotal, type: WidthType.DXA }, columnWidths: infoColWidths, rows: [
          labelRow('DOCENTE', teacher ? teacher.name : ''),
          labelRow('ÁREA', subject.name),
          labelRow('ASIGNATURA', subject.name),
          labelRow('UNIDAD DIDÁCTICA No.', String(plan.unidadNumero)),
          labelRow('TÍTULO DE LA UNIDAD', plan.tituloUnidad),
          labelRow('CURSO / GRADO', course ? course.level : ''),
          labelRow('PARALELO', course ? course.paralelo : ''),
          labelRow('FECHA DE INICIO', fmtDate(plan.fechaInicio)),
          labelRow('FECHA DE FINALIZACIÓN', fmtDate(plan.fechaFin)),
        ]}),
        ...fieldParagraphs('OBJETIVO DE LA UNIDAD:', plan.objetivoUnidad),
        ...fieldParagraphs('OBJETIVO DE APRENDIZAJE:', plan.objetivoAprendizaje),
        ...fieldParagraphs('EJES TRANSVERSALES:', plan.ejesTransversales),
        ...fieldParagraphs('ESTÁNDAR DE APRENDIZAJE:', plan.estandarAprendizaje),
        new Paragraph({ spacing: { before: 260, after: 120 }, children: [new TextRun({ text: 'PLANIFICACIÓN SEMANAL', bold: true, size: 20, color: NAVY })] }),
        new Table({ width: { size: weekTotal, type: WidthType.DXA }, columnWidths: weekColWidths, rows: [headerRow, ...weekRows] }),
        new Paragraph({ spacing: { before: 400 }, children: [new TextRun({ text: '' })] }),
        new Table({ width: { size: infoTotal, type: WidthType.DXA }, columnWidths: [infoTotal / 3, infoTotal / 3, infoTotal / 3], rows: [
          new TableRow({ children: [
            signatureCell('DOCENTE', teacher ? teacher.name : ''),
            signatureCell('DIRECTOR DE ÁREA', ''),
            signatureCell('VICERRECTOR (E)', ''),
          ]}),
        ]}),
      ],
    }],
  });

  return await Packer.toBlob(doc);
}

window.exportPlanPDF = () => {
  const plan = getPlanForSubject(ui.teacherSubjectId);
  if (!plan) { toast('Guarda la planificación primero.', 'error'); return; }
  const subject = getSubject(plan.subjectId);
  const course = getCourse(subject.courseId);
  const teacher = getTeacher(subject.teacherId);
  document.getElementById('printArea').innerHTML = buildPlanPrintHTML(plan, subject, course, teacher);
  window.print();
};
function buildPlanPrintHTML(plan, subject, course, teacher) {
  const td = 'padding:6px 8px;border:1px solid #ccc;font-size:10.5px;vertical-align:top;';
  const th = 'padding:6px 8px;border:1px solid #ccc;font-size:10px;background:#1e3a5f;color:#fff;text-align:center;';
  const infoRow = (label, value) => `<tr><td style="${td}background:#f1f5f9;font-weight:700;width:22%;">${escapeHtml(label)}</td><td style="${td}">${escapeHtml(value || '—')}</td></tr>`;
  const activitiesHTML = (sem) => {
    const html = [['Experiencia', sem.experiencia], ['Reflexión', sem.reflexion], ['Conceptualización', sem.conceptualizacion], ['Aplicación', sem.aplicacion]]
      .filter(([, text]) => text)
      .map(([label, text]) => `<div style="margin-bottom:4px;"><b style="color:#1e3a5f;">${escapeHtml(label)}:</b> ${escapeHtml(text)}</div>`)
      .join('');
    return html || '—';
  };
  const weekRows = plan.semanas.map(sem => `
    <tr><td colspan="6" style="${td}background:#fdece0;font-weight:700;color:#c25e17;">SEMANA ${sem.numero}: ${fmtDate(sem.fechaInicio)} – ${fmtDate(sem.fechaFin)}</td></tr>
    <tr>
      <td style="${td}">${escapeHtml(sem.temaConceptos || '—')}</td>
      <td style="${td}">${escapeHtml(sem.destrezas || '—')}</td>
      <td style="${td}">${activitiesHTML(sem)}</td>
      <td style="${td}">${escapeHtml(sem.recursos || '—')}</td>
      <td style="${td}">${escapeHtml(sem.indicadorEvaluacion || '—')}</td>
      <td style="${td}">${escapeHtml(sem.instrumentoEvaluacion || '—')}</td>
    </tr>
  `).join('');
  return `
    <div style="font-family:'Inter',sans-serif;color:#1f2937;">
      <div style="text-align:center;border-bottom:3px solid #1e3a5f;padding-bottom:10px;margin-bottom:14px;">
        <div style="font-family:'Quicksand',sans-serif;font-weight:700;font-size:16px;color:#16304d;">${escapeHtml(db.meta.schoolName)}</div>
        <div style="font-size:11px;color:#6b7280;">${escapeHtml(db.meta.location)} · "${escapeHtml(db.meta.motto)}"</div>
        <div style="font-family:'Quicksand',sans-serif;font-weight:700;font-size:14px;color:#16304d;margin-top:8px;">PUD ${escapeHtml(String(plan.unidadNumero))} — ${escapeHtml(db.meta.currentPeriodLabel)} ${escapeHtml(db.meta.yearLabel)}</div>
        <div style="font-size:11px;color:#6b7280;">Plan de Unidad Didáctica — Datos Informativos</div>
      </div>
      <table style="width:100%;border-collapse:collapse;margin-bottom:14px;">
        ${infoRow('DOCENTE', teacher ? teacher.name : '')}
        ${infoRow('ÁREA', subject.name)}
        ${infoRow('ASIGNATURA', subject.name)}
        ${infoRow('UNIDAD DIDÁCTICA No.', String(plan.unidadNumero))}
        ${infoRow('TÍTULO DE LA UNIDAD', plan.tituloUnidad)}
        ${infoRow('CURSO / GRADO', course ? course.level : '')}
        ${infoRow('PARALELO', course ? course.paralelo : '')}
        ${infoRow('FECHA DE INICIO', fmtDate(plan.fechaInicio))}
        ${infoRow('FECHA DE FINALIZACIÓN', fmtDate(plan.fechaFin))}
      </table>
      <div style="font-size:10.5px;margin-bottom:8px;"><b>OBJETIVO DE LA UNIDAD:</b> ${escapeHtml(plan.objetivoUnidad || '—')}</div>
      <div style="font-size:10.5px;margin-bottom:8px;"><b>OBJETIVO DE APRENDIZAJE:</b> ${escapeHtml(plan.objetivoAprendizaje || '—')}</div>
      <div style="font-size:10.5px;margin-bottom:8px;"><b>EJES TRANSVERSALES:</b> ${escapeHtml(plan.ejesTransversales || '—')}</div>
      <div style="font-size:10.5px;margin-bottom:14px;"><b>ESTÁNDAR DE APRENDIZAJE:</b> ${escapeHtml(plan.estandarAprendizaje || '—')}</div>
      <div style="font-family:'Quicksand',sans-serif;font-weight:700;font-size:12px;color:#16304d;margin-bottom:6px;">PLANIFICACIÓN SEMANAL</div>
      <table style="width:100%;border-collapse:collapse;margin-bottom:30px;">
        <tr>
          <th style="${th}">Conceptos Esenciales</th>
          <th style="${th}">Destrezas con Criterio de Desempeño</th>
          <th style="${th}">Actividades de Aprendizaje</th>
          <th style="${th}">Recursos</th>
          <th style="${th}">Indicador de Evaluación</th>
          <th style="${th}">Instrumento de Evaluación</th>
        </tr>
        ${weekRows}
      </table>
      <table style="width:100%;border-collapse:collapse;margin-top:50px;">
        <tr>
          <td style="text-align:center;font-size:10.5px;width:33%;">
            <div style="border-top:1px solid #999;padding-top:6px;">${escapeHtml(teacher ? teacher.name : '')}</div>
            <div style="font-weight:700;margin-top:2px;">DOCENTE</div>
            <div style="color:#6b7280;">Fecha: ${fmtDate(todayISO())}</div>
          </td>
          <td style="text-align:center;font-size:10.5px;width:33%;">
            <div style="border-top:1px solid #999;padding-top:6px;">&nbsp;</div>
            <div style="font-weight:700;margin-top:2px;">DIRECTOR DE ÁREA</div>
            <div style="color:#6b7280;">Fecha: ___________</div>
          </td>
          <td style="text-align:center;font-size:10.5px;width:33%;">
            <div style="border-top:1px solid #999;padding-top:6px;">&nbsp;</div>
            <div style="font-weight:700;margin-top:2px;">VICERRECTOR (E)</div>
            <div style="color:#6b7280;">Fecha: ___________</div>
          </td>
        </tr>
      </table>
    </div>
  `;
}

/* ------------------------------ ESTUDIANTE: DASHBOARD ---------------------- */
function subjectCard(studentId, subjectId) {
  const subject = getSubject(subjectId); if (!subject) return '';
  const teacher = getTeacher(subject.teacherId);
  const hue = subjectHue(subject.name);
  const progress = subjectProgress(studentId, subjectId);
  const avg = subjectAverage(studentId, subjectId);
  return `
    <button onclick="window.openSubject('${subjectId}')" class="${CARD} p-5 text-left hover:shadow-md hover:-translate-y-0.5 transition-all">
      <div class="flex items-center justify-between mb-3 gap-2">
        <span class="text-[11px] font-bold ${hue.badge} border px-2 py-0.5 rounded-md uppercase tracking-wide truncate">${escapeHtml(subject.name)}</span>
        <span class="text-sm font-bold text-primary-dark flex-shrink-0">${avg !== null ? avg.toFixed(1) : '—'}</span>
      </div>
      <div class="text-xs text-slate-400 mb-3 truncate">${teacher ? escapeHtml(teacher.name) : 'Sin docente'}</div>
      <div class="w-full h-2 bg-slate-100 rounded-full overflow-hidden">
        <div class="h-full ${hue.bar} rounded-full" style="width:${progress}%"></div>
      </div>
      <div class="text-[11px] text-slate-400 mt-1.5">${progress}% completado</div>
    </button>
  `;
}
function upcomingRow(a) {
  const subject = a.subjectId ? getSubject(a.subjectId) : null;
  const isClase = a.type === 'Clase';
  const overdue = !isClase && a.dueDate < todayISO();
  const dateLabel = a.dueDateEnd ? `${fmtDate(a.dueDate)} – ${fmtDate(a.dueDateEnd)}` : fmtDate(a.dueDate);
  return `
    <div class="flex items-center gap-3 px-5 py-3.5 border-b border-slate-50 last:border-0">
      <div class="w-9 h-9 rounded-lg ${isClase ? 'bg-violet-50 text-violet-600' : overdue ? 'bg-red-50 text-red-500' : 'bg-sky-light text-primary'} flex items-center justify-center text-sm flex-shrink-0">${TYPE_ICON[a.type] || '📝'}</div>
      <div class="min-w-0 flex-1">
        <div class="text-sm font-semibold text-slate-700 truncate">${escapeHtml(a.title)}</div>
        <div class="text-[11px] text-slate-400 truncate">${subject ? escapeHtml(subject.name) : 'General'} · ${escapeHtml(a.type === 'Clase' ? 'Planificación' : a.type)}</div>
      </div>
      <div class="text-right flex-shrink-0">
        <div class="text-xs font-bold ${overdue ? 'text-red-500' : 'text-slate-600'}">${dateLabel}</div>
        ${a.rescheduled ? `<div class="text-[10px] text-accent-dark font-semibold">Reprogramado</div>` : ''}
      </div>
    </div>
  `;
}
function screenStudentDashboard() {
  const student = getStudent(ui.studentId);
  if (!student) return emptyStudentState();
  const course = getCourse(student.courseId);
  const avg = studentOverallAverage(student.id);
  const att = studentAttendancePct(student.id);
  const upcoming = upcomingForStudent(student.id, 5);
  return `
    <div class="mb-6">
      <h1 class="font-display font-bold text-2xl text-primary-dark">Hola, ${escapeHtml(firstName(student.name))} 👋</h1>
      <p class="text-slate-500 text-sm mt-1">${course ? escapeHtml(course.name) : ''} · Año Lectivo ${escapeHtml(db.meta.yearLabel)}</p>
    </div>
    <div class="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-8">
      ${kpiCard('📈', 'Promedio General', avg !== null ? avg.toFixed(1) : '—', 'Sobre 10 puntos')}
      ${kpiCard('✅', 'Asistencia', att !== null ? att + '%' : '—', 'Período actual')}
      ${kpiCard('📚', 'Materias', student.subjectIds.length, 'Matriculadas')}
      ${kpiCard('⏰', 'Por vencer', pendingCountForStudent(student.id), 'Actividades próximas')}
    </div>

    <div class="flex items-center justify-between mb-3">
      <div class="font-display font-bold text-primary-dark">Mis Materias</div>
      <button onclick="window.setStudentScreen('materias')" class="text-xs font-bold text-accent hover:underline">Ver todas →</button>
    </div>
    <div class="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4 mb-8">
      ${student.subjectIds.slice(0, 6).map(id => subjectCard(student.id, id)).join('')}
    </div>

    <div class="font-display font-bold text-primary-dark mb-3">Próximas Actividades</div>
    <div class="${CARD} overflow-hidden">
      ${upcoming.length ? upcoming.map(upcomingRow).join('') : `<div class="p-8 text-center text-sm text-slate-400">No tienes actividades pendientes. ¡Vas al día! 🎉</div>`}
    </div>
  `;
}

/* ---------------------------- ESTUDIANTE: HORARIO --------------------------- */
function screenStudentHorario() {
  const student = getStudent(ui.studentId);
  if (!student) return emptyStudentState();
  const course = getCourse(student.courseId);
  return `
    <div class="mb-6">
      <h1 class="font-display font-bold text-2xl text-primary-dark">Horario y Calendario</h1>
      <p class="text-slate-500 text-sm mt-1">${course ? escapeHtml(course.name) : ''} · Matrícula vigente</p>
    </div>
    <div class="${CARD} p-4 mb-8 overflow-x-auto">
      <div class="min-w-[720px]">
        <div class="grid grid-cols-[110px_repeat(5,1fr)] gap-2 pb-3 mb-2 border-b-2 border-slate-100">
          <div></div>
          ${WEEKDAYS.map(d => `<div class="text-center text-[11px] font-bold text-primary-dark bg-sky-light py-1.5 rounded-md">${WEEKDAY_LABELS[d]}</div>`).join('')}
        </div>
        ${HOUR_ROWS.map(row => `
          <div class="grid grid-cols-[110px_repeat(5,1fr)] gap-2 mb-2">
            <div class="bg-slate-50 border border-slate-200 rounded-lg flex flex-col items-center justify-center py-2">
              <div class="text-xs font-extrabold text-slate-700">${row.label}</div>
              <div class="text-[10px] text-slate-400">${row.time}</div>
            </div>
            ${WEEKDAYS.map(d => {
              if (row.isRecreo) return `<div class="schedule-card sched-recreo flex items-center justify-center text-[11px] font-semibold rounded-lg">Recreo</div>`;
              const entry = db.schedule.find(s => s.courseId === student.courseId && s.day === d && s.hourKey === row.key);
              const subject = entry ? getSubject(entry.subjectId) : null;
              if (!subject) return `<div class="schedule-card sched-recreo rounded-lg"></div>`;
              const hue = subjectHue(subject.name);
              return `<button onclick="window.openSubject('${subject.id}')" class="schedule-card ${hue.sched} text-left px-2.5 py-2 rounded-lg text-[12px] font-bold">${escapeHtml(subject.name)}</button>`;
            }).join('')}
          </div>
        `).join('')}
      </div>
    </div>

    <div class="font-display font-bold text-primary-dark mb-3">Calendario de Actividades</div>
    <div class="${CARD} overflow-hidden">
      ${calendarFeed(student)}
    </div>
  `;
}
function calendarFeed(student) {
  const today = todayISO();
  const items = db.assignments.filter(a => {
    const belongs = a.subjectId ? student.subjectIds.includes(a.subjectId) : a.courseId === student.courseId;
    return belongs && a.dueDate >= addDays(today, -30) && a.dueDate <= addDays(today, 60);
  }).sort((a, b) => a.dueDate.localeCompare(b.dueDate));
  if (!items.length) return `<div class="p-8 text-center text-sm text-slate-400">Sin actividades registradas en este rango.</div>`;
  return items.map(upcomingRow).join('');
}

/* --------------------------- ESTUDIANTE: MATERIAS --------------------------- */
function screenStudentMaterias() {
  const student = getStudent(ui.studentId);
  if (!student) return emptyStudentState();
  return `
    <div class="mb-6">
      <h1 class="font-display font-bold text-2xl text-primary-dark">Mis Materias</h1>
      <p class="text-slate-500 text-sm mt-1">Selecciona una materia para ver calificaciones, recursos y asistencia.</p>
    </div>
    <div class="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
      ${student.subjectIds.map(id => subjectCard(student.id, id)).join('')}
    </div>
  `;
}
window.openSubject = (subjectId) => {
  ui.selectedSubjectId = subjectId;
  ui.subjectTab = 'calificaciones';
  ui.role = 'estudiante';
  ui.studentScreen = 'materias';
  render();
};
window.backToMaterias = () => { ui.selectedSubjectId = null; render(); };
window.setSubjectTab = (t) => { ui.subjectTab = t; render(); };

function screenSubjectDetail() {
  const student = getStudent(ui.studentId);
  const subject = getSubject(ui.selectedSubjectId);
  if (!student || !subject) return emptyStudentState();
  const teacher = getTeacher(subject.teacherId);
  const hue = subjectHue(subject.name);
  const tabs = [
    { id: 'calificaciones', label: 'Calificaciones y Asignaciones' },
    { id: 'recursos', label: 'Recursos de Estudio' },
    { id: 'asistencia', label: 'Asistencia' },
  ];
  return `
    <button onclick="window.backToMaterias()" class="text-xs font-bold text-slate-500 hover:text-primary mb-4 inline-flex items-center gap-1">← Volver a Mis Materias</button>
    <span class="text-[11px] font-bold ${hue.badge} border px-2 py-0.5 rounded-md uppercase">${escapeHtml(subject.name)}</span>
    <h1 class="font-display font-bold text-2xl text-primary-dark mt-2 mb-1">${escapeHtml(subject.name)}</h1>
    <p class="text-slate-500 text-sm mb-6">${teacher ? escapeHtml(teacher.name) : 'Sin docente asignado'}</p>

    <div class="flex gap-1 border-b border-slate-200 mb-6 overflow-x-auto">
      ${tabs.map(t => `
        <button onclick="window.setSubjectTab('${t.id}')" class="px-4 py-2.5 text-sm font-semibold whitespace-nowrap border-b-2 -mb-px transition-colors ${ui.subjectTab === t.id ? 'border-accent text-primary-dark' : 'border-transparent text-slate-400 hover:text-slate-600'}">${t.label}</button>
      `).join('')}
    </div>

    ${ui.subjectTab === 'calificaciones' ? tabCalificaciones(student, subject) : ''}
    ${ui.subjectTab === 'recursos' ? tabRecursos(subject) : ''}
    ${ui.subjectTab === 'asistencia' ? tabAsistencia(student, subject) : ''}
  `;
}
const STATUS_STYLE = {
  pendiente: 'bg-amber-50 text-amber-700 border-amber-200',
  entregado: 'bg-blue-50 text-blue-700 border-blue-200',
  calificado: 'bg-emerald-50 text-emerald-700 border-emerald-200',
};
function tabCalificaciones(student, subject) {
  const asgs = assignmentsOfSubject(subject.id);
  return `
    <div class="flex flex-col gap-3">
      ${asgs.map(a => {
        const sub = submissionsOf(a.id, student.id);
        if (!sub) return '';
        return `
        <div class="${CARD} p-5">
          <div class="flex items-start justify-between gap-3 flex-wrap mb-2">
            <div>
              <div class="font-display font-bold text-primary-dark text-[15px]">${escapeHtml(a.title)}</div>
              <div class="text-xs text-slate-400 mt-0.5">${escapeHtml(a.type)} · Vence: ${fmtDate(a.dueDate)} ${a.rescheduled ? `<span class="text-accent-dark font-semibold">(reprogramado, antes ${fmtDate(a.originalDueDate)})</span>` : ''}</div>
            </div>
            <span class="text-[11px] font-bold border px-2.5 py-1 rounded-full flex-shrink-0 ${STATUS_STYLE[sub.status]}">${capitalize(sub.status)}</span>
          </div>
          <p class="text-xs text-slate-500 mb-3">${escapeHtml(a.description || '')}</p>
          ${sub.status === 'calificado' ? `
            <div class="flex items-center gap-4 bg-slate-50 rounded-lg p-3">
              <div class="text-xl font-display font-bold text-primary-dark">${sub.grade.toFixed(1)}<span class="text-xs text-slate-400 font-sans font-normal">/10</span></div>
              <div class="text-xs text-slate-500 flex-1">${escapeHtml(sub.feedback || '')}</div>
            </div>
          ` : ''}
          ${sub.status === 'entregado' ? `<div class="text-xs text-blue-600 font-semibold mt-1">✓ Entregado — pendiente de calificación</div>${sub.submittedText ? `<div class="text-xs text-slate-500 italic mt-1">Tu entrega: "${escapeHtml(sub.submittedText)}"</div>` : ''}` : ''}
          ${sub.status === 'pendiente' ? `
            <div class="mt-2">
              <textarea id="hw-text-${a.id}" placeholder="Escribe tu respuesta o pega el enlace de tu trabajo..." class="${INPUT} h-20 resize-none mb-2"></textarea>
              <button onclick="window.submitHomework('${a.id}')" class="${BTN_PRIMARY} text-xs px-4 py-2">Enviar Entrega</button>
            </div>
          ` : ''}
        </div>`;
      }).join('')}
      ${!asgs.length ? `<div class="${CARD} p-8 text-center text-sm text-slate-400">Sin asignaciones registradas.</div>` : ''}
    </div>
  `;
}
window.submitHomework = (assignmentId) => {
  const textEl = document.getElementById(`hw-text-${assignmentId}`);
  const text = textEl ? textEl.value.trim() : '';
  if (!text) { toast('Escribe una respuesta antes de enviar.', 'error'); return; }
  const sub = submissionsOf(assignmentId, ui.studentId);
  if (!sub) return;
  sub.status = 'entregado';
  sub.submittedText = text;
  sub.submittedAt = todayISO();
  saveDB();
  toast('Tarea entregada con éxito.');
  render();
};
function tabRecursos(subject) {
  const resources = db.resources.filter(r => r.subjectId === subject.id);
  return `
    <div class="grid grid-cols-1 sm:grid-cols-2 gap-4">
      ${resources.map(r => `
        <div class="${CARD} p-5 flex flex-col gap-2">
          <div class="w-full h-28 rounded-lg bg-gradient-to-br from-primary to-primary-light flex items-center justify-center relative overflow-hidden">
            <div class="w-12 h-12 rounded-full bg-white/20 flex items-center justify-center">
              <div class="w-0 h-0 border-y-[8px] border-y-transparent border-l-[13px] border-l-white ml-1"></div>
            </div>
            <span class="absolute bottom-2 left-3 text-[10px] text-white/70 font-mono">${r.type === 'video' ? 'video de repaso · demo' : 'enlace de apoyo · demo'}</span>
          </div>
          <div class="font-display font-bold text-primary-dark text-[14px]">${escapeHtml(r.title)}</div>
          <p class="text-xs text-slate-500 flex-1">${escapeHtml(r.description)}</p>
          <button onclick="window.openResourceDemo()" class="text-xs font-bold text-accent hover:underline text-left">${r.type === 'video' ? '▶ Ver video' : '🔗 Abrir enlace'}</button>
        </div>
      `).join('')}
      ${!resources.length ? `<div class="${CARD} p-8 text-center text-sm text-slate-400 sm:col-span-2">El docente aún no ha publicado recursos para esta materia.</div>` : ''}
    </div>
  `;
}
window.openResourceDemo = () => toast('Este es un recurso de demostración — en producción abriría el material real.');

const ATT_STYLE = { presente: 'bg-emerald-50 text-emerald-700', falta: 'bg-red-50 text-red-600', atraso: 'bg-amber-50 text-amber-700', justificado: 'bg-blue-50 text-blue-700' };
const ATT_LABEL = { presente: 'Presente', falta: 'Falta', atraso: 'Atraso', justificado: 'Justificado' };
function tabAsistencia(student, subject) {
  const records = attendanceOf(student.id, subject.id);
  const pct = subjectAttendancePct(student.id, subject.id);
  return `
    <div class="${CARD} p-5 mb-5 flex items-center gap-5">
      <div class="text-3xl font-display font-bold text-primary-dark">${pct !== null ? pct + '%' : '—'}</div>
      <div class="text-xs text-slate-500">Asistencia acumulada en ${escapeHtml(subject.name)} (${records.length} clases registradas)</div>
    </div>
    <div class="${CARD} overflow-hidden">
      <div class="grid grid-cols-[1fr_110px_1fr_90px] gap-2 px-5 py-3 text-[11px] font-bold text-slate-400 uppercase border-b border-slate-100 bg-slate-50">
        <div>Fecha</div><div>Estado</div><div>Justificación</div><div></div>
      </div>
      ${records.map(r => `
        <div class="grid grid-cols-[1fr_110px_1fr_90px] gap-2 px-5 py-3 items-center border-b border-slate-50 text-sm">
          <div class="text-slate-600">${fmtDate(r.date)}</div>
          <div><span class="text-[11px] font-bold px-2 py-0.5 rounded-md ${ATT_STYLE[r.status]}">${ATT_LABEL[r.status]}</span></div>
          <div class="text-xs text-slate-500 truncate">${r.justification ? escapeHtml(r.justification) : '—'}</div>
          <div>${r.status === 'falta' ? `<button onclick="window.openJustifyModal('${r.id}')" class="text-xs font-bold text-accent hover:underline">Justificar</button>` : ''}</div>
        </div>
      `).join('')}
      ${!records.length ? `<div class="p-8 text-center text-sm text-slate-400">Sin registros de asistencia.</div>` : ''}
    </div>
  `;
}
window.openJustifyModal = (attendanceId) => { ui.justifyModalOpen = true; ui.justifyAttendanceId = attendanceId; render(); };
window.closeJustifyModal = () => { ui.justifyModalOpen = false; render(); };
window.saveJustification = () => {
  const text = document.getElementById('jf-text').value.trim();
  if (!text) { toast('Escribe una justificación.', 'error'); return; }
  const rec = db.attendance.find(a => a.id === ui.justifyAttendanceId);
  if (rec) { rec.status = 'justificado'; rec.justification = text; saveDB(); }
  ui.justifyModalOpen = false;
  toast('Falta justificada correctamente.');
  render();
};
function justifyModalHTML() {
  return `
  <div class="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/50 anim-fade" onclick="if(event.target===this) window.closeJustifyModal()">
    <div class="bg-white rounded-2xl w-full max-w-sm p-6 anim-popin">
      <div class="font-display font-bold text-lg text-primary-dark mb-1">Justificar Falta</div>
      <p class="text-xs text-slate-500 mb-4">Explica brevemente el motivo de la inasistencia.</p>
      <textarea id="jf-text" class="${INPUT} h-24 resize-none mb-4" placeholder="Ej. Cita médica, certificado adjunto..."></textarea>
      <div class="flex gap-3">
        <button onclick="window.closeJustifyModal()" class="${BTN_SECONDARY} flex-1">Cancelar</button>
        <button onclick="window.saveJustification()" class="${BTN_PRIMARY} flex-1">Guardar</button>
      </div>
    </div>
  </div>`;
}

/* -------------------------- ESTUDIANTE: MENSAJERÍA -------------------------- */
function screenStudentMensajeria() {
  const student = getStudent(ui.studentId);
  if (!student) return emptyStudentState();
  const teacherIds = [...new Set(student.subjectIds.map(id => (getSubject(id) || {}).teacherId).filter(Boolean))];
  if (!ui.chatTeacherId || !teacherIds.includes(ui.chatTeacherId)) ui.chatTeacherId = teacherIds[0] || null;
  const activeTeacher = ui.chatTeacherId ? getTeacher(ui.chatTeacherId) : null;
  const messages = ui.chatTeacherId ? db.messages.filter(m => m.studentId === student.id && m.teacherId === ui.chatTeacherId) : [];
  return `
    <div class="mb-6">
      <h1 class="font-display font-bold text-2xl text-primary-dark">Mensajería Interna</h1>
      <p class="text-slate-500 text-sm mt-1">Canal directo con tus docentes.</p>
    </div>
    <div class="${CARD} grid grid-cols-1 sm:grid-cols-[220px_1fr] h-[560px] overflow-hidden">
      <div class="border-b sm:border-b-0 sm:border-r border-slate-100 bg-slate-50 overflow-x-auto sm:overflow-y-auto flex sm:flex-col flex-shrink-0">
        ${teacherIds.map(tid => {
          const t = getTeacher(tid);
          const subjectNames = db.subjects.filter(s => s.teacherId === tid && student.subjectIds.includes(s.id)).map(s => s.name).join(', ');
          return `<button onclick="window.selectChatTeacher('${tid}')" class="text-left px-4 py-3 flex-shrink-0 sm:border-b border-slate-100 min-w-[160px] sm:min-w-0 ${ui.chatTeacherId === tid ? 'bg-white border-l-4 border-l-accent' : 'border-l-4 border-l-transparent hover:bg-white/60'}">
            <div class="text-sm font-semibold text-slate-700 truncate">${t ? escapeHtml(t.name) : ''}</div>
            <div class="text-[11px] text-slate-400 truncate">${escapeHtml(subjectNames)}</div>
          </button>`;
        }).join('') || `<div class="p-4 text-xs text-slate-400">Sin docentes asignados.</div>`}
      </div>
      <div class="flex flex-col min-w-0">
        <div class="px-5 py-3.5 border-b border-slate-100 font-display font-bold text-primary-dark text-sm">${activeTeacher ? escapeHtml(activeTeacher.name) : 'Selecciona un docente'}</div>
        <div id="chat-scroll" class="flex-1 overflow-y-auto p-5 flex flex-col gap-3 bg-slate-50/50">
          ${messages.length ? messages.map(m => `
            <div class="max-w-[75%] px-4 py-2.5 rounded-2xl text-[13px] leading-snug ${m.sender === 'student' ? 'self-end bg-primary text-white rounded-br-sm' : 'self-start bg-white border border-slate-200 text-slate-700 rounded-bl-sm'}">
              <div>${escapeHtml(m.text)}</div>
              <div class="text-[10px] mt-1 ${m.sender === 'student' ? 'text-white/60' : 'text-slate-400'}">${escapeHtml(m.time)}</div>
            </div>
          `).join('') : `<div class="m-auto text-xs text-slate-400">Aún no hay mensajes. ¡Escribe el primero!</div>`}
        </div>
        <div class="p-3.5 border-t border-slate-100 flex gap-2">
          <input id="chat-input" type="text" placeholder="Escribe un mensaje…" onkeydown="if(event.key==='Enter'){event.preventDefault();window.sendMessage();}" class="${INPUT}" ${activeTeacher ? '' : 'disabled'} />
          <button onclick="window.sendMessage()" class="${BTN_PRIMARY} px-4" ${activeTeacher ? '' : 'disabled'}>Enviar</button>
        </div>
      </div>
    </div>
  `;
}
window.selectChatTeacher = (id) => { ui.chatTeacherId = id; render(); };
function scrollChatToBottom() {
  const el = document.getElementById('chat-scroll');
  if (el) el.scrollTop = el.scrollHeight;
}
const CANNED_REPLIES = ['Recibido, gracias por avisar.', 'Claro, lo revisamos en la próxima clase.', 'Perfecto, quedo pendiente.', 'Gracias por tu mensaje, te respondo con más detalle pronto.'];
window.sendMessage = () => {
  const input = document.getElementById('chat-input');
  const text = input.value.trim();
  if (!text || !ui.chatTeacherId) return;
  const studentId = ui.studentId, teacherId = ui.chatTeacherId;
  db.messages.push({ id: uid('msg'), studentId, teacherId, sender: 'student', text, time: nowLabel() });
  saveDB();
  render();
  scrollChatToBottom();
  setTimeout(() => {
    db.messages.push({ id: uid('msg'), studentId, teacherId, sender: 'teacher', text: CANNED_REPLIES[Math.floor(Math.random() * CANNED_REPLIES.length)], time: nowLabel() });
    saveDB();
    if (ui.role === 'estudiante' && ui.studentScreen === 'mensajeria' && ui.studentId === studentId && ui.chatTeacherId === teacherId) {
      render();
      scrollChatToBottom();
    }
  }, 1400);
};

/* --------------------------- ESTUDIANTE: REPORTE ---------------------------- */
function screenStudentReporte() {
  const student = getStudent(ui.studentId);
  if (!student) return emptyStudentState();
  const course = getCourse(student.courseId);
  const avg = studentOverallAverage(student.id);
  const att = studentAttendancePct(student.id);
  return `
    <div class="mb-6 flex items-start justify-between flex-wrap gap-3">
      <div>
        <h1 class="font-display font-bold text-2xl text-primary-dark">Reporte Académico</h1>
        <p class="text-slate-500 text-sm mt-1">Genera el boletín oficial en PDF para ${escapeHtml(student.name)}.</p>
      </div>
      <button onclick="window.printStudentReport()" class="${BTN_PRIMARY}">🖨️ Imprimir / Descargar PDF</button>
    </div>
    <div class="${CARD} p-6 mb-6">
      <div class="grid grid-cols-2 sm:grid-cols-4 gap-4">
        <div><div class="text-[11px] font-bold text-slate-400 uppercase">Estudiante</div><div class="text-sm font-semibold text-slate-700 mt-1">${escapeHtml(student.name)}</div></div>
        <div><div class="text-[11px] font-bold text-slate-400 uppercase">Curso</div><div class="text-sm font-semibold text-slate-700 mt-1">${course ? escapeHtml(course.name) : ''}</div></div>
        <div><div class="text-[11px] font-bold text-slate-400 uppercase">Promedio</div><div class="text-sm font-semibold text-slate-700 mt-1">${avg !== null ? avg.toFixed(1) : '—'}</div></div>
        <div><div class="text-[11px] font-bold text-slate-400 uppercase">Asistencia</div><div class="text-sm font-semibold text-slate-700 mt-1">${att !== null ? att + '%' : '—'}</div></div>
      </div>
    </div>
    <div class="${CARD} overflow-hidden">
      <div class="grid grid-cols-[1.4fr_1fr_0.7fr_0.7fr_0.9fr] gap-2 px-5 py-3 text-[11px] font-bold text-slate-400 uppercase border-b border-slate-100 bg-slate-50">
        <div>Materia</div><div>Docente</div><div>Promedio</div><div>Asistencia</div><div>Estado</div>
      </div>
      ${student.subjectIds.map(id => {
        const subject = getSubject(id); if (!subject) return '';
        const teacher = getTeacher(subject.teacherId);
        const savg = subjectAverage(student.id, id);
        const satt = subjectAttendancePct(student.id, id);
        const approved = savg === null || savg >= 7;
        return `<div class="grid grid-cols-[1.4fr_1fr_0.7fr_0.7fr_0.9fr] gap-2 px-5 py-3 items-center border-b border-slate-50 text-sm">
          <div class="font-semibold text-slate-700 truncate">${escapeHtml(subject.name)}</div>
          <div class="text-slate-500 text-xs truncate">${teacher ? escapeHtml(teacher.name) : '—'}</div>
          <div class="font-bold text-primary-dark">${savg !== null ? savg.toFixed(1) : '—'}</div>
          <div class="text-slate-600">${satt !== null ? satt + '%' : '—'}</div>
          <div><span class="text-[11px] font-bold px-2 py-0.5 rounded-md ${approved ? 'bg-emerald-50 text-emerald-700' : 'bg-red-50 text-red-600'}">${approved ? 'Aprobado' : 'En riesgo'}</span></div>
        </div>`;
      }).join('')}
    </div>
  `;
}
window.printStudentReport = () => {
  const student = getStudent(ui.studentId);
  if (!student) { toast('Selecciona un estudiante primero.', 'error'); return; }
  document.getElementById('printArea').innerHTML = buildPrintReport(student);
  window.print();
};
function buildPrintReport(student) {
  const course = getCourse(student.courseId);
  const avg = studentOverallAverage(student.id);
  const att = studentAttendancePct(student.id);
  const rows = student.subjectIds.map(id => {
    const subject = getSubject(id); if (!subject) return '';
    const teacher = getTeacher(subject.teacherId);
    const savg = subjectAverage(student.id, id);
    const approved = savg === null || savg >= 7;
    return `<tr>
      <td style="padding:8px;border:1px solid #ddd;">${escapeHtml(subject.name)}</td>
      <td style="padding:8px;border:1px solid #ddd;">${teacher ? escapeHtml(teacher.name) : '—'}</td>
      <td style="padding:8px;border:1px solid #ddd;text-align:center;">${savg !== null ? savg.toFixed(1) : '—'}</td>
      <td style="padding:8px;border:1px solid #ddd;text-align:center;">${approved ? 'Aprobado' : 'En riesgo'}</td>
    </tr>`;
  }).join('');
  return `
    <div style="font-family:'Inter',sans-serif;color:#1f2937;">
      <div style="display:flex;align-items:center;gap:14px;border-bottom:3px solid #1e3a5f;padding-bottom:14px;margin-bottom:18px;">
        <img src="assets/logo-andoas.jpg" style="width:60px;height:60px;border-radius:50%;object-fit:cover;" />
        <div>
          <div style="font-family:'Quicksand',sans-serif;font-weight:700;font-size:17px;color:#16304d;">${escapeHtml(db.meta.schoolName)}</div>
          <div style="font-size:11px;color:#6b7280;">${escapeHtml(db.meta.location)} · Fundada en ${db.meta.founded} · "${escapeHtml(db.meta.motto)}"</div>
        </div>
        <div style="margin-left:auto;text-align:right;">
          <div style="font-family:'Quicksand',sans-serif;font-weight:700;font-size:15px;color:#16304d;">Boletín Académico</div>
          <div style="font-size:11px;color:#6b7280;">Año lectivo ${escapeHtml(db.meta.yearLabel)}</div>
        </div>
      </div>
      <div style="display:grid;grid-template-columns:repeat(4,1fr);gap:10px;margin-bottom:18px;font-size:12px;">
        <div><b>Estudiante:</b><br>${escapeHtml(student.name)}</div>
        <div><b>Matrícula:</b><br>${escapeHtml(student.matricula)}</div>
        <div><b>Curso:</b><br>${course ? escapeHtml(course.name) : ''}</div>
        <div><b>Fecha de emisión:</b><br>${fmtDate(todayISO())}</div>
      </div>
      <table style="width:100%;border-collapse:collapse;font-size:12px;margin-bottom:18px;">
        <thead><tr style="background:#f1f5f9;">
          <th style="padding:8px;border:1px solid #ddd;text-align:left;">Materia</th>
          <th style="padding:8px;border:1px solid #ddd;text-align:left;">Docente</th>
          <th style="padding:8px;border:1px solid #ddd;">Promedio</th>
          <th style="padding:8px;border:1px solid #ddd;">Estado</th>
        </tr></thead>
        <tbody>${rows}</tbody>
      </table>
      <div style="display:flex;gap:30px;font-size:13px;margin-bottom:40px;">
        <div><b>Promedio general:</b> ${avg !== null ? avg.toFixed(1) : '—'} / 10</div>
        <div><b>Asistencia general:</b> ${att !== null ? att + '%' : '—'}</div>
      </div>
      <div style="display:flex;justify-content:space-between;margin-top:60px;font-size:11px;color:#6b7280;">
        <div style="border-top:1px solid #999;width:220px;text-align:center;padding-top:6px;">Firma Docente Tutor</div>
        <div style="border-top:1px solid #999;width:220px;text-align:center;padding-top:6px;">Firma Secretaría</div>
      </div>
    </div>
  `;
}

/* ---------------------------------- MODALES -------------------------------- */
function renderModal() {
  const el = document.getElementById('modal-root');
  if (ui.studentModalOpen) { el.innerHTML = studentModalHTML(); return; }
  if (ui.teacherModalOpen) { el.innerHTML = teacherModalHTML(); return; }
  if (ui.justifyModalOpen) { el.innerHTML = justifyModalHTML(); return; }
  if (ui.obsModalOpen) { el.innerHTML = obsModalHTML(); return; }
  if (ui.assignmentModalOpen) { el.innerHTML = assignmentModalHTML(); return; }
  el.innerHTML = '';
}

/* ------------------------------- NAVEGACIÓN --------------------------------- */
window.setAdminScreen = (s) => { ui.adminScreen = s; ui.sidebarOpen = false; if (s !== 'revision') ui.reviewingPlanId = null; render(); };
window.setStudentScreen = (s) => { ui.studentScreen = s; ui.selectedSubjectId = null; ui.sidebarOpen = false; render(); };
window.setRole = (r) => { ui.role = r; ui.sidebarOpen = false; render(); };
window.selectStudent = (id) => { ui.studentId = id; ui.selectedSubjectId = null; ui.chatTeacherId = null; render(); };
window.toggleSidebar = (v) => { ui.sidebarOpen = v; render(); };
window.confirmResetDB = () => {
  if (!confirm('Esto borrará todos los datos actuales y restaurará el ejemplo inicial. ¿Continuar?')) return;
  localStorage.removeItem(DB_KEY);
  seedDB();
  saveDB();
  ui.studentId = db.students[0] ? db.students[0].id : null;
  ui.selectedSubjectId = null;
  ui.teacherId = db.teachers[0] ? db.teachers[0].id : null;
  ui.teacherSubjectId = null;
  ui.teacherAssignmentId = null;
  ui.teacherChatStudentId = null;
  toast('Datos de ejemplo restaurados.');
  render();
};

/* ----------------------------------- INIT ----------------------------------- */
document.addEventListener('DOMContentLoaded', () => {
  loadDB();
  ui.studentId = db.students[0] ? db.students[0].id : null;
  ui.teacherId = db.teachers[0] ? db.teachers[0].id : null;
  render();
});
