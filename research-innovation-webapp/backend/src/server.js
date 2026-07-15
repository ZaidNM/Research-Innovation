'use strict';

require('dotenv').config();

const fs = require('fs');
const path = require('path');
const crearApp = require('./app');
const { verificarConexion, pool } = require('./config/db');

const PUERTO = Number(process.env.PORT || 3000);

async function iniciar() {
  // Falla rápido y con un mensaje claro si falta configuración esencial,
  // en vez de arrancar "a medias" y fallar de forma confusa en el primer request.
  const faltantes = ['DB_USER', 'DB_PASSWORD', 'DB_NAME', 'JWT_SECRET'].filter((k) => !process.env[k]);
  if (faltantes.length > 0) {
    console.error(`\n[arranque] Faltan variables de entorno: ${faltantes.join(', ')}`);
    console.error('[arranque] Copia .env.example a .env y complétalo. Ver INSTALACION.md.\n');
    process.exit(1);
  }

  fs.mkdirSync(path.join(__dirname, '..', 'uploads'), { recursive: true });

  try {
    await verificarConexion();
    console.log('[arranque] Conexión a MySQL/MariaDB verificada correctamente.');
  } catch (err) {
    console.error('\n[arranque] No se pudo conectar a la base de datos.');
    console.error(`[arranque] Detalle: ${err.message}`);
    console.error('[arranque] Verifica que el servidor MySQL/MariaDB esté encendido y que los datos de .env sean correctos.\n');
    process.exit(1);
  }

  const app = crearApp();
  const servidor = app.listen(PUERTO, () => {
    console.log(`\n  Research & Innovation — servidor activo`);
    console.log(`  Sitio público:     http://localhost:${PUERTO}`);
    console.log(`  Panel admin:       http://localhost:${PUERTO}/admin`);
    console.log(`  API:               http://localhost:${PUERTO}/api`);
    console.log(`  Entorno:           ${process.env.NODE_ENV || 'development'}\n`);
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
