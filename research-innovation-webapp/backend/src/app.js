'use strict';

const path = require('path');
const fs = require('fs'); // <-- Importado correctamente aquí arriba
const express = require('express');
const cors = require('cors');
const helmet = require('helmet');
const morgan = require('morgan');
const cookieParser = require('cookie-parser');

const rutasApi = require('./routes');
const { errorHandler, notFoundHandler } = require('./middleware/errorHandler');

const RAIZ_PROYECTO = path.join(__dirname, '..', '..');

function crearApp() {
  const app = express();

  app.disable('x-powered-by');
  app.set('trust proxy', 1);

  app.use(helmet({ contentSecurityPolicy: false, crossOriginResourcePolicy: false }));

  if (process.env.CORS_ORIGIN) {
    app.use(cors({ origin: process.env.CORS_ORIGIN, credentials: true }));
  }

  app.use(morgan(process.env.NODE_ENV === 'production' ? 'combined' : 'dev'));
  app.use(express.json({ limit: '2mb' }));
  app.use(express.urlencoded({ extended: true }));
  app.use(cookieParser());

  // ── API ─────────────────────────────────────────────────
  app.use('/api', rutasApi);

  // ── Panel de administración (Manejador seguro) ────
  const rutaAdmin = path.join(RAIZ_PROYECTO, 'admin');
  app.use('/admin', express.static(rutaAdmin));
  app.get('/admin/*', (req, res, next) => {
    const file = path.join(rutaAdmin, 'index.html');
    if (fs.existsSync(file)) {
      return res.sendFile(file);
    }
    next();
  });

  // ── Sitio público + área de usuario ───────────────────────
  const rutaPublic = path.join(RAIZ_PROYECTO, 'public');
  app.use(express.static(rutaPublic));

  // ── 404 para rutas /api no encontradas ────────────────────
  app.use('/api', notFoundHandler);

  // Cualquier otra ruta no-API sirve el index del sitio público o responde JSON de API viva
  app.get('*', (req, res) => {
    const file = path.join(rutaPublic, 'index.html');
    if (fs.existsSync(file)) {
      return res.sendFile(file);
    }
    res.json({ 
      status: "online",
      message: "Research & Innovation API funcionando correctamente en Railway" 
    });
  });

  app.use(errorHandler);

  return app;
}

// Aseguramos que la exportación quede al final y libre de errores
module.exports = crearApp;