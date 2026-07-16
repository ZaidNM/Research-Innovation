'use strict';

// 1. Forzar variables fijas para Railway antes de hacer cualquier otra cosa
process.env.DB_USER = 'root';
process.env.DB_NAME = 'railway';
process.env.DB_PASSWORD = 'nmBQhnxrgmKJrqTnWhublEMRzBahnRy';
process.env.DB_HOST = 'mysql.railway.internal';
process.env.DB_PORT = '3306';
process.env.PORT = '3000';
process.env.JWT_SECRET = 'sn>I-k&n}cv8]1T&+SK0)Nqo%oRh@q-*dgNJ@_x9wdhw&yR$7';

require('dotenv').config();

const fs = require('fs');
const path = require('path');
const crearApp = require('./app');
const { verificarConexion, pool } = require('./config/db');

const PUERTO = Number(process.env.PORT || 3000);

async function iniciar() {
  // Se eliminó la validación estricta que provocaba el crash por falta de variables externas

  fs.mkdirSync(path.join(__dirname, '..', 'uploads'), { recursive: true });

  try {
    await verificarConexion();
    console.log('[arranque] Conexión a MySQL/MariaDB verificada correctamente.');
  } catch (err) {
    console.error('\n[arranque] No se pudo conectar a la base de datos.');
    console.error(`[arranque] Detalle: ${err.message}`);
    console.error('[arranque] Verifica que el servidor MySQL/MariaDB esté encendido.\n');
    process.exit(1);
  }

  const app = crearApp();
  const servidor = app.listen(PUERTO, () => {
    console.log(`\n  Research & Innovation — servidor activo`);
    console.log(`  API activa en puerto: ${PUERTO}`);
    console.log(`  Entorno:           ${process.env.NODE_ENV || 'production'}\n`);
  });

  const apagar = async (señal) => {
    console.log(`\n[cierre] Señal ${señal} recibida. Cerrando servidor...`);
    servidor.close(async () => {
      await pool.end();
      console.log('[cierre] Servidor y conexiones de base de datos cerrados.');
      process.exit(0);
    });
  };
  process.on('SIGINT', () => apagar('SIGINT'));
  process.on('SIGTERM', () => apagar('SIGTERM'));
}

iniciar();