'use strict';

const contenidoModel = require('../../models/contenidoModel');
const { asyncHandler, AppError } = require('../../utils/asyncHandler');

const CLAVES_VALIDAS = ['hero', 'servicios', 'nosotros', 'proceso', 'patentes_seccion', 'estadisticas', 'aliados', 'contacto_info'];

const obtenerTodo = asyncHandler(async (req, res) => {
  res.json({ contenido: await contenidoModel.obtenerTodo() });
});

const guardarClave = asyncHandler(async (req, res) => {
  const { clave } = req.params;
  if (!CLAVES_VALIDAS.includes(clave)) throw new AppError(400, `Clave de contenido desconocida: ${clave}`);
  if (req.body?.valor === undefined) throw new AppError(400, 'Falta el campo "valor".');
  const valor = await contenidoModel.guardarClave(clave, req.body.valor);
  res.json({ clave, valor });
});

module.exports = { obtenerTodo, guardarClave, CLAVES_VALIDAS };
