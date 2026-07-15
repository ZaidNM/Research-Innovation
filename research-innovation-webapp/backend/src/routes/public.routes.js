'use strict';

const express = require('express');
const rateLimit = require('express-rate-limit');
const publicController = require('../controllers/publicController');

const router = express.Router();

const limitadorContacto = rateLimit({
  windowMs: 15 * 60 * 1000,
  limit: 10,
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: 'Demasiados mensajes enviados. Espera unos minutos e inténtalo de nuevo.' },
});

router.get('/contenido', publicController.obtenerContenido);
router.get('/faqs', publicController.obtenerFaqs);
router.get('/patentes-destacadas', publicController.obtenerPatentesDestacadas);
router.post('/contacto', limitadorContacto, publicController.enviarContacto);

module.exports = router;
