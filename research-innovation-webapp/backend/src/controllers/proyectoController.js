'use strict';

const fs = require('fs');
const path = require('path');
const proyectoModel = require('../models/proyectoModel');
const { UPLOAD_ROOT } = require('../middleware/upload');
const { asyncHandler, AppError } = require('../utils/asyncHandler');

/**
 * Middleware previo a la carga de archivos: busca el proyecto del usuario
 * autenticado y lo deja en req.miProyectoId para que el storage de multer
 * (middleware/upload.js) sepa en qué carpeta guardar el archivo. Debe ir
 * ANTES de uploadMiDocumento.single(...) en la cadena de la ruta.
 */
const resolverMiProyecto = asyncHandler(async (req, res, next) => {
  const proyecto = await proyectoModel.obtenerPorUsuario(req.user.id);
  if (!proyecto) throw new AppError(404, 'No tienes un proyecto activo.');
  req.miProyectoId = proyecto.id;
  next();
});

const obtenerMiProyecto = asyncHandler(async (req, res) => {
  const proyecto = await proyectoModel.obtenerPorUsuario(req.user.id);
  if (!proyecto) return res.json({ proyecto: null, fases: [], documentos: [], alertas: [] });

  const [fases, documentos, alertas] = await Promise.all([
    proyectoModel.listarFases(proyecto.id),
    proyectoModel.listarDocumentos(proyecto.id, { soloPublicos: true }),
    proyectoModel.listarAlertas(proyecto.id),
  ]);
  res.json({ proyecto, fases, documentos, alertas });
});

const descargarMiDocumento = asyncHandler(async (req, res) => {
  const proyecto = await proyectoModel.obtenerPorUsuario(req.user.id);
  if (!proyecto) throw new AppError(404, 'No tienes un proyecto activo.');

  const doc = await proyectoModel.obtenerDocumentoCrudo(req.params.docId);
  if (!doc || doc.proyecto_id !== proyecto.id || !doc.es_publico_cliente) {
    throw new AppError(404, 'Documento no encontrado.');
  }
  const rutaAbsoluta = path.join(UPLOAD_ROOT, doc.ruta_archivo);
  if (!fs.existsSync(rutaAbsoluta)) throw new AppError(404, 'El archivo ya no está disponible en el servidor.');
  res.download(rutaAbsoluta, doc.nombre);
});

/** El cliente sube un documento pendiente de su lado (ej: poder notarial solicitado). */
const subirMiDocumento = asyncHandler(async (req, res) => {
  if (!req.file) throw new AppError(400, 'Selecciona un archivo para subir.');

  const rutaRelativa = path.relative(UPLOAD_ROOT, req.file.path).split(path.sep).join('/');
  const id = await proyectoModel.agregarDocumento({
    proyectoId: req.miProyectoId,
    nombre: req.file.originalname,
    rutaArchivo: rutaRelativa,
    tipo: path.extname(req.file.originalname).replace('.', '') || null,
    tamanoKb: Math.round(req.file.size / 1024),
    subidoPor: 'cliente',
    esPublicoCliente: true,
  });
  res.status(201).json({ ok: true, id });
});

module.exports = { obtenerMiProyecto, descargarMiDocumento, subirMiDocumento, resolverMiProyecto };
