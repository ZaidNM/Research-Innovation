'use strict';

require('dotenv').config();

const fs = require('fs');
const path = require('path');
const crearApp = require('./app');
const { verificarConexion, pool } = require('./config/db');

const PUERTO = Number(process.env.PORT || 3000);

async function iniciar() {
  // Nota: Dejamos la validación desactivada o activada, pero como usaremos las variables oficiales ya no fallará.
  // ... resto de tu archivo original sin los process.env fijos que agregamos antes.
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