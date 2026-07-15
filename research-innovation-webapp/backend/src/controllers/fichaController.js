'use strict';

const fichaModel = require('../models/fichaModel');
const { asyncHandler, AppError } = require('../utils/asyncHandler');

const TIPOS_PROTECCION = ['patente', 'modelo_utilidad', 'marca', 'derecho_autor', 'no_definido'];

const obtenerMia = asyncHandler(async (req, res) => {
  const ficha = await fichaModel.obtenerPorUsuario(req.user.id);
  res.json({ ficha });
});

const enviar = asyncHandler(async (req, res) => {
  const { tituloProyecto, descripcion, sector, tipoProteccion, nivelTrl, documentacion, yaDivulgada, tieneSocios, dudas } = req.body || {};

  if (!tituloProyecto || String(tituloProyecto).trim().length < 3) {
    throw new AppError(400, 'Describe el título de tu proyecto (mínimo 3 caracteres).');
  }
  if (!descripcion || String(descripcion).trim().length < 10) {
    throw new AppError(400, 'Cuéntanos un poco más sobre tu invención (mínimo 10 caracteres).');
  }
  if (tipoProteccion && !TIPOS_PROTECCION.includes(tipoProteccion)) {
    throw new AppError(400, 'Tipo de protección inválido.');
  }
  if (documentacion !== undefined && !Array.isArray(documentacion)) {
    throw new AppError(400, 'El campo de documentación debe ser una lista.');
  }

  const ficha = await fichaModel.crearOActualizar(req.user.id, {
    tituloProyecto: String(tituloProyecto).trim().slice(0, 255),
    descripcion: String(descripcion).trim(),
    sector: sector ? String(sector).trim().slice(0, 120) : null,
    tipoProteccion: tipoProteccion || 'no_definido',
    nivelTrl: nivelTrl || null,
    documentacion: documentacion || [],
    yaDivulgada: ['si', 'no', 'nose'].includes(yaDivulgada) ? yaDivulgada : 'nose',
    tieneSocios: ['si', 'no'].includes(tieneSocios) ? tieneSocios : 'no',
    dudas: dudas ? String(dudas).trim() : null,
  });

  res.status(201).json({ ficha });
});

module.exports = { obtenerMia, enviar };
