'use strict';

const patenteDestacadaModel = require('../../models/patenteDestacadaModel');
const { asyncHandler, AppError } = require('../../utils/asyncHandler');

const listar = asyncHandler(async (req, res) => {
  res.json({ patentes: await patenteDestacadaModel.listar({ soloPublicados: false }) });
});

const crear = asyncHandler(async (req, res) => {
  const { titulo } = req.body || {};
  if (!titulo || String(titulo).trim().length < 2) throw new AppError(400, 'Ingresa el título del proyecto.');
  const patente = await patenteDestacadaModel.crear(req.body);
  res.status(201).json({ patente });
});

const actualizar = asyncHandler(async (req, res) => {
  const patente = await patenteDestacadaModel.actualizar(req.params.id, req.body || {});
  if (!patente) throw new AppError(404, 'Registro no encontrado.');
  res.json({ patente });
});

const eliminar = asyncHandler(async (req, res) => {
  await patenteDestacadaModel.eliminar(req.params.id);
  res.json({ ok: true });
});

module.exports = { listar, crear, actualizar, eliminar };
