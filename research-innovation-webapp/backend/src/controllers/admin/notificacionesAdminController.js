'use strict';

const { pool } = require('../../config/db');
const notificacionModel = require('../../models/notificacionModel');
const { asyncHandler, AppError } = require('../../utils/asyncHandler');

const DESTINOS_MASIVOS = ['todos', 'registrado', 'cliente'];

/**
 * Envía una notificación. Body:
 *   { usuarioId, mensaje, detalle?, icono?, tipo? }               → a un usuario puntual
 *   { destinoMasivo: 'todos'|'registrado'|'cliente', mensaje, ... } → broadcast
 */
const enviar = asyncHandler(async (req, res) => {
  const { usuarioId, destinoMasivo, mensaje, detalle, icono, tipo } = req.body || {};
  if (!mensaje || String(mensaje).trim().length < 3) throw new AppError(400, 'Escribe el mensaje de la notificación.');

  if (usuarioId) {
    const id = await notificacionModel.crear({ usuarioId, icono, mensaje: String(mensaje).trim(), detalle, tipo });
    return res.status(201).json({ ok: true, enviadas: 1, id });
  }

  if (destinoMasivo) {
    if (!DESTINOS_MASIVOS.includes(destinoMasivo)) throw new AppError(400, 'Destino masivo inválido.');
    const where = destinoMasivo === 'todos' ? "tipo != 'admin'" : 'tipo = ?';
    const params = destinoMasivo === 'todos' ? [] : [destinoMasivo];
    const [usuarios] = await pool.query(`SELECT id FROM usuarios WHERE ${where} AND activo = 1`, params);
    const ids = usuarios.map((u) => u.id);
    const enviadas = await notificacionModel.crearParaVarios(ids, { icono, mensaje: String(mensaje).trim(), detalle, tipo });
    return res.status(201).json({ ok: true, enviadas });
  }

  throw new AppError(400, 'Indica un usuarioId o un destinoMasivo.');
});

module.exports = { enviar };
