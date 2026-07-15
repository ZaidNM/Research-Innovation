'use strict';

const { pool } = require('../config/db');

function mapContacto(row) {
  return {
    id: row.id,
    nombre: row.nombre,
    email: row.email,
    asunto: row.asunto,
    mensaje: row.mensaje,
    leido: !!row.leido,
    creadoEn: row.creado_en,
  };
}

async function crear({ nombre, email, asunto, mensaje }) {
  const [r] = await pool.query(
    'INSERT INTO contactos_web (nombre, email, asunto, mensaje) VALUES (?, ?, ?, ?)',
    [nombre, email, asunto || null, mensaje]
  );
  return r.insertId;
}

async function listar({ leido } = {}) {
  const condiciones = [];
  const params = [];
  if (leido !== undefined) {
    condiciones.push('leido = ?');
    params.push(leido ? 1 : 0);
  }
  const where = condiciones.length ? `WHERE ${condiciones.join(' AND ')}` : '';
  const [rows] = await pool.query(`SELECT * FROM contactos_web ${where} ORDER BY creado_en DESC`, params);
  return rows.map(mapContacto);
}

async function contarNoLeidos() {
  const [[{ total }]] = await pool.query('SELECT COUNT(*) AS total FROM contactos_web WHERE leido = 0');
  return total;
}

async function marcarLeido(id, leido = true) {
  await pool.query('UPDATE contactos_web SET leido = ? WHERE id = ?', [leido ? 1 : 0, id]);
}

module.exports = { crear, listar, contarNoLeidos, marcarLeido };
