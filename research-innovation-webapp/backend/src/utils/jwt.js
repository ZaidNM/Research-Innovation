'use strict';

const jwt = require('jsonwebtoken');

const SECRET = process.env.JWT_SECRET;
const EXPIRES_IN = process.env.JWT_EXPIRES_IN || '8h';

if (!SECRET || SECRET.length < 20) {
  // Falla rápido al arrancar si falta configurar el secreto: es preferible
  // que el servidor no levante a que levante firmando tokens inseguros.
  throw new Error(
    '[config] JWT_SECRET no está definido o es demasiado corto. ' +
    'Genera uno con: node -e "console.log(require(\'crypto\').randomBytes(48).toString(\'hex\'))" y ponlo en .env'
  );
}

function firmarToken({ usuarioId, tipo, jti }) {
  return jwt.sign({ sub: usuarioId, tipo, jti }, SECRET, { expiresIn: EXPIRES_IN });
}

function verificarToken(token) {
  return jwt.verify(token, SECRET); // lanza si es inválido/expiró
}

/** Convierte '8h' / '30m' / '1d' al número de milisegundos equivalente, para calcular expira_en. */
function expiresInMs() {
  const match = /^(\d+)([smhd])$/.exec(EXPIRES_IN);
  if (!match) return 8 * 60 * 60 * 1000; // default 8h
  const valor = Number(match[1]);
  const unidad = match[2];
  const factores = { s: 1000, m: 60 * 1000, h: 60 * 60 * 1000, d: 24 * 60 * 60 * 1000 };
  return valor * factores[unidad];
}

module.exports = { firmarToken, verificarToken, expiresInMs };
