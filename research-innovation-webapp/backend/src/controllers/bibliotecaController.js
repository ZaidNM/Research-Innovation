'use strict';

const bibliotecaModel = require('../models/bibliotecaModel');
const { asyncHandler, AppError } = require('../utils/asyncHandler');

const listarCategorias = asyncHandler(async (req, res) => {
  const categorias = await bibliotecaModel.listarCategorias();
  res.json({ categorias });
});

const listarArticulos = asyncHandler(async (req, res) => {
  const { categoria, q } = req.query;
  const articulos = await bibliotecaModel.listarArticulos({
    categoriaSlug: categoria || undefined,
    q: q || undefined,
    soloPublicados: true,
    usuarioId: req.user.id,
  });
  res.json({ articulos });
});

const obtenerArticulo = asyncHandler(async (req, res) => {
  const articulo = await bibliotecaModel.obtenerArticulo(req.params.id);
  if (!articulo || !articulo.publicado) throw new AppError(404, 'Artículo no encontrado.');
  await bibliotecaModel.registrarLectura(req.user.id, articulo.id);
  res.json({ articulo: { ...articulo, leido: true } });
});

const contarLecturas = asyncHandler(async (req, res) => {
  const total = await bibliotecaModel.contarLecturas(req.user.id);
  res.json({ total });
});

module.exports = { listarCategorias, listarArticulos, obtenerArticulo, contarLecturas };
