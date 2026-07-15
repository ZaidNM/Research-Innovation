'use strict';

const contactoModel = require('../../models/contactoModel');
const { asyncHandler } = require('../../utils/asyncHandler');

const listar = asyncHandler(async (req, res) => {
  const { leido } = req.query;
  const filtro = leido === undefined ? {} : { leido: leido === 'true' };
  res.json({ contactos: await contactoModel.listar(filtro) });
});

const marcarLeido = asyncHandler(async (req, res) => {
  await contactoModel.marcarLeido(req.params.id, req.body?.leido !== false);
  res.json({ ok: true });
});

module.exports = { listar, marcarLeido };
