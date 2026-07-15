'use strict';

const usuarioModel = require('../models/usuarioModel');
const sesionModel = require('../models/sesionModel');
const { hashPassword, compararPassword, validarFortaleza } = require('../utils/password');
const { firmarToken } = require('../utils/jwt');
const { asyncHandler, AppError } = require('../utils/asyncHandler');

const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

function fijarCookieSesion(res, token) {
  const maxAgeMs = require('../utils/jwt').expiresInMs();
  res.cookie(process.env.COOKIE_NAME || 'ri_token', token, {
    httpOnly: true,
    sameSite: 'lax',
    secure: process.env.NODE_ENV === 'production',
    maxAge: maxAgeMs,
    path: '/',
  });
}

const registro = asyncHandler(async (req, res) => {
  const { nombre, email, password, perfil, organizacion } = req.body || {};

  if (!nombre || String(nombre).trim().length < 2) throw new AppError(400, 'Ingresa tu nombre completo.');
  if (!email || !EMAIL_REGEX.test(email)) throw new AppError(400, 'Ingresa un correo electrónico válido.');
  const errorPassword = validarFortaleza(password);
  if (errorPassword) throw new AppError(400, errorPassword);

  const existente = await usuarioModel.encontrarPorEmail(email.toLowerCase().trim());
  if (existente) throw new AppError(409, 'Ya existe una cuenta registrada con ese correo.');

  const passwordHash = await hashPassword(password);
  const usuario = await usuarioModel.crear({
    nombre: String(nombre).trim(),
    email: email.toLowerCase().trim(),
    passwordHash,
    perfil,
    organizacion,
  });

  const jti = await sesionModel.crearSesion(usuario.id, req.get('user-agent'));
  const token = firmarToken({ usuarioId: usuario.id, tipo: usuario.tipo, jti });
  fijarCookieSesion(res, token);

  res.status(201).json({ user: usuarioModel.mapUsuario(usuario) });
});

const login = asyncHandler(async (req, res) => {
  const { email, password } = req.body || {};
  if (!email || !password) throw new AppError(400, 'Ingresa tu correo y contraseña.');

  const usuario = await usuarioModel.encontrarPorEmail(email.toLowerCase().trim());
  // Mensaje deliberadamente genérico: no revela si el email existe o no.
  if (!usuario) throw new AppError(401, 'Correo o contraseña incorrectos.');

  const passwordValido = await compararPassword(password, usuario.password_hash);
  if (!passwordValido) throw new AppError(401, 'Correo o contraseña incorrectos.');

  if (!usuario.activo) throw new AppError(403, 'Esta cuenta está desactivada. Contacta a la empresa.');

  await sesionModel.limpiarSesionesVencidas();
  const jti = await sesionModel.crearSesion(usuario.id, req.get('user-agent'));
  const token = firmarToken({ usuarioId: usuario.id, tipo: usuario.tipo, jti });
  fijarCookieSesion(res, token);

  res.json({ user: usuarioModel.mapUsuario(usuario) });
});

const logout = asyncHandler(async (req, res) => {
  if (req.sessionJti) await sesionModel.eliminarSesion(req.sessionJti);
  res.clearCookie(process.env.COOKIE_NAME || 'ri_token', { path: '/' });
  res.json({ ok: true });
});

const yo = asyncHandler(async (req, res) => {
  res.json({ user: req.user });
});

module.exports = { registro, login, logout, yo };
