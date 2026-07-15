'use strict';

const notificacionModel = require('../models/notificacionModel');
const { asyncHandler, AppError } = require('../utils/asyncHandler');

const listar = asyncHandler(async (req, res) => {
  const [notificaciones, noLeidas] = await Promise.all([
    notificacionModel.listarPorUsuario(req.user.id),
    notificacionModel.contarNoLeidas(req.user.id),
  ]);
  res.json({ notificaciones, noLeidas });
});

const marcarLeida = asyncHandler(async (req, res) => {
  const ok = await notificacionModel.marcarLeida(req.params.id, req.user.id);
  if (!ok) throw new AppError(404, 'Notificación no encontrada.');
  res.json({ ok: true });
});

const marcarTodasLeidas = asyncHandler(async (req, res) => {
  await notificacionModel.marcarTodasLeidas(req.user.id);
  res.json({ ok: true });
});

module.exports = { listar, marcarLeida, marcarTodasLeidas };
