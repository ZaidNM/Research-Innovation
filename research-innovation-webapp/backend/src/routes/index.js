'use strict';

const express = require('express');

const router = express.Router();

router.use('/auth', require('./auth.routes'));
router.use('/public', require('./public.routes'));
router.use('/biblioteca', require('./biblioteca.routes'));
router.use('/ficha', require('./ficha.routes'));
router.use('/proyectos', require('./proyecto.routes'));
router.use('/notificaciones', require('./notificacion.routes'));
router.use('/admin', require('./admin.routes'));

module.exports = router;
