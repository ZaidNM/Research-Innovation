'use strict';

const express = require('express');
const proyectoController = require('../controllers/proyectoController');
const { requireAuth, requireRole } = require('../middleware/auth');
const { uploadMiDocumento } = require('../middleware/upload');

const router = express.Router();
router.use(requireAuth, requireRole('registrado', 'cliente'));

router.get('/mio', proyectoController.obtenerMiProyecto);
router.get('/mio/documentos/:docId/descargar', proyectoController.descargarMiDocumento);
router.post(
  '/mio/documentos',
  proyectoController.resolverMiProyecto,
  uploadMiDocumento.single('archivo'),
  proyectoController.subirMiDocumento
);

module.exports = router;
