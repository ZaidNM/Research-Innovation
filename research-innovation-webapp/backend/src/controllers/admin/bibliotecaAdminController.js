'use strict';

const bibliotecaModel = require('../../models/bibliotecaModel');
const { asyncHandler, AppError } = require('../../utils/asyncHandler');

// ── Categorías ────────────────────────────────────────────
const listarCategorias = asyncHandler(async (req, res) => {
  res.json({ categorias: await bibliotecaModel.listarCategorias() });
});

const crearCategoria = asyncHandler(async (req, res) => {
  const { slug, nombre, icono, orden } = req.body || {};
  if (!slug || !/^[a-z0-9-]+$/.test(slug)) throw new AppError(400, 'El slug debe usar solo minúsculas, números y guiones.');
  if (!nombre || String(nombre).trim().length < 2) throw new AppError(400, 'Ingresa el nombre de la categoría.');
  const categoria = await bibliotecaModel.crearCategoria({ slug, nombre: String(nombre).trim(), icono, orden });
  res.status(201).json({ categoria });
});

const actualizarCategoria = asyncHandler(async (req, res) => {
  const categoria = await bibliotecaModel.actualizarCategoria(req.params.id, req.body || {});
  res.json({ categoria });
});

const eliminarCategoria = asyncHandler(async (req, res) => {
  await bibliotecaModel.eliminarCategoria(req.params.id);
  res.json({ ok: true });
});

// ── Artículos ─────────────────────────────────────────────
const listarArticulos = asyncHandler(async (req, res) => {
  const { categoria, q } = req.query;
  const articulos = await bibliotecaModel.listarArticulos({
    categoriaSlug: categoria || undefined, q: q || undefined, soloPublicados: false,
  });
  res.json({ articulos });
});

const crearArticulo = asyncHandler(async (req, res) => {
  const { categoriaId, titulo, descripcion } = req.body || {};
  if (!categoriaId) throw new AppError(400, 'Selecciona una categoría.');
  if (!titulo || String(titulo).trim().length < 3) throw new AppError(400, 'Ingresa el título del artículo.');
  if (!descripcion || String(descripcion).trim().length < 3) throw new AppError(400, 'Ingresa una descripción breve.');
  const articulo = await bibliotecaModel.crearArticulo(req.body);
  res.status(201).json({ articulo });
});

const actualizarArticulo = asyncHandler(async (req, res) => {
  const articulo = await bibliotecaModel.actualizarArticulo(req.params.id, req.body || {});
  if (!articulo) throw new AppError(404, 'Artículo no encontrado.');
  res.json({ articulo });
});

const eliminarArticulo = asyncHandler(async (req, res) => {
  await bibliotecaModel.eliminarArticulo(req.params.id);
  res.json({ ok: true });
});

module.exports = {
  listarCategorias, crearCategoria, actualizarCategoria, eliminarCategoria,
  listarArticulos, crearArticulo, actualizarArticulo, eliminarArticulo,
};
