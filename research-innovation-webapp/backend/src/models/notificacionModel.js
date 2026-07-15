'use strict';

const { pool } = require('../config/db');

function mapNotificacion(row) {
  return {
    id: row.id,
    usuarioId: row.usuario_id,
    icono: row.icono,
    mensaje: row.mensaje,
    detalle: row.detalle,
    leida: !!row.leida,
    tipo: row.tipo,
    creadoEn: row.creado_en,
  };
}

async function listarPorUsuario(usuarioId) {
  const [rows] = await pool.query(
    'SELECT * FROM notificaciones WHERE usuario_id = ? ORDER BY creado_en DESC LIMIT 100',
    [usuarioId]
  );
  return rows.map(mapNotificacion);
}

async function contarNoLeidas(usuarioId) {
  const [[{ total }]] = await pool.query(
    'SELECT COUNT(*) AS total FROM notificaciones WHERE usuario_id = ? AND leida = 0',
    [usuarioId]
  );
  return total;
}

/** Crea una notificación. Se usa tanto desde el panel admin (envío manual) como
 *  automáticamente cuando cambia una fase de seguimiento o se crea un proyecto. */
async function crear({ usuarioId, icono, mensaje, detalle, tipo }, conn = pool) {
  const [r] = await conn.query(
    'INSERT INTO notificaciones (usuario_id, icono, mensaje, detalle, tipo) VALUES (?, ?, ?, ?, ?)',
    [usuarioId, icono || 'ti-bell', mensaje, detalle || null, tipo || 'sistema']
  );
  return r.insertId;
}

async function crearParaVarios(usuarioIds, datosBase) {
  if (usuarioIds.length === 0) return 0;
  const values = usuarioIds.map(() => '(?, ?, ?, ?, ?)').join(', ');
  const params = [];
  for (const uid of usuarioIds) {
    params.push(uid, datosBase.icono || 'ti-bell', datosBase.mensaje, datosBase.detalle || null, datosBase.tipo || 'sistema');
  }
  const [r] = await pool.query(
    `INSERT INTO notificaciones (usuario_id, icono, mensaje, detalle, tipo) VALUES ${values}`,
    params
  );
  return r.affectedRows;
}

async function marcarLeida(id, usuarioId) {
  const [r] = await pool.query(
    'UPDATE notificaciones SET leida = 1 WHERE id = ? AND usuario_id = ?',
    [id, usuarioId]
  );
  return r.affectedRows > 0;
}

async function marcarTodasLeidas(usuarioId) {
  await pool.query('UPDATE notificaciones SET leida = 1 WHERE usuario_id = ? AND leida = 0', [usuarioId]);
}

module.exports = { listarPorUsuario, contarNoLeidas, crear, crearParaVarios, marcarLeida, marcarTodasLeidas };
