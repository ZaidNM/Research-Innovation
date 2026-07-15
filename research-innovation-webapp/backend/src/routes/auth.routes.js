'use strict';

const express = require('express');
const rateLimit = require('express-rate-limit');
const authController = require('../controllers/authController');
const { requireAuth } = require('../middleware/auth');

const router = express.Router();

// Limita intentos de login/registro por IP para dificultar fuerza bruta.
const limitadorAuth = rateLimit({
  windowMs: 15 * 60 * 1000,
  limit: 20,
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: 'Demasiados intentos. Espera unos minutos e inténtalo de nuevo.' },
});

router.post('/registro', limitadorAuth, authController.registro);
router.post('/login', limitadorAuth, authController.login);
router.post('/logout', requireAuth, authController.logout);
router.get('/yo', requireAuth, authController.yo);

module.exports = router;
