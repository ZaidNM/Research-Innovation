'use strict';

const { pool } = require('../config/db');
const { verificarToken } = require('../utils/jwt');
const { AppError } = require('../utils/asyncHandler');

/**
 * Exige una sesión válida. Verifica, en este orden:
 *   1. Que exista la cookie con el token.
 *   2. Que el JWT sea válido y no haya expirado (firma + exp).
 *   3. Que la sesión siga viva en la tabla `sesiones` (permite logout
 *      real desde el servidor, no solo borrar la cookie del navegador).
 *   4. Que el usuario siga existiendo y activo en la base de datos, y
 *      recarga su `tipo` actual (si el admin lo promovió a "cliente"
 *      después de emitido el token, el cambio se refleja al instante
 *      sin esperar a que expire la sesión anterior).
 * Deja el usuario autenticado en req.user.
 */
async function requireAuth(req, res, next) {
  try {
    const cookieName = process.env.COOKIE_NAME || 'ri_token';
    const token = req.cookies?.[cookieName];
    if (!token) throw new AppError(401, 'No has iniciado sesión.');

    let payload;
    try {
      payload = verificarToken(token);
    } catch {
      throw new AppError(401, 'Tu sesión expiró o no es válida. Inicia sesión nuevamente.');
    }

    const [sesiones] = await pool.query(
      'SELECT id FROM sesiones WHERE token = ? AND usuario_id = ? AND expira_en > NOW()',
      [payload.jti, payload.sub]
    );
    if (sesiones.length === 0) {
      throw new AppError(401, 'Tu sesión ya no está activa. Inicia sesión nuevamente.');
    }

    const [usuarios] = await pool.query(
      `SELECT id, nombre, email, tipo, perfil, organizacion, telefono, activo, ficha_enviada
       FROM usuarios WHERE id = ?`,
      [payload.sub]
    );
    const usuario = usuarios[0];
    if (!usuario || !usuario.activo) {
      throw new AppError(401, 'Esta cuenta ya no tiene acceso. Contacta a la empresa si crees que es un error.');
    }

    req.user = {
      id: usuario.id,
      nombre: usuario.nombre,
      email: usuario.email,
      tipo: usuario.tipo,
      perfil: usuario.perfil,
      organizacion: usuario.organizacion,
      telefono: usuario.telefono,
      fichaEnviada: !!usuario.ficha_enviada,
    };
    req.sessionJti = payload.jti;
    next();
  } catch (err) {
    next(err);
  }
}

/** Exige que req.user.tipo esté dentro de los roles permitidos. Usar SIEMPRE después de requireAuth. */
function requireRole(...rolesPermitidos) {
  return (req, res, next) => {
    if (!req.user) return next(new AppError(401, 'No has iniciado sesión.'));
    if (!rolesPermitidos.includes(req.user.tipo)) {
      return next(new AppError(403, 'No tienes permisos para realizar esta acción.'));
    }
    next();
  };
}

/**
 * Igual que requireAuth pero no falla si no hay sesión: solo intenta
 * poblar req.user si existe un token válido. Útil para rutas públicas
 * que se comportan distinto si el visitante ya está autenticado.
 */
async function attachUserIfPresent(req, res, next) {
  const cookieName = process.env.COOKIE_NAME || 'ri_token';
  if (!req.cookies?.[cookieName]) return next();
  requireAuth(req, res, (err) => next()); // ignora el error; simplemente no habrá req.user
}

module.exports = { requireAuth, requireRole, attachUserIfPresent };
