/* =========================================================================
   AulaConecta — prototipo v3: cambios por la retroalimentación (10/11/2026)
   - Inicio de sesión con clave temporal de un solo uso (RF-03, RN-13) y
     bloqueo tras 3 intentos (RNF-12).
   - Cinco roles: Administrador, Secretaría, Docente, Estudiante y Representante.
   - Avisos por niveles (CR-01): push automático y WhatsApp con un clic,
     solo 3 mensajes y sin la nota exacta (RF-29 a RF-35).
   - Paginación y filtros en los listados (RF-39).
   - Trabajo sin conexión con cola de cambios y resolución de conflictos (RNF-01, RN-15).
   Todos los datos son ficticios y se guardan en el navegador.
   ========================================================================= */

const CLAVE_DEMO = 'Andoas2026';
const HORAS_CLAVE_TEMPORAL = 72;
const MAX_INTENTOS = 3;
const MINUTOS_BLOQUEO = 15;

const ROLES = {
  admin: 'Administrador',
  secretaria: 'Secretaría',
  docente: 'Docente',
  estudiante: 'Estudiante',
  representante: 'Representante',
};
const SECRETARIA_TITLES = { estudiantes: 'Matrícula de Estudiantes', contactos: 'Representantes y Autorizaciones', cuentas: 'Cuentas y Accesos' };
const REP_TITLES = { resumen: 'Mi Representado', avisos: 'Avisos Recibidos', consentimiento: 'Consentimiento de Avisos' };
ADMIN_TITLES.avisos = 'Historial de Avisos';
ADMIN_TITLES.cuentas = 'Cuentas y Accesos';
TEACHER_TITLES.avisos = 'Avisos a Representantes';

const MOTIVOS = {
  confirmacion_autorizacion: { label: 'Confirmación de autorización', icon: '✅' },
  promedio_bajo: { label: 'Promedio menor a 7', icon: '📉' },
  falta_sin_justificar: { label: 'Falta sin justificar', icon: '🚫' },
};
const ESTADOS_AVISO = {
  en_cola: { label: 'En cola (sin conexión)', cls: 'bg-amber-50 text-amber-700 border-amber-200' },
  entregado: { label: 'Entregado', cls: 'bg-emerald-50 text-emerald-700 border-emerald-200' },
  sin_autorizacion: { label: 'No enviado: sin autorización', cls: 'bg-slate-100 text-slate-600 border-slate-200' },
  baja: { label: 'No enviado: dado de baja', cls: 'bg-slate-100 text-slate-600 border-slate-200' },
};

Object.assign(ui, {
  session: null,
  login: { usuario: '', clave: '', error: '' },
  activando: null,
  secretariaScreen: 'estudiantes',
  repScreen: 'resumen',
  offline: false,
  pag: {},
  filtros: {},
  waAvisoId: null,
  credenciales: null,
  conflicto: null,
});

/* ------------------------------ MIGRACIÓN ------------------------------ */
function apellidoDe(nombre) {
  const p = (nombre || '').replace(/^(Lic\.|Ing\.|Prof\.|Dr\.|Dra\.)\s+/i, '').split(/\s+/).filter(Boolean);
  return p.length >= 4 ? p[2] : (p[1] || p[0] || '');
}
function primerNombre(nombre) {
  const p = (nombre || '').replace(/^(Lic\.|Ing\.|Prof\.|Dr\.|Dra\.)\s+/i, '').split(/\s+/).filter(Boolean);
  return p[0] || 'usuario';
}
function sinTildes(s) { return (s || '').normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase().replace(/[^a-z]/g, ''); }

// RN-11: nombre.apellido en minúsculas; si existe se agrega un número
function generarUsuario(nombre) {
  const base = `${sinTildes(primerNombre(nombre))}.${sinTildes(apellidoDe(nombre))}`;
  let u = base, n = 2;
  while (db.cuentas.some(c => c.usuario === u)) u = base + n++;
  return u;
}
// RN-13: clave temporal aleatoria (no se usa la cédula)
function generarClaveTemporal() {
  const letras = 'ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnpqrstuvwxyz23456789';
  const bytes = new Uint32Array(10);
  crypto.getRandomValues(bytes);
  const s = [...bytes].map(b => letras[b % letras.length]).join('');
  return `${s.slice(0, 4)}-${s.slice(4, 7)}-${s.slice(7)}`;
}
function crearCuenta(rol, personaId, nombre, activa) {
  const cuenta = {
    id: uid('cta'), usuario: generarUsuario(nombre), rol, personaId, nombre,
    clave: activa ? CLAVE_DEMO : null,
    claveTemporal: activa ? null : generarClaveTemporal(),
    venceTemporal: activa ? null : new Date(Date.now() + HORAS_CLAVE_TEMPORAL * 3600e3).toISOString(),
    intentos: 0, bloqueadaHasta: null, creadaEn: new Date().toISOString(),
  };
  db.cuentas.push(cuenta);
  return cuenta;
}
function telefonoFicticio(i) { return '09' + String(80000000 + ((i * 7919) % 9999999)).padStart(8, '0'); }

function asegurarV3() {
  let cambio = false;
  if (!db.representantes) {
    const nombresRep = ['María', 'José', 'Rosa', 'Luis', 'Carmen', 'Jorge', 'Patricia', 'Miguel', 'Lucía', 'Fernando'];
    db.representantes = db.students.map((st, i) => ({
      id: uid('rep'), nombre: `${nombresRep[i % nombresRep.length]} ${apellidoDe(st.name)}`, parentesco: i % 3 === 0 ? 'Padre' : 'Madre',
      telefono: telefonoFicticio(i + 1), studentIds: [st.id],
      // Algunos representantes sin autorización para mostrar la regla RN-06
      autorizado: i % 6 !== 4, verificado: i % 6 !== 4, baja: false,
    }));
    cambio = true;
  }
  if (!db.avisos) { db.avisos = []; cambio = true; }
  if (!db.colaSync) { db.colaSync = []; cambio = true; }
  if (!db.conflictos) { db.conflictos = []; cambio = true; }
  if (!db.secretaria) { db.secretaria = { id: 'sec_1', name: 'Rosa Paredes' }; cambio = true; }
  if (!db.cuentas) {
    db.cuentas = [];
    crearCuenta('admin', 'admin', 'Vicerrector Andoas', true).usuario = 'vicerrector';
    crearCuenta('secretaria', db.secretaria.id, db.secretaria.name, true);
    db.teachers.forEach(t => crearCuenta('docente', t.id, t.name, true));
    db.students.forEach((s, i) => crearCuenta('estudiante', s.id, s.name, i !== db.students.length - 1));
    db.representantes.forEach(r => crearCuenta('representante', r.id, r.nombre, true));
    cambio = true;
  }
  if (cambio) saveDB();
}

/* ------------------------------ UTILIDADES ----------------------------- */
function cuentaDe(rol, personaId) { return db.cuentas.find(c => c.rol === rol && c.personaId === personaId); }
function representantesDe(studentId) { return db.representantes.filter(r => r.studentIds.includes(studentId)); }
function getRepresentante(id) { return db.representantes.find(r => r.id === id); }
function fechaHora(iso) { return new Date(iso).toLocaleString('es-EC', { day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit' }); }
function promedioMateria(studentId, subjectId) {
  const e = getGradeEntry(subjectId, studentId);
  if (e) {
    const r = computeGradeEntry(e);
    const v = r.notaFinal !== null ? r.notaFinal : (r.promedioConRef !== null ? r.promedioConRef : r.promedioGeneral);
    if (v !== null) return v;
  }
  return subjectAverage(studentId, subjectId);
}
function estadoCuenta(c) {
  if (c.bloqueadaHasta && new Date(c.bloqueadaHasta) > new Date()) return { label: 'Bloqueada 15 min', cls: 'bg-red-50 text-red-700 border-red-200' };
  if (c.clave) return { label: 'Activa', cls: 'bg-emerald-50 text-emerald-700 border-emerald-200' };
  if (c.claveTemporal && new Date(c.venceTemporal) < new Date()) return { label: 'Clave temporal vencida', cls: 'bg-amber-50 text-amber-700 border-amber-200' };
  return { label: 'Pendiente de activar', cls: 'bg-sky-light text-primary-dark border-sky' };
}
function badge(texto, cls) { return `<span class="inline-block text-[11px] font-bold px-2 py-0.5 rounded-md border ${cls}">${escapeHtml(texto)}</span>`; }

/* ------------------------- PAGINACIÓN Y FILTROS (RF-39) ------------------------- */
function filtro(clave) { return ui.filtros[clave] || (ui.filtros[clave] = {}); }
function paginar(lista, clave) {
  const p = ui.pag[clave] || (ui.pag[clave] = { pagina: 1, tamano: 20 });
  const total = lista.length;
  const paginas = Math.max(1, Math.ceil(total / p.tamano));
  if (p.pagina > paginas) p.pagina = paginas;
  const ini = (p.pagina - 1) * p.tamano;
  const items = lista.slice(ini, ini + p.tamano);
  const controles = `<div class="flex items-center justify-between gap-3 flex-wrap px-5 py-3 border-t border-slate-100 bg-slate-50 text-xs text-slate-500">
    <div>${total ? `Mostrando <b>${ini + 1}–${ini + items.length}</b> de <b>${total}</b>` : 'Sin resultados'}</div>
    <div class="flex items-center gap-2">
      <label>Por página</label>
      <select onchange="window.setTamanoPagina('${clave}', this.value)" class="border border-slate-300 rounded-md px-2 py-1 bg-white">
        ${[20, 50, 100].map(n => `<option ${n === p.tamano ? 'selected' : ''}>${n}</option>`).join('')}
      </select>
      <button onclick="window.setPagina('${clave}', ${p.pagina - 1})" ${p.pagina <= 1 ? 'disabled' : ''} class="px-2.5 py-1 rounded-md border border-slate-300 bg-white disabled:opacity-40">‹</button>
      <span>Página ${p.pagina} de ${paginas}</span>
      <button onclick="window.setPagina('${clave}', ${p.pagina + 1})" ${p.pagina >= paginas ? 'disabled' : ''} class="px-2.5 py-1 rounded-md border border-slate-300 bg-white disabled:opacity-40">›</button>
    </div>
  </div>`;
  return { items, controles };
}
window.setPagina = (clave, n) => { ui.pag[clave].pagina = Math.max(1, n); render(); };
window.setTamanoPagina = (clave, n) => { ui.pag[clave] = { pagina: 1, tamano: Number(n) }; render(); };
window.setFiltro = (clave, campo, valor) => { filtro(clave)[campo] = valor; if (ui.pag[clave]) ui.pag[clave].pagina = 1; render(); };
function filtroTexto(clave, placeholder) {
  return `<input type="search" value="${escapeHtml(filtro(clave).texto || '')}" placeholder="${placeholder}" onchange="window.setFiltro('${clave}','texto',this.value)" class="${INPUT} max-w-xs" />`;
}
function filtroSelect(clave, campo, opciones, todos) {
  const v = filtro(clave)[campo] || '';
  return `<select onchange="window.setFiltro('${clave}','${campo}',this.value)" class="${INPUT} max-w-[220px]">
    <option value="">${todos}</option>
    ${opciones.map(([val, lab]) => `<option value="${val}" ${val === v ? 'selected' : ''}>${escapeHtml(lab)}</option>`).join('')}
  </select>`;
}
const opcionesCursos = () => db.courses.map(c => [c.id, c.name]);
function coincide(texto, ...campos) {
  if (!texto) return true;
  const t = sinTildes(texto);
  return campos.some(c => sinTildes(c).includes(t));
}

/* ------------------------- INICIO DE SESIÓN (RF-03) ------------------------ */
function screenLogin() {
  const pendiente = db.cuentas.find(c => !c.clave && c.claveTemporal && new Date(c.venceTemporal) > new Date());
  const accesos = [
    ['admin', 'vicerrector'], ['secretaria', cuentaDe('secretaria', db.secretaria.id)?.usuario],
    ['docente', cuentaDe('docente', db.teachers[0]?.id)?.usuario], ['estudiante', cuentaDe('estudiante', db.students[0]?.id)?.usuario],
    ['representante', cuentaDe('representante', db.representantes[0]?.id)?.usuario],
  ].filter(a => a[1]);
  const l = ui.login;
  return `
  <div class="min-h-full flex items-center justify-center py-8">
    <div class="w-full max-w-4xl grid md:grid-cols-2 gap-6">
      <div class="${CARD} p-8">
        <div class="flex items-center gap-3 mb-6">
          <img src="assets/logo-andoas.jpg" alt="Escudo" class="w-12 h-12 rounded-full ring-2 ring-accent" />
          <div><div class="font-display font-bold text-xl text-primary-dark">AulaConecta</div><div class="text-xs text-slate-500">U.E. "Andoas" · Puyo</div></div>
        </div>
        <label class="${LABEL}">Usuario</label>
        <input id="lg-usuario" value="${escapeHtml(l.usuario)}" class="${INPUT} mb-4" placeholder="nombre.apellido" autocomplete="username" />
        <label class="${LABEL}">Contraseña o clave temporal</label>
        <input id="lg-clave" type="password" class="${INPUT} mb-2" autocomplete="current-password" onkeydown="if(event.key==='Enter') window.iniciarSesion()" />
        ${l.error ? `<div class="text-xs font-semibold text-red-600 bg-red-50 border border-red-200 rounded-lg px-3 py-2 mb-3">${escapeHtml(l.error)}</div>` : '<div class="mb-3"></div>'}
        <button onclick="window.iniciarSesion()" class="${BTN_PRIMARY} w-full">Ingresar</button>
        <p class="text-[11px] text-slate-400 mt-4 leading-relaxed">Las cuentas nuevas reciben una <b>clave temporal aleatoria de un solo uso</b>, válida por ${HORAS_CLAVE_TEMPORAL} horas. Tras ${MAX_INTENTOS} intentos fallidos la cuenta se bloquea ${MINUTOS_BLOQUEO} minutos.</p>
      </div>
      <div class="${CARD} p-8 bg-slate-50">
        <div class="font-display font-bold text-primary-dark mb-1">Cuentas de prueba (datos ficticios)</div>
        <p class="text-xs text-slate-500 mb-4">Contraseña de las cuentas activas: <code class="bg-white border px-1.5 py-0.5 rounded">${CLAVE_DEMO}</code></p>
        <div class="flex flex-col gap-2 mb-6">
          ${accesos.map(([rol, u]) => `<button onclick="window.llenarAcceso('${u}','${CLAVE_DEMO}')" class="flex items-center justify-between text-left bg-white border border-slate-200 hover:border-accent rounded-lg px-4 py-2.5 text-sm">
            <span class="font-semibold text-slate-700">${ROLES[rol]}</span><code class="text-xs text-slate-500">${u}</code></button>`).join('')}
        </div>
        ${pendiente ? `<div class="border-t border-slate-200 pt-4">
          <div class="text-xs font-bold text-slate-600 mb-1">Cuenta nueva sin activar (RF-03)</div>
          <p class="text-xs text-slate-500 mb-2">${escapeHtml(pendiente.nombre)} · vence ${fechaHora(pendiente.venceTemporal)}</p>
          <button onclick="window.llenarAcceso('${pendiente.usuario}','${pendiente.claveTemporal}')" class="${BTN_SECONDARY} w-full text-xs">Usar <code>${pendiente.usuario}</code> con su clave temporal</button>
        </div>` : ''}
      </div>
    </div>
  </div>`;
}
window.llenarAcceso = (u, c) => {
  ui.login.usuario = u; ui.login.error = '';
  render();
  document.getElementById('lg-clave').value = c;
};
window.iniciarSesion = () => {
  const usuario = document.getElementById('lg-usuario').value.trim().toLowerCase();
  const clave = document.getElementById('lg-clave').value;
  ui.login.usuario = usuario;
  const c = db.cuentas.find(x => x.usuario === usuario);
  const error = msg => { ui.login.error = msg; render(); };
  if (!c) return error('Usuario o contraseña incorrectos.');
  if (c.bloqueadaHasta && new Date(c.bloqueadaHasta) > new Date()) return error(`Cuenta bloqueada por intentos fallidos. Intente después de ${fechaHora(c.bloqueadaHasta)}`);
  if (c.claveTemporal && clave === c.claveTemporal) {
    if (new Date(c.venceTemporal) < new Date()) return error('La clave temporal venció. Pida una nueva a la secretaría.');
    c.intentos = 0; saveDB();
    ui.activando = c.id; ui.login = { usuario: '', clave: '', error: '' };
    return render();
  }
  if (c.clave && clave === c.clave) {
    c.intentos = 0; c.bloqueadaHasta = null; saveDB();
    abrirSesion(c);
    return;
  }
  c.intentos = (c.intentos || 0) + 1;
  if (c.intentos >= MAX_INTENTOS) {
    c.bloqueadaHasta = new Date(Date.now() + MINUTOS_BLOQUEO * 60e3).toISOString(); c.intentos = 0;
    saveDB();
    return error(`Cuenta bloqueada ${MINUTOS_BLOQUEO} minutos por ${MAX_INTENTOS} intentos fallidos (RNF-12).`);
  }
  saveDB();
  error(`Usuario o contraseña incorrectos. Intentos restantes: ${MAX_INTENTOS - c.intentos}.`);
};
function abrirSesion(c) {
  ui.session = { cuentaId: c.id, rol: c.rol, personaId: c.personaId, usuario: c.usuario, nombre: c.nombre };
  ui.role = c.rol;
  if (c.rol === 'docente') ui.teacherId = c.personaId;
  if (c.rol === 'estudiante') ui.studentId = c.personaId;
  ui.login = { usuario: '', clave: '', error: '' };
  toast(`Bienvenido/a, ${c.nombre}.`);
  render();
}
window.cerrarSesion = () => { ui.session = null; ui.activando = null; ui.offline = false; render(); };

function screenActivacion() {
  const c = db.cuentas.find(x => x.id === ui.activando);
  return `
  <div class="min-h-full flex items-center justify-center py-8">
    <div class="${CARD} p-8 w-full max-w-md">
      <div class="text-3xl mb-2">🔐</div>
      <div class="font-display font-bold text-xl text-primary-dark">Activa tu cuenta</div>
      <p class="text-sm text-slate-500 mt-1 mb-5">Hola ${escapeHtml(c.nombre)}. Ingresaste con una clave temporal de un solo uso. Crea tu contraseña para continuar; la clave temporal dejará de funcionar.</p>
      <label class="${LABEL}">Nueva contraseña</label>
      <input id="ac-1" type="password" class="${INPUT} mb-3" autocomplete="new-password" />
      <label class="${LABEL}">Repite la contraseña</label>
      <input id="ac-2" type="password" class="${INPUT} mb-2" autocomplete="new-password" onkeydown="if(event.key==='Enter') window.activarCuenta()" />
      <ul class="text-[11px] text-slate-500 mb-5 list-disc pl-4"><li>Mínimo 8 caracteres.</li><li>Distinta de tu usuario y de la clave temporal.</li></ul>
      <div class="flex gap-3"><button onclick="window.cerrarSesion()" class="${BTN_SECONDARY} flex-1">Cancelar</button><button onclick="window.activarCuenta()" class="${BTN_PRIMARY} flex-1">Activar y entrar</button></div>
    </div>
  </div>`;
}
window.activarCuenta = () => {
  const c = db.cuentas.find(x => x.id === ui.activando);
  const a = document.getElementById('ac-1').value, b = document.getElementById('ac-2').value;
  if (a.length < 8) return toast('La contraseña debe tener al menos 8 caracteres.', 'error');
  if (a !== b) return toast('Las contraseñas no coinciden.', 'error');
  if (a.toLowerCase().includes(c.usuario) || a === c.claveTemporal) return toast('La contraseña no puede contener tu usuario ni ser la clave temporal.', 'error');
  c.clave = a; c.claveTemporal = null; c.venceTemporal = null; c.activadaEn = new Date().toISOString();
  saveDB();
  ui.activando = null;
  toast('Cuenta activada. La clave temporal ya no es válida.');
  abrirSesion(c);
};

/* --------------------------- CUENTAS Y ACCESOS --------------------------- */
function screenCuentas() {
  const f = filtro('cuentas');
  const lista = db.cuentas.filter(c => (!f.rol || c.rol === f.rol) && coincide(f.texto, c.nombre, c.usuario));
  const { items, controles } = paginar(lista, 'cuentas');
  return `
    <div class="mb-6"><h1 class="font-display font-bold text-2xl text-primary-dark">Cuentas y Accesos</h1>
      <p class="text-slate-500 text-sm mt-1">Usuario generado con nombre y apellido (RF-02). Las cuentas nuevas usan una clave temporal aleatoria de un solo uso, válida ${HORAS_CLAVE_TEMPORAL} h (RF-03).</p></div>
    <div class="flex gap-3 flex-wrap mb-4">${filtroTexto('cuentas', 'Buscar por nombre o usuario')} ${filtroSelect('cuentas', 'rol', Object.entries(ROLES), 'Todos los roles')}</div>
    <div class="${CARD} overflow-hidden">
      <div class="grid grid-cols-[1.4fr_1fr_0.8fr_1fr_150px] gap-2 px-5 py-3 text-[11px] font-bold text-slate-400 uppercase border-b border-slate-100 bg-slate-50">
        <div>Nombre</div><div>Usuario</div><div>Rol</div><div>Estado</div><div>Acciones</div></div>
      ${items.map(c => { const e = estadoCuenta(c); return `<div class="grid grid-cols-[1.4fr_1fr_0.8fr_1fr_150px] gap-2 px-5 py-3 items-center border-b border-slate-50 text-sm">
        <div class="font-semibold text-slate-700 truncate">${escapeHtml(c.nombre)}</div>
        <code class="text-xs text-slate-600">${c.usuario}</code>
        <div class="text-xs text-slate-500">${ROLES[c.rol]}</div>
        <div>${badge(e.label, e.cls)}</div>
        <button onclick="window.reiniciarClave('${c.id}')" class="text-xs font-semibold text-primary hover:underline text-left">Generar clave temporal</button>
      </div>`; }).join('') || '<div class="p-8 text-center text-sm text-slate-400">Sin resultados.</div>'}
      ${controles}
    </div>`;
}
window.reiniciarClave = (id) => {
  const c = db.cuentas.find(x => x.id === id);
  if (!confirm(`¿Generar una nueva clave temporal para ${c.nombre}? Su contraseña actual dejará de funcionar.`)) return;
  c.clave = null; c.claveTemporal = generarClaveTemporal(); c.bloqueadaHasta = null; c.intentos = 0;
  c.venceTemporal = new Date(Date.now() + HORAS_CLAVE_TEMPORAL * 3600e3).toISOString();
  saveDB();
  ui.credenciales = { nombre: c.nombre, usuario: c.usuario, clave: c.claveTemporal, vence: c.venceTemporal };
  render();
};
function credencialesModalHTML() {
  const k = ui.credenciales;
  return `<div class="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/50 anim-fade">
    <div class="bg-white rounded-2xl w-full max-w-md p-6 anim-popin">
      <div class="font-display font-bold text-lg text-primary-dark mb-1">Credenciales generadas</div>
      <p class="text-sm text-slate-500 mb-4">Entrégalas en persona a ${escapeHtml(k.nombre)}. La clave es de un solo uso y vence el ${fechaHora(k.vence)}.</p>
      <div class="bg-slate-50 border border-slate-200 rounded-lg p-4 mb-5 text-sm">
        <div class="flex justify-between mb-2"><span class="text-slate-500">Usuario</span><code class="font-bold">${k.usuario}</code></div>
        <div class="flex justify-between"><span class="text-slate-500">Clave temporal</span><code class="font-bold">${k.clave}</code></div>
      </div>
      <button onclick="window.cerrarCredenciales()" class="${BTN_PRIMARY} w-full">Entendido</button>
    </div></div>`;
}
window.cerrarCredenciales = () => { ui.credenciales = null; render(); };

/* ---------------------- REPRESENTANTES Y AUTORIZACIONES ---------------------- */
function screenContactos() {
  const f = filtro('contactos');
  const filas = db.representantes.flatMap(r => r.studentIds.map(sid => ({ r, st: getStudent(sid) }))).filter(x => x.st)
    .filter(({ r, st }) => (!f.curso || st.courseId === f.curso) && (!f.estado || (f.estado === 'si' ? r.autorizado && !r.baja : !r.autorizado || r.baja)) && coincide(f.texto, r.nombre, st.name, r.telefono));
  const { items, controles } = paginar(filas, 'contactos');
  return `
    <div class="mb-6"><h1 class="font-display font-bold text-2xl text-primary-dark">Representantes y Autorizaciones</h1>
      <p class="text-slate-500 text-sm mt-1">Solo se envían avisos a números verificados con autorización firmada (RF-29, RN-06). Al autorizar se envía el mensaje de confirmación.</p></div>
    <div class="flex gap-3 flex-wrap mb-4">${filtroTexto('contactos', 'Buscar representante, estudiante o número')} ${filtroSelect('contactos', 'curso', opcionesCursos(), 'Todos los cursos')} ${filtroSelect('contactos', 'estado', [['si', 'Con autorización'], ['no', 'Sin autorización o de baja']], 'Todas las autorizaciones')}</div>
    <div class="${CARD} overflow-hidden">
      <div class="grid grid-cols-[1.2fr_1.2fr_0.9fr_0.9fr_170px] gap-2 px-5 py-3 text-[11px] font-bold text-slate-400 uppercase border-b border-slate-100 bg-slate-50">
        <div>Representante</div><div>Estudiante</div><div>Celular</div><div>Autorización</div><div>Acción</div></div>
      ${items.map(({ r, st }) => `<div class="grid grid-cols-[1.2fr_1.2fr_0.9fr_0.9fr_170px] gap-2 px-5 py-3 items-center border-b border-slate-50 text-sm">
        <div><div class="font-semibold text-slate-700">${escapeHtml(r.nombre)}</div><div class="text-[11px] text-slate-400">${r.parentesco}</div></div>
        <div class="text-xs text-slate-600">${escapeHtml(st.name)}<div class="text-[11px] text-slate-400">${escapeHtml((getCourse(st.courseId) || {}).name || '')}</div></div>
        <div class="text-xs text-slate-600">${r.telefono} ${r.verificado ? '<span title="Verificado">✔️</span>' : ''}</div>
        <div>${r.baja ? badge('Dado de baja', 'bg-slate-100 text-slate-600 border-slate-200') : r.autorizado ? badge('Autorizado', 'bg-emerald-50 text-emerald-700 border-emerald-200') : badge('Sin autorización', 'bg-amber-50 text-amber-700 border-amber-200')}</div>
        <div>${r.autorizado && !r.baja ? `<button onclick="window.revocarAutorizacion('${r.id}')" class="${BTN_DANGER_TEXT}">Retirar autorización</button>` : `<button onclick="window.registrarAutorizacion('${r.id}','${st.id}')" class="text-xs font-semibold text-primary hover:underline">Registrar autorización</button>`}</div>
      </div>`).join('') || '<div class="p-8 text-center text-sm text-slate-400">Sin resultados.</div>'}
      ${controles}
    </div>`;
}
window.registrarAutorizacion = (repId, studentId) => {
  const r = getRepresentante(repId);
  if (!confirm(`¿Confirmas que ${r.nombre} firmó la autorización y que el número ${r.telefono} fue verificado?`)) return;
  r.autorizado = true; r.verificado = true; r.baja = false;
  crearAviso(studentId, null, 'confirmacion_autorizacion', { repId });
  saveDB(); toast('Autorización registrada y confirmación enviada.'); render();
};
window.revocarAutorizacion = (repId) => {
  const r = getRepresentante(repId);
  if (!confirm(`¿Retirar la autorización de ${r.nombre}? No recibirá más avisos externos.`)) return;
  r.autorizado = false; saveDB(); toast('Autorización retirada.'); render();
};

/* ------------------------- AVISOS POR NIVELES (CR-01) ------------------------- */
function textoAviso(a, rep) {
  const st = getStudent(a.studentId); const sub = a.subjectId ? getSubject(a.subjectId) : null;
  const est = st ? st.name.split(' ').slice(0, 1).join(' ') + ' ' + apellidoDe(st.name) : 'su representado';
  const encabezado = '🏫 U.E. "Andoas" · AulaConecta\n\n';
  if (a.motivo === 'confirmacion_autorizacion') return `${encabezado}Hola ${rep.nombre}, desde ahora recibirá por este medio avisos sobre el rendimiento y la asistencia de ${est}.\n\nPuede dejar de recibirlos cuando quiera con el botón "No recibir avisos".`;
  if (a.motivo === 'promedio_bajo') return `${encabezado}Hola ${rep.nombre}, le informamos que ${est} tiene un promedio menor a 7 en *${sub ? sub.name : ''}*.\n\nLe recomendamos revisar el detalle con su representado y, si lo necesita, acercarse al docente de la materia.`;
  return `${encabezado}Hola ${rep.nombre}, ${est} registró una *falta sin justificar* el ${fmtDate(a.fechaEvento)} en ${sub ? sub.name : ''}.\n\nSi la falta tiene justificación, puede registrarla en AulaConecta o comunicarse con el colegio.`;
}
// Crea un aviso por cada representante del estudiante; respeta autorización (RN-06) y duplicados (RN-07)
function crearAviso(studentId, subjectId, motivo, extra = {}) {
  const reps = extra.repId ? [getRepresentante(extra.repId)] : representantesDe(studentId);
  const periodo = motivo === 'falta_sin_justificar' ? (extra.fecha || todayISO()) : db.meta.currentPeriodLabel;
  let creados = 0;
  reps.forEach(rep => {
    const duplicado = db.avisos.some(a => a.repId === rep.id && a.studentId === studentId && a.subjectId === subjectId && a.motivo === motivo && a.periodo === periodo);
    if (duplicado && motivo !== 'confirmacion_autorizacion') return;
    const estado = rep.baja ? 'baja' : !rep.autorizado ? 'sin_autorizacion' : ui.offline ? 'en_cola' : 'entregado';
    db.avisos.unshift({
      id: uid('av'), repId: rep.id, studentId, subjectId, motivo, periodo, fechaEvento: extra.fecha || todayISO(),
      creadoEn: new Date().toISOString(), estado,
      push: estado === 'entregado' ? 'entregado' : estado === 'en_cola' ? 'en_cola' : 'no_enviado',
      whatsapp: estado === 'entregado' || estado === 'en_cola' ? 'listo' : 'no_aplica', enviadoPor: null,
    });
    creados++;
  });
  if (creados) {
    if (ui.offline) toast(`Sin conexión: ${creados} aviso(s) quedan en cola y se enviarán al volver la conexión.`);
    else if (reps.some(r => r.autorizado && !r.baja)) toast(`🔔 Notificación push enviada al representante (${MOTIVOS[motivo].label}).`);
    else toast('El representante no tiene autorización: el aviso queda solo en el tablero (RN-06).');
  }
}
function revisarPromedio(studentId, subjectId) {
  const v = promedioMateria(studentId, subjectId);
  if (v !== null && v < 7) crearAviso(studentId, subjectId, 'promedio_bajo');
}
function avisosVisibles() {
  if (ui.role === 'docente') {
    const mias = new Set(subjectsOfTeacher(ui.teacherId).map(s => s.id));
    return db.avisos.filter(a => a.subjectId && mias.has(a.subjectId));
  }
  if (ui.role === 'representante') return db.avisos.filter(a => a.repId === ui.session.personaId && a.estado !== 'sin_autorizacion' && a.estado !== 'baja');
  return db.avisos;
}
function screenAvisos() {
  const f = filtro('avisos');
  const lista = avisosVisibles().filter(a => {
    const st = getStudent(a.studentId) || {}; const rep = getRepresentante(a.repId) || {};
    return (!f.motivo || a.motivo === f.motivo) && (!f.estado || a.estado === f.estado) && coincide(f.texto, st.name, rep.nombre);
  });
  const { items, controles } = paginar(lista, 'avisos');
  return `
    <div class="mb-6"><h1 class="font-display font-bold text-2xl text-primary-dark">${ui.role === 'docente' ? 'Avisos a Representantes' : 'Historial de Avisos'}</h1>
      <p class="text-slate-500 text-sm mt-1">Nivel 1: notificación push automática y gratuita. Nivel 2: WhatsApp con un clic, gratuito. Nivel 3: WhatsApp automático, opcional y de pago (no activo). Ningún mensaje incluye la nota exacta (RF-33).</p></div>
    <div class="flex gap-3 flex-wrap mb-4">${filtroTexto('avisos', 'Buscar estudiante o representante')} ${filtroSelect('avisos', 'motivo', Object.entries(MOTIVOS).map(([k, v]) => [k, v.label]), 'Todos los motivos')} ${filtroSelect('avisos', 'estado', Object.entries(ESTADOS_AVISO).map(([k, v]) => [k, v.label]), 'Todos los estados')}</div>
    <div class="${CARD} overflow-hidden">
      <div class="grid grid-cols-[110px_1.3fr_1.1fr_1fr_0.9fr_150px] gap-2 px-5 py-3 text-[11px] font-bold text-slate-400 uppercase border-b border-slate-100 bg-slate-50">
        <div>Fecha</div><div>Motivo / estudiante</div><div>Representante</div><div>Estado</div><div>Canales</div><div>WhatsApp</div></div>
      ${items.map(a => {
        const st = getStudent(a.studentId) || {}; const rep = getRepresentante(a.repId) || {}; const sub = a.subjectId ? getSubject(a.subjectId) : null;
        const e = ESTADOS_AVISO[a.estado];
        return `<div class="grid grid-cols-[110px_1.3fr_1.1fr_1fr_0.9fr_150px] gap-2 px-5 py-3 items-center border-b border-slate-50 text-sm">
          <div class="text-xs text-slate-500">${fechaHora(a.creadoEn)}</div>
          <div><div class="font-semibold text-slate-700">${MOTIVOS[a.motivo].icon} ${MOTIVOS[a.motivo].label}</div><div class="text-[11px] text-slate-500">${escapeHtml(st.name || '')}${sub ? ' · ' + escapeHtml(sub.name) : ''}</div></div>
          <div class="text-xs text-slate-600">${escapeHtml(rep.nombre || '')}<div class="text-[11px] text-slate-400">${rep.telefono || ''}</div></div>
          <div>${badge(e.label, e.cls)}</div>
          <div class="text-[11px] text-slate-500">Push: <b>${a.push === 'entregado' ? 'entregado' : a.push === 'en_cola' ? 'en cola' : '—'}</b><br>WhatsApp: <b>${a.whatsapp === 'enviado' ? 'enviado' : a.whatsapp === 'listo' ? 'listo' : '—'}</b></div>
          <div>${a.whatsapp === 'listo' && a.estado === 'entregado' ? `<button onclick="window.abrirWhatsApp('${a.id}')" class="text-xs font-bold text-white bg-emerald-600 hover:bg-emerald-700 rounded-lg px-3 py-1.5">Avisar por WhatsApp</button>` : a.whatsapp === 'enviado' ? `<span class="text-[11px] text-slate-400">Enviado por ${escapeHtml(a.enviadoPor || '')}</span>` : ''}</div>
        </div>`;
      }).join('') || '<div class="p-8 text-center text-sm text-slate-400">No hay avisos con estos filtros. Registra una falta o una nota menor a 7 para generar uno.</div>'}
      ${controles}
    </div>`;
}
window.abrirWhatsApp = (id) => { ui.waAvisoId = id; render(); };
window.cerrarWhatsApp = () => { ui.waAvisoId = null; render(); };
window.marcarWhatsAppEnviado = () => {
  const a = db.avisos.find(x => x.id === ui.waAvisoId);
  a.whatsapp = 'enviado'; a.enviadoPor = ui.session ? ui.session.nombre : '';
  saveDB(); ui.waAvisoId = null; toast('WhatsApp registrado en el historial con quién lo envió.'); render();
};
function whatsappModalHTML() {
  const a = db.avisos.find(x => x.id === ui.waAvisoId); const rep = getRepresentante(a.repId);
  const texto = textoAviso(a, rep);
  const enlace = `https://wa.me/593${rep.telefono.slice(1)}?text=${encodeURIComponent(texto)}`;
  return `<div class="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/50 anim-fade" onclick="if(event.target===this) window.cerrarWhatsApp()">
    <div class="bg-white rounded-2xl w-full max-w-md p-6 anim-popin">
      <div class="font-display font-bold text-lg text-primary-dark mb-1">WhatsApp con un clic (nivel 2)</div>
      <p class="text-xs text-slate-500 mb-4">El mensaje ya está escrito con la plantilla aprobada y no incluye la nota exacta. Se abre WhatsApp con el texto listo para enviar a ${escapeHtml(rep.nombre)} (${rep.telefono}).</p>
      <div class="bg-[#e7fbe0] border border-emerald-200 rounded-xl p-4 text-sm text-slate-700 whitespace-pre-line mb-5">${escapeHtml(texto)}</div>
      <div class="flex gap-3">
        <a href="${enlace}" target="_blank" rel="noopener" class="${BTN_SECONDARY} flex-1">Abrir WhatsApp</a>
        <button onclick="window.marcarWhatsAppEnviado()" class="${BTN_PRIMARY} flex-1">Marcar como enviado</button>
      </div>
    </div></div>`;
}

/* ------------------------------- REPRESENTANTE ------------------------------ */
function repActual() { return getRepresentante(ui.session.personaId); }
function screenRepResumen() {
  const rep = repActual(); const st = getStudent(rep.studentIds[0]);
  if (!st) return `<div class="${CARD} p-8 text-center text-sm text-slate-400">No tiene representados registrados.</div>`;
  const course = getCourse(st.courseId); const att = studentAttendancePct(st.id);
  const materias = st.subjectIds.map(id => ({ s: getSubject(id), v: promedioMateria(st.id, id), a: subjectAttendancePct(st.id, id) })).filter(m => m.s);
  const conNota = materias.filter(m => m.v !== null);
  const avg = conNota.length ? conNota.reduce((t, m) => t + m.v, 0) / conNota.length : null;
  const proximas = upcomingForStudent(st.id).filter(x => x.dueDate >= todayISO()).slice(0, 5);
  return `
    <div class="mb-6"><h1 class="font-display font-bold text-2xl text-primary-dark">${escapeHtml(st.name)}</h1>
      <p class="text-slate-500 text-sm mt-1">${escapeHtml(course ? course.name : '')} · Representante: ${escapeHtml(rep.nombre)} (${rep.parentesco}). Aquí ve el detalle que los avisos no muestran (RF-38).</p></div>
    <div class="grid grid-cols-2 lg:grid-cols-3 gap-4 mb-6">
      ${kpiCard('📈', 'Promedio general', avg !== null ? avg.toFixed(2) : '—', 'Todas las materias')}
      ${kpiCard('✅', 'Asistencia', att !== null ? att + '%' : '—', 'Del periodo')}
      ${kpiCard('🔔', 'Avisos recibidos', avisosVisibles().length, 'Push y WhatsApp')}
    </div>
    <div class="${CARD} overflow-hidden mb-6">
      <div class="px-5 py-3 font-display font-bold text-primary-dark border-b border-slate-100">Materias</div>
      ${materias.map(m => `<div class="flex items-center justify-between px-5 py-3 border-b border-slate-50 text-sm ${m.v !== null && m.v < 7 ? 'bg-red-50' : ''}">
        <div class="font-semibold text-slate-700">${escapeHtml(m.s.name)}</div>
        <div class="flex items-center gap-4"><span class="text-xs text-slate-500">Asistencia ${m.a !== null ? m.a + '%' : '—'}</span>
        <span class="font-bold ${m.v !== null && m.v < 7 ? 'text-red-600' : 'text-primary-dark'}">${m.v !== null ? m.v.toFixed(2) : '—'}</span>${m.v !== null && m.v < 7 ? badge('Menor a 7', 'bg-red-100 text-red-700 border-red-200') : ''}</div>
      </div>`).join('')}
    </div>
    <div class="${CARD} overflow-hidden">
      <div class="px-5 py-3 font-display font-bold text-primary-dark border-b border-slate-100">Próximas tareas y evaluaciones (RF-32)</div>
      ${proximas.map(a => `<div class="flex justify-between px-5 py-3 border-b border-slate-50 text-sm"><span>${TYPE_ICON[a.type] || '📝'} ${escapeHtml(a.title)} <span class="text-xs text-slate-400">· ${escapeHtml((getSubject(a.subjectId) || {}).name || '')}</span></span><span class="text-xs text-slate-500">${fmtDate(a.dueDate)}</span></div>`).join('') || '<div class="p-6 text-center text-sm text-slate-400">Sin pendientes.</div>'}
    </div>`;
}
function screenRepAvisos() {
  const lista = avisosVisibles();
  const { items, controles } = paginar(lista, 'avisosRep');
  const rep = repActual();
  return `
    <div class="mb-6"><h1 class="font-display font-bold text-2xl text-primary-dark">Avisos Recibidos</h1>
      <p class="text-slate-500 text-sm mt-1">Solo tres tipos de mensaje: confirmación de autorización, promedio menor a 7 y falta sin justificar. Los atrasos, tareas y comunicados se ven en la aplicación.</p></div>
    <div class="flex flex-col gap-3">
      ${items.map(a => `<div class="${CARD} p-4">
        <div class="flex items-center justify-between mb-2"><div class="text-sm font-bold text-primary-dark">${MOTIVOS[a.motivo].icon} ${MOTIVOS[a.motivo].label}</div><div class="text-[11px] text-slate-400">${fechaHora(a.creadoEn)} · ${a.estado === 'en_cola' ? 'en cola' : 'push entregado'}</div></div>
        <div class="text-sm text-slate-600 whitespace-pre-line">${escapeHtml(textoAviso(a, rep))}</div>
      </div>`).join('') || `<div class="${CARD} p-8 text-center text-sm text-slate-400">Aún no ha recibido avisos.</div>`}
    </div>
    <div class="${CARD} mt-3 overflow-hidden">${controles}</div>`;
}
function screenRepConsentimiento() {
  const rep = repActual();
  return `
    <div class="mb-6"><h1 class="font-display font-bold text-2xl text-primary-dark">Consentimiento de Avisos</h1>
      <p class="text-slate-500 text-sm mt-1">Usted decide si recibe avisos. La baja se aplica de inmediato (RNF-05).</p></div>
    <div class="${CARD} p-6 max-w-xl">
      <div class="flex items-center justify-between mb-4"><div><div class="font-semibold text-slate-700">${escapeHtml(rep.nombre)}</div><div class="text-xs text-slate-500">${rep.telefono}</div></div>
        ${rep.baja ? badge('No recibe avisos', 'bg-slate-100 text-slate-600 border-slate-200') : rep.autorizado ? badge('Recibe avisos', 'bg-emerald-50 text-emerald-700 border-emerald-200') : badge('Sin autorización', 'bg-amber-50 text-amber-700 border-amber-200')}</div>
      <ul class="text-sm text-slate-600 list-disc pl-5 mb-5"><li>Notificación en el celular (push), gratuita.</li><li>Mensaje de WhatsApp enviado por el docente o la secretaría, gratuito.</li><li>Los mensajes nunca incluyen la nota exacta.</li></ul>
      ${!rep.autorizado ? '<p class="text-xs text-slate-500">Para recibir avisos debe firmar la autorización en la secretaría del colegio.</p>'
        : rep.baja ? `<button onclick="window.cambiarBaja(false)" class="${BTN_PRIMARY}">Volver a recibir avisos</button>` : `<button onclick="window.cambiarBaja(true)" class="${BTN_SECONDARY}">No recibir avisos</button>`}
    </div>`;
}
window.cambiarBaja = (v) => { const r = repActual(); r.baja = v; saveDB(); toast(v ? 'Listo: ya no recibirá avisos.' : 'Volverá a recibir avisos.'); render(); };

/* ----------------------- TRABAJO SIN CONEXIÓN (RNF-01) ----------------------- */
function registrarCambioLocal(tipo, descripcion, ref) {
  if (!ui.offline) return;
  db.colaSync.push({ id: uid('sync'), tipo, descripcion, ref, creadoEn: new Date().toISOString(), estado: 'pendiente' });
  saveDB();
}
function bannerSinConexion() {
  if (!ui.offline) return '';
  const pend = db.colaSync.filter(c => c.estado === 'pendiente');
  const hayAsistencia = pend.some(c => c.tipo === 'asistencia');
  return `<div class="mb-5 rounded-xl border border-amber-300 bg-amber-50 px-4 py-3 text-sm text-amber-800 flex items-center justify-between gap-3 flex-wrap">
    <div>📴 <b>Sin conexión.</b> Los cambios se guardan cifrados en este equipo y se enviarán al volver la conexión. <b>${pend.length}</b> pendiente(s).</div>
    ${hayAsistencia ? `<button onclick="window.simularCambioOtroUsuario()" class="text-xs font-semibold underline">Simular cambio de otro docente</button>` : ''}
  </div>`;
}
window.toggleConexion = () => {
  if (!ui.offline) { ui.offline = true; toast('Modo sin conexión: puedes seguir registrando notas y asistencia.'); render(); return; }
  ui.offline = false;
  sincronizar();
};
window.simularCambioOtroUsuario = () => {
  const c = [...db.colaSync].reverse().find(x => x.estado === 'pendiente' && x.tipo === 'asistencia');
  if (!c) return;
  c.conflicto = { valorServidor: c.ref.status === 'falta' ? 'presente' : 'falta', autor: 'Otro docente (desde otro equipo)' };
  saveDB(); toast('Otro usuario cambió el mismo registro mientras estabas sin conexión.'); render();
};
function sincronizar() {
  const pend = db.colaSync.filter(c => c.estado === 'pendiente');
  const conflictos = pend.filter(c => c.conflicto);
  pend.filter(c => !c.conflicto).forEach(c => { c.estado = 'sincronizado'; });
  const enCola = db.avisos.filter(a => a.estado === 'en_cola');
  enCola.forEach(a => { a.estado = 'entregado'; a.push = 'entregado'; });
  saveDB();
  toast(`Conexión recuperada: ${pend.length - conflictos.length} cambio(s) sincronizados${enCola.length ? ` y ${enCola.length} aviso(s) enviados` : ''}.`);
  if (conflictos.length) ui.conflicto = conflictos[0].id;
  render();
}
function conflictoModalHTML() {
  const c = db.colaSync.find(x => x.id === ui.conflicto);
  const st = getStudent(c.ref.studentId) || {}; const sub = getSubject(c.ref.subjectId) || {};
  return `<div class="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/50 anim-fade">
    <div class="bg-white rounded-2xl w-full max-w-lg p-6 anim-popin">
      <div class="font-display font-bold text-lg text-primary-dark mb-1">Conflicto de sincronización</div>
      <p class="text-sm text-slate-500 mb-4">La asistencia de <b>${escapeHtml(st.name || '')}</b> en ${escapeHtml(sub.name || '')} cambió en el servidor mientras estabas sin conexión. Según la regla RN-15, decide el docente; el cambio descartado queda registrado.</p>
      <div class="grid grid-cols-2 gap-3 mb-5 text-sm">
        <div class="border border-slate-200 rounded-lg p-3"><div class="text-[11px] font-bold text-slate-400 uppercase mb-1">Tu cambio</div><div class="font-bold">${capitalize(c.ref.status)}</div></div>
        <div class="border border-slate-200 rounded-lg p-3"><div class="text-[11px] font-bold text-slate-400 uppercase mb-1">${escapeHtml(c.conflicto.autor)}</div><div class="font-bold">${capitalize(c.conflicto.valorServidor)}</div></div>
      </div>
      <div class="flex gap-3"><button onclick="window.resolverConflicto('servidor')" class="${BTN_SECONDARY} flex-1">Usar el del servidor</button><button onclick="window.resolverConflicto('mio')" class="${BTN_PRIMARY} flex-1">Mantener mi cambio</button></div>
    </div></div>`;
}
window.resolverConflicto = (opcion) => {
  const c = db.colaSync.find(x => x.id === ui.conflicto);
  const final = opcion === 'mio' ? c.ref.status : c.conflicto.valorServidor;
  upsertAttendanceToday(c.ref.studentId, c.ref.subjectId, final);
  db.conflictos.push({ id: uid('cf'), syncId: c.id, elegido: opcion, valorFinal: final, descartado: opcion === 'mio' ? c.conflicto.valorServidor : c.ref.status, resueltoPor: ui.session.nombre, fecha: new Date().toISOString() });
  c.estado = 'sincronizado';
  saveDB();
  const siguiente = db.colaSync.find(x => x.estado === 'pendiente' && x.conflicto);
  ui.conflicto = siguiente ? siguiente.id : null;
  toast('Conflicto resuelto y registrado.');
  render();
};
