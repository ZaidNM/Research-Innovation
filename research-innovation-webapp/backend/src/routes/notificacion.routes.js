'use strict';

const express = require('express');
const notificacionController = require('../controllers/notificacionController');
const { requireAuth } = require('../middleware/auth');

const router = express.Router();
router.use(requireAuth);

router.get('/', notificacionController.listar);
router.patch('/leer-todas', notificacionController.marcarTodasLeidas);
router.patch('/:id/leer', notificacionController.marcarLeida);

module.exports = router;
