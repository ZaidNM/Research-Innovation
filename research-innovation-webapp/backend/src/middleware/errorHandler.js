'use strict';

const multer = require('multer');

/** Middleware final de la cadena: convierte cualquier error en una respuesta JSON consistente. */
// eslint-disable-next-line no-unused-vars
function errorHandler(err, req, res, next) {
  // Errores propios (AppError) traen su código HTTP
  if (err.status) {
    return res.status(err.status).json({ error: err.message, detalles: err.detalles });
  }

  // Errores de Multer (archivo demasiado grande, campo inesperado, etc.)
  if (err instanceof multer.MulterError) {
    const mensajes = {
      LIMIT_FILE_SIZE: 'El archivo supera el tamaño máximo permitido.',
      LIMIT_UNEXPECTED_FILE: 'Campo de archivo inesperado.',
    };
    return res.status(400).json({ error: mensajes[err.code] || 'Error al subir el archivo.' });
  }

  // Violación de restricción única de MySQL (ej: email duplicado)
  if (err.code === 'ER_DUP_ENTRY') {
    return res.status(409).json({ error: 'Ya existe un registro con esos datos.' });
  }
  // Violación de llave foránea
  if (err.code === 'ER_ROW_IS_REFERENCED_2' || err.code === 'ER_ROW_IS_REFERENCED') {
    return res.status(409).json({ error: 'No se puede eliminar: hay datos relacionados que dependen de este registro.' });
  }
  if (err.code === 'ER_NO_REFERENCED_ROW_2') {
    return res.status(400).json({ error: 'Referencia inválida: el registro relacionado no existe.' });
  }

  // JSON de body malformado
  if (err.type === 'entity.parse.failed') {
    return res.status(400).json({ error: 'El cuerpo de la solicitud no es JSON válido.' });
  }

  // Cualquier otro error: no exponer detalles internos al cliente
  console.error('[error no controlado]', err);
  return res.status(500).json({ error: 'Error interno del servidor.' });
}

function notFoundHandler(req, res) {
  res.status(404).json({ error: `Ruta no encontrada: ${req.method} ${req.originalUrl}` });
}

module.exports = { errorHandler, notFoundHandler };
