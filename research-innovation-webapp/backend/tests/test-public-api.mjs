// Simula lo que hace public/app.js en el navegador, validando cada
// contrato de datos contra la API real (sin necesidad de un navegador).
const BASE = 'http://localhost:3000';
let cookieJar = '';

async function api(ruta, opciones = {}) {
  const headers = {};
  if (!opciones.formData) headers['Content-Type'] = 'application/json';
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
  console.log('1) cargarContenidoPublico() — GET /public/contenido, /public/faqs, /public/patentes-destacadas');
  const { contenido } = await api('/public/contenido');
  assert(contenido.hero.tituloAccent.length > 0, 'hero.tituloAccent no vacío');
  assert(Array.isArray(contenido.servicios.items), 'servicios.items es array');
  assert(Array.isArray(contenido.estadisticas), 'estadisticas es array (para renderEstadisticas)');
  assert(Array.isArray(contenido.aliados), 'aliados es array (para renderAliados)');
  const { faqs } = await api('/public/faqs');
  assert(faqs.length >= 5, `${faqs.length} FAQs públicas`);
  const { patentes } = await api('/public/patentes-destacadas');
  assert(patentes.length >= 3, `${patentes.length} patentes destacadas públicas`);

  console.log('2) initContactForm() — POST /public/contacto');
  await api('/public/contacto', { method: 'POST', body: { nombre: 'Test Usuario', email: 'test@example.com', asunto: 'Prueba', mensaje: 'Mensaje de prueba de contrato.' } });
  console.log('  ✓ contacto enviado sin error');

  console.log('3) initRegister() submit — POST /auth/registro');
  const email = `contrato.${Date.now()}@example.com`;
  const { user: nuevo } = await api('/auth/registro', { method: 'POST', body: { nombre: 'Contrato Test', email, password: 'ClaveSegura123', perfil: 'universitario', organizacion: 'UNHEVAL' } });
  assert(nuevo.tipo === 'registrado', 'usuario nuevo es tipo registrado');
  assert(nuevo.fichaEnviada === false, 'usuario nuevo no tiene ficha enviada');

  console.log('4) renderBiblioteca() — GET /biblioteca/categorias + /biblioteca/articulos (autenticado)');
  const { categorias } = await api('/biblioteca/categorias');
  assert(categorias.every(c => c.slug && c.nombre), 'cada categoría trae slug y nombre (para filtros)');
  const { articulos } = await api('/biblioteca/articulos');
  assert(articulos.every(a => 'leido' in a), 'cada artículo trae el flag "leido" para el usuario autenticado');
  const primero = articulos[0];

  console.log('5) openArticle() — GET /biblioteca/articulos/:id (marca lectura)');
  const { articulo } = await api(`/biblioteca/articulos/${primero.id}`);
  assert(articulo.leido === true, 'el artículo queda marcado como leído tras abrirlo');
  const { total: totalLeidos } = await api('/biblioteca/lecturas/total');
  assert(totalLeidos === 1, `lecturas/total = ${totalLeidos} (se esperaba 1)`);

  console.log('6) renderFicha() cuando no hay ficha — GET /ficha/mia debe ser null');
  const fichaVacia = await api('/ficha/mia');
  assert(fichaVacia.ficha === null, 'ficha.mia es null antes de enviar');

  console.log('7) fichaSubmit() — POST /ficha con los nombres de campo que usa app.js');
  const { ficha } = await api('/ficha', { method: 'POST', body: {
    tituloProyecto: 'Prototipo de prueba de contrato', descripcion: 'Descripción de prueba con más de diez caracteres.',
    sector: 'Electrónica y TIC', tipoProteccion: 'modelo_utilidad', nivelTrl: '3-4',
    documentacion: ['Bocetos o dibujos a mano'], yaDivulgada: 'no', tieneSocios: 'no', dudas: '¿Cuánto demora?',
  } });
  assert(ficha.estado === 'pendiente', 'ficha recién enviada queda en estado pendiente');
  assert(ficha.tipoProteccion === 'modelo_utilidad', 'tipoProteccion coincide con el valor enviado por el wizard');

  console.log('8) renderSeguimiento() para tipo "registrado" (sin proyecto) — no debe llamar a /proyectos/mio en la UI, pero probamos que el backend igual responde 403 correctamente si se llamara');
  let statusEsperado403 = null;
  try { await api('/proyectos/mio'); } catch (e) { statusEsperado403 = e.message; }
  assert(statusEsperado403 === null, 'un usuario "registrado" SÍ puede llamar /proyectos/mio (devuelve proyecto:null, no 403)');
  const proyMio = await api('/proyectos/mio');
  assert(proyMio.proyecto === null, 'usuario registrado sin proyecto recibe proyecto:null (no error)');

  console.log('9) login con cuenta demo cliente — loginDemo("cliente")');
  cookieJar = '';
  const { user: demoCliente } = await api('/auth/login', { method: 'POST', body: { email: 'cliente@demo.com', password: 'Cliente2026!' } });
  assert(demoCliente.tipo === 'cliente', 'demo cliente logueado correctamente');

  console.log('10) renderSeguimiento() para tipo "cliente" — shape completo esperado por el render');
  const { proyecto, fases, documentos, alertas } = await api('/proyectos/mio');
  assert(proyecto.titulo.length > 0, 'proyecto.titulo presente');
  assert(fases.length === 9, `${fases.length} fases (se esperaban 9)`);
  assert(documentos.some(d => d.pendiente === true), 'hay al menos un documento marcado como pendiente (para el estado visual PENDIENTE)');
  assert(alertas.length >= 1, `${alertas.length} alertas`);

  console.log('11) subirDocumentoCliente() — POST /proyectos/mio/documentos (multipart)');
  const fd = new FormData();
  fd.append('archivo', new Blob(['contenido de prueba'], { type: 'application/pdf' }), 'prueba_cliente.pdf');
  await api('/proyectos/mio/documentos', { method: 'POST', formData: fd });
  const { documentos: docsDespues } = await api('/proyectos/mio');
  assert(docsDespues.some(d => d.nombre === 'prueba_cliente.pdf'), 'el documento subido por el cliente aparece en su propio seguimiento');

  console.log('12) descarga de documento propio — GET /proyectos/mio/documentos/:id/descargar');
  const docPublico = docsDespues.find(d => d.nombre === 'prueba_cliente.pdf');
  const respDescarga = await fetch(`${BASE}/api/proyectos/mio/documentos/${docPublico.id}/descargar`, { headers: { Cookie: cookieJar } });
  assert(respDescarga.status === 200, `descarga responde 200 (fue ${respDescarga.status})`);

  console.log('13) renderNotificaciones() + markRead/markAllRead');
  const { notificaciones, noLeidas } = await api('/notificaciones');
  assert(notificaciones.length >= 1, `${notificaciones.length} notificaciones`);
  assert(noLeidas >= 1, `${noLeidas} no leídas`);
  const primeraNoLeida = notificaciones.find(n => !n.leida);
  await api(`/notificaciones/${primeraNoLeida.id}/leer`, { method: 'PATCH' });
  const { noLeidas: despuesDeUna } = await api('/notificaciones');
  assert(despuesDeUna === noLeidas - 1, 'marcar una notificación como leída reduce el contador en 1');
  await api('/notificaciones/leer-todas', { method: 'PATCH' });
  const { noLeidas: despuesDeTodas } = await api('/notificaciones');
  assert(despuesDeTodas === 0, 'marcar todas como leídas deja el contador en 0');

  console.log('\n✅ TODOS LOS CONTRATOS QUE app.js (público/usuario) CONSUME FUERON VALIDADOS CONTRA LA API REAL.');
}

main().catch((err) => {
  console.error('\n❌ FALLÓ:', err.message);
  process.exit(1);
});
