'use strict';

const fichaModel = require('../../models/fichaModel');
const { asyncHandler, AppError } = require('../../utils/asyncHandler');

const ESTADOS_VALIDOS = ['pendiente', 'en_revision', 'atendida'];

const listar = asyncHandler(async (req, res) => {
  const { estado, q } = req.query;
  const fichas = await fichaModel.listar({ estado: estado || undefined, q: q || undefined });
  res.json({ fichas });
});

const obtener = asyncHandler(async (req, res) => {
  const ficha = await fichaModel.obtenerPorId(req.params.id);
  if (!ficha) throw new AppError(404, 'Ficha no encontrada.');
  res.json({ ficha });
});

const actualizar = asyncHandler(async (req, res) => {
  const { estado, notasAdmin } = req.body || {};
  if (estado !== undefined && !ESTADOS_VALIDOS.includes(estado)) throw new AppError(400, 'Estado inválido.');
  const ficha = await fichaModel.actualizarEstado(req.params.id, { estado, notasAdmin });
  if (!ficha) throw new AppError(404, 'Ficha no encontrada.');
  res.json({ ficha });
});

module.exports = { listar, obtener, actualizar };
