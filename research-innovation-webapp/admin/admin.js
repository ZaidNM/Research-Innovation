'use strict';
/* ═══════════════════════════════════════════════════════════
   Research & Innovation SAC — Panel de administración
   Vanilla JS, sin frameworks (consistente con el stack del sitio
   público). Todo el estado vive en memoria; la fuente de verdad
   es siempre la API — cada sección recarga sus datos al abrirse.
═══════════════════════════════════════════════════════════ */

const ESTADO = { usuario: null, usuariosCache: [] };

/* ───────────────────────────────────────────────
   CLIENTE API
   ─────────────────────────────────────────────── */
async function api(ruta, opciones = {}) {
  const resp = await fetch(`/api${ruta}`, {
    method: opciones.method || 'GET',
    headers: opciones.body instanceof FormData ? undefined : { 'Content-Type': 'application/json' },
    body: opciones.body instanceof FormData ? opciones.body : (opciones.body ? JSON.stringify(opciones.body) : undefined),
    credentials: 'include',
  });
  let datos = null;
  try { datos = await resp.json(); } catch { /* respuesta sin cuerpo */ }
  if (!resp.ok) {
    const error = new Error((datos && datos.error) || `Error ${resp.status}`);
    error.status = resp.status;
    throw error;
  }
  return datos;
}

/* ───────────────────────────────────────────────
   UTILIDADES DE UI
   ─────────────────────────────────────────────── */
function escapeHtml(str) {
  if (str === null || str === undefined) return '';
  return String(str)
    .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;').replace(/'/g, '&#39;');
}

function toast(mensaje, tipo = 'success') {
  const cont = document.getElementById('admin-toasts');
  const el = document.createElement('div');
  el.className = `admin-toast ${tipo}`;
  el.innerHTML = `<i class="ti ti-${tipo === 'error' ? 'alert-triangle' : 'check'}"></i><span>${escapeHtml(mensaje)}</span>`;
  cont.appendChild(el);
  setTimeout(() => el.remove(), 4200);
}

function manejarError(err, contextoDefault = 'Ocurrió un error inesperado.') {
  console.error(err);
  toast(err?.message || contextoDefault, 'error');
}

function abrirModal(titulo, bodyHtml, { ancho = false } = {}) {
  document.getElementById('admin-modal-title').textContent = titulo;
  document.getElementById('admin-modal-body').innerHTML = bodyHtml;
  document.getElementById('admin-modal').classList.toggle('admin-modal-wide', ancho);
  document.getElementById('admin-modal-backdrop').hidden = false;
}
function cerrarModal() {
  document.getElementById('admin-modal-backdrop').hidden = true;
  document.getElementById('admin-modal-body').innerHTML = '';
}
document.getElementById('admin-modal-close').addEventListener('click', cerrarModal);
document.getElementById('admin-modal-backdrop').addEventListener('click', (e) => {
  if (e.target.id === 'admin-modal-backdrop') cerrarModal();
});

function fmtFecha(valor) {
  if (!valor) return '—';
  const d = new Date(valor.includes(' ') ? valor.replace(' ', 'T') : valor);
  if (Number.isNaN(d.getTime())) return valor;
  return d.toLocaleDateString('es-PE', { day: '2-digit', month: 'short', year: 'numeric' });
}
function fmtFechaHora(valor) {
  if (!valor) return '—';
  const d = new Date(valor.includes(' ') ? valor.replace(' ', 'T') : valor);
  if (Number.isNaN(d.getTime())) return valor;
  return d.toLocaleString('es-PE', { day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit' });
}

const ETIQUETAS_TIPO_USUARIO = { registrado: 'Registrado', cliente: 'Cliente', admin: 'Admin' };
const ETIQUETAS_ESTADO_FICHA = { pendiente: 'Pendiente', en_revision: 'En revisión', atendida: 'Atendida' };
const ETIQUETAS_ESTADO_FASE = { pendiente: 'Pendiente', activo: 'En curso', completado: 'Completado', con_observacion: 'Con observación' };
const ETIQUETAS_ESTADO_PROYECTO = { activo: 'Activo', pausado: 'Pausado', cerrado: 'Cerrado', otorgado: 'Otorgado' };

function pill(texto, clase) { return `<span class="pill pill-${clase}">${escapeHtml(texto)}</span>`; }
function pillEstadoFicha(e) { return pill(ETIQUETAS_ESTADO_FICHA[e] || e, e === 'atendida' ? 'green' : e === 'en_revision' ? 'amber' : 'gray'); }
function pillEstadoFase(e) { return pill(ETIQUETAS_ESTADO_FASE[e] || e, e === 'completado' ? 'green' : e === 'activo' ? 'red' : e === 'con_observacion' ? 'amber' : 'gray'); }
function pillEstadoProyecto(e) { return pill(ETIQUETAS_ESTADO_PROYECTO[e] || e, e === 'otorgado' ? 'green' : e === 'activo' ? 'red' : 'gray'); }
function pillTipoUsuario(t) { return pill(ETIQUETAS_TIPO_USUARIO[t] || t, t === 'admin' ? 'dark' : t === 'cliente' ? 'green' : 'gray'); }

/* ───────────────────────────────────────────────
   AUTENTICACIÓN
   ─────────────────────────────────────────────── */
async function iniciar() {
  try {
    const { user } = await api('/auth/yo');
    if (user.tipo !== 'admin') {
      mostrarLogin('Esta cuenta no tiene permisos de administrador.');
      return;
    }
    ESTADO.usuario = user;
    mostrarApp();
  } catch {
    mostrarLogin();
  }
}

function mostrarLogin(error) {
  document.getElementById('admin-app').hidden = true;
  document.getElementById('admin-login-screen').hidden = false;
  const errBox = document.getElementById('admin-login-error');
  if (error) { errBox.textContent = error; errBox.hidden = false; } else { errBox.hidden = true; }
}

function mostrarApp() {
  document.getElementById('admin-login-screen').hidden = true;
  document.getElementById('admin-app').hidden = false;
  document.getElementById('admin-user-nombre').textContent = ESTADO.usuario.nombre;
  mostrarSeccion('dashboard');
}

document.getElementById('admin-login-form').addEventListener('submit', async (e) => {
  e.preventDefault();
  const email = document.getElementById('admin-login-email').value.trim();
  const password = document.getElementById('admin-login-password').value;
  const btn = e.target.querySelector('button[type="submit"]');
  btn.disabled = true;
  try {
    const { user } = await api('/auth/login', { method: 'POST', body: { email, password } });
    if (user.tipo !== 'admin') {
      await api('/auth/logout', { method: 'POST' }).catch(() => {});
      mostrarLogin('Esta cuenta no tiene permisos de administrador.');
      return;
    }
    ESTADO.usuario = user;
    mostrarApp();
  } catch (err) {
    mostrarLogin(err.message || 'No se pudo iniciar sesión.');
  } finally {
    btn.disabled = false;
  }
});

document.getElementById('btn-logout').addEventListener('click', async () => {
  try { await api('/auth/logout', { method: 'POST' }); } catch { /* ignorar */ }
  ESTADO.usuario = null;
  mostrarLogin();
});

/* ───────────────────────────────────────────────
   NAVEGACIÓN ENTRE SECCIONES
   ─────────────────────────────────────────────── */
const TITULOS_SECCION = {
  dashboard: ['Panel general', 'Resumen de actividad de la plataforma'],
  fichas: ['Fichas de orientación', 'Solicitudes enviadas por usuarios registrados'],
  usuarios: ['Usuarios', 'Cuentas registradas en la plataforma'],
  proyectos: ['Proyectos y seguimiento', 'Expedientes de patentes de los clientes'],
  biblioteca: ['Biblioteca virtual', 'Categorías y artículos educativos'],
  contenido: ['Contenido del sitio', 'Textos editables de la página pública'],
  faqs: ['Preguntas frecuentes', 'Panel FAQ del sitio público'],
  patentes: ['Patentes destacadas', 'Sección "Patentes otorgadas" del sitio público'],
  contactos: ['Mensajes de contacto', 'Formulario de contacto del sitio público'],
  notificaciones: ['Enviar notificación', 'Notificaciones individuales o masivas'],
};

const CARGADORES_SECCION = {
  dashboard: cargarDashboard,
  fichas: cargarFichas,
  usuarios: cargarUsuarios,
  proyectos: cargarProyectos,
  biblioteca: cargarBiblioteca,
  contenido: cargarContenido,
  faqs: cargarFaqs,
  patentes: cargarPatentes,
  contactos: cargarContactos,
  notificaciones: cargarNotificaciones,
};

function mostrarSeccion(nombre) {
  document.querySelectorAll('.admin-nav-item').forEach((b) => b.classList.toggle('active', b.dataset.section === nombre));
  document.querySelectorAll('.admin-section').forEach((s) => { s.hidden = s.id !== `section-${nombre}`; });
  const [titulo, sub] = TITULOS_SECCION[nombre];
  document.getElementById('admin-section-title').textContent = titulo;
  document.getElementById('admin-section-subtitle').textContent = sub;
  document.getElementById('admin-sidebar')?.classList.remove('open');
  document.getElementById('admin-sidebar-overlay')?.classList.remove('open');
  CARGADORES_SECCION[nombre]?.();
}

document.querySelectorAll('.admin-nav-item').forEach((btn) => {
  btn.addEventListener('click', () => mostrarSeccion(btn.dataset.section));
});

// Menú hamburguesa (solo visible en pantallas angostas vía CSS)
const sidebarEl = document.getElementById('admin-sidebar');
const overlayEl = document.getElementById('admin-sidebar-overlay');
document.getElementById('admin-hamburger').addEventListener('click', () => {
  sidebarEl.classList.add('open');
  overlayEl.classList.add('open');
});
overlayEl.addEventListener('click', () => {
  sidebarEl.classList.remove('open');
  overlayEl.classList.remove('open');
});

/* ═══════════════════════════════════════════════
   1) DASHBOARD
═══════════════════════════════════════════════ */
async function cargarDashboard() {
  const cont = document.getElementById('section-dashboard');
  cont.innerHTML = `<div class="admin-loading"><i class="ti ti-loader-2 spin"></i> Cargando…</div>`;
  try {
    const s = await api('/admin/stats');
    actualizarBadges(s);
    cont.innerHTML = `
      <div class="admin-stats-grid">
        ${statCard(s.usuarios.total, 'Usuarios totales', false)}
        ${statCard(s.usuarios.clientes, 'Clientes activos', true)}
        ${statCard(s.fichas.pendientes, 'Fichas pendientes', s.fichas.pendientes > 0)}
        ${statCard(s.proyectos.activos, 'Proyectos en curso', false)}
        ${statCard(s.proyectos.otorgados, 'Patentes otorgadas', false)}
        ${statCard(s.contactos.sinLeer, 'Mensajes sin leer', s.contactos.sinLeer > 0)}
      </div>
      <div class="admin-panel-block">
        <div class="admin-panel-block-head"><h3>Accesos rápidos</h3></div>
        <div class="admin-panel-block-body" style="display:flex;gap:12px;flex-wrap:wrap;">
          <button class="admin-btn admin-btn-outline" onclick="mostrarSeccion('fichas')"><i class="ti ti-clipboard-text"></i> Revisar fichas</button>
          <button class="admin-btn admin-btn-outline" onclick="mostrarSeccion('proyectos')"><i class="ti ti-timeline"></i> Ver proyectos</button>
          <button class="admin-btn admin-btn-outline" onclick="mostrarSeccion('contactos')"><i class="ti ti-mail"></i> Ver mensajes</button>
          <button class="admin-btn admin-btn-outline" onclick="mostrarSeccion('contenido')"><i class="ti ti-edit"></i> Editar sitio público</button>
        </div>
      </div>`;
  } catch (err) {
    cont.innerHTML = errorBlock('No se pudo cargar el panel general.');
    manejarError(err);
  }
}
function statCard(n, label, accent) {
  return `<div class="admin-stat-card ${accent ? 'accent' : ''}"><div class="n">${n}</div><div class="label">${escapeHtml(label)}</div></div>`;
}
function errorBlock(msg) {
  return `<div class="admin-empty"><i class="ti ti-alert-triangle"></i>${escapeHtml(msg)}</div>`;
}
function actualizarBadges(s) {
  const bF = document.getElementById('badge-fichas');
  const bC = document.getElementById('badge-contactos');
  const pend = s.fichas.pendientes || 0;
  const sinLeer = s.contactos.sinLeer || 0;
  bF.textContent = pend; bF.hidden = pend === 0;
  bC.textContent = sinLeer; bC.hidden = sinLeer === 0;
}

/* ═══════════════════════════════════════════════
   2) FICHAS DE ORIENTACIÓN
═══════════════════════════════════════════════ */
async function cargarFichas(estadoFiltro = '', q = '') {
  const cont = document.getElementById('section-fichas');
  cont.innerHTML = `
    <div class="admin-toolbar">
      <div class="grow"><input id="f-fichas-q" class="admin-input" placeholder="Buscar por usuario o proyecto…" value="${escapeHtml(q)}" /></div>
      <select id="f-fichas-estado" class="admin-select" style="width:180px">
        <option value="">Todos los estados</option>
        <option value="pendiente">Pendiente</option>
        <option value="en_revision">En revisión</option>
        <option value="atendida">Atendida</option>
      </select>
    </div>
    <div id="fichas-tabla" class="admin-panel-block"><div class="admin-loading"><i class="ti ti-loader-2 spin"></i> Cargando…</div></div>`;
  document.getElementById('f-fichas-estado').value = estadoFiltro;
  document.getElementById('f-fichas-estado').addEventListener('change', (e) => cargarFichas(e.target.value, document.getElementById('f-fichas-q').value));
  document.getElementById('f-fichas-q').addEventListener('keydown', (e) => { if (e.key === 'Enter') cargarFichas(document.getElementById('f-fichas-estado').value, e.target.value); });

  try {
    const { fichas } = await api(`/admin/fichas?${new URLSearchParams({ estado: estadoFiltro, q })}`);
    const tabla = document.getElementById('fichas-tabla');
    if (fichas.length === 0) { tabla.innerHTML = errorBlockInfo('No hay fichas con ese filtro.'); return; }
    tabla.innerHTML = `<div class="admin-table-wrap"><table class="admin-table">
      <thead><tr><th>Usuario</th><th>Proyecto</th><th>Sector</th><th>TRL</th><th>Estado</th><th>Enviada</th><th></th></tr></thead>
      <tbody>${fichas.map((f) => `
        <tr>
          <td><strong>${escapeHtml(f.usuarioNombre)}</strong><br><span class="muted">${escapeHtml(f.usuarioEmail)}</span></td>
          <td>${escapeHtml(f.tituloProyecto)}</td>
          <td class="muted">${escapeHtml(f.sector || '—')}</td>
          <td class="muted">${escapeHtml(f.nivelTrl || '—')}</td>
          <td>${pillEstadoFicha(f.estado)}</td>
          <td class="muted">${fmtFecha(f.enviadaEn)}</td>
          <td><button class="admin-btn admin-btn-outline admin-btn-sm" onclick="verFicha(${f.id})">Ver ficha</button></td>
        </tr>`).join('')}</tbody></table></div>`;
  } catch (err) {
    document.getElementById('fichas-tabla').innerHTML = errorBlock('No se pudieron cargar las fichas.');
    manejarError(err);
  }
}
function errorBlockInfo(msg) { return `<div class="admin-empty"><i class="ti ti-inbox"></i>${escapeHtml(msg)}</div>`; }

async function verFicha(id) {
  try {
    const { ficha: f } = await api(`/admin/fichas/${id}`);
    const docs = (f.documentacion || []).join(', ') || 'No especificó';
    abrirModal(f.tituloProyecto, `
      <div class="admin-field"><label>Solicitante</label><div>${escapeHtml(f.usuarioNombre)} — ${escapeHtml(f.usuarioEmail)}</div></div>
      <div class="admin-field"><label>Descripción</label><div>${escapeHtml(f.descripcion)}</div></div>
      <div class="admin-field-row">
        <div class="admin-field"><label>Sector</label><div>${escapeHtml(f.sector || '—')}</div></div>
        <div class="admin-field"><label>Nivel TRL</label><div>${escapeHtml(f.nivelTrl || '—')}</div></div>
      </div>
      <div class="admin-field-row">
        <div class="admin-field"><label>¿Ya divulgada?</label><div>${escapeHtml(f.yaDivulgada)}</div></div>
        <div class="admin-field"><label>¿Tiene socios?</label><div>${escapeHtml(f.tieneSocios)}</div></div>
      </div>
      <div class="admin-field"><label>Documentación disponible</label><div>${escapeHtml(docs)}</div></div>
      <div class="admin-field"><label>Dudas principales</label><div>${escapeHtml(f.dudas || '—')}</div></div>
      <hr style="border:none;border-top:1px solid var(--gray-200);margin:16px 0" />
      <div class="admin-field"><label>Estado</label>
        <select id="ficha-estado" class="admin-select">
          <option value="pendiente" ${f.estado === 'pendiente' ? 'selected' : ''}>Pendiente</option>
          <option value="en_revision" ${f.estado === 'en_revision' ? 'selected' : ''}>En revisión</option>
          <option value="atendida" ${f.estado === 'atendida' ? 'selected' : ''}>Atendida</option>
        </select>
      </div>
      <div class="admin-field"><label>Notas internas</label><textarea id="ficha-notas" class="admin-textarea" placeholder="Notas visibles solo para el equipo…">${escapeHtml(f.notasAdmin || '')}</textarea></div>
      <div class="admin-modal-actions">
        <button class="admin-btn admin-btn-outline" onclick="cerrarModal()">Cerrar</button>
        <button class="admin-btn admin-btn-red" onclick="guardarFicha(${f.id})">Guardar cambios</button>
      </div>`, { ancho: true });
  } catch (err) { manejarError(err); }
}
async function guardarFicha(id) {
  try {
    await api(`/admin/fichas/${id}`, { method: 'PATCH', body: {
      estado: document.getElementById('ficha-estado').value,
      notasAdmin: document.getElementById('ficha-notas').value,
    } });
    toast('Ficha actualizada.');
    cerrarModal();
    cargarFichas();
    cargarDashboard();
  } catch (err) { manejarError(err); }
}

/* ═══════════════════════════════════════════════
   3) USUARIOS
═══════════════════════════════════════════════ */
async function cargarUsuarios(tipoFiltro = '', q = '') {
  const cont = document.getElementById('section-usuarios');
  cont.innerHTML = `
    <div class="admin-toolbar">
      <div class="grow"><input id="f-usr-q" class="admin-input" placeholder="Buscar por nombre o correo…" value="${escapeHtml(q)}" /></div>
      <select id="f-usr-tipo" class="admin-select" style="width:180px">
        <option value="">Todos los tipos</option>
        <option value="registrado">Registrado</option>
        <option value="cliente">Cliente</option>
        <option value="admin">Admin</option>
      </select>
    </div>
    <div id="usr-tabla" class="admin-panel-block"><div class="admin-loading"><i class="ti ti-loader-2 spin"></i> Cargando…</div></div>`;
  document.getElementById('f-usr-tipo').value = tipoFiltro;
  document.getElementById('f-usr-tipo').addEventListener('change', (e) => cargarUsuarios(e.target.value, document.getElementById('f-usr-q').value));
  document.getElementById('f-usr-q').addEventListener('keydown', (e) => { if (e.key === 'Enter') cargarUsuarios(document.getElementById('f-usr-tipo').value, e.target.value); });

  try {
    const { datos } = await api(`/admin/usuarios?${new URLSearchParams({ tipo: tipoFiltro, q, page: 1 })}`);
    ESTADO.usuariosCache = datos;
    const tabla = document.getElementById('usr-tabla');
    if (datos.length === 0) { tabla.innerHTML = errorBlockInfo('No hay usuarios con ese filtro.'); return; }
    tabla.innerHTML = `<div class="admin-table-wrap"><table class="admin-table">
      <thead><tr><th>Nombre</th><th>Correo</th><th>Tipo</th><th>Organización</th><th>Ficha</th><th>Registrado</th><th></th></tr></thead>
      <tbody>${datos.map((u) => `
        <tr>
          <td><strong>${escapeHtml(u.nombre)}</strong>${u.activo ? '' : ' <span class="pill pill-red">Inactivo</span>'}</td>
          <td class="muted">${escapeHtml(u.email)}</td>
          <td>${pillTipoUsuario(u.tipo)}</td>
          <td class="muted">${escapeHtml(u.organizacion || '—')}</td>
          <td>${u.fichaEnviada ? '<i class="ti ti-check" style="color:var(--green)"></i>' : '<span class="muted">—</span>'}</td>
          <td class="muted">${fmtFecha(u.creadoEn)}</td>
          <td><button class="admin-btn admin-btn-outline admin-btn-sm" onclick="verUsuario(${u.id})">Ver</button></td>
        </tr>`).join('')}</tbody></table></div>`;
  } catch (err) {
    document.getElementById('usr-tabla').innerHTML = errorBlock('No se pudieron cargar los usuarios.');
    manejarError(err);
  }
}

async function verUsuario(id) {
  try {
    const { usuario: u, ficha, proyecto } = await api(`/admin/usuarios/${id}`);
    abrirModal(u.nombre, `
      <div class="admin-field-row">
        <div class="admin-field"><label>Correo</label><div>${escapeHtml(u.email)}</div></div>
        <div class="admin-field"><label>Registrado</label><div>${fmtFecha(u.creadoEn)}</div></div>
      </div>
      <div class="admin-field-row">
        <div class="admin-field"><label>Tipo de cuenta</label>
          <select id="usr-tipo" class="admin-select" ${u.id === ESTADO.usuario.id ? 'disabled' : ''}>
            <option value="registrado" ${u.tipo === 'registrado' ? 'selected' : ''}>Registrado</option>
            <option value="cliente" ${u.tipo === 'cliente' ? 'selected' : ''}>Cliente</option>
            <option value="admin" ${u.tipo === 'admin' ? 'selected' : ''}>Admin</option>
          </select>
        </div>
        <div class="admin-field"><label>Estado de cuenta</label>
          <select id="usr-activo" class="admin-select" ${u.id === ESTADO.usuario.id ? 'disabled' : ''}>
            <option value="true" ${u.activo ? 'selected' : ''}>Activa</option>
            <option value="false" ${!u.activo ? 'selected' : ''}>Desactivada</option>
          </select>
        </div>
      </div>
      <div class="admin-field-row">
        <div class="admin-field"><label>Organización</label><input id="usr-org" class="admin-input" value="${escapeHtml(u.organizacion || '')}" /></div>
        <div class="admin-field"><label>Teléfono</label><input id="usr-tel" class="admin-input" value="${escapeHtml(u.telefono || '')}" /></div>
      </div>
      <hr style="border:none;border-top:1px solid var(--gray-200);margin:16px 0" />
      <div class="admin-field"><label>Ficha de orientación</label>
        <div>${ficha ? `${escapeHtml(ficha.tituloProyecto)} — ${pillEstadoFicha(ficha.estado)}` : '<span class="muted">No ha enviado ficha</span>'}</div>
      </div>
      <div class="admin-field"><label>Proyecto de patente</label>
        <div>${proyecto ? `${escapeHtml(proyecto.titulo)} — ${pillEstadoProyecto(proyecto.estado)} (${proyecto.porcentajeAvance}%)` : '<span class="muted">Sin proyecto asignado</span>'}</div>
      </div>
      <div class="admin-modal-actions">
        ${!proyecto && u.tipo !== 'admin' ? `<button class="admin-btn admin-btn-dark" onclick="cerrarModal();abrirFormularioProyecto(${u.id},'${escapeHtml(u.nombre).replace(/'/g, "\\'")}')"><i class="ti ti-plus"></i> Crear proyecto</button>` : ''}
        <button class="admin-btn admin-btn-outline" onclick="cerrarModal()">Cancelar</button>
        <button class="admin-btn admin-btn-red" onclick="guardarUsuario(${u.id})">Guardar cambios</button>
      </div>`, { ancho: true });
  } catch (err) { manejarError(err); }
}
async function guardarUsuario(id) {
  const cambios = {
    organizacion: document.getElementById('usr-org').value || null,
    telefono: document.getElementById('usr-tel').value || null,
  };
  const selTipo = document.getElementById('usr-tipo');
  const selActivo = document.getElementById('usr-activo');
  if (!selTipo.disabled) cambios.tipo = selTipo.value;
  if (!selActivo.disabled) cambios.activo = selActivo.value === 'true';
  try {
    await api(`/admin/usuarios/${id}`, { method: 'PATCH', body: cambios });
    toast('Usuario actualizado.');
    cerrarModal();
    cargarUsuarios();
  } catch (err) { manejarError(err); }
}

/* ═══════════════════════════════════════════════
   4) PROYECTOS Y SEGUIMIENTO
═══════════════════════════════════════════════ */
async function cargarProyectos(estadoFiltro = '', q = '') {
  const cont = document.getElementById('section-proyectos');
  cont.innerHTML = `
    <div class="admin-toolbar">
      <div class="grow"><input id="f-proy-q" class="admin-input" placeholder="Buscar por título, expediente o cliente…" value="${escapeHtml(q)}" /></div>
      <select id="f-proy-estado" class="admin-select" style="width:170px">
        <option value="">Todos los estados</option>
        <option value="activo">Activo</option><option value="pausado">Pausado</option>
        <option value="cerrado">Cerrado</option><option value="otorgado">Otorgado</option>
      </select>
      <button class="admin-btn admin-btn-red" onclick="mostrarSeccion('usuarios')"><i class="ti ti-plus"></i> Nuevo (desde Usuarios)</button>
    </div>
    <div id="proy-tabla" class="admin-panel-block"><div class="admin-loading"><i class="ti ti-loader-2 spin"></i> Cargando…</div></div>`;
  document.getElementById('f-proy-estado').value = estadoFiltro;
  document.getElementById('f-proy-estado').addEventListener('change', (e) => cargarProyectos(e.target.value, document.getElementById('f-proy-q').value));
  document.getElementById('f-proy-q').addEventListener('keydown', (e) => { if (e.key === 'Enter') cargarProyectos(document.getElementById('f-proy-estado').value, e.target.value); });

  try {
    const { proyectos } = await api(`/admin/proyectos?${new URLSearchParams({ estado: estadoFiltro, q })}`);
    const tabla = document.getElementById('proy-tabla');
    if (proyectos.length === 0) { tabla.innerHTML = errorBlockInfo('No hay proyectos con ese filtro. Para crear uno, ve a Usuarios y abre la ficha de un cliente potencial.'); return; }
    tabla.innerHTML = `<div class="admin-table-wrap"><table class="admin-table">
      <thead><tr><th>Proyecto</th><th>Cliente</th><th>Expediente</th><th>Avance</th><th>Estado</th><th></th></tr></thead>
      <tbody>${proyectos.map((p) => `
        <tr>
          <td><strong>${escapeHtml(p.titulo)}</strong></td>
          <td class="muted">${escapeHtml(p.usuarioNombre)}</td>
          <td class="muted">${escapeHtml(p.numeroExpediente || '—')}</td>
          <td style="min-width:120px">
            <div class="admin-progress-track"><div class="admin-progress-fill" style="width:${p.porcentajeAvance}%"></div></div>
            <span class="muted" style="font-size:11px">${p.porcentajeAvance}%</span>
          </td>
          <td>${pillEstadoProyecto(p.estado)}</td>
          <td><button class="admin-btn admin-btn-outline admin-btn-sm" onclick="abrirDetalleProyecto(${p.id})">Gestionar</button></td>
        </tr>`).join('')}</tbody></table></div>`;
  } catch (err) {
    document.getElementById('proy-tabla').innerHTML = errorBlock('No se pudieron cargar los proyectos.');
    manejarError(err);
  }
}

function abrirFormularioProyecto(usuarioId, nombreUsuario) {
  const hoy = new Date().toISOString().slice(0, 10);
  abrirModal(`Crear proyecto para ${nombreUsuario}`, `
    <div class="admin-field"><label>Título del proyecto</label><input id="np-titulo" class="admin-input" placeholder="Ej. Sistema de filtración de agua mediante nanomateriales" /></div>
    <div class="admin-field-row">
      <div class="admin-field"><label>Tipo de patente</label>
        <select id="np-tipo" class="admin-select">
          <option value="invencion">Patente de invención</option>
          <option value="modelo_utilidad">Modelo de utilidad</option>
          <option value="diseno_industrial">Diseño industrial</option>
          <option value="otro">Otro</option>
        </select>
      </div>
      <div class="admin-field"><label>N° de expediente (opcional)</label><input id="np-expediente" class="admin-input" placeholder="Se completa al presentar ante INDECOPI" /></div>
    </div>
    <div class="admin-field-row">
      <div class="admin-field"><label>Fecha de inicio</label><input id="np-inicio" type="date" class="admin-input" value="${hoy}" /></div>
      <div class="admin-field"><label>Fecha estimada de resolución</label><input id="np-estimada" type="date" class="admin-input" /></div>
    </div>
    <p class="admin-field-hint">Se crearán automáticamente las 9 fases del proceso en estado "pendiente", y el usuario pasará a tipo "cliente".</p>
    <div class="admin-modal-actions">
      <button class="admin-btn admin-btn-outline" onclick="cerrarModal()">Cancelar</button>
      <button class="admin-btn admin-btn-red" onclick="crearProyecto(${usuarioId})">Crear proyecto</button>
    </div>`);
}
async function crearProyecto(usuarioId) {
  const titulo = document.getElementById('np-titulo').value.trim();
  const fechaInicio = document.getElementById('np-inicio').value;
  if (!titulo || !fechaInicio) return toast('Completa al menos el título y la fecha de inicio.', 'error');
  try {
    const { proyecto } = await api('/admin/proyectos', { method: 'POST', body: {
      usuarioId, titulo,
      tipoPatente: document.getElementById('np-tipo').value,
      numeroExpediente: document.getElementById('np-expediente').value || null,
      fechaInicio,
      fechaEstimada: document.getElementById('np-estimada').value || null,
    } });
    toast('Proyecto creado. El cliente ya puede ver su seguimiento.');
    cerrarModal();
    abrirDetalleProyecto(proyecto.id);
  } catch (err) { manejarError(err); }
}

async function abrirDetalleProyecto(id) {
  const cont = document.getElementById('section-proyectos');
  cont.innerHTML = `<div class="admin-loading"><i class="ti ti-loader-2 spin"></i> Cargando proyecto…</div>`;
  try {
    const { proyecto: p, fases, documentos, alertas } = await api(`/admin/proyectos/${id}`);
    cont.innerHTML = `
      <div class="admin-back-link" onclick="cargarProyectos()"><i class="ti ti-arrow-left"></i> Volver a proyectos</div>
      <div class="admin-detail-header">
        <div>
          <h2 style="font-family:var(--font-serif);font-size:22px;margin-bottom:4px">${escapeHtml(p.titulo)}</h2>
          <p class="muted">${escapeHtml(p.usuarioNombre)} — ${escapeHtml(p.usuarioEmail)}</p>
        </div>
        <div style="display:flex;gap:10px;align-items:center">
          ${pillEstadoProyecto(p.estado)}
          <div style="text-align:right">
            <div style="font-weight:700;font-size:18px">${p.porcentajeAvance}%</div>
            <div class="admin-progress-track" style="width:120px"><div class="admin-progress-fill" style="width:${p.porcentajeAvance}%"></div></div>
          </div>
        </div>
      </div>

      <div class="admin-tabs">
        <button class="admin-tab active" data-tab="info">Información</button>
        <button class="admin-tab" data-tab="fases">Seguimiento (${fases.length} fases)</button>
        <button class="admin-tab" data-tab="documentos">Documentos (${documentos.length})</button>
        <button class="admin-tab" data-tab="alertas">Alertas (${alertas.length})</button>
      </div>

      <div id="tab-info" class="admin-tab-panel">${panelInfoProyecto(p)}</div>
      <div id="tab-fases" class="admin-tab-panel" hidden>${panelFasesProyecto(p, fases)}</div>
      <div id="tab-documentos" class="admin-tab-panel" hidden>${panelDocumentosProyecto(p, documentos)}</div>
      <div id="tab-alertas" class="admin-tab-panel" hidden>${panelAlertasProyecto(p, alertas)}</div>
    `;
    cont.querySelectorAll('.admin-tab').forEach((tab) => tab.addEventListener('click', () => {
      cont.querySelectorAll('.admin-tab').forEach((t) => t.classList.toggle('active', t === tab));
      cont.querySelectorAll('.admin-tab-panel').forEach((p2) => { p2.hidden = p2.id !== `tab-${tab.dataset.tab}`; });
    }));
    document.getElementById('info-form').addEventListener('submit', (e) => { e.preventDefault(); guardarInfoProyecto(id); });
    document.getElementById('doc-input').addEventListener('change', (e) => subirDocumentoAdmin(id, e.target.files[0]));
    document.getElementById('alerta-form').addEventListener('submit', (e) => { e.preventDefault(); agregarAlertaAdmin(id); });
  } catch (err) {
    cont.innerHTML = errorBlock('No se pudo cargar el proyecto.');
    manejarError(err);
  }
}

function panelInfoProyecto(p) {
  return `<form id="info-form" class="admin-panel-block"><div class="admin-panel-block-body">
    <div class="admin-field-row">
      <div class="admin-field"><label>Título</label><input id="ip-titulo" class="admin-input" value="${escapeHtml(p.titulo)}" /></div>
      <div class="admin-field"><label>N° de expediente</label><input id="ip-expediente" class="admin-input" value="${escapeHtml(p.numeroExpediente || '')}" /></div>
    </div>
    <div class="admin-field-row-3">
      <div class="admin-field"><label>Tipo de patente</label>
        <select id="ip-tipo" class="admin-select">
          ${['invencion', 'modelo_utilidad', 'diseno_industrial', 'otro'].map((t) => `<option value="${t}" ${p.tipoPatente === t ? 'selected' : ''}>${t.replace('_', ' ')}</option>`).join('')}
        </select>
      </div>
      <div class="admin-field"><label>Estado</label>
        <select id="ip-estado" class="admin-select">
          ${['activo', 'pausado', 'cerrado', 'otorgado'].map((t) => `<option value="${t}" ${p.estado === t ? 'selected' : ''}>${ETIQUETAS_ESTADO_PROYECTO[t]}</option>`).join('')}
        </select>
      </div>
      <div class="admin-field"><label>% de avance (manual)</label><input id="ip-avance" type="number" min="0" max="100" class="admin-input" value="${p.porcentajeAvance}" /></div>
    </div>
    <div class="admin-field"><label>Fecha estimada de resolución</label><input id="ip-estimada" type="date" class="admin-input" value="${p.fechaEstimada ? p.fechaEstimada.slice(0, 10) : ''}" /></div>
    <div class="admin-field"><label>Notas internas (no visibles para el cliente)</label><textarea id="ip-notas" class="admin-textarea">${escapeHtml(p.notasInternas || '')}</textarea></div>
    <button type="submit" class="admin-btn admin-btn-red"><i class="ti ti-device-floppy"></i> Guardar información</button>
  </div></form>`;
}
async function guardarInfoProyecto(id) {
  try {
    await api(`/admin/proyectos/${id}`, { method: 'PATCH', body: {
      titulo: document.getElementById('ip-titulo').value,
      numeroExpediente: document.getElementById('ip-expediente').value || null,
      tipoPatente: document.getElementById('ip-tipo').value,
      estado: document.getElementById('ip-estado').value,
      porcentajeAvance: Number(document.getElementById('ip-avance').value),
      fechaEstimada: document.getElementById('ip-estimada').value || null,
      notasInternas: document.getElementById('ip-notas').value || null,
    } });
    toast('Información del proyecto actualizada.');
    abrirDetalleProyecto(id);
  } catch (err) { manejarError(err); }
}

function panelFasesProyecto(p, fases) {
  return `<div class="admin-panel-block"><div class="admin-panel-block-body">
    <p class="admin-field-hint" style="margin-bottom:14px">Haz clic en una fase para actualizar su estado. El cliente recibe una notificación automática cada vez que cambias el estado de una fase.</p>
    <div class="admin-phase-list">
      ${fases.map((f) => `
        <div class="admin-phase-row ${f.estado}" onclick="editarFase(${p.id},${f.faseId},'${escapeHtml(f.nombre).replace(/'/g, "\\'")}',${JSON.stringify(f).replace(/"/g, '&quot;')})">
          <div class="num">${f.orden}</div>
          <div class="info">
            <div class="t">${escapeHtml(f.nombre)}</div>
            <div class="d">${f.fechaInicio ? fmtFecha(f.fechaInicio) : 'Sin iniciar'}${f.fechaFin ? ' → ' + fmtFecha(f.fechaFin) : ''}${f.observacion ? ' · Observación registrada' : ''}</div>
          </div>
          ${pillEstadoFase(f.estado)}
        </div>`).join('')}
    </div>
  </div></div>`;
}
function editarFase(proyectoId, faseId, nombre, faseJson) {
  const f = typeof faseJson === 'string' ? JSON.parse(faseJson.replace(/&quot;/g, '"')) : faseJson;
  abrirModal(nombre, `
    <div class="admin-field"><label>Estado</label>
      <select id="fase-estado" class="admin-select">
        ${['pendiente', 'activo', 'completado', 'con_observacion'].map((e) => `<option value="${e}" ${f.estado === e ? 'selected' : ''}>${ETIQUETAS_ESTADO_FASE[e]}</option>`).join('')}
      </select>
    </div>
    <div class="admin-field-row">
      <div class="admin-field"><label>Fecha de inicio</label><input id="fase-inicio" type="date" class="admin-input" value="${f.fechaInicio ? f.fechaInicio.slice(0, 10) : ''}" /></div>
      <div class="admin-field"><label>Fecha de fin</label><input id="fase-fin" type="date" class="admin-input" value="${f.fechaFin ? f.fechaFin.slice(0, 10) : ''}" /></div>
    </div>
    <div class="admin-field"><label>Nota interna</label><textarea id="fase-nota" class="admin-textarea">${escapeHtml(f.nota || '')}</textarea></div>
    <div class="admin-field"><label>Observación oficial (visible para el cliente)</label><textarea id="fase-observacion" class="admin-textarea" placeholder="Ej: se requiere adjuntar poder notarial antes del...">${escapeHtml(f.observacion || '')}</textarea></div>
    <div class="admin-modal-actions">
      <button class="admin-btn admin-btn-outline" onclick="cerrarModal()">Cancelar</button>
      <button class="admin-btn admin-btn-red" onclick="guardarFase(${proyectoId},${faseId})">Guardar y notificar al cliente</button>
    </div>`, { ancho: true });
}
async function guardarFase(proyectoId, faseId) {
  try {
    await api(`/admin/proyectos/${proyectoId}/fases/${faseId}`, { method: 'PATCH', body: {
      estado: document.getElementById('fase-estado').value,
      fechaInicio: document.getElementById('fase-inicio').value || null,
      fechaFin: document.getElementById('fase-fin').value || null,
      nota: document.getElementById('fase-nota').value || null,
      observacion: document.getElementById('fase-observacion').value || null,
    } });
    toast('Fase actualizada y cliente notificado.');
    cerrarModal();
    abrirDetalleProyecto(proyectoId);
  } catch (err) { manejarError(err); }
}

function panelDocumentosProyecto(p, documentos) {
  return `
    <div class="admin-panel-block"><div class="admin-panel-block-body">
      <label for="doc-input" class="admin-dropzone" style="display:block">
        <i class="ti ti-cloud-upload"></i>
        Haz clic para subir un documento del expediente<br />
        <span style="font-size:11.5px">PDF, DOC/DOCX, imágenes, STL/OBJ/GLB o ZIP · máx. 20&nbsp;MB</span>
      </label>
      <input type="file" id="doc-input" hidden accept=".pdf,.doc,.docx,.png,.jpg,.jpeg,.webp,.stl,.obj,.glb,.zip" />
    </div></div>
    <div class="admin-panel-block"><div class="admin-panel-block-body">
      ${documentos.length === 0 ? errorBlockInfo('Aún no hay documentos en este expediente.') : documentos.map((d) => `
        <div class="admin-doc-row">
          <i class="ti ti-file-text"></i>
          <div class="name">${escapeHtml(d.nombre)}</div>
          <div class="meta">${d.tamanoKb ? d.tamanoKb + ' KB' : ''} · subido por ${d.subidoPor} · ${fmtFecha(d.creadoEn)}</div>
          ${pill(d.esPublicoCliente ? 'Visible al cliente' : 'Solo interno', d.esPublicoCliente ? 'green' : 'gray')}
          <div class="admin-row-actions">
            <button class="admin-btn admin-btn-icon admin-btn-ghost" title="Descargar" onclick="window.open('/api/admin/documentos/${d.id}/descargar','_blank')"><i class="ti ti-download"></i></button>
            <button class="admin-btn admin-btn-icon admin-btn-ghost" title="${d.esPublicoCliente ? 'Ocultar al cliente' : 'Mostrar al cliente'}" onclick="alternarVisibilidadDocumento(${p.id},${d.id},${!d.esPublicoCliente})"><i class="ti ti-${d.esPublicoCliente ? 'eye-off' : 'eye'}"></i></button>
            <button class="admin-btn admin-btn-icon admin-btn-danger" title="Eliminar" onclick="eliminarDocumentoAdmin(${p.id},${d.id})"><i class="ti ti-trash"></i></button>
          </div>
        </div>`).join('')}
    </div></div>`;
}
async function subirDocumentoAdmin(proyectoId, archivo) {
  if (!archivo) return;
  const fd = new FormData();
  fd.append('archivo', archivo);
  fd.append('esPublicoCliente', 'true');
  try {
    await api(`/admin/proyectos/${proyectoId}/documentos`, { method: 'POST', body: fd });
    toast('Documento subido.');
    abrirDetalleProyecto(proyectoId);
  } catch (err) { manejarError(err); }
}
async function alternarVisibilidadDocumento(proyectoId, docId, nuevoValor) {
  try {
    await api(`/admin/documentos/${docId}`, { method: 'PATCH', body: { esPublicoCliente: nuevoValor } });
    abrirDetalleProyecto(proyectoId);
  } catch (err) { manejarError(err); }
}
async function eliminarDocumentoAdmin(proyectoId, docId) {
  if (!confirm('¿Eliminar este documento del expediente? Esta acción no se puede deshacer.')) return;
  try {
    await api(`/admin/documentos/${docId}`, { method: 'DELETE' });
    toast('Documento eliminado.');
    abrirDetalleProyecto(proyectoId);
  } catch (err) { manejarError(err); }
}

function panelAlertasProyecto(p, alertas) {
  return `
    <form id="alerta-form" class="admin-panel-block"><div class="admin-panel-block-body">
      <div class="admin-field-row-3">
        <div class="admin-field"><label>Tipo</label>
          <select id="al-tipo" class="admin-select">
            <option value="urgente">Urgente</option><option value="tasa">Tasa</option>
            <option value="observacion">Observación</option><option value="recordatorio">Recordatorio</option><option value="info">Informativa</option>
          </select>
        </div>
        <div class="admin-field" style="grid-column:span 2"><label>Mensaje</label><input id="al-mensaje" class="admin-input" placeholder="Ej. Adjuntar poder notarial antes del..." /></div>
      </div>
      <div class="admin-field"><label>Fecha límite (opcional)</label><input id="al-fecha" type="date" class="admin-input" style="max-width:220px" /></div>
      <button type="submit" class="admin-btn admin-btn-red"><i class="ti ti-bell-plus"></i> Agregar alerta y notificar</button>
    </div></form>
    <div class="admin-panel-block"><div class="admin-panel-block-body">
      ${alertas.length === 0 ? errorBlockInfo('No hay alertas registradas.') : alertas.map((a) => `
        <div class="admin-alert-row">
          <i class="ti ti-${a.tipo === 'urgente' ? 'alert-triangle' : 'bell'}"></i>
          <div class="name">${escapeHtml(a.mensaje)}</div>
          <div class="meta">${a.fechaLimite ? 'Límite: ' + fmtFecha(a.fechaLimite) : fmtFecha(a.creadoEn)}</div>
          ${pill(a.leida ? 'Leída' : 'Sin leer', a.leida ? 'gray' : 'red')}
          <button class="admin-btn admin-btn-icon admin-btn-danger" onclick="eliminarAlertaAdmin(${p.id},${a.id})"><i class="ti ti-trash"></i></button>
        </div>`).join('')}
    </div></div>`;
}
async function agregarAlertaAdmin(proyectoId) {
  const mensaje = document.getElementById('al-mensaje').value.trim();
  if (!mensaje) return toast('Escribe el mensaje de la alerta.', 'error');
  try {
    await api(`/admin/proyectos/${proyectoId}/alertas`, { method: 'POST', body: {
      tipo: document.getElementById('al-tipo').value,
      mensaje,
      fechaLimite: document.getElementById('al-fecha').value || null,
    } });
    toast('Alerta creada y cliente notificado.');
    abrirDetalleProyecto(proyectoId);
  } catch (err) { manejarError(err); }
}
async function eliminarAlertaAdmin(proyectoId, alertaId) {
  if (!confirm('¿Eliminar esta alerta?')) return;
  try {
    await api(`/admin/alertas/${alertaId}`, { method: 'DELETE' });
    abrirDetalleProyecto(proyectoId);
  } catch (err) { manejarError(err); }
}

/* ═══════════════════════════════════════════════
   5) BIBLIOTECA VIRTUAL
═══════════════════════════════════════════════ */
async function cargarBiblioteca() {
  const cont = document.getElementById('section-biblioteca');
  cont.innerHTML = `<div class="admin-loading"><i class="ti ti-loader-2 spin"></i> Cargando…</div>`;
  try {
    const [{ categorias }, { articulos }] = await Promise.all([
      api('/admin/biblioteca/categorias'), api('/admin/biblioteca/articulos'),
    ]);
    cont.innerHTML = `
      <div class="admin-panel-block">
        <div class="admin-panel-block-head"><h3>Categorías</h3><button class="admin-btn admin-btn-outline admin-btn-sm" onclick="formCategoria()"><i class="ti ti-plus"></i> Nueva categoría</button></div>
        <div class="admin-panel-block-body admin-table-wrap"><table class="admin-table">
          <thead><tr><th>Slug</th><th>Nombre</th><th>Ícono</th><th>Orden</th><th></th></tr></thead>
          <tbody>${categorias.map((c) => `
            <tr><td class="muted">${escapeHtml(c.slug)}</td><td><strong>${escapeHtml(c.nombre)}</strong></td>
            <td class="muted">${escapeHtml(c.icono || '—')}</td><td class="muted">${c.orden}</td>
            <td class="admin-row-actions">
              <button class="admin-btn admin-btn-icon admin-btn-ghost" onclick='formCategoria(${JSON.stringify(c)})'><i class="ti ti-pencil"></i></button>
              <button class="admin-btn admin-btn-icon admin-btn-danger" onclick="eliminarCategoria(${c.id})"><i class="ti ti-trash"></i></button>
            </td></tr>`).join('')}</tbody></table></div>
      </div>
      <div class="admin-panel-block">
        <div class="admin-panel-block-head"><h3>Artículos (${articulos.length})</h3><button class="admin-btn admin-btn-red admin-btn-sm" onclick="formArticulo(null, ${JSON.stringify(categorias)})"><i class="ti ti-plus"></i> Nuevo artículo</button></div>
        <div class="admin-panel-block-body admin-table-wrap"><table class="admin-table">
          <thead><tr><th>Título</th><th>Categoría</th><th>Lectura</th><th>Estado</th><th></th></tr></thead>
          <tbody>${articulos.map((a) => `
            <tr><td><strong>${escapeHtml(a.titulo)}</strong><br><span class="muted">${escapeHtml(a.descripcion).slice(0, 70)}${a.descripcion.length > 70 ? '…' : ''}</span></td>
            <td class="muted">${escapeHtml(a.categoriaNombre)}</td><td class="muted">${a.tiempoLectura} min</td>
            <td>${pill(a.publicado ? 'Publicado' : 'Borrador', a.publicado ? 'green' : 'gray')}</td>
            <td class="admin-row-actions">
              <button class="admin-btn admin-btn-icon admin-btn-ghost" onclick='formArticulo(${JSON.stringify(a)}, ${JSON.stringify(categorias)})'><i class="ti ti-pencil"></i></button>
              <button class="admin-btn admin-btn-icon admin-btn-danger" onclick="eliminarArticulo(${a.id})"><i class="ti ti-trash"></i></button>
            </td></tr>`).join('')}</tbody></table></div>
      </div>`;
  } catch (err) {
    cont.innerHTML = errorBlock('No se pudo cargar la biblioteca.');
    manejarError(err);
  }
}
function formCategoria(c) {
  abrirModal(c ? 'Editar categoría' : 'Nueva categoría', `
    <div class="admin-field"><label>Nombre</label><input id="cat-nombre" class="admin-input" value="${escapeHtml(c?.nombre || '')}" /></div>
    <div class="admin-field-row">
      <div class="admin-field"><label>Slug (solo minúsculas, sin espacios)</label><input id="cat-slug" class="admin-input" value="${escapeHtml(c?.slug || '')}" placeholder="ej. internacional" /></div>
      <div class="admin-field"><label>Orden</label><input id="cat-orden" type="number" class="admin-input" value="${c?.orden ?? 0}" /></div>
    </div>
    <div class="admin-field"><label>Ícono (clase Tabler, opcional)</label><input id="cat-icono" class="admin-input" value="${escapeHtml(c?.icono || '')}" placeholder="ti-globe" /></div>
    <div class="admin-modal-actions">
      <button class="admin-btn admin-btn-outline" onclick="cerrarModal()">Cancelar</button>
      <button class="admin-btn admin-btn-red" onclick="guardarCategoria(${c?.id || 'null'})">Guardar</button>
    </div>`);
}
async function guardarCategoria(id) {
  const body = {
    nombre: document.getElementById('cat-nombre').value.trim(),
    slug: document.getElementById('cat-slug').value.trim().toLowerCase(),
    orden: Number(document.getElementById('cat-orden').value) || 0,
    icono: document.getElementById('cat-icono').value.trim() || null,
  };
  try {
    await api(id ? `/admin/biblioteca/categorias/${id}` : '/admin/biblioteca/categorias', { method: id ? 'PATCH' : 'POST', body });
    toast('Categoría guardada.');
    cerrarModal();
    cargarBiblioteca();
  } catch (err) { manejarError(err); }
}
async function eliminarCategoria(id) {
  if (!confirm('¿Eliminar esta categoría? Debe no tener artículos asociados.')) return;
  try { await api(`/admin/biblioteca/categorias/${id}`, { method: 'DELETE' }); toast('Categoría eliminada.'); cargarBiblioteca(); }
  catch (err) { manejarError(err); }
}
function formArticulo(a, categorias) {
  abrirModal(a ? 'Editar artículo' : 'Nuevo artículo', `
    <div class="admin-field"><label>Título</label><input id="art-titulo" class="admin-input" value="${escapeHtml(a?.titulo || '')}" /></div>
    <div class="admin-field-row">
      <div class="admin-field"><label>Categoría</label>
        <select id="art-categoria" class="admin-select">${categorias.map((c) => `<option value="${c.id}" ${a?.categoriaId === c.id ? 'selected' : ''}>${escapeHtml(c.nombre)}</option>`).join('')}</select>
      </div>
      <div class="admin-field"><label>Tiempo de lectura (min)</label><input id="art-tiempo" type="number" class="admin-input" value="${a?.tiempoLectura ?? 5}" /></div>
    </div>
    <div class="admin-field"><label>Descripción breve (se muestra en la tarjeta)</label><textarea id="art-desc" class="admin-textarea" style="min-height:70px">${escapeHtml(a?.descripcion || '')}</textarea></div>
    <div class="admin-field"><label>Contenido completo (se muestra al abrir el artículo)</label><textarea id="art-contenido" class="admin-textarea" style="min-height:160px">${escapeHtml(a?.contenido || '')}</textarea></div>
    <div class="admin-checkbox-row" style="margin-bottom:14px"><input type="checkbox" id="art-publicado" ${a?.publicado !== false ? 'checked' : ''} /> <label for="art-publicado">Publicado (visible para usuarios)</label></div>
    <div class="admin-modal-actions">
      <button class="admin-btn admin-btn-outline" onclick="cerrarModal()">Cancelar</button>
      <button class="admin-btn admin-btn-red" onclick="guardarArticulo(${a?.id || 'null'})">Guardar</button>
    </div>`, { ancho: true });
}
async function guardarArticulo(id) {
  const body = {
    titulo: document.getElementById('art-titulo').value.trim(),
    categoriaId: Number(document.getElementById('art-categoria').value),
    tiempoLectura: Number(document.getElementById('art-tiempo').value) || 5,
    descripcion: document.getElementById('art-desc').value.trim(),
    contenido: document.getElementById('art-contenido').value.trim() || null,
    publicado: document.getElementById('art-publicado').checked,
  };
  try {
    await api(id ? `/admin/biblioteca/articulos/${id}` : '/admin/biblioteca/articulos', { method: id ? 'PATCH' : 'POST', body });
    toast('Artículo guardado.');
    cerrarModal();
    cargarBiblioteca();
  } catch (err) { manejarError(err); }
}
async function eliminarArticulo(id) {
  if (!confirm('¿Eliminar este artículo?')) return;
  try { await api(`/admin/biblioteca/articulos/${id}`, { method: 'DELETE' }); toast('Artículo eliminado.'); cargarBiblioteca(); }
  catch (err) { manejarError(err); }
}

/* ═══════════════════════════════════════════════
   6) CONTENIDO DEL SITIO PÚBLICO
═══════════════════════════════════════════════ */
async function cargarContenido() {
  const cont = document.getElementById('section-contenido');
  cont.innerHTML = `<div class="admin-loading"><i class="ti ti-loader-2 spin"></i> Cargando…</div>`;
  try {
    const { contenido: c } = await api('/admin/contenido');
    cont.innerHTML = `
      ${bloqueObjeto('hero', 'Portada (Hero)', c.hero, [
        ['eyebrow', 'Texto pequeño superior'], ['tituloLinea1', 'Título — línea 1'],
        ['tituloAccent', 'Título — línea destacada (en rojo)'], ['descripcion', 'Descripción', 'textarea'],
      ])}
      ${bloqueObjeto('nosotros', 'Sección "Sobre nosotros"', c.nosotros, [
        ['tag', 'Etiqueta de sección'], ['titulo', 'Título'], ['descripcion', 'Descripción', 'textarea'],
      ])}
      ${bloqueObjeto('patentes_seccion', 'Sección "Patentes otorgadas" (encabezado)', c.patentes_seccion, [
        ['tag', 'Etiqueta de sección'], ['titulo', 'Título'], ['subtitulo', 'Subtítulo', 'textarea'],
      ])}
      ${bloqueObjeto('contacto_info', 'Datos de contacto', c.contacto_info, [
        ['email', 'Correo'], ['telefono', 'Teléfono mostrado'], ['whatsapp', 'WhatsApp (solo números, con código de país)'],
        ['direccion', 'Dirección'], ['linkedin', 'Nombre en LinkedIn'],
      ])}
      ${bloqueServicios(c.servicios)}
      ${bloqueProceso(c.proceso)}
      ${bloqueEstadisticas(c.estadisticas)}
      ${bloqueAliados(c.aliados)}
    `;
  } catch (err) {
    cont.innerHTML = errorBlock('No se pudo cargar el contenido.');
    manejarError(err);
  }
}
function campoContenido(clave, label, valor, tipo) {
  const id = `ct-${clave}`;
  if (tipo === 'textarea') return `<div class="admin-field"><label>${escapeHtml(label)}</label><textarea id="${id}" class="admin-textarea">${escapeHtml(valor || '')}</textarea></div>`;
  return `<div class="admin-field"><label>${escapeHtml(label)}</label><input id="${id}" class="admin-input" value="${escapeHtml(valor || '')}" /></div>`;
}
function bloqueObjeto(clave, titulo, obj, campos) {
  return `<div class="admin-panel-block"><div class="admin-panel-block-head"><h3>${escapeHtml(titulo)}</h3>
    <button class="admin-btn admin-btn-red admin-btn-sm" onclick="guardarContenidoObjeto('${clave}',[${campos.map((c) => `'${c[0]}'`).join(',')}])"><i class="ti ti-device-floppy"></i> Guardar</button></div>
    <div class="admin-panel-block-body">${campos.map(([k, l, t]) => campoContenido(`${clave}-${k}`, l, obj?.[k], t)).join('')}</div></div>`;
}
async function guardarContenidoObjeto(clave, campos) {
  const valor = {};
  campos.forEach((k) => { valor[k] = document.getElementById(`ct-${clave}-${k}`).value; });
  await guardarClaveContenido(clave, valor);
}
async function guardarClaveContenido(clave, valor) {
  try {
    await api(`/admin/contenido/${clave}`, { method: 'PUT', body: { valor } });
    toast('Contenido actualizado en el sitio público.');
  } catch (err) { manejarError(err); }
}

function bloqueServicios(s) {
  const items = s?.items || [];
  return `<div class="admin-panel-block"><div class="admin-panel-block-head"><h3>Sección "Servicios"</h3>
    <button class="admin-btn admin-btn-red admin-btn-sm" onclick="guardarServicios()"><i class="ti ti-device-floppy"></i> Guardar</button></div>
    <div class="admin-panel-block-body">
      ${campoContenido('servicios-tag', 'Etiqueta de sección', s?.tag)}
      ${campoContenido('servicios-titulo', 'Título', s?.titulo)}
      ${campoContenido('servicios-subtitulo', 'Subtítulo', s?.subtitulo, 'textarea')}
      <div id="servicios-items">${items.map((it, i) => filaServicio(it, i)).join('')}</div>
      <button type="button" class="admin-btn admin-btn-outline admin-btn-sm" onclick="agregarFilaServicio()"><i class="ti ti-plus"></i> Agregar servicio</button>
    </div></div>`;
}
function filaServicio(it, i) {
  return `<div class="admin-repeat-item" data-idx="${i}">
    <button type="button" class="admin-repeat-remove" onclick="this.closest('.admin-repeat-item').remove()"><i class="ti ti-x"></i></button>
    <div class="admin-field-row">
      <div class="admin-field"><label>Ícono (clase Tabler)</label><input class="admin-input sv-icono" value="${escapeHtml(it?.icono || '')}" placeholder="ti-stethoscope" /></div>
      <div class="admin-field"><label>Título</label><input class="admin-input sv-titulo" value="${escapeHtml(it?.titulo || '')}" /></div>
    </div>
    <div class="admin-field"><label>Descripción</label><textarea class="admin-textarea sv-desc" style="min-height:60px">${escapeHtml(it?.descripcion || '')}</textarea></div>
  </div>`;
}
function agregarFilaServicio() {
  document.getElementById('servicios-items').insertAdjacentHTML('beforeend', filaServicio(null, Date.now()));
}
async function guardarServicios() {
  const items = [...document.querySelectorAll('#servicios-items .admin-repeat-item')].map((el) => ({
    icono: el.querySelector('.sv-icono').value, titulo: el.querySelector('.sv-titulo').value, descripcion: el.querySelector('.sv-desc').value,
  }));
  await guardarClaveContenido('servicios', {
    tag: document.getElementById('ct-servicios-tag').value,
    titulo: document.getElementById('ct-servicios-titulo').value,
    subtitulo: document.getElementById('ct-servicios-subtitulo').value,
    items,
  });
}

function bloqueProceso(p) {
  const pasos = p?.pasos || [];
  return `<div class="admin-panel-block"><div class="admin-panel-block-head"><h3>Sección "¿Cómo trabajamos?"</h3>
    <button class="admin-btn admin-btn-red admin-btn-sm" onclick="guardarProceso()"><i class="ti ti-device-floppy"></i> Guardar</button></div>
    <div class="admin-panel-block-body">
      ${campoContenido('proceso-tag', 'Etiqueta de sección', p?.tag)}
      ${campoContenido('proceso-titulo', 'Título', p?.titulo)}
      ${campoContenido('proceso-subtitulo', 'Subtítulo', p?.subtitulo, 'textarea')}
      <div id="proceso-items">${pasos.map((it, i) => filaPaso(it, i)).join('')}</div>
      <button type="button" class="admin-btn admin-btn-outline admin-btn-sm" onclick="agregarFilaPaso()"><i class="ti ti-plus"></i> Agregar paso</button>
    </div></div>`;
}
function filaPaso(it, i) {
  return `<div class="admin-repeat-item" data-idx="${i}">
    <button type="button" class="admin-repeat-remove" onclick="this.closest('.admin-repeat-item').remove()"><i class="ti ti-x"></i></button>
    <div class="admin-field-row">
      <div class="admin-field"><label>Número</label><input class="admin-input ps-numero" value="${escapeHtml(it?.numero || '')}" style="max-width:80px" /></div>
      <div class="admin-field"><label>Título</label><input class="admin-input ps-titulo" value="${escapeHtml(it?.titulo || '')}" /></div>
    </div>
    <div class="admin-field"><label>Descripción</label><input class="admin-input ps-desc" value="${escapeHtml(it?.descripcion || '')}" /></div>
  </div>`;
}
function agregarFilaPaso() {
  document.getElementById('proceso-items').insertAdjacentHTML('beforeend', filaPaso(null, Date.now()));
}
async function guardarProceso() {
  const pasos = [...document.querySelectorAll('#proceso-items .admin-repeat-item')].map((el) => ({
    numero: el.querySelector('.ps-numero').value, titulo: el.querySelector('.ps-titulo').value, descripcion: el.querySelector('.ps-desc').value,
  }));
  await guardarClaveContenido('proceso', {
    tag: document.getElementById('ct-proceso-tag').value,
    titulo: document.getElementById('ct-proceso-titulo').value,
    subtitulo: document.getElementById('ct-proceso-subtitulo').value,
    pasos,
  });
}

function bloqueEstadisticas(lista) {
  const arr = lista || [];
  return `<div class="admin-panel-block"><div class="admin-panel-block-head"><h3>Estadísticas (contador animado)</h3>
    <button class="admin-btn admin-btn-red admin-btn-sm" onclick="guardarEstadisticas()"><i class="ti ti-device-floppy"></i> Guardar</button></div>
    <div class="admin-panel-block-body">
      <div id="estad-items">${arr.map((it, i) => filaEstadistica(it, i)).join('')}</div>
      <button type="button" class="admin-btn admin-btn-outline admin-btn-sm" onclick="agregarFilaEstadistica()"><i class="ti ti-plus"></i> Agregar estadística</button>
    </div></div>`;
}
function filaEstadistica(it, i) {
  return `<div class="admin-repeat-item" data-idx="${i}">
    <button type="button" class="admin-repeat-remove" onclick="this.closest('.admin-repeat-item').remove()"><i class="ti ti-x"></i></button>
    <div class="admin-field-row-3">
      <div class="admin-field"><label>Valor (número final)</label><input type="number" class="admin-input es-valor" value="${it?.valor ?? 0}" /></div>
      <div class="admin-field"><label>Etiqueta</label><input class="admin-input es-etiqueta" value="${escapeHtml(it?.etiqueta || '')}" /></div>
      <div class="admin-field"><label>Estilo</label>
        <select class="admin-select es-estilo"><option value="accent" ${it?.estilo === 'accent' ? 'selected' : ''}>Rojo (acento)</option><option value="light" ${it?.estilo === 'light' ? 'selected' : ''}>Claro</option></select>
      </div>
    </div>
  </div>`;
}
function agregarFilaEstadistica() {
  document.getElementById('estad-items').insertAdjacentHTML('beforeend', filaEstadistica(null, Date.now()));
}
async function guardarEstadisticas() {
  const valor = [...document.querySelectorAll('#estad-items .admin-repeat-item')].map((el) => ({
    valor: Number(el.querySelector('.es-valor').value) || 0,
    etiqueta: el.querySelector('.es-etiqueta').value,
    estilo: el.querySelector('.es-estilo').value,
  }));
  await guardarClaveContenido('estadisticas', valor);
}

function bloqueAliados(lista) {
  const arr = lista || [];
  return `<div class="admin-panel-block"><div class="admin-panel-block-head"><h3>Carrusel de aliados</h3>
    <button class="admin-btn admin-btn-red admin-btn-sm" onclick="guardarAliados()"><i class="ti ti-device-floppy"></i> Guardar</button></div>
    <div class="admin-panel-block-body">
      <div class="admin-field"><label>Un nombre por línea</label><textarea id="aliados-textarea" class="admin-textarea" style="min-height:140px">${escapeHtml(arr.join('\n'))}</textarea></div>
    </div></div>`;
}
async function guardarAliados() {
  const valor = document.getElementById('aliados-textarea').value.split('\n').map((s) => s.trim()).filter(Boolean);
  await guardarClaveContenido('aliados', valor);
}

/* ═══════════════════════════════════════════════
   7) FAQ
═══════════════════════════════════════════════ */
async function cargarFaqs() {
  const cont = document.getElementById('section-faqs');
  cont.innerHTML = `<div class="admin-loading"><i class="ti ti-loader-2 spin"></i> Cargando…</div>`;
  try {
    const { faqs } = await api('/admin/faqs');
    cont.innerHTML = `
      <div class="admin-toolbar"><div class="grow"></div><button class="admin-btn admin-btn-red" onclick="formFaq()"><i class="ti ti-plus"></i> Nueva pregunta</button></div>
      <div class="admin-panel-block admin-table-wrap"><table class="admin-table">
        <thead><tr><th>Pregunta</th><th>Orden</th><th>Estado</th><th></th></tr></thead>
        <tbody>${faqs.map((f) => `
          <tr><td><strong>${escapeHtml(f.pregunta)}</strong><br><span class="muted">${escapeHtml(f.respuesta).slice(0, 80)}${f.respuesta.length > 80 ? '…' : ''}</span></td>
          <td class="muted">${f.orden}</td><td>${pill(f.publicado ? 'Publicada' : 'Oculta', f.publicado ? 'green' : 'gray')}</td>
          <td class="admin-row-actions">
            <button class="admin-btn admin-btn-icon admin-btn-ghost" onclick='formFaq(${JSON.stringify(f)})'><i class="ti ti-pencil"></i></button>
            <button class="admin-btn admin-btn-icon admin-btn-danger" onclick="eliminarFaq(${f.id})"><i class="ti ti-trash"></i></button>
          </td></tr>`).join('')}</tbody></table></div>`;
  } catch (err) {
    cont.innerHTML = errorBlock('No se pudieron cargar las preguntas frecuentes.');
    manejarError(err);
  }
}
function formFaq(f) {
  abrirModal(f ? 'Editar pregunta' : 'Nueva pregunta frecuente', `
    <div class="admin-field"><label>Pregunta</label><input id="faq-pregunta" class="admin-input" value="${escapeHtml(f?.pregunta || '')}" /></div>
    <div class="admin-field"><label>Respuesta</label><textarea id="faq-respuesta" class="admin-textarea">${escapeHtml(f?.respuesta || '')}</textarea></div>
    <div class="admin-field-row">
      <div class="admin-field"><label>Orden</label><input id="faq-orden" type="number" class="admin-input" value="${f?.orden ?? 0}" /></div>
      <div class="admin-field"><label>Estado</label>
        <select id="faq-publicado" class="admin-select"><option value="true" ${f?.publicado !== false ? 'selected' : ''}>Publicada</option><option value="false" ${f?.publicado === false ? 'selected' : ''}>Oculta</option></select>
      </div>
    </div>
    <div class="admin-modal-actions">
      <button class="admin-btn admin-btn-outline" onclick="cerrarModal()">Cancelar</button>
      <button class="admin-btn admin-btn-red" onclick="guardarFaq(${f?.id || 'null'})">Guardar</button>
    </div>`);
}
async function guardarFaq(id) {
  const body = {
    pregunta: document.getElementById('faq-pregunta').value.trim(),
    respuesta: document.getElementById('faq-respuesta').value.trim(),
    orden: Number(document.getElementById('faq-orden').value) || 0,
    publicado: document.getElementById('faq-publicado').value === 'true',
  };
  try {
    await api(id ? `/admin/faqs/${id}` : '/admin/faqs', { method: id ? 'PATCH' : 'POST', body });
    toast('Pregunta guardada.');
    cerrarModal();
    cargarFaqs();
  } catch (err) { manejarError(err); }
}
async function eliminarFaq(id) {
  if (!confirm('¿Eliminar esta pregunta frecuente?')) return;
  try { await api(`/admin/faqs/${id}`, { method: 'DELETE' }); toast('Pregunta eliminada.'); cargarFaqs(); }
  catch (err) { manejarError(err); }
}

/* ═══════════════════════════════════════════════
   8) PATENTES DESTACADAS
═══════════════════════════════════════════════ */
async function cargarPatentes() {
  const cont = document.getElementById('section-patentes');
  cont.innerHTML = `<div class="admin-loading"><i class="ti ti-loader-2 spin"></i> Cargando…</div>`;
  try {
    const { patentes } = await api('/admin/patentes-destacadas');
    cont.innerHTML = `
      <div class="admin-toolbar"><div class="grow"></div><button class="admin-btn admin-btn-red" onclick="formPatente()"><i class="ti ti-plus"></i> Nuevo proyecto destacado</button></div>
      <div class="admin-panel-block admin-table-wrap"><table class="admin-table">
        <thead><tr><th>Título</th><th>Video</th><th>Orden</th><th>Estado</th><th></th></tr></thead>
        <tbody>${patentes.map((p) => `
          <tr><td><strong>${escapeHtml(p.titulo)}</strong><br><span class="muted">${escapeHtml(p.descripcion || '')}</span></td>
          <td class="muted">${p.videoUrl ? '<i class="ti ti-video" style="color:var(--green)"></i> Cargado' : 'Sin video'}</td>
          <td class="muted">${p.orden}</td><td>${pill(p.publicado ? 'Publicado' : 'Oculto', p.publicado ? 'green' : 'gray')}</td>
          <td class="admin-row-actions">
            <button class="admin-btn admin-btn-icon admin-btn-ghost" onclick='formPatente(${JSON.stringify(p)})'><i class="ti ti-pencil"></i></button>
            <button class="admin-btn admin-btn-icon admin-btn-danger" onclick="eliminarPatente(${p.id})"><i class="ti ti-trash"></i></button>
          </td></tr>`).join('')}</tbody></table></div>`;
  } catch (err) {
    cont.innerHTML = errorBlock('No se pudieron cargar las patentes destacadas.');
    manejarError(err);
  }
}
function formPatente(p) {
  abrirModal(p ? 'Editar proyecto destacado' : 'Nuevo proyecto destacado', `
    <div class="admin-field"><label>Título</label><input id="pd-titulo" class="admin-input" value="${escapeHtml(p?.titulo || '')}" /></div>
    <div class="admin-field"><label>Descripción corta</label><input id="pd-desc" class="admin-input" value="${escapeHtml(p?.descripcion || '')}" placeholder="Ej. Video explosión 3D" /></div>
    <div class="admin-field"><label>URL del video (mp4 o embed)</label><input id="pd-video" class="admin-input" value="${escapeHtml(p?.videoUrl || '')}" placeholder="https://…" /></div>
    <div class="admin-field-row">
      <div class="admin-field"><label>Orden</label><input id="pd-orden" type="number" class="admin-input" value="${p?.orden ?? 0}" /></div>
      <div class="admin-field"><label>Estado</label>
        <select id="pd-publicado" class="admin-select"><option value="true" ${p?.publicado !== false ? 'selected' : ''}>Publicado</option><option value="false" ${p?.publicado === false ? 'selected' : ''}>Oculto</option></select>
      </div>
    </div>
    <div class="admin-modal-actions">
      <button class="admin-btn admin-btn-outline" onclick="cerrarModal()">Cancelar</button>
      <button class="admin-btn admin-btn-red" onclick="guardarPatente(${p?.id || 'null'})">Guardar</button>
    </div>`);
}
async function guardarPatente(id) {
  const body = {
    titulo: document.getElementById('pd-titulo').value.trim(),
    descripcion: document.getElementById('pd-desc').value.trim() || null,
    videoUrl: document.getElementById('pd-video').value.trim() || null,
    orden: Number(document.getElementById('pd-orden').value) || 0,
    publicado: document.getElementById('pd-publicado').value === 'true',
  };
  try {
    await api(id ? `/admin/patentes-destacadas/${id}` : '/admin/patentes-destacadas', { method: id ? 'PATCH' : 'POST', body });
    toast('Guardado correctamente.');
    cerrarModal();
    cargarPatentes();
  } catch (err) { manejarError(err); }
}
async function eliminarPatente(id) {
  if (!confirm('¿Eliminar este proyecto destacado?')) return;
  try { await api(`/admin/patentes-destacadas/${id}`, { method: 'DELETE' }); toast('Eliminado.'); cargarPatentes(); }
  catch (err) { manejarError(err); }
}

/* ═══════════════════════════════════════════════
   9) MENSAJES DE CONTACTO
═══════════════════════════════════════════════ */
async function cargarContactos() {
  const cont = document.getElementById('section-contactos');
  cont.innerHTML = `<div class="admin-loading"><i class="ti ti-loader-2 spin"></i> Cargando…</div>`;
  try {
    const { contactos } = await api('/admin/contactos');
    if (contactos.length === 0) { cont.innerHTML = errorBlockInfo('No hay mensajes de contacto todavía.'); return; }
    cont.innerHTML = `<div class="admin-panel-block admin-table-wrap"><table class="admin-table">
      <thead><tr><th>De</th><th>Asunto</th><th>Mensaje</th><th>Fecha</th><th></th></tr></thead>
      <tbody>${contactos.map((c) => `
        <tr style="${c.leido ? '' : 'font-weight:600'}">
          <td>${escapeHtml(c.nombre)}<br><span class="muted" style="font-weight:400">${escapeHtml(c.email)}</span></td>
          <td>${escapeHtml(c.asunto || '—')}</td>
          <td class="muted" style="font-weight:400;max-width:320px">${escapeHtml(c.mensaje).slice(0, 90)}${c.mensaje.length > 90 ? '…' : ''}</td>
          <td class="muted" style="font-weight:400">${fmtFechaHora(c.creadoEn)}</td>
          <td><button class="admin-btn admin-btn-outline admin-btn-sm" onclick="verContacto(${c.id})">${c.leido ? 'Ver' : 'Leer'}</button></td>
        </tr>`).join('')}</tbody></table></div>`;
  } catch (err) {
    cont.innerHTML = errorBlock('No se pudieron cargar los mensajes.');
    manejarError(err);
  }
}
async function verContacto(id) {
  try {
    const { contactos } = await api('/admin/contactos');
    const c = contactos.find((x) => x.id === id);
    if (!c) return;
    abrirModal(c.asunto || 'Mensaje de contacto', `
      <div class="admin-field"><label>De</label><div>${escapeHtml(c.nombre)} — <a href="mailto:${escapeHtml(c.email)}">${escapeHtml(c.email)}</a></div></div>
      <div class="admin-field"><label>Recibido</label><div>${fmtFechaHora(c.creadoEn)}</div></div>
      <div class="admin-field"><label>Mensaje</label><div style="white-space:pre-wrap">${escapeHtml(c.mensaje)}</div></div>
      <div class="admin-modal-actions">
        <a class="admin-btn admin-btn-outline" href="mailto:${escapeHtml(c.email)}"><i class="ti ti-mail"></i> Responder por correo</a>
        <button class="admin-btn admin-btn-red" onclick="cerrarModal()">Cerrar</button>
      </div>`);
    if (!c.leido) { await api(`/admin/contactos/${id}/leido`, { method: 'PATCH', body: { leido: true } }); cargarContactos(); cargarDashboard(); }
  } catch (err) { manejarError(err); }
}

/* ═══════════════════════════════════════════════
   10) ENVIAR NOTIFICACIÓN
═══════════════════════════════════════════════ */
async function cargarNotificaciones() {
  const cont = document.getElementById('section-notificaciones');
  cont.innerHTML = `<div class="admin-loading"><i class="ti ti-loader-2 spin"></i> Cargando…</div>`;
  try {
    const { datos: usuarios } = await api('/admin/usuarios?porPagina=200');
    const noAdmin = usuarios.filter((u) => u.tipo !== 'admin');
    cont.innerHTML = `<div class="admin-panel-block" style="max-width:640px"><div class="admin-panel-block-body">
      <form id="notif-form">
        <div class="admin-field"><label>Destinatario</label>
          <select id="nf-destino" class="admin-select">
            <option value="masivo:todos">Todos los usuarios</option>
            <option value="masivo:registrado">Todos los "registrado"</option>
            <option value="masivo:cliente">Todos los "cliente"</option>
            <option value="individual">Un usuario específico…</option>
          </select>
        </div>
        <div class="admin-field" id="nf-usuario-wrap" hidden><label>Usuario</label>
          <select id="nf-usuario" class="admin-select">${noAdmin.map((u) => `<option value="${u.id}">${escapeHtml(u.nombre)} — ${escapeHtml(u.email)}</option>`).join('')}</select>
        </div>
        <div class="admin-field-row">
          <div class="admin-field"><label>Tipo</label>
            <select id="nf-tipo" class="admin-select"><option value="sistema">Sistema</option><option value="proyecto">Proyecto</option><option value="evento">Evento</option><option value="promocion">Promoción</option></select>
          </div>
          <div class="admin-field"><label>Ícono (clase Tabler)</label><input id="nf-icono" class="admin-input" value="ti-bell" /></div>
        </div>
        <div class="admin-field"><label>Mensaje</label><input id="nf-mensaje" class="admin-input" placeholder="Ej. Taller gratuito de propiedad intelectual este sábado" /></div>
        <div class="admin-field"><label>Detalle (opcional)</label><textarea id="nf-detalle" class="admin-textarea" style="min-height:70px"></textarea></div>
        <button type="submit" class="admin-btn admin-btn-red"><i class="ti ti-send"></i> Enviar notificación</button>
      </form>
    </div></div>`;
    document.getElementById('nf-destino').addEventListener('change', (e) => {
      document.getElementById('nf-usuario-wrap').hidden = e.target.value !== 'individual';
    });
    document.getElementById('notif-form').addEventListener('submit', enviarNotificacion);
  } catch (err) {
    cont.innerHTML = errorBlock('No se pudo cargar el formulario de notificaciones.');
    manejarError(err);
  }
}
async function enviarNotificacion(e) {
  e.preventDefault();
  const destino = document.getElementById('nf-destino').value;
  const mensaje = document.getElementById('nf-mensaje').value.trim();
  if (!mensaje) return toast('Escribe el mensaje de la notificación.', 'error');
  const body = {
    mensaje,
    detalle: document.getElementById('nf-detalle').value.trim() || null,
    tipo: document.getElementById('nf-tipo').value,
    icono: document.getElementById('nf-icono').value.trim() || 'ti-bell',
  };
  if (destino === 'individual') body.usuarioId = Number(document.getElementById('nf-usuario').value);
  else body.destinoMasivo = destino.split(':')[1];
  try {
    const r = await api('/admin/notificaciones', { method: 'POST', body });
    toast(`Notificación enviada a ${r.enviadas} usuario(s).`);
    document.getElementById('nf-mensaje').value = '';
    document.getElementById('nf-detalle').value = '';
  } catch (err) { manejarError(err); }
}

/* ───────────────────────────────────────────────
   ARRANQUE
   ─────────────────────────────────────────────── */
iniciar();
