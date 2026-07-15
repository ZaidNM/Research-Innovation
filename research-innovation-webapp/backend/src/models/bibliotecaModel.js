'use strict';

const { pool } = require('../config/db');

function mapCategoria(row) {
  return { id: row.id, slug: row.slug, nombre: row.nombre, icono: row.icono, orden: row.orden };
}

function mapArticulo(row) {
  return {
    id: row.id,
    categoriaId: row.categoria_id,
    categoriaSlug: row.categoria_slug,
    categoriaNombre: row.categoria_nombre,
    titulo: row.titulo,
    descripcion: row.descripcion,
    contenido: row.contenido,
    icono: row.icono,
    tiempoLectura: row.tiempo_lectura,
    publicado: !!row.publicado,
    leido: row.leido !== undefined ? !!row.leido : undefined,
    creadoEn: row.creado_en,
  };
}

// ── Categorías ────────────────────────────────────────────
async function listarCategorias() {
  const [rows] = await pool.query('SELECT * FROM categorias_biblioteca ORDER BY orden ASC, nombre ASC');
  return rows.map(mapCategoria);
}

async function crearCategoria({ slug, nombre, icono, orden }) {
  const [r] = await pool.query(
    'INSERT INTO categorias_biblioteca (slug, nombre, icono, orden) VALUES (?, ?, ?, ?)',
    [slug, nombre, icono || null, orden || 0]
  );
  const [rows] = await pool.query('SELECT * FROM categorias_biblioteca WHERE id = ?', [r.insertId]);
  return mapCategoria(rows[0]);
}

async function actualizarCategoria(id, { slug, nombre, icono, orden }) {
  await pool.query(
    'UPDATE categorias_biblioteca SET slug = COALESCE(?, slug), nombre = COALESCE(?, nombre), icono = ?, orden = COALESCE(?, orden) WHERE id = ?',
    [slug, nombre, icono ?? null, orden, id]
  );
  const [rows] = await pool.query('SELECT * FROM categorias_biblioteca WHERE id = ?', [id]);
  return mapCategoria(rows[0]);
}

async function eliminarCategoria(id) {
  await pool.query('DELETE FROM categorias_biblioteca WHERE id = ?', [id]);
}

// ── Artículos ─────────────────────────────────────────────
const SELECT_ARTICULO_BASE = `
  SELECT a.*, c.slug AS categoria_slug, c.nombre AS categoria_nombre
  FROM articulos_biblioteca a
  JOIN categorias_biblioteca c ON c.id = a.categoria_id
`;

async function listarArticulos({ categoriaSlug, q, soloPublicados = true, usuarioId } = {}) {
  const condiciones = [];
  const params = [];
  if (soloPublicados) condiciones.push('a.publicado = 1');
  if (categoriaSlug) {
    condiciones.push('c.slug = ?');
    params.push(categoriaSlug);
  }
  if (q) {
    condiciones.push('(a.titulo LIKE ? OR a.descripcion LIKE ?)');
    params.push(`%${q}%`, `%${q}%`);
  }
  const where = condiciones.length ? `WHERE ${condiciones.join(' AND ')}` : '';

  let selectLeido = '';
  const paramsFinal = [...params];
  if (usuarioId) {
    selectLeido = `, EXISTS(SELECT 1 FROM lecturas_articulos l WHERE l.articulo_id = a.id AND l.usuario_id = ?) AS leido`;
    paramsFinal.unshift(usuarioId);
  }

  const [rows] = await pool.query(
    `${SELECT_ARTICULO_BASE.replace('a.*', `a.*${selectLeido}`)} ${where} ORDER BY a.creado_en DESC`,
    paramsFinal
  );
  return rows.map(mapArticulo);
}

async function obtenerArticulo(id) {
  const [rows] = await pool.query(`${SELECT_ARTICULO_BASE} WHERE a.id = ?`, [id]);
  return rows[0] ? mapArticulo(rows[0]) : null;
}

async function crearArticulo({ categoriaId, titulo, descripcion, contenido, icono, tiempoLectura, publicado }) {
  const [r] = await pool.query(
    `INSERT INTO articulos_biblioteca (categoria_id, titulo, descripcion, contenido, icono, tiempo_lectura, publicado)
     VALUES (?, ?, ?, ?, ?, ?, ?)`,
    [categoriaId, titulo, descripcion, contenido || null, icono || null, tiempoLectura || 5, publicado === false ? 0 : 1]
  );
  return obtenerArticulo(r.insertId);
}

async function actualizarArticulo(id, cambios) {
  const mapaColumnas = {
    categoriaId: 'categoria_id', titulo: 'titulo', descripcion: 'descripcion',
    contenido: 'contenido', icono: 'icono', tiempoLectura: 'tiempo_lectura', publicado: 'publicado',
  };
  const campos = [];
  const params = [];
  for (const [clave, columna] of Object.entries(mapaColumnas)) {
    if (cambios[clave] !== undefined) {
      campos.push(`${columna} = ?`);
      params.push(clave === 'publicado' ? (cambios[clave] ? 1 : 0) : cambios[clave]);
    }
  }
  if (campos.length === 0) return obtenerArticulo(id);
  params.push(id);
  await pool.query(`UPDATE articulos_biblioteca SET ${campos.join(', ')} WHERE id = ?`, params);
  return obtenerArticulo(id);
}

async function eliminarArticulo(id) {
  await pool.query('DELETE FROM articulos_biblioteca WHERE id = ?', [id]);
}

// ── Lecturas ──────────────────────────────────────────────
async function registrarLectura(usuarioId, articuloId) {
  await pool.query(
    'INSERT IGNORE INTO lecturas_articulos (usuario_id, articulo_id) VALUES (?, ?)',
    [usuarioId, articuloId]
  );
}

async function contarLecturas(usuarioId) {
  const [[{ total }]] = await pool.query(
    'SELECT COUNT(*) AS total FROM lecturas_articulos WHERE usuario_id = ?',
    [usuarioId]
  );
  return total;
}

module.exports = {
  listarCategorias, crearCategoria, actualizarCategoria, eliminarCategoria,
  listarArticulos, obtenerArticulo, crearArticulo, actualizarArticulo, eliminarArticulo,
  registrarLectura, contarLecturas,
};
