'use strict';

const { pool } = require('../config/db');

/** Devuelve TODO el contenido público como un solo objeto { clave: valorParseado }. */
async function obtenerTodo() {
  const [rows] = await pool.query('SELECT clave, valor FROM contenido_publico');
  const resultado = {};
  for (const row of rows) {
    try {
      resultado[row.clave] = JSON.parse(row.valor);
    } catch {
      resultado[row.clave] = row.valor;
    }
  }
  return resultado;
}

async function obtenerClave(clave) {
  const [rows] = await pool.query('SELECT valor FROM contenido_publico WHERE clave = ?', [clave]);
  if (!rows[0]) return null;
  try {
    return JSON.parse(rows[0].valor);
  } catch {
    return rows[0].valor;
  }
}

/** Crea o reemplaza el valor de una clave. El valor se guarda como JSON. */
async function guardarClave(clave, valor) {
  const json = JSON.stringify(valor);
  await pool.query(
    `INSERT INTO contenido_publico (clave, valor) VALUES (?, ?)
     ON DUPLICATE KEY UPDATE valor = VALUES(valor)`,
    [clave, json]
  );
  return valor;
}

module.exports = { obtenerTodo, obtenerClave, guardarClave };
