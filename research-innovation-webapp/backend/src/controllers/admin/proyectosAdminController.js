'use strict';

const fs = require('fs');
const path = require('path');
const proyectoModel = require('../../models/proyectoModel');
const usuarioModel = require('../../models/usuarioModel');
const { UPLOAD_ROOT } = require('../../middleware/upload');
const { asyncHandler, AppError } = require('../../utils/asyncHandler');

const ESTADOS_PROYECTO = ['activo', 'pausado', 'cerrado', 'otorgado'];
const ESTADOS_FASE = ['pendiente', 'activo', 'completado', 'con_observacion'];
const TIPOS_ALERTA = ['urgente', 'tasa', 'observacion', 'recordatorio', 'info'];

const catalogoFases = asyncHandler(async (req, res) => {
  const fases = await proyectoModel.obtenerCatalogoFases();
  res.json({ fases });
});

const listar = asyncHandler(async (req, res) => {
  const { estado, q } = req.query;
  const proyectos = await proyectoModel.listarTodos({ estado: estado || undefined, q: q || undefined });
  res.json({ proyectos });
});

const crear = asyncHandler(async (req, res) => {
  const { usuarioId, titulo, numeroExpediente, tipoPatente, fechaInicio, fechaEstimada } = req.body || {};
  if (!usuarioId) throw new AppError(400, 'Selecciona el usuario dueño del proyecto.');
  if (!titulo || String(titulo).trim().length < 3) throw new AppError(400, 'Ingresa el título del proyecto.');
  if (!fechaInicio) throw new AppError(400, 'Ingresa la fecha de inicio.');

  const usuario = await usuarioModel.encontrarPorId(usuarioId);
  if (!usuario) throw new AppError(404, 'El usuario seleccionado no existe.');
  if (usuario.tipo === 'admin') throw new AppError(400, 'No se puede crear un proyecto para una cuenta de administrador.');

  const existente = await proyectoModel.obtenerPorUsuario(usuarioId);
  if (existente) throw new AppError(409, 'Este usuario ya tiene un proyecto registrado.');

  const proyecto = await proyectoModel.crear({
    usuarioId, titulo: String(titulo).trim(), numeroExpediente, tipoPatente, fechaInicio, fechaEstimada,
  });
  res.status(201).json({ proyecto });
});

const obtener = asyncHandler(async (req, res) => {
  const proyecto = await proyectoModel.obtenerPorId(req.params.id);
  if (!proyecto) throw new AppError(404, 'Proyecto no encontrado.');
  const [fases, documentos, alertas] = await Promise.all([
    proyectoModel.listarFases(proyecto.id),
    proyectoModel.listarDocumentos(proyecto.id),
    proyectoModel.listarAlertas(proyecto.id),
  ]);
  res.json({ proyecto, fases, documentos, alertas });
});

const actualizar = asyncHandler(async (req, res) => {
  const { titulo, numeroExpediente, tipoPatente, porcentajeAvance, estado, fechaEstimada, notasInternas } = req.body || {};
  if (estado !== undefined && !ESTADOS_PROYECTO.includes(estado)) throw new AppError(400, 'Estado de proyecto inválido.');
  if (porcentajeAvance !== undefined && (porcentajeAvance < 0 || porcentajeAvance > 100)) {
    throw new AppError(400, 'El porcentaje de avance debe estar entre 0 y 100.');
  }
  const proyecto = await proyectoModel.actualizar(req.params.id, {
    titulo, numeroExpediente, tipoPatente, porcentajeAvance, estado, fechaEstimada, notasInternas,
  });
  if (!proyecto) throw new AppError(404, 'Proyecto no encontrado.');
  res.json({ proyecto });
});

const actualizarFase = asyncHandler(async (req, res) => {
  const { estado, fechaInicio, fechaFin, nota, observacion } = req.body || {};
  if (estado !== undefined && !ESTADOS_FASE.includes(estado)) throw new AppError(400, 'Estado de fase inválido.');
  const fase = await proyectoModel.actualizarFase(req.params.id, req.params.faseId, {
    estado, fechaInicio, fechaFin, nota, observacion,
  });
  if (!fase) throw new AppError(404, 'Fase no encontrada para este proyecto.');
  res.json({ fase });
});

const subirDocumento = asyncHandler(async (req, res) => {
  if (!req.file) throw new AppError(400, 'Selecciona un archivo para subir.');
  const proyecto = await proyectoModel.obtenerPorId(req.params.id);
  if (!proyecto) throw new AppError(404, 'Proyecto no encontrado.');

  const rutaRelativa = path.relative(UPLOAD_ROOT, req.file.path).split(path.sep).join('/');
  const esPublicoCliente = req.body?.esPublicoCliente !== 'false';
  const id = await proyectoModel.agregarDocumento({
    proyectoId: proyecto.id,
    nombre: req.file.originalname,
    rutaArchivo: rutaRelativa,
    tipo: path.extname(req.file.originalname).replace('.', '') || null,
    tamanoKb: Math.round(req.file.size / 1024),
    subidoPor: 'empresa',
    esPublicoCliente,
  });
  res.status(201).json({ ok: true, id });
});

const descargarDocumento = asyncHandler(async (req, res) => {
  const doc = await proyectoModel.obtenerDocumentoCrudo(req.params.docId);
  if (!doc) throw new AppError(404, 'Documento no encontrado.');
  const rutaAbsoluta = path.join(UPLOAD_ROOT, doc.ruta_archivo);
  if (!fs.existsSync(rutaAbsoluta)) throw new AppError(404, 'El archivo ya no está disponible en el servidor.');
  res.download(rutaAbsoluta, doc.nombre);
});

const actualizarDocumento = asyncHandler(async (req, res) => {
  await proyectoModel.actualizarDocumento(req.params.docId, req.body || {});
  res.json({ ok: true });
});

const eliminarDocumento = asyncHandler(async (req, res) => {
  const doc = await proyectoModel.obtenerDocumentoCrudo(req.params.docId);
  if (doc) {
    const rutaAbsoluta = path.join(UPLOAD_ROOT, doc.ruta_archivo);
    fs.promises.unlink(rutaAbsoluta).catch(() => {}); // best-effort; no bloquear si ya no existe el archivo
  }
  await proyectoModel.eliminarDocumento(req.params.docId);
  res.json({ ok: true });
});

const agregarAlerta = asyncHandler(async (req, res) => {
  const { tipo, mensaje, fechaLimite } = req.body || {};
  if (!mensaje || String(mensaje).trim().length < 3) throw new AppError(400, 'Escribe el mensaje de la alerta.');
  if (tipo !== undefined && !TIPOS_ALERTA.includes(tipo)) throw new AppError(400, 'Tipo de alerta inválido.');
  const proyecto = await proyectoModel.obtenerPorId(req.params.id);
  if (!proyecto) throw new AppError(404, 'Proyecto no encontrado.');
  const id = await proyectoModel.agregarAlerta({ proyectoId: proyecto.id, tipo, mensaje: String(mensaje).trim(), fechaLimite });
  res.status(201).json({ ok: true, id });
});

const actualizarAlerta = asyncHandler(async (req, res) => {
  await proyectoModel.actualizarAlerta(req.params.alertaId, req.body || {});
  res.json({ ok: true });
});

const eliminarAlerta = asyncHandler(async (req, res) => {
  await proyectoModel.eliminarAlerta(req.params.alertaId);
  res.json({ ok: true });
});

module.exports = {
  catalogoFases, listar, crear, obtener, actualizar, actualizarFase,
  subirDocumento, descargarDocumento, actualizarDocumento, eliminarDocumento,
  agregarAlerta, actualizarAlerta, eliminarAlerta,
};
