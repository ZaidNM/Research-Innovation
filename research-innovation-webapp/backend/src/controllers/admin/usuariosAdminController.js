'use strict';

const usuarioModel = require('../../models/usuarioModel');
const fichaModel = require('../../models/fichaModel');
const proyectoModel = require('../../models/proyectoModel');
const { asyncHandler, AppError } = require('../../utils/asyncHandler');

const TIPOS_VALIDOS = ['registrado', 'cliente', 'admin'];

const listar = asyncHandler(async (req, res) => {
  const { tipo, q, page } = req.query;
  const resultado = await usuarioModel.listar({ tipo: tipo || undefined, q: q || undefined, page: Number(page) || 1 });
  res.json(resultado);
});

const obtener = asyncHandler(async (req, res) => {
  const usuario = await usuarioModel.encontrarPorId(req.params.id);
  if (!usuario) throw new AppError(404, 'Usuario no encontrado.');
  const [ficha, proyecto] = await Promise.all([
    fichaModel.obtenerPorUsuario(usuario.id),
    proyectoModel.obtenerPorUsuario(usuario.id),
  ]);
  res.json({ usuario: usuarioModel.mapUsuario(usuario), ficha, proyecto });
});

const actualizar = asyncHandler(async (req, res) => {
  const { tipo, activo, organizacion, telefono, perfil } = req.body || {};
  if (tipo !== undefined && !TIPOS_VALIDOS.includes(tipo)) throw new AppError(400, 'Tipo de usuario inválido.');
  if (Number(req.params.id) === req.user.id && (tipo !== undefined && tipo !== 'admin')) {
    throw new AppError(400, 'No puedes quitarte tu propio rol de administrador.');
  }
  if (Number(req.params.id) === req.user.id && activo === false) {
    throw new AppError(400, 'No puedes desactivar tu propia cuenta.');
  }
  const usuario = await usuarioModel.actualizarPorAdmin(req.params.id, { tipo, activo, organizacion, telefono, perfil });
  if (!usuario) throw new AppError(404, 'Usuario no encontrado.');
  res.json({ usuario: usuarioModel.mapUsuario(usuario) });
});

module.exports = { listar, obtener, actualizar };
