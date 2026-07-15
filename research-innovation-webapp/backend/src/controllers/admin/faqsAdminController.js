'use strict';

const faqModel = require('../../models/faqModel');
const { asyncHandler, AppError } = require('../../utils/asyncHandler');

const listar = asyncHandler(async (req, res) => {
  res.json({ faqs: await faqModel.listar({ soloPublicados: false }) });
});

const crear = asyncHandler(async (req, res) => {
  const { pregunta, respuesta } = req.body || {};
  if (!pregunta || String(pregunta).trim().length < 5) throw new AppError(400, 'Ingresa la pregunta.');
  if (!respuesta || String(respuesta).trim().length < 5) throw new AppError(400, 'Ingresa la respuesta.');
  const faq = await faqModel.crear(req.body);
  res.status(201).json({ faq });
});

const actualizar = asyncHandler(async (req, res) => {
  const faq = await faqModel.actualizar(req.params.id, req.body || {});
  if (!faq) throw new AppError(404, 'Pregunta frecuente no encontrada.');
  res.json({ faq });
});

const eliminar = asyncHandler(async (req, res) => {
  await faqModel.eliminar(req.params.id);
  res.json({ ok: true });
});

module.exports = { listar, crear, actualizar, eliminar };
