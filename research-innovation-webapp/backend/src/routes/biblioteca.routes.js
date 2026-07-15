'use strict';

const express = require('express');
const bibliotecaController = require('../controllers/bibliotecaController');
const { requireAuth } = require('../middleware/auth');

const router = express.Router();
router.use(requireAuth);

router.get('/categorias', bibliotecaController.listarCategorias);
router.get('/articulos', bibliotecaController.listarArticulos);
router.get('/articulos/:id', bibliotecaController.obtenerArticulo);
router.get('/lecturas/total', bibliotecaController.contarLecturas);

module.exports = router;
