'use strict';

/**
 * Envuelve un controlador async para que cualquier error (incluyendo
 * rechazos de promesas de consultas SQL) llegue automáticamente al
 * middleware de errores en vez de colgar el request o tirar el proceso.
 */
function asyncHandler(fn) {
  return function wrapped(req, res, next) {
    Promise.resolve(fn(req, res, next)).catch(next);
  };
}

/** Error de aplicación con código HTTP explícito, para respuestas consistentes. */
class AppError extends Error {
  constructor(status, mensaje, detalles) {
    super(mensaje);
    this.status = status;
    this.detalles = detalles;
  }
}

module.exports = { asyncHandler, AppError };
