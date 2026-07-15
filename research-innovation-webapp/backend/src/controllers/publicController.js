'use strict';

const contenidoModel = require('../models/contenidoModel');
const faqModel = require('../models/faqModel');
const contactoModel = require('../models/contactoModel');
const patenteDestacadaModel = require('../models/patenteDestacadaModel');
const { asyncHandler, AppError } = require('../utils/asyncHandler');

const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

const obtenerContenido = asyncHandler(async (req, res) => {
  const contenido = await contenidoModel.obtenerTodo();
  res.json({ contenido });
});

const obtenerFaqs = asyncHandler(async (req, res) => {
  const faqs = await faqModel.listar({ soloPublicados: true });
  res.json({ faqs });
});

const obtenerPatentesDestacadas = asyncHandler(async (req, res) => {
  const patentes = await patenteDestacadaModel.listar({ soloPublicados: true });
  res.json({ patentes });
});

const enviarContacto = asyncHandler(async (req, res) => {
  const { nombre, email, asunto, mensaje } = req.body || {};
  if (!nombre || String(nombre).trim().length < 2) throw new AppError(400, 'Ingresa tu nombre.');
  if (!email || !EMAIL_REGEX.test(email)) throw new AppError(400, 'Ingresa un correo electrónico válido.');
  if (!mensaje || String(mensaje).trim().length < 5) throw new AppError(400, 'Cuéntanos brevemente en qué podemos ayudarte.');

  const id = await contactoModel.crear({
    nombre: String(nombre).trim().slice(0, 150),
    email: String(email).trim().slice(0, 180),
    asunto: asunto ? String(asunto).trim().slice(0, 255) : null,
    mensaje: String(mensaje).trim(),
  });
  res.status(201).json({ ok: true, id });
});

module.exports = { obtenerContenido, obtenerFaqs, obtenerPatentesDestacadas, enviarContacto };
