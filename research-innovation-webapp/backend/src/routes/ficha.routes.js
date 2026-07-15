'use strict';

const express = require('express');
const fichaController = require('../controllers/fichaController');
const { requireAuth } = require('../middleware/auth');

const router = express.Router();
router.use(requireAuth);

router.get('/mia', fichaController.obtenerMia);
router.post('/', fichaController.enviar);

module.exports = router;
