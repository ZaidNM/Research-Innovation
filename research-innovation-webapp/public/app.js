/* ═══════════════════════════════════════════════════════════
   Research & Innovation SAC — Main JavaScript (conectado a API real)
   Maneja: navegación, auth, dashboard, biblioteca,
           ficha orientativa, seguimiento, notificaciones, animaciones
═══════════════════════════════════════════════════════════ */

'use strict';

/* ─── ESTADO GLOBAL DE SESIÓN ─── */
const AppState = {
  currentUser: null,      // { id, nombre, email, tipo: 'registrado'|'cliente'|'admin', ... }
  currentPage: 'home',
  dashPanel: 'inicio',
  fichaStep: 1,
  fichaData: {},           // usa exactamente los nombres de campo del backend
  categorias: [],
  articulos: [],
  faqs: [],
};

/* ─── CLIENTE API ─── */
async function api(ruta, opciones = {}) {
  const isForm = opciones.body instanceof FormData;
  const resp = await fetch(`/api${ruta}`, {
    method: opciones.method || 'GET',
    headers: isForm ? undefined : { 'Content-Type': 'application/json' },
    body: isForm ? opciones.body : (opciones.body !== undefined ? JSON.stringify(opciones.body) : undefined),
    credentials: 'include',
  });
  let datos = null;
  try { datos = await resp.json(); } catch { /* respuesta sin cuerpo */ }
  if (!resp.ok) {
    const err = new Error((datos && datos.error) || `Error ${resp.status}`);
    err.status = resp.status;
    throw err;
  }
  return datos;
}

/* ─── ETIQUETAS ─── */
const ETIQUETAS_TIPO_PROTECCION = {
  patente: 'Patente de invención', modelo_utilidad: 'Modelo de utilidad',
  marca: 'Marca comercial', derecho_autor: 'Derecho de autor', no_definido: 'Aún no lo sé',
};
const ETIQUETAS_ESTADO_FICHA = { pendiente: 'Pendiente de revisión', en_revision: 'En revisión', atendida: 'Atendida' };
const ETIQUETAS_TIPO_PATENTE = { invencion: 'Patente de Invención', modelo_utilidad: 'Modelo de Utilidad', diseno_industrial: 'Diseño Industrial', otro: 'Otro' };

/* ════════════════════════════════════════════════
   UTILIDADES
═══════════════════════════════════════════════════ */
function escapeHtml(str) {
  if (str === null || str === undefined) return '';
  return String(str)
    .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;').replace(/'/g, '&#39;');
}

function capitalize(str) { return str ? str.charAt(0).toUpperCase() + str.slice(1) : ''; }

function iniciales(nombre) {
  return (nombre || '').split(' ').filter(Boolean).map(w => w[0]).join('').slice(0, 2).toUpperCase() || '--';
}

function fmtFecha(v) {
  if (!v) return 'Pendiente';
  const d = new Date(v.includes(' ') ? v.replace(' ', 'T') : `${v}T00:00:00`);
  if (Number.isNaN(d.getTime())) return v;
  return d.toLocaleDateString('es-PE', { day: '2-digit', month: 'short', year: 'numeric' });
}

function tiempoRelativo(fecha) {
  if (!fecha) return '';
  const d = new Date(fecha.includes(' ') ? fecha.replace(' ', 'T') : fecha);
  const diffMin = Math.floor((Date.now() - d.getTime()) / 60000);
  if (diffMin < 1) return 'Justo ahora';
  if (diffMin < 60) return `Hace ${diffMin} min`;
  const horas = Math.floor(diffMin / 60);
  if (horas < 24) return `Hace ${horas} h`;
  const dias = Math.floor(horas / 24);
  if (dias < 7) return `Hace ${dias} día${dias > 1 ? 's' : ''}`;
  const semanas = Math.floor(dias / 7);
  if (semanas < 5) return `Hace ${semanas} semana${semanas > 1 ? 's' : ''}`;
  const meses = Math.floor(dias / 30);
  return `Hace ${meses} mes${meses > 1 ? 'es' : ''}`;
}

function iconoPorTipoArchivo(tipo) {
  const t = (tipo || '').toLowerCase();
  if (t === 'pdf') return 'ti-file-type-pdf';
  if (['doc', 'docx'].includes(t)) return 'ti-file-type-doc';
  if (['png', 'jpg', 'jpeg', 'webp'].includes(t)) return 'ti-photo';
  if (['stl', 'obj', 'glb'].includes(t)) return 'ti-3d-cube-sphere';
  if (t === 'zip') return 'ti-file-zip';
  return 'ti-file-text';
}

function showToast(msg, type = 'default') {
  let toast = document.getElementById('global-toast');
  if (!toast) {
    toast = document.createElement('div');
    toast.id = 'global-toast';
    toast.className = 'toast';
    toast.innerHTML = '<i class="ti ti-info-circle"></i><span></span>';
    document.body.appendChild(toast);
  }
  toast.className = `toast ${type}`;
  toast.querySelector('i').className = type === 'success'
    ? 'ti ti-check' : type === 'error'
    ? 'ti ti-x' : 'ti ti-info-circle';
  toast.querySelector('span').textContent = msg;
  toast.classList.add('show');
  clearTimeout(toast._hideTimer);
  toast._hideTimer = setTimeout(() => toast.classList.remove('show'), 3800);
}

function openModal(id) { document.getElementById(id)?.classList.add('open'); }
function closeModal(id) { document.getElementById(id)?.classList.remove('open'); }

function emptyStateHtml(msg) {
  return `<div style="padding:40px;text-align:center;color:var(--gray-500)">
    <i class="ti ti-inbox" style="font-size:32px;display:block;margin-bottom:10px"></i>${escapeHtml(msg)}
  </div>`;
}

/* ════════════════════════════════════════════════
   NAVEGACIÓN ENTRE PÁGINAS
═══════════════════════════════════════════════════ */
function navigateTo(page) {
  closeMobileMenu();
  document.querySelectorAll('.page').forEach(p => p.classList.remove('active'));
  const target = document.getElementById(`page-${page}`);
  if (target) {
    target.classList.add('active');
    AppState.currentPage = page;
    window.scrollTo(0, 0);
  }
  const navbar = document.getElementById('navbar');
  if (navbar) navbar.classList.toggle('solid', page !== 'home');
  updateNavbar();
}

function updateNavbar() {
  const user = AppState.currentUser;
  const navAuth = document.getElementById('nav-auth');
  const navUser = document.getElementById('nav-user');
  const mobAuth = document.getElementById('mobile-menu-auth');
  const mobUser = document.getElementById('mobile-menu-user');
  if (!navAuth || !navUser) return;

  if (user) {
    navAuth.style.display = 'none';
    navUser.style.display = 'flex';
    if (mobAuth) mobAuth.style.display = 'none';
    if (mobUser) mobUser.style.display = 'flex';
    const avatarEl = navUser.querySelector('.nav-user-avatar');
    const nameEl = navUser.querySelector('.nav-user-name');
    if (avatarEl) avatarEl.textContent = iniciales(user.nombre);
    if (nameEl) nameEl.textContent = user.nombre.split(' ')[0];
  } else {
    navAuth.style.display = 'flex';
    navUser.style.display = 'none';
    if (mobAuth) mobAuth.style.display = 'flex';
    if (mobUser) mobUser.style.display = 'none';
  }
}

function toggleMobileMenu() { document.getElementById('mobile-menu')?.classList.toggle('open'); }
function closeMobileMenu() { document.getElementById('mobile-menu')?.classList.remove('open'); }

/* ════════════════════════════════════════════════
   SESIÓN
═══════════════════════════════════════════════════ */
async function restaurarSesion() {
  try {
    const { user } = await api('/auth/yo');
    AppState.currentUser = user;
  } catch {
    AppState.currentUser = null;
  }
  updateNavbar();
  return AppState.currentUser;
}

async function doLogout() {
  try { await api('/auth/logout', { method: 'POST' }); } catch { /* la cookie puede ya haber expirado */ }
  AppState.currentUser = null;
  updateNavbar();
  showToast('Sesión cerrada.');
  setTimeout(() => navigateTo('home'), 400);
}

/* ════════════════════════════════════════════════
   AUTH — LOGIN
═══════════════════════════════════════════════════ */
function initLogin() {
  const form = document.getElementById('login-form');
  if (!form) return;

  form.addEventListener('submit', async (e) => {
    e.preventDefault();
    const email = form.querySelector('#login-email').value.trim();
    const password = form.querySelector('#login-password').value;
    const errEl = document.getElementById('login-error');
    const btn = document.getElementById('login-submit-btn');
    errEl.classList.remove('show');
    btn.disabled = true;
    try {
      const { user } = await api('/auth/login', { method: 'POST', body: { email, password } });
      AppState.currentUser = user;
      updateNavbar();
      showToast(`Bienvenido, ${user.nombre.split(' ')[0]}`, 'success');
      setTimeout(() => { navigateTo('dashboard'); initDashboard(); }, 500);
    } catch (err) {
      errEl.textContent = err.message || 'Correo o contraseña incorrectos.';
      errEl.classList.add('show');
    } finally {
      btn.disabled = false;
    }
  });

  document.getElementById('toggle-login-pass')?.addEventListener('click', () => {
    const inp = document.getElementById('login-password');
    inp.type = inp.type === 'password' ? 'text' : 'password';
  });
}

async function loginDemo(tipo) {
  const cuentas = {
    cliente: { email: 'cliente@demo.com', password: 'Cliente2026!' },
    registrado: { email: 'usuario@demo.com', password: 'Usuario2026!' },
  };
  const cred = cuentas[tipo];
  if (!cred) return;
  try {
    const { user } = await api('/auth/login', { method: 'POST', body: cred });
    AppState.currentUser = user;
    updateNavbar();
    showToast('Sesión de demostración iniciada.', 'success');
    setTimeout(() => { navigateTo('dashboard'); initDashboard(); }, 500);
  } catch (err) {
    showToast(err.message || 'No se pudo iniciar la sesión de demostración.', 'error');
  }
}

/* ════════════════════════════════════════════════
   AUTH — REGISTRO
═══════════════════════════════════════════════════ */
let registerStep = 1;
const totalRegisterSteps = 3;

function initRegister() {
  updateRegisterStepUI();

  document.getElementById('reg-next-1')?.addEventListener('click', () => {
    const name = document.getElementById('reg-name').value.trim();
    const email = document.getElementById('reg-email').value.trim();
    const err = document.getElementById('reg-error');
    if (!name || !email) { showFieldError(err, 'Completa todos los campos.'); return; }
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) { showFieldError(err, 'Correo inválido.'); return; }
    err.classList.remove('show');
    goRegisterStep(2);
  });

  document.getElementById('reg-next-2')?.addEventListener('click', () => {
    const pass = document.getElementById('reg-password').value;
    const confirm = document.getElementById('reg-confirm').value;
    const err = document.getElementById('reg-error');
    if (pass.length < 8) { showFieldError(err, 'La contraseña debe tener al menos 8 caracteres.'); return; }
    if (!/[a-zA-Z]/.test(pass) || !/[0-9]/.test(pass)) { showFieldError(err, 'La contraseña debe combinar letras y números.'); return; }
    if (pass !== confirm) { showFieldError(err, 'Las contraseñas no coinciden.'); return; }
    if (!document.getElementById('reg-terms').checked) { showFieldError(err, 'Debes aceptar los términos y condiciones.'); return; }
    err.classList.remove('show');
    goRegisterStep(3);
  });

  document.getElementById('reg-submit')?.addEventListener('click', async () => {
    const nombre = document.getElementById('reg-name').value.trim();
    const email = document.getElementById('reg-email').value.trim();
    const password = document.getElementById('reg-password').value;
    const perfil = document.querySelector('input[name="reg-perfil"]:checked')?.value || 'emprendedor';
    const organizacion = document.getElementById('reg-org').value.trim();
    const btn = document.getElementById('reg-submit');
    btn.disabled = true;
    try {
      const { user } = await api('/auth/registro', { method: 'POST', body: { nombre, email, password, perfil, organizacion } });
      AppState.currentUser = user;
      updateNavbar();
      showToast('¡Cuenta creada exitosamente!', 'success');
      setTimeout(() => { navigateTo('dashboard'); initDashboard(); }, 800);
    } catch (err) {
      showFieldError(document.getElementById('reg-error'), err.message || 'No se pudo crear la cuenta.');
      goRegisterStep(1);
    } finally {
      btn.disabled = false;
    }
  });

  document.querySelectorAll('[data-reg-back]').forEach(btn => {
    btn.addEventListener('click', () => goRegisterStep(registerStep - 1));
  });

  ['toggle-reg-pass', 'toggle-reg-confirm'].forEach(id => {
    document.getElementById(id)?.addEventListener('click', () => {
      const targetId = id === 'toggle-reg-pass' ? 'reg-password' : 'reg-confirm';
      const inp = document.getElementById(targetId);
      if (inp) inp.type = inp.type === 'password' ? 'text' : 'password';
    });
  });
}

function goRegisterStep(step) {
  registerStep = step;
  updateRegisterStepUI();
}

function updateRegisterStepUI() {
  document.querySelectorAll('.register-step').forEach((el, i) => el.classList.toggle('active', i + 1 === registerStep));
  document.querySelectorAll('.step-dot').forEach((dot, i) => {
    dot.classList.remove('active', 'done');
    if (i + 1 < registerStep) dot.classList.add('done');
    else if (i + 1 === registerStep) dot.classList.add('active');
  });
  document.querySelectorAll('.step-line').forEach((line, i) => line.classList.toggle('done', i + 1 < registerStep));
}

function showFieldError(el, msg) {
  if (!el) return;
  el.textContent = msg;
  el.classList.add('show');
}

/* ════════════════════════════════════════════════
   DASHBOARD — INICIALIZACIÓN
═══════════════════════════════════════════════════ */
let dashboardShellWired = false;

function initDashboardShell() {
  if (dashboardShellWired) return;
  dashboardShellWired = true;

  document.querySelector('.sidebar-nav')?.addEventListener('click', (e) => {
    const link = e.target.closest('.sidebar-link[data-panel]');
    if (!link) return;
    if (link.classList.contains('locked')) {
      showToast('Esta sección está disponible para clientes activos.', 'error');
      return;
    }
    switchDashPanel(link.dataset.panel);
    closeDashSidebar();
  });

  document.getElementById('btn-logout')?.addEventListener('click', doLogout);
  document.getElementById('nav-logout')?.addEventListener('click', doLogout);
  document.getElementById('mobile-nav-logout')?.addEventListener('click', doLogout);
  document.getElementById('dash-notif-btn')?.addEventListener('click', () => switchDashPanel('notificaciones'));
  document.getElementById('dash-hamburger')?.addEventListener('click', openDashSidebar);
  document.getElementById('dashboard-sidebar-overlay')?.addEventListener('click', closeDashSidebar);
}

function openDashSidebar() {
  document.getElementById('dashboard-sidebar')?.classList.add('open');
  document.getElementById('dashboard-sidebar-overlay')?.classList.add('open');
}
function closeDashSidebar() {
  document.getElementById('dashboard-sidebar')?.classList.remove('open');
  document.getElementById('dashboard-sidebar-overlay')?.classList.remove('open');
}

async function initDashboard() {
  if (!AppState.currentUser) {
    await restaurarSesion();
    if (!AppState.currentUser) { navigateTo('home'); return; }
  }
  initDashboardShell();
  const user = AppState.currentUser;

  document.querySelectorAll('#dash-welcome-name, #dash-welcome-name-2').forEach(el => { el.textContent = user.nombre.split(' ')[0]; });
  const sidebarName = document.getElementById('sidebar-user-name');
  if (sidebarName) sidebarName.textContent = user.nombre;
  const sidebarEmail = document.getElementById('sidebar-user-email');
  if (sidebarEmail) sidebarEmail.textContent = user.email;
  const sidebarAvatar = document.getElementById('sidebar-avatar');
  if (sidebarAvatar) sidebarAvatar.textContent = iniciales(user.nombre);

  const trackLink = document.getElementById('sidebar-seguimiento');
  if (trackLink) {
    if (user.tipo === 'cliente') { trackLink.classList.remove('locked'); trackLink.title = ''; }
    else { trackLink.classList.add('locked'); trackLink.title = 'Disponible cuando te conviertas en cliente activo'; }
  }

  try {
    const { noLeidas } = await api('/notificaciones');
    updateNotifBadge(noLeidas);
  } catch { /* no crítico */ }

  switchDashPanel('inicio');
}

function switchDashPanel(panel) {
  AppState.dashPanel = panel;
  document.querySelectorAll('.dash-panel').forEach(p => p.classList.remove('active'));
  document.getElementById(`panel-${panel}`)?.classList.add('active');
  document.querySelectorAll('.sidebar-link[data-panel]').forEach(l => l.classList.toggle('active', l.dataset.panel === panel));

  const titles = { inicio: 'Panel de inicio', biblioteca: 'Biblioteca Virtual', ficha: 'Ficha de Orientación', seguimiento: 'Seguimiento de Solicitud', notificaciones: 'Notificaciones' };
  const topbarTitle = document.getElementById('dash-topbar-title');
  if (topbarTitle) topbarTitle.textContent = titles[panel] || '';

  if (panel === 'inicio') renderPanelInicio();
  if (panel === 'biblioteca') renderBiblioteca();
  if (panel === 'ficha') renderFicha();
  if (panel === 'seguimiento') renderSeguimiento();
  if (panel === 'notificaciones') renderNotificaciones();
}

/* ════════════════════════════════════════════════
   PANEL INICIO
═══════════════════════════════════════════════════ */
async function renderPanelInicio() {
  const user = AppState.currentUser;
  const statsEl = document.getElementById('panel-inicio-stats');
  const notifEl = document.getElementById('panel-inicio-notifs');
  const quickEl = document.getElementById('panel-inicio-quick');
  if (!statsEl) return;
  statsEl.innerHTML = `<p style="padding:12px;color:var(--gray-500);font-size:13px">Cargando…</p>`;

  try {
    const [{ notificaciones, noLeidas }, { total: articulosLeidos }, { articulos }] = await Promise.all([
      api('/notificaciones'),
      api('/biblioteca/lecturas/total'),
      api('/biblioteca/articulos'),
    ]);
    updateNotifBadge(noLeidas);

    let tieneProyecto = false;
    if (user.tipo === 'cliente') {
      const { proyecto } = await api('/proyectos/mio');
      tieneProyecto = !!proyecto;
    }

    statsEl.innerHTML = `
      <div class="dash-stat-card accent">
        <div class="dash-stat-icon"><i class="ti ti-user-check"></i></div>
        <div class="dash-stat-num">${escapeHtml(capitalize(user.tipo))}</div>
        <div class="dash-stat-label">Tipo de cuenta</div>
      </div>
      <div class="dash-stat-card">
        <div class="dash-stat-icon"><i class="ti ti-book"></i></div>
        <div class="dash-stat-num">${articulosLeidos}</div>
        <div class="dash-stat-label">Artículos leídos</div>
      </div>
      <div class="dash-stat-card">
        <div class="dash-stat-icon"><i class="ti ti-bell"></i></div>
        <div class="dash-stat-num">${noLeidas}</div>
        <div class="dash-stat-label">Notificaciones nuevas</div>
      </div>
      <div class="dash-stat-card">
        <div class="dash-stat-icon"><i class="ti ti-timeline"></i></div>
        <div class="dash-stat-num">${tieneProyecto ? 1 : 0}</div>
        <div class="dash-stat-label">Proyectos activos</div>
      </div>`;

    notifEl.innerHTML = notificaciones.slice(0, 3).map(n => notifItemHtml(n, false)).join('') || emptyStateHtml('Sin notificaciones todavía.');

    const fichaEnviada = user.fichaEnviada;
    quickEl.innerHTML = `
      <div class="card" style="cursor:pointer" onclick="switchDashPanel('biblioteca')">
        <i class="ti ti-book" style="font-size:22px;color:var(--red);margin-bottom:10px;display:block"></i>
        <p style="font-size:14px;font-weight:500;margin-bottom:4px">Biblioteca Virtual</p>
        <p style="font-size:12px;color:var(--gray-500)">Accede a ${articulos.length} artículos especializados</p>
      </div>
      <div class="card" style="cursor:pointer" onclick="switchDashPanel('ficha')">
        <i class="ti ti-clipboard-text" style="font-size:22px;color:var(--red);margin-bottom:10px;display:block"></i>
        <p style="font-size:14px;font-weight:500;margin-bottom:4px">${fichaEnviada ? 'Ficha enviada ✓' : 'Enviar Ficha de Orientación'}</p>
        <p style="font-size:12px;color:var(--gray-500)">${fichaEnviada ? 'Tu ficha fue recibida' : 'Organiza los datos de tu proyecto'}</p>
      </div>
      ${user.tipo === 'cliente' ? `
      <div class="card" style="cursor:pointer" onclick="switchDashPanel('seguimiento')">
        <i class="ti ti-timeline" style="font-size:22px;color:var(--red);margin-bottom:10px;display:block"></i>
        <p style="font-size:14px;font-weight:500;margin-bottom:4px">Seguimiento de patente</p>
        <p style="font-size:12px;color:var(--gray-500)">Ve el estado actual de tu solicitud</p>
      </div>` : `
      <div class="card" style="opacity:0.5">
        <i class="ti ti-lock" style="font-size:22px;color:var(--gray-300);margin-bottom:10px;display:block"></i>
        <p style="font-size:14px;font-weight:500;margin-bottom:4px">Seguimiento (solo clientes)</p>
        <p style="font-size:12px;color:var(--gray-500)">Disponible cuando trabajes con nosotros</p>
      </div>`}`;
  } catch (err) {
    statsEl.innerHTML = emptyStateHtml('No se pudo cargar tu panel. Intenta recargar la página.');
    console.error(err);
  }
}

/* ════════════════════════════════════════════════
   PANEL BIBLIOTECA
═══════════════════════════════════════════════════ */
let libCurrentCat = 'all';

async function renderBiblioteca() {
  const container = document.getElementById('lib-articles');
  if (container) container.innerHTML = `<p style="padding:40px;text-align:center;color:var(--gray-500)">Cargando…</p>`;
  try {
    const [{ categorias }, { articulos }] = await Promise.all([
      api('/biblioteca/categorias'),
      api('/biblioteca/articulos'),
    ]);
    AppState.categorias = categorias;
    AppState.articulos = articulos;
    libCurrentCat = 'all';
    renderLibraryFilters();
    renderLibraryArticles();
    const searchEl = document.getElementById('lib-search');
    if (searchEl) { searchEl.value = ''; searchEl.oninput = renderLibraryArticles; }
  } catch (err) {
    if (container) container.innerHTML = emptyStateHtml('No se pudo cargar la biblioteca. Intenta nuevamente.');
    console.error(err);
  }
}

function renderLibraryFilters() {
  const base = [{ slug: 'all', nombre: 'Todos los artículos', icono: 'ti-layout-grid' }, ...AppState.categorias];
  const container = document.getElementById('lib-filters');
  if (!container) return;
  container.innerHTML = base.map(c => {
    const count = c.slug === 'all' ? AppState.articulos.length : AppState.articulos.filter(a => a.categoriaSlug === c.slug).length;
    return `
      <button class="library-filter-item ${libCurrentCat === c.slug ? 'active' : ''}" onclick="setLibCat('${c.slug}')">
        <i class="ti ${escapeHtml(c.icono || 'ti-folder')}"></i>
        ${escapeHtml(c.nombre)}
        <span class="library-count">${count}</span>
      </button>`;
  }).join('');
}

function setLibCat(cat) {
  libCurrentCat = cat;
  renderLibraryFilters();
  renderLibraryArticles();
}

function renderLibraryArticles() {
  const search = (document.getElementById('lib-search')?.value || '').toLowerCase();
  let articles = AppState.articulos;
  if (libCurrentCat !== 'all') articles = articles.filter(a => a.categoriaSlug === libCurrentCat);
  if (search) articles = articles.filter(a => a.titulo.toLowerCase().includes(search) || a.descripcion.toLowerCase().includes(search));

  const container = document.getElementById('lib-articles');
  if (!container) return;
  if (articles.length === 0) {
    container.innerHTML = `<div style="padding:40px;text-align:center;color:var(--gray-500)">
      <i class="ti ti-search-off" style="font-size:32px;display:block;margin-bottom:10px"></i>
      No se encontraron artículos.
    </div>`;
    return;
  }
  container.innerHTML = `<div class="articles-grid">${articles.map(a => `
    <div class="article-card" onclick="openArticle(${a.id})">
      <div class="article-thumb"><i class="ti ${escapeHtml(a.icono || 'ti-file-text')}"></i></div>
      <div class="article-body">
        <div class="article-tag">${escapeHtml(a.categoriaNombre)}</div>
        <h3 class="article-title">${escapeHtml(a.titulo)}</h3>
        <p class="article-desc">${escapeHtml(a.descripcion)}</p>
        <div class="article-meta">
          <span class="read-time"><i class="ti ti-clock" style="font-size:12px"></i> ${a.tiempoLectura} min de lectura</span>
          <span style="color:var(--red);font-size:12px;font-weight:500">${a.leido ? 'Ya leído ✓' : 'Leer →'}</span>
        </div>
      </div>
    </div>`).join('')}</div>`;
}

async function openArticle(id) {
  try {
    const { articulo } = await api(`/biblioteca/articulos/${id}`);
    openModal('modal-article');
    document.getElementById('modal-article-title').textContent = articulo.titulo;
    const cuerpo = articulo.contenido
      ? escapeHtml(articulo.contenido)
      : 'Este artículo todavía no tiene contenido completo cargado por el equipo de Research & Innovation. Contáctanos o solicita orientación personalizada a través de la ficha de orientación.';
    document.getElementById('modal-article-body').innerHTML = `
      <div style="margin-bottom:12px">
        <span style="font-size:11px;letter-spacing:.08em;text-transform:uppercase;color:var(--red);font-weight:600">${escapeHtml(articulo.categoriaNombre)}</span>
        <span style="margin:0 10px;color:var(--gray-300)">·</span>
        <span style="font-size:12px;color:var(--gray-500)">${articulo.tiempoLectura} min de lectura</span>
      </div>
      <p style="font-size:14px;color:var(--gray-700);line-height:1.8;margin-bottom:16px">${escapeHtml(articulo.descripcion)}</p>
      <div style="background:var(--gray-100);border-radius:8px;padding:20px;font-size:13px;color:var(--gray-700);line-height:1.8;white-space:pre-wrap">${cuerpo}</div>
    `;
    if (AppState.dashPanel === 'biblioteca') renderLibraryArticles(); // refresca el indicador "Ya leído"
  } catch (err) {
    showToast(err.message || 'No se pudo abrir el artículo.', 'error');
  }
}

/* ════════════════════════════════════════════════
   PANEL FICHA ORIENTATIVA
═══════════════════════════════════════════════════ */
const FICHA_STEPS = [
  { label: 'Tu proyecto' }, { label: 'Tipo de creación' }, { label: 'Nivel de avance (TRL)' },
  { label: 'Documentación' }, { label: 'Tus dudas' },
];

async function renderFicha() {
  const container = document.getElementById('panel-ficha-content');
  if (!container) return;
  container.innerHTML = `<p style="padding:40px;text-align:center;color:var(--gray-500)">Cargando…</p>`;
  try {
    const { ficha } = await api('/ficha/mia');
    if (ficha) {
      AppState.fichaData = { ...ficha };
      renderFichaEnviada(ficha);
    } else {
      AppState.fichaData = { documentacion: [] };
      AppState.fichaStep = 1;
      renderFichaStep();
    }
  } catch (err) {
    container.innerHTML = emptyStateHtml('No se pudo cargar tu ficha de orientación.');
    console.error(err);
  }
}

function renderFichaEnviada(ficha) {
  const container = document.getElementById('panel-ficha-content');
  const resumen = [
    ['Título', ficha.tituloProyecto], ['Descripción', ficha.descripcion], ['Sector', ficha.sector],
    ['Tipo de protección', ETIQUETAS_TIPO_PROTECCION[ficha.tipoProteccion] || ficha.tipoProteccion],
    ['Nivel TRL', ficha.nivelTrl], ['Documentación', (ficha.documentacion || []).join(', ')],
    ['Dudas', ficha.dudas],
  ].filter(([, v]) => v);

  container.innerHTML = `
    <div class="ficha-layout">
      <div class="ficha-card ficha-submitted">
        <i class="ti ti-circle-check" style="color:var(--green)"></i>
        <h3>Ficha enviada con éxito</h3>
        <p>Hemos recibido la información de tu proyecto. Estado actual: <strong>${escapeHtml(ETIQUETAS_ESTADO_FICHA[ficha.estado] || ficha.estado)}</strong>. Un especialista de Research & Innovation revisará los datos y se pondrá en contacto contigo en las próximas 48 horas hábiles.</p>
        <div style="background:var(--gray-100);border-radius:8px;padding:16px;text-align:left;max-width:420px;margin:0 auto">
          <p style="font-size:13px;font-weight:600;margin-bottom:8px">Resumen enviado:</p>
          ${resumen.map(([k, v]) => `<p style="font-size:12px;color:var(--gray-500);margin-bottom:4px"><strong style="color:var(--gray-700)">${escapeHtml(k)}:</strong> ${escapeHtml(v)}</p>`).join('')}
        </div>
        <button class="btn-outline-dark" style="margin-top:20px" onclick="switchDashPanel('inicio')">Volver al inicio</button>
      </div>
    </div>`;
}

function renderFichaStep() {
  const container = document.getElementById('panel-ficha-content');
  if (!container) return;
  const step = AppState.fichaStep;
  const total = FICHA_STEPS.length;
  const pct = Math.round(((step - 1) / total) * 100);

  container.innerHTML = `
    <div class="ficha-layout">
      <div class="ficha-header">
        <h2 class="dash-section-title" style="margin-bottom:4px">Ficha de Orientación</h2>
        <p style="font-size:13px;color:var(--gray-500);margin-bottom:12px">Organiza la información de tu proyecto para que nuestro equipo pueda orientarte mejor.</p>
        <div class="ficha-progress"><div class="ficha-progress-bar" style="width:${pct}%"></div></div>
        <div class="ficha-step-info">
          <span>Paso ${step} de ${total}: <strong>${escapeHtml(FICHA_STEPS[step - 1].label)}</strong></span>
          <span>${pct}% completado</span>
        </div>
      </div>
      <div id="ficha-step-body"></div>
    </div>`;
  renderFichaStepBody(step);
}

function renderFichaStepBody(step) {
  const body = document.getElementById('ficha-step-body');
  if (!body) return;
  const d = AppState.fichaData;

  const navPrev = step > 1 ? `<button class="btn-outline-dark" onclick="fichaNav(-1)"><i class="ti ti-arrow-left"></i> Anterior</button>` : `<div></div>`;
  const navNext = step < FICHA_STEPS.length
    ? `<button class="btn-red" onclick="fichaNav(1)">Siguiente <i class="ti ti-arrow-right"></i></button>`
    : `<button class="btn-red" onclick="fichaSubmit()"><i class="ti ti-send"></i> Enviar ficha</button>`;

  let content = '';

  if (step === 1) {
    content = `
      <div class="ficha-card">
        <h3 class="ficha-card-title">Cuéntanos sobre tu proyecto</h3>
        <p class="ficha-card-sub">Describe tu idea o invención de forma general. No te preocupes por los términos técnicos, solo cuéntanos qué hace y qué problema resuelve.</p>
        <div class="form-group">
          <label class="form-label">Nombre o título de tu proyecto *</label>
          <input class="form-field" id="ficha-titulo" placeholder="Ej: Sistema de purificación de agua con nanopartículas" value="${escapeHtml(d.tituloProyecto || '')}">
        </div>
        <div class="form-group">
          <label class="form-label">¿Qué hace tu invención? ¿Qué problema resuelve? *</label>
          <textarea class="form-field" id="ficha-desc" placeholder="Explica brevemente en qué consiste tu idea y cómo mejora lo que ya existe..." style="min-height:120px">${escapeHtml(d.descripcion || '')}</textarea>
        </div>
        <div class="form-group">
          <label class="form-label">Sector o campo de aplicación</label>
          <select class="form-field" id="ficha-sector">
            <option value="">Selecciona un sector</option>
            ${['Agricultura y alimentación', 'Salud y biotecnología', 'Electrónica y TIC', 'Mecánica e industria', 'Energía y medio ambiente', 'Construcción', 'Textil y materiales', 'Educación', 'Otro'].map(s =>
              `<option value="${escapeHtml(s)}" ${d.sector === s ? 'selected' : ''}>${escapeHtml(s)}</option>`
            ).join('')}
          </select>
        </div>
        <div class="ficha-nav">${navPrev}${navNext}</div>
      </div>`;
  }

  if (step === 2) {
    const tipos = [
      { val: 'patente', label: 'Patente de invención', desc: 'Producto o proceso nuevo, con nivel inventivo y aplicación industrial.' },
      { val: 'modelo_utilidad', label: 'Modelo de utilidad', desc: 'Mejora funcional de un objeto o herramienta ya existente.' },
      { val: 'marca', label: 'Marca comercial', desc: 'Nombre, logo o signo que distingue tus productos o servicios.' },
      { val: 'derecho_autor', label: 'Derecho de autor (software/arte)', desc: 'Obra literaria, artística, software o base de datos.' },
      { val: 'no_definido', label: 'No lo sé aún', desc: 'Necesito orientación para identificar qué tipo de protección aplica.' },
    ];
    content = `
      <div class="ficha-card">
        <h3 class="ficha-card-title">¿Qué tipo de creación tienes?</h3>
        <p class="ficha-card-sub">Selecciona la opción que más se acerca a tu situación. Si no estás seguro, elige la última opción.</p>
        <div class="radio-group">
          ${tipos.map(t => `
            <label class="radio-option ${d.tipoProteccion === t.val ? 'selected' : ''}">
              <input type="radio" name="ficha-tipo" value="${t.val}" ${d.tipoProteccion === t.val ? 'checked' : ''}>
              <div class="radio-option-text"><p>${escapeHtml(t.label)}</p><span>${escapeHtml(t.desc)}</span></div>
            </label>`).join('')}
        </div>
        <div class="ficha-nav">${navPrev}${navNext}</div>
      </div>`;
  }

  if (step === 3) {
    const trls = [
      { n: '1-2', label: 'Solo tengo la idea, no hay prototipo' },
      { n: '3-4', label: 'Tengo bocetos o un prototipo conceptual' },
      { n: '5-6', label: 'Prototipo probado en laboratorio' },
      { n: '7-8', label: 'Prototipo funcionando en entorno real' },
      { n: '9', label: 'Producto listo para comercialización' },
    ];
    content = `
      <div class="ficha-card">
        <h3 class="ficha-card-title">Nivel de avance tecnológico (TRL)</h3>
        <p class="ficha-card-sub">¿En qué etapa de desarrollo se encuentra tu proyecto? Esto nos ayuda a orientarte mejor sobre el momento ideal para iniciar el proceso de patentamiento.</p>
        <div class="trl-grid">
          ${trls.map(t => `
            <div class="trl-card ${d.nivelTrl === t.n ? 'selected' : ''}" onclick="selectTRL('${t.n}', this)">
              <div class="trl-num">TRL ${t.n}</div>
              <div class="trl-label">${escapeHtml(t.label)}</div>
            </div>`).join('')}
        </div>
        <div class="ficha-nav">${navPrev}${navNext}</div>
      </div>`;
  }

  if (step === 4) {
    const docs = ['Descripción escrita', 'Bocetos o dibujos a mano', 'Fotografías del prototipo', 'Archivos CAD/3D', 'Memoria descriptiva', 'Videos demostrativos', 'Ninguno aún'];
    const selDocs = d.documentacion || [];
    content = `
      <div class="ficha-card">
        <h3 class="ficha-card-title">¿Con qué documentación cuentas?</h3>
        <p class="ficha-card-sub">Marca todos los materiales que tienes disponibles sobre tu invención. Esto nos ayuda a planificar mejor el proceso de redacción.</p>
        <div class="checkbox-group">
          ${docs.map(dc => `
            <label class="checkbox-option">
              <input type="checkbox" name="ficha-docs" value="${escapeHtml(dc)}" ${selDocs.includes(dc) ? 'checked' : ''}>
              <label>${escapeHtml(dc)}</label>
            </label>`).join('')}
        </div>
        <div class="ficha-nav">${navPrev}${navNext}</div>
      </div>`;
  }

  if (step === 5) {
    content = `
      <div class="ficha-card">
        <h3 class="ficha-card-title">¿Cuáles son tus principales dudas?</h3>
        <p class="ficha-card-sub">Cuéntanos qué es lo que más te preocupa o lo que más quieres saber. Esto nos ayuda a preparar una orientación personalizada para ti.</p>
        <div class="form-group">
          <label class="form-label">¿Ya has divulgado tu invención públicamente? (ferias, redes, tesis publicada)</label>
          <div style="display:flex;gap:12px;margin-bottom:16px">
            ${[['si', 'Sí'], ['no', 'No'], ['nose', 'No estoy seguro']].map(([val, label]) => `
              <label style="display:flex;align-items:center;gap:8px;font-size:13px;cursor:pointer">
                <input type="radio" name="ficha-divulgado" value="${val}" ${d.yaDivulgada === val ? 'checked' : ''}> ${label}
              </label>`).join('')}
          </div>
        </div>
        <div class="form-group">
          <label class="form-label">¿Tienes socios o coinventores en este proyecto?</label>
          <div style="display:flex;gap:12px;margin-bottom:16px">
            ${[['si', 'Sí'], ['no', 'No']].map(([val, label]) => `
              <label style="display:flex;align-items:center;gap:8px;font-size:13px;cursor:pointer">
                <input type="radio" name="ficha-socios" value="${val}" ${d.tieneSocios === val ? 'checked' : ''}> ${label}
              </label>`).join('')}
          </div>
        </div>
        <div class="form-group">
          <label class="form-label">Dudas específicas que deseas resolver</label>
          <textarea class="form-field" id="ficha-dudas" placeholder="Ej: ¿Mi invención puede ser patentada si ya hice una presentación en la universidad? ¿Cuánto cuesta el proceso completo?..." style="min-height:120px">${escapeHtml(d.dudas || '')}</textarea>
        </div>
        <div class="ficha-nav">${navPrev}${navNext}</div>
      </div>`;
  }

  body.innerHTML = content;
  body.querySelectorAll('.radio-option').forEach(opt => {
    opt.addEventListener('click', () => {
      body.querySelectorAll('.radio-option').forEach(o => o.classList.remove('selected'));
      opt.classList.add('selected');
      const input = opt.querySelector('input[type="radio"]');
      if (input) input.checked = true;
    });
  });
}

function selectTRL(val, el) {
  document.querySelectorAll('.trl-card').forEach(c => c.classList.remove('selected'));
  el.classList.add('selected');
  AppState.fichaData.nivelTrl = val;
}

function fichaNav(dir) {
  fichaCollectStep(AppState.fichaStep);
  const newStep = AppState.fichaStep + dir;
  if (newStep < 1 || newStep > FICHA_STEPS.length) return;
  AppState.fichaStep = newStep;
  renderFichaStep();
}

function fichaCollectStep(step) {
  const d = AppState.fichaData;
  if (step === 1) {
    const titulo = document.getElementById('ficha-titulo')?.value.trim();
    const desc = document.getElementById('ficha-desc')?.value.trim();
    const sector = document.getElementById('ficha-sector')?.value;
    if (titulo) d.tituloProyecto = titulo;
    if (desc) d.descripcion = desc;
    if (sector) d.sector = sector;
  }
  if (step === 2) {
    const tipo = document.querySelector('input[name="ficha-tipo"]:checked')?.value;
    if (tipo) d.tipoProteccion = tipo;
  }
  if (step === 4) {
    d.documentacion = [...document.querySelectorAll('input[name="ficha-docs"]:checked')].map(i => i.value);
  }
  if (step === 5) {
    const div = document.querySelector('input[name="ficha-divulgado"]:checked')?.value;
    const socios = document.querySelector('input[name="ficha-socios"]:checked')?.value;
    const dudas = document.getElementById('ficha-dudas')?.value.trim();
    if (div) d.yaDivulgada = div;
    if (socios) d.tieneSocios = socios;
    if (dudas) d.dudas = dudas;
  }
}

async function fichaSubmit() {
  fichaCollectStep(5);
  const d = AppState.fichaData;

  if (!d.tituloProyecto || d.tituloProyecto.trim().length < 3) {
    showToast('Completa al menos el nombre del proyecto.', 'error');
    AppState.fichaStep = 1; renderFichaStep(); return;
  }
  if (!d.descripcion || d.descripcion.trim().length < 10) {
    showToast('Cuéntanos un poco más sobre tu invención (mínimo 10 caracteres).', 'error');
    AppState.fichaStep = 1; renderFichaStep(); return;
  }

  try {
    const { ficha } = await api('/ficha', { method: 'POST', body: d });
    if (AppState.currentUser) AppState.currentUser.fichaEnviada = true;
    showToast('¡Ficha enviada! Nos pondremos en contacto pronto.', 'success');
    renderFichaEnviada(ficha);
  } catch (err) {
    showToast(err.message || 'No se pudo enviar la ficha. Intenta nuevamente.', 'error');
  }
}

/* ════════════════════════════════════════════════
   PANEL SEGUIMIENTO
═══════════════════════════════════════════════════ */
async function renderSeguimiento() {
  const user = AppState.currentUser;
  const container = document.getElementById('panel-seguimiento-content');
  if (!container) return;

  if (user?.tipo !== 'cliente') {
    container.innerHTML = `
      <div class="locked-banner">
        <i class="ti ti-lock"></i>
        <h3>Sección exclusiva para clientes activos</h3>
        <p>Esta área está disponible una vez que inicies un servicio con Research & Innovation. Podrás ver el estado en tiempo real de tu solicitud de patente.</p>
        <button class="btn-red" onclick="switchDashPanel('ficha')"><i class="ti ti-clipboard-text"></i> Enviar ficha de orientación</button>
      </div>`;
    return;
  }

  container.innerHTML = `<p style="padding:40px;text-align:center;color:var(--gray-500)">Cargando…</p>`;
  try {
    const { proyecto: d, fases, documentos, alertas } = await api('/proyectos/mio');
    if (!d) {
      container.innerHTML = `
        <div class="locked-banner">
          <i class="ti ti-hourglass-high"></i>
          <h3>Aún no tienes un proyecto activo</h3>
          <p>Ya eres cliente de Research & Innovation. Nuestro equipo está preparando tu expediente y pronto podrás ver aquí el seguimiento de tu solicitud.</p>
        </div>`;
      return;
    }

    const claseEstado = d.estado === 'activo' ? 'en-proceso' : d.estado === 'otorgado' ? 'completado' : '';
    const labelEstado = { activo: 'En proceso', pausado: 'Pausado', cerrado: 'Cerrado', otorgado: 'Patente otorgada' }[d.estado] || d.estado;

    container.innerHTML = `
      <div class="seguimiento-header">
        <div style="display:flex;justify-content:space-between;align-items:flex-start;flex-wrap:wrap;gap:12px">
          <div>
            <p class="seguimiento-proyecto">${escapeHtml(d.titulo)}</p>
            <p class="seguimiento-sub">Expediente: <strong>${escapeHtml(d.numeroExpediente || 'Aún no asignado')}</strong> · ${escapeHtml(ETIQUETAS_TIPO_PATENTE[d.tipoPatente] || d.tipoPatente)} · Iniciado el ${fmtFecha(d.fechaInicio)}</p>
            <div style="margin-top:10px"><span class="seguimiento-status ${claseEstado}"><i class="ti ti-clock"></i> ${escapeHtml(labelEstado)}</span></div>
          </div>
          <div style="text-align:right">
            <p style="font-size:12px;color:var(--gray-500);margin-bottom:6px">Progreso general</p>
            <div style="background:var(--gray-200);border-radius:100px;height:8px;width:160px">
              <div style="height:100%;width:${d.porcentajeAvance}%;background:var(--red);border-radius:100px"></div>
            </div>
            <p style="font-size:13px;font-weight:600;color:var(--red);margin-top:4px">${d.porcentajeAvance}%</p>
          </div>
        </div>
      </div>

      ${alertas.map(a => {
        const urgente = a.tipo === 'urgente';
        const icono = { urgente: 'ti-alert-circle', tasa: 'ti-coin', observacion: 'ti-alert-triangle', recordatorio: 'ti-calendar', info: 'ti-info-circle' }[a.tipo] || 'ti-info-circle';
        return `<div style="background:${urgente ? '#FFF7E6' : 'var(--gray-100)'};border:1px solid ${urgente ? '#FFE0A0' : 'var(--gray-200)'};border-radius:var(--radius-lg);padding:14px 18px;display:flex;align-items:center;gap:12px;margin-bottom:12px">
          <i class="ti ${icono}" style="font-size:18px;color:${urgente ? '#B07300' : 'var(--gray-500)'}"></i>
          <span style="font-size:13px;color:${urgente ? '#B07300' : 'var(--gray-700)'};">${escapeHtml(a.mensaje)}${a.fechaLimite ? ` (límite: ${fmtFecha(a.fechaLimite)})` : ''}</span>
        </div>`;
      }).join('')}

      <div class="timeline-container">
        <h3 class="dash-section-title">Línea de tiempo del proceso</h3>
        <div class="timeline">
          ${fases.map(f => {
            const dotClass = f.estado === 'completado' ? 'done' : f.estado === 'activo' ? 'active' : f.estado === 'con_observacion' ? 'obs' : '';
            const phaseClass = f.estado === 'activo' ? 'active-phase' : f.estado === 'completado' ? 'done-phase' : '';
            const icon = f.estado === 'completado' ? 'ti-check' : f.estado === 'activo' ? 'ti-loader' : f.estado === 'con_observacion' ? 'ti-alert-triangle' : 'ti-clock';
            const fecha = f.fechaFin ? fmtFecha(f.fechaFin) : f.fechaInicio ? fmtFecha(f.fechaInicio) : 'Pendiente';
            return `<div class="timeline-item">
              <div class="timeline-dot ${dotClass}"><i class="ti ${icon}"></i></div>
              <div class="timeline-content">
                <p class="timeline-phase ${phaseClass}">${escapeHtml(f.nombre)}</p>
                <p class="timeline-date">${fecha}</p>
                ${f.nota ? `<div class="timeline-note">${escapeHtml(f.nota)}</div>` : ''}
                ${f.observacion ? `<div class="timeline-obs"><i class="ti ti-alert-triangle"></i>${escapeHtml(f.observacion)}</div>` : ''}
              </div>
            </div>`;
          }).join('')}
        </div>
      </div>

      <div style="margin-bottom:8px"><h3 class="dash-section-title">Documentos del expediente</h3></div>
      <div class="docs-grid">
        ${documentos.length === 0 ? '<p style="color:var(--gray-500);font-size:13px">Aún no hay documentos cargados.</p>' : documentos.map(doc => `
          <div class="doc-item">
            <div class="doc-icon"><i class="ti ${iconoPorTipoArchivo(doc.tipo)}"></i></div>
            <div class="doc-info">
              <p>${escapeHtml(doc.nombre)}</p>
              <span>${doc.pendiente ? 'PENDIENTE de tu parte' : `${doc.tamanoKb ? doc.tamanoKb + ' KB · ' : ''}${fmtFecha(doc.creadoEn)}`}</span>
            </div>
            ${doc.pendiente
              ? '<span class="doc-download" style="opacity:.4;cursor:default" title="Aún no disponible"><i class="ti ti-clock"></i></span>'
              : `<a class="doc-download" href="/api/proyectos/mio/documentos/${doc.id}/descargar" title="Descargar"><i class="ti ti-download"></i></a>`}
          </div>`).join('')}
      </div>
      <div style="margin-top:14px">
        <label class="btn-outline-dark btn-sm" style="cursor:pointer;display:inline-flex;align-items:center;gap:6px">
          <i class="ti ti-upload"></i> Subir un documento
          <input type="file" id="seg-upload-input" style="display:none" accept=".pdf,.doc,.docx,.png,.jpg,.jpeg,.webp,.stl,.obj,.glb,.zip" />
        </label>
        <span style="font-size:11px;color:var(--gray-500);margin-left:8px">PDF, DOC, imágenes, 3D o ZIP · máx. 20&nbsp;MB</span>
      </div>`;

    const uploadInput = document.getElementById('seg-upload-input');
    if (uploadInput) uploadInput.onchange = (e) => subirDocumentoCliente(e.target.files[0]);
  } catch (err) {
    container.innerHTML = emptyStateHtml('No se pudo cargar tu seguimiento. Intenta nuevamente.');
    console.error(err);
  }
}

async function subirDocumentoCliente(file) {
  if (!file) return;
  const fd = new FormData();
  fd.append('archivo', file);
  try {
    await api('/proyectos/mio/documentos', { method: 'POST', body: fd });
    showToast('Documento subido correctamente.', 'success');
    renderSeguimiento();
  } catch (err) {
    showToast(err.message || 'No se pudo subir el archivo.', 'error');
  }
}

/* ════════════════════════════════════════════════
   PANEL NOTIFICACIONES
═══════════════════════════════════════════════════ */
function notifItemHtml(n, conAccion) {
  return `<div class="notif-item ${!n.leida ? 'unread' : ''}" id="notif-${n.id}">
    <div class="notif-icon"><i class="ti ${escapeHtml(n.icono || 'ti-bell')}"></i></div>
    <div style="flex:1">
      <p>${escapeHtml(n.mensaje)}</p>
      ${n.detalle ? `<span>${escapeHtml(n.detalle)}</span><br>` : ''}
      <span style="font-size:11px;color:var(--gray-300);margin-top:4px;display:block">${tiempoRelativo(n.creadoEn)}</span>
    </div>
    ${conAccion && !n.leida ? `<button onclick="markRead(${n.id})" style="background:none;border:none;font-size:11px;color:var(--red);cursor:pointer;white-space:nowrap;flex-shrink:0;padding:4px 8px">Marcar leído</button>` : ''}
  </div>`;
}

async function renderNotificaciones() {
  const container = document.getElementById('panel-notificaciones-content');
  if (!container) return;
  container.innerHTML = `<p style="padding:40px;text-align:center;color:var(--gray-500)">Cargando…</p>`;
  try {
    const { notificaciones, noLeidas } = await api('/notificaciones');
    updateNotifBadge(noLeidas);
    container.innerHTML = `
      <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:20px">
        <h3 class="dash-section-title" style="margin-bottom:0">Todas las notificaciones</h3>
        <button class="btn-outline-dark btn-sm" onclick="markAllRead()">Marcar todo como leído</button>
      </div>
      <div class="notif-list">${notificaciones.map(n => notifItemHtml(n, true)).join('') || emptyStateHtml('No tienes notificaciones todavía.')}</div>`;
  } catch (err) {
    container.innerHTML = emptyStateHtml('No se pudieron cargar tus notificaciones.');
    console.error(err);
  }
}

async function markRead(id) {
  try {
    await api(`/notificaciones/${id}/leer`, { method: 'PATCH' });
    renderNotificaciones();
    if (AppState.dashPanel === 'inicio') renderPanelInicio();
  } catch (err) {
    showToast(err.message || 'No se pudo actualizar la notificación.', 'error');
  }
}

async function markAllRead() {
  try {
    await api('/notificaciones/leer-todas', { method: 'PATCH' });
    renderNotificaciones();
    if (AppState.dashPanel === 'inicio') renderPanelInicio();
  } catch (err) {
    showToast(err.message || 'No se pudo actualizar.', 'error');
  }
}

function updateNotifBadge(count) {
  const sidebarBadge = document.querySelector('#sidebar-notif .badge');
  const topbarBadge = document.querySelector('.notif-badge');
  if (sidebarBadge) { sidebarBadge.textContent = count; sidebarBadge.style.display = count > 0 ? '' : 'none'; }
  if (topbarBadge) { topbarBadge.style.display = count > 0 ? '' : 'none'; }
}

/* ════════════════════════════════════════════════
   CONTENIDO PÚBLICO (hero, servicios, nosotros, etc.)
   Se obtiene del panel admin — si la petición falla, el sitio
   conserva el texto de respaldo que ya está escrito en el HTML.
═══════════════════════════════════════════════════ */
async function cargarContenidoPublico() {
  try {
    const [{ contenido: c }, { faqs }, { patentes }] = await Promise.all([
      api('/public/contenido'), api('/public/faqs'), api('/public/patentes-destacadas'),
    ]);
    AppState.faqs = faqs;
    renderHero(c.hero);
    renderServicios(c.servicios);
    renderNosotros(c.nosotros);
    renderProceso(c.proceso);
    renderPatentes(c.patentes_seccion, patentes);
    renderEstadisticas(c.estadisticas);
    renderAliados(c.aliados);
    renderContactoInfo(c.contacto_info);
    renderFaqList(faqs);
  } catch (err) {
    console.error('No se pudo cargar el contenido público; se conserva el contenido de respaldo.', err);
  }
}

function renderHero(h) {
  if (!h) return;
  const eyebrow = document.getElementById('hero-eyebrow');
  const title = document.getElementById('hero-title');
  const desc = document.getElementById('hero-desc');
  if (eyebrow && h.eyebrow) eyebrow.textContent = h.eyebrow;
  if (title && (h.tituloLinea1 || h.tituloAccent)) title.innerHTML = `${escapeHtml(h.tituloLinea1 || '')} <span>${escapeHtml(h.tituloAccent || '')}</span>`;
  if (desc && h.descripcion) desc.textContent = h.descripcion;
}

function renderServicios(s) {
  if (!s) return;
  const setText = (id, val) => { const el = document.getElementById(id); if (el && val) el.textContent = val; };
  setText('servicios-tag', s.tag); setText('servicios-titulo', s.titulo); setText('servicios-subtitulo', s.subtitulo);
  const items = s.items || [];
  const cont = document.getElementById('servicios-cards');
  if (cont && items.length) {
    cont.innerHTML = items.map((it, i) => `
      <div class="card card-accent service-card fade-in ${i > 0 ? 'fade-in-delay-' + Math.min(i, 3) : ''}">
        <i class="ti ${escapeHtml(it.icono || 'ti-star')}"></i>
        <h3>${escapeHtml(it.titulo)}</h3>
        <p>${escapeHtml(it.descripcion)}</p>
      </div>`).join('');
  }
}

function renderNosotros(n) {
  if (!n) return;
  const setText = (id, val) => { const el = document.getElementById(id); if (el && val) el.textContent = val; };
  setText('nosotros-tag', n.tag); setText('nosotros-titulo', n.titulo); setText('nosotros-desc', n.descripcion);
}

function renderProceso(p) {
  if (!p) return;
  const setText = (id, val) => { const el = document.getElementById(id); if (el && val) el.textContent = val; };
  setText('proceso-tag', p.tag); setText('proceso-titulo', p.titulo); setText('proceso-subtitulo', p.subtitulo);
  const pasos = p.pasos || [];
  const cont = document.getElementById('proceso-steps');
  if (cont && pasos.length) {
    cont.innerHTML = pasos.map((s, i) => `
      <div class="step fade-in ${i > 0 ? 'fade-in-delay-' + Math.min(i, 3) : ''}">
        <div class="step-num ${i === 0 ? 'dark' : 'accent'}">${escapeHtml(s.numero || String(i + 1))}</div>
        <h4>${escapeHtml(s.titulo)}</h4>
        <p>${escapeHtml(s.descripcion)}</p>
      </div>`).join('');
  }
}

function renderPatentes(seccion, patentes) {
  if (seccion) {
    const setText = (id, val) => { const el = document.getElementById(id); if (el && val) el.textContent = val; };
    setText('patentes-tag', seccion.tag); setText('patentes-titulo', seccion.titulo); setText('patentes-subtitulo', seccion.subtitulo);
  }
  const cont = document.getElementById('patentes-videos');
  if (!cont || !patentes || patentes.length === 0) return;
  cont.innerHTML = patentes.map((p, i) => `
    <div class="video-card fade-in ${i > 0 ? 'fade-in-delay-' + Math.min(i, 3) : ''}" data-video-url="${escapeHtml(p.videoUrl || '')}" onclick="abrirVideoPatente(this)" style="${p.videoUrl ? 'cursor:pointer' : ''}">
      <i class="ti ti-player-play"></i>
      <span>${escapeHtml(p.descripcion || 'Video explosión 3D')} · ${escapeHtml(p.titulo)}</span>
    </div>`).join('');
}
function abrirVideoPatente(el) {
  const url = el.dataset.videoUrl;
  if (url) window.open(url, '_blank', 'noopener');
}

function renderEstadisticas(lista) {
  const cont = document.getElementById('stats-grid');
  if (!cont || !lista || !lista.length) return;
  cont.innerHTML = lista.map((it, i) => `
    <div class="fade-in ${i > 0 ? 'fade-in-delay-' + Math.min(i, 3) : ''}">
      <p class="stat-num ${it.estilo === 'light' ? 'light' : 'accent'}" data-target="${Number(it.valor) || 0}">0</p>
      <p class="stat-label">${escapeHtml(it.etiqueta)}</p>
    </div>`).join('');
}

function renderAliados(lista) {
  const cont = document.getElementById('aliados-track');
  if (!cont || !lista || !lista.length) return;
  const html = lista.map(nombre => `<div class="logo-pill"><i class="ti ti-building-community"></i>${escapeHtml(nombre)}</div>`).join('');
  cont.innerHTML = html + html; // duplicado para el loop continuo del carrusel
}

function renderContactoInfo(info) {
  if (!info) return;
  const setText = (id, val) => { const el = document.getElementById(id); if (el && val) el.textContent = val; };
  setText('contact-email', info.email);
  setText('contact-telefono', info.telefono);
  setText('contact-direccion', info.direccion);
  if (info.linkedin) setText('contact-linkedin', `LinkedIn / ${info.linkedin}`);
  const wsp = document.getElementById('wsp-float');
  if (wsp && info.whatsapp) wsp.href = `https://wa.me/${info.whatsapp.replace(/\D/g, '')}`;
}

function renderFaqList(faqs) {
  const cont = document.getElementById('faq-list');
  if (!cont || !faqs || faqs.length === 0) return;
  cont.innerHTML = faqs.map((f, i) => `
    <div class="faq-item ${i === 0 ? 'open' : ''}">
      <div class="faq-q"><span>${escapeHtml(f.pregunta)}</span><i class="ti ti-plus faq-icon"></i></div>
      <div class="faq-a">${escapeHtml(f.respuesta)}</div>
    </div>`).join('');
}

/* ════════════════════════════════════════════════
   SCROLL Y NAVBAR DINÁMICA
═══════════════════════════════════════════════════ */
function initScrollBehavior() {
  const navbar = document.getElementById('navbar');
  const progress = document.getElementById('scroll-progress');
  window.addEventListener('scroll', () => {
    if (AppState.currentPage !== 'home') return;
    const scrollY = window.scrollY;
    const maxScroll = document.documentElement.scrollHeight - window.innerHeight;
    if (progress) progress.style.width = maxScroll > 0 ? (scrollY / maxScroll * 100) + '%' : '0%';
    if (navbar) navbar.classList.toggle('scrolled', scrollY > 80);
  });
}

/* ════════════════════════════════════════════════
   ANIMACIONES INTERSECTION OBSERVER
═══════════════════════════════════════════════════ */
function initAnimations() {
  const observer = new IntersectionObserver(entries => {
    entries.forEach(e => { if (e.isIntersecting) { e.target.classList.add('visible'); observer.unobserve(e.target); } });
  }, { threshold: 0.15 });
  document.querySelectorAll('.fade-in').forEach(el => observer.observe(el));

  const counterObs = new IntersectionObserver(entries => {
    entries.forEach(e => {
      if (!e.isIntersecting) return;
      const el = e.target;
      const target = parseInt(el.dataset.target, 10);
      const suffix = target === 100 ? '%' : '+';
      let cur = 0;
      const step = Math.ceil(target / 40) || 1;
      const timer = setInterval(() => {
        cur = Math.min(cur + step, target);
        el.textContent = cur + suffix;
        if (cur >= target) clearInterval(timer);
      }, 30);
      counterObs.unobserve(el);
    });
  }, { threshold: 0.5 });
  document.querySelectorAll('.stat-num[data-target]').forEach(el => counterObs.observe(el));
}

/* ════════════════════════════════════════════════
   FAQ
═══════════════════════════════════════════════════ */
function initFAQ() {
  document.querySelectorAll('.faq-q').forEach(btn => {
    btn.addEventListener('click', () => {
      const item = btn.parentElement;
      const wasOpen = item.classList.contains('open');
      document.querySelectorAll('.faq-item').forEach(i => i.classList.remove('open'));
      if (!wasOpen) item.classList.add('open');
    });
  });
}

/* ════════════════════════════════════════════════
   CONTACTO FORM
═══════════════════════════════════════════════════ */
function initContactForm() {
  const form = document.getElementById('contact-form');
  if (!form) return;
  form.addEventListener('submit', async (e) => {
    e.preventDefault();
    const btn = form.querySelector('button[type="submit"]');
    const datos = Object.fromEntries(new FormData(form).entries());
    btn.disabled = true;
    try {
      await api('/public/contacto', { method: 'POST', body: datos });
      showToast('¡Mensaje enviado! Te contactaremos pronto.', 'success');
      form.reset();
    } catch (err) {
      showToast(err.message || 'No se pudo enviar el mensaje. Intenta nuevamente.', 'error');
    } finally {
      btn.disabled = false;
    }
  });
}

/* ════════════════════════════════════════════════
   NAV USER DROPDOWN
═══════════════════════════════════════════════════ */
function initNavDropdown() {
  const btn = document.getElementById('nav-user-btn');
  const dropdown = document.getElementById('nav-dropdown');
  if (!btn || !dropdown) return;
  btn.addEventListener('click', e => { e.stopPropagation(); dropdown.classList.toggle('open'); });
  document.addEventListener('click', () => dropdown.classList.remove('open'));
}

/* ════════════════════════════════════════════════
   MODAL GLOBAL CLOSE
═══════════════════════════════════════════════════ */
function initModals() {
  document.querySelectorAll('.modal-close, [data-modal-close]').forEach(btn => {
    btn.addEventListener('click', () => btn.closest('.modal-overlay')?.classList.remove('open'));
  });
  document.querySelectorAll('.modal-overlay').forEach(overlay => {
    overlay.addEventListener('click', e => { if (e.target === overlay) overlay.classList.remove('open'); });
  });
}

/* ════════════════════════════════════════════════
   BOOT
═══════════════════════════════════════════════════ */
document.addEventListener('DOMContentLoaded', async () => {
  initScrollBehavior();
  initContactForm();
  initNavDropdown();
  initModals();
  initLogin();
  initRegister();
  document.getElementById('nav-hamburger')?.addEventListener('click', toggleMobileMenu);
  document.getElementById('mobile-nav-logout')?.addEventListener('click', doLogout);

  await cargarContenidoPublico();
  initFAQ();
  initAnimations();

  await restaurarSesion();
  navigateTo('home');

  // Exponer funciones globales necesarias para onclick en HTML
  window.navigateTo = navigateTo;
  window.switchDashPanel = switchDashPanel;
  window.setLibCat = setLibCat;
  window.openArticle = openArticle;
  window.fichaNav = fichaNav;
  window.fichaSubmit = fichaSubmit;
  window.selectTRL = selectTRL;
  window.markRead = markRead;
  window.markAllRead = markAllRead;
  window.openModal = openModal;
  window.closeModal = closeModal;
  window.showToast = showToast;
  window.loginDemo = loginDemo;
  window.initDashboard = initDashboard;
  window.abrirVideoPatente = abrirVideoPatente;
  window.closeMobileMenu = closeMobileMenu;
});
