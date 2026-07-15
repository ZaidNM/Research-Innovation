'use strict';

const fs = require('fs');
const path = require('path');
const multer = require('multer');
const { AppError } = require('../utils/asyncHandler');

const UPLOAD_ROOT = path.join(__dirname, '..', '..', 'uploads');

// Extensiones permitidas para expedientes de patentes: documentos técnicos,
// imágenes de bocetos y archivos de modelado 3D. Todo lo demás se rechaza.
const EXTENSIONES_PERMITIDAS = new Set([
  '.pdf', '.doc', '.docx', '.png', '.jpg', '.jpeg', '.webp', '.stl', '.obj', '.glb', '.zip',
]);

function nombreSeguro(nombreOriginal) {
  const ext = path.extname(nombreOriginal).toLowerCase();
  const base = path
    .basename(nombreOriginal, ext)
    .normalize('NFKD')
    .replace(/[^\w.-]+/g, '_') // solo letras/números/guiones tras quitar tildes
    .slice(0, 80);
  return `${Date.now()}_${base}${ext}`;
}

function crearDestino(dir, cb) {
  fs.mkdirSync(dir, { recursive: true });
  cb(null, dir);
}

// Caso admin: el proyectoId viaja en la URL (/admin/proyectos/:id/documentos).
const storageAdmin = multer.diskStorage({
  destination(req, file, cb) {
    const proyectoId = String(req.params.id || req.params.proyectoId || '').replace(/\D/g, '');
    if (!proyectoId) return cb(new AppError(400, 'Falta el identificador del proyecto.'));
    crearDestino(path.join(UPLOAD_ROOT, 'proyectos', proyectoId), cb);
  },
  filename(req, file, cb) {
    cb(null, nombreSeguro(file.originalname));
  },
});

// Caso cliente: no hay proyectoId en la URL (/proyectos/mio/documentos), así
// que se resuelve consultando el proyecto propio ANTES de que multer procese
// el archivo (ver middleware/resolverMiProyecto más abajo, usado en la ruta).
const storageCliente = multer.diskStorage({
  destination(req, file, cb) {
    if (!req.miProyectoId) return cb(new AppError(404, 'No tienes un proyecto activo.'));
    crearDestino(path.join(UPLOAD_ROOT, 'proyectos', String(req.miProyectoId)), cb);
  },
  filename(req, file, cb) {
    cb(null, nombreSeguro(file.originalname));
  },
});

function filtroArchivo(req, file, cb) {
  const ext = path.extname(file.originalname).toLowerCase();
  if (!EXTENSIONES_PERMITIDAS.has(ext)) {
    return cb(new AppError(415, `Tipo de archivo no permitido (${ext || 'sin extensión'}). Formatos válidos: PDF, DOC/DOCX, PNG, JPG, WEBP, STL, OBJ, GLB, ZIP.`));
  }
  cb(null, true);
}

const maxMb = Number(process.env.UPLOAD_MAX_MB || 20);
const limits = { fileSize: maxMb * 1024 * 1024, files: 1 };

const uploadDocumento = multer({ storage: storageAdmin, fileFilter: filtroArchivo, limits });
const uploadMiDocumento = multer({ storage: storageCliente, fileFilter: filtroArchivo, limits });

module.exports = { uploadDocumento, uploadMiDocumento, UPLOAD_ROOT };
