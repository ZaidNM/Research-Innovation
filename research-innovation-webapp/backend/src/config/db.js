'use strict';

const mysql = require('mysql2/promise');

const pool = mysql.createPool({
  host: process.env.DB_HOST || '127.0.0.1',
  port: Number(process.env.DB_PORT || 3306),
  user: process.env.DB_USER,
  password: process.env.DB_PASSWORD,
  database: process.env.DB_NAME,
  charset: 'utf8mb4',
  waitForConnections: true,
  connectionLimit: 10,
  maxIdle: 10,
  idleTimeout: 60000,
  queueLimit: 0,
  dateStrings: true, // devuelve DATE/DATETIME como texto 'YYYY-MM-DD[ HH:MM:SS]' en vez de objetos Date con zona horaria
  decimalNumbers: true,
});

/**
 * Verifica la conexión a la base de datos al arrancar el servidor.
 * Falla rápido y con un mensaje claro si la BD no está disponible,
 * en vez de dejar que cada request individual falle de forma confusa.
 */
async function verificarConexion() {
  const conn = await pool.getConnection();
  try {
    await conn.query('SELECT 1');
  } finally {
    conn.release();
  }
}

module.exports = { pool, verificarConexion };
