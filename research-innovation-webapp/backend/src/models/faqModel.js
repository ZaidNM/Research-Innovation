'use strict';

const { pool } = require('../config/db');

function mapFaq(row) {
  return { id: row.id, pregunta: row.pregunta, respuesta: row.respuesta, orden: row.orden, publicado: !!row.publicado };
}

async function listar({ soloPublicados = true } = {}) {
  const where = soloPublicados ? 'WHERE publicado = 1' : '';
  const [rows] = await pool.query(`SELECT * FROM faqs ${where} ORDER BY orden ASC, id ASC`);
  return rows.map(mapFaq);
}

async function crear({ pregunta, respuesta, orden, publicado }) {
  const [r] = await pool.query(
    'INSERT INTO faqs (pregunta, respuesta, orden, publicado) VALUES (?, ?, ?, ?)',
    [pregunta, respuesta, orden || 0, publicado === false ? 0 : 1]
  );
  return { id: r.insertId, pregunta, respuesta, orden: orden || 0, publicado: publicado !== false };
}

async function actualizar(id, { pregunta, respuesta, orden, publicado }) {
  await pool.query(
    `UPDATE faqs SET pregunta = COALESCE(?, pregunta), respuesta = COALESCE(?, respuesta),
     orden = COALESCE(?, orden), publicado = COALESCE(?, publicado) WHERE id = ?`,
    [pregunta, respuesta, orden, publicado === undefined ? null : (publicado ? 1 : 0), id]
  );
  const [rows] = await pool.query('SELECT * FROM faqs WHERE id = ?', [id]);
  return rows[0] ? mapFaq(rows[0]) : null;
}

async function eliminar(id) {
  await pool.query('DELETE FROM faqs WHERE id = ?', [id]);
}

module.exports = { listar, crear, actualizar, eliminar };
