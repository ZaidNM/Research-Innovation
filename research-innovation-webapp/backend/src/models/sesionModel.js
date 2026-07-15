'use strict';

const { v4: uuidv4 } = require('uuid');
const { pool } = require('../config/db');
const { expiresInMs } = require('../utils/jwt');

async function crearSesion(usuarioId, userAgent) {
  const jti = uuidv4();
  const expiraEn = new Date(Date.now() + expiresInMs());
  await pool.query(
    'INSERT INTO sesiones (usuario_id, token, user_agent, expira_en) VALUES (?, ?, ?, ?)',
    [usuarioId, jti, (userAgent || '').slice(0, 255), expiraEn]
  );
  return jti;
}

async function eliminarSesion(jti) {
  await pool.query('DELETE FROM sesiones WHERE token = ?', [jti]);
}

/** Limpia sesiones vencidas. Se invoca de forma perezosa en cada login para no necesitar un cron aparte. */
async function limpiarSesionesVencidas() {
  await pool.query('DELETE FROM sesiones WHERE expira_en <= NOW()');
}

module.exports = { crearSesion, eliminarSesion, limpiarSesionesVencidas };
