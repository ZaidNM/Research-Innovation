// Simula el comportamiento de admin.js llamando a los mismos endpoints,
// para validar el contrato completo sin necesidad de un navegador real.
const BASE = 'http://localhost:3000';
let cookieJar = '';

async function api(ruta, opciones = {}) {
  const headers = opciones.body instanceof URLSearchParams || opciones.formData ? {} : { 'Content-Type': 'application/json' };
  if (cookieJar) headers.Cookie = cookieJar;
  const resp = await fetch(`${BASE}/api${ruta}`, {
    method: opciones.method || 'GET',
    headers,
    body: opciones.formData || (opciones.body ? JSON.stringify(opciones.body) : undefined),
  });
  const setCookie = resp.headers.get('set-cookie');
  if (setCookie) cookieJar = setCookie.split(';')[0];
  let datos = null;
  try { datos = await resp.json(); } catch {}
  if (!resp.ok) throw new Error(`[${resp.status}] ${datos?.error || 'error'}`);
  return datos;
}

function assert(cond, msg) {
  if (!cond) throw new Error(`ASSERT FALLÓ: ${msg}`);
  console.log(`  ✓ ${msg}`);
}

async function main() {
  console.log('1) Login como admin (igual que admin-login-form)');
  const loginResp = await api('/auth/login', { method: 'POST', body: { email: 'admin@researchinnovation.com', password: 'Admin2026!' } });
  assert(loginResp.user.tipo === 'admin', 'el usuario logueado es admin');

  console.log('2) Cargar dashboard (cargarDashboard)');
  const stats = await api('/admin/stats');
  assert(typeof stats.usuarios.total === 'number', 'stats.usuarios.total es numérico');

  console.log('3) Cargar usuarios (cargarUsuarios)');
  const { datos: usuarios } = await api('/admin/usuarios');
  assert(Array.isArray(usuarios) && usuarios.length >= 3, `hay ${usuarios.length} usuarios`);
  const cliente = usuarios.find((u) => u.email === 'cliente@demo.com');
  assert(!!cliente, 'existe cliente@demo.com en la lista');

  console.log('4) Ver detalle de usuario (verUsuario)');
  const detalle = await api(`/admin/usuarios/${cliente.id}`);
  assert(detalle.usuario.email === 'cliente@demo.com', 'detalle trae el usuario correcto');
  assert(!!detalle.proyecto, 'el cliente demo ya tiene proyecto');

  console.log('5) Cargar biblioteca (cargarBiblioteca)');
  const bib = await api('/admin/biblioteca/categorias');
  assert(bib.categorias.length >= 4, `hay ${bib.categorias.length} categorías`);

  console.log('6) Cargar contenido (cargarContenido) - shape esperado por bloqueObjeto/bloqueServicios/etc.');
  const { contenido } = await api('/admin/contenido');
  assert(typeof contenido.hero.eyebrow === 'string', 'contenido.hero.eyebrow existe');
  assert(Array.isArray(contenido.servicios.items), 'contenido.servicios.items es array');
  assert(Array.isArray(contenido.proceso.pasos), 'contenido.proceso.pasos es array');
  assert(Array.isArray(contenido.estadisticas), 'contenido.estadisticas es array');
  assert(Array.isArray(contenido.aliados), 'contenido.aliados es array');
  assert(typeof contenido.contacto_info.email === 'string', 'contenido.contacto_info.email existe');

  console.log('7) Simular guardarServicios (edición de repetibles)');
  const nuevoServicios = { ...contenido.servicios, items: [...contenido.servicios.items, { icono: 'ti-test', titulo: 'Servicio de prueba', descripcion: 'Descripción de prueba' }] };
  await api('/admin/contenido/servicios', { method: 'PUT', body: { valor: nuevoServicios } });
  const verif = await api('/public/contenido');
  assert(verif.contenido.servicios.items.length === nuevoServicios.items.length, 'el nuevo servicio se guardó y es visible en el público');

  console.log('8) Cargar fichas y proyectos (cargarFichas / cargarProyectos)');
  const fichas = await api('/admin/fichas');
  assert(Array.isArray(fichas.fichas), 'fichas.fichas es array');
  const proyectos = await api('/admin/proyectos');
  assert(Array.isArray(proyectos.proyectos), 'proyectos.proyectos es array');
  assert(proyectos.proyectos.length >= 1, 'hay al menos 1 proyecto (el demo)');

  console.log('9) Ver detalle de proyecto (abrirDetalleProyecto) y validar shape para panelFasesProyecto');
  const pid = proyectos.proyectos[0].id;
  const det = await api(`/admin/proyectos/${pid}`);
  assert(det.fases.length === 9, `el proyecto tiene ${det.fases.length} fases (se esperaban 9)`);
  assert(det.fases[0].orden === 1, 'las fases vienen ordenadas');
  assert('nombre' in det.fases[0] && 'estado' in det.fases[0], 'cada fase trae nombre y estado');

  console.log('10) FAQ y patentes destacadas (cargarFaqs / cargarPatentes)');
  const faqs = await api('/admin/faqs');
  assert(faqs.faqs.length >= 5, `hay ${faqs.faqs.length} FAQs`);
  const patentes = await api('/admin/patentes-destacadas');
  assert(patentes.patentes.length >= 3, `hay ${patentes.patentes.length} patentes destacadas`);

  console.log('11) Contactos (cargarContactos)');
  const contactos = await api('/admin/contactos');
  assert(Array.isArray(contactos.contactos), 'contactos.contactos es array');

  console.log('12) Notificaciones — cargar lista de usuarios para el <select> (cargarNotificaciones)');
  const { datos: usuariosParaSelect } = await api('/admin/usuarios?porPagina=200');
  assert(usuariosParaSelect.every((u) => u.id && u.nombre && u.email), 'todos los usuarios traen id/nombre/email para el <select>');

  console.log('\n✅ TODOS LOS CONTRATOS QUE admin.js CONSUME FUERON VALIDADOS CONTRA LA API REAL.');
}

main().catch((err) => {
  console.error('\n❌ FALLÓ:', err.message);
  process.exit(1);
});
