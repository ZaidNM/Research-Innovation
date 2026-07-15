'use strict';

const { pool } = require('../config/db');

function mapPatente(row) {
  return {
    id: row.id,
    titulo: row.titulo,
    descripcion: row.descripcion,
    videoUrl: row.video_url,
    orden: row.orden,
    publicado: !!row.publicado,
  };
}

async function listar({ soloPublicados = true } = {}) {
  const where = soloPublicados ? 'WHERE publicado = 1' : '';
  const [rows] = await pool.query(`SELECT * FROM patentes_destacadas ${where} ORDER BY orden ASC, id ASC`);
  return rows.map(mapPatente);
}

async function crear({ titulo, descripcion, videoUrl, orden, publicado }) {
  const [r] = await pool.query(
    'INSERT INTO patentes_destacadas (titulo, descripcion, video_url, orden, publicado) VALUES (?, ?, ?, ?, ?)',
    [titulo, descripcion || null, videoUrl || null, orden || 0, publicado === false ? 0 : 1]
  );
  const [rows] = await pool.query('SELECT * FROM patentes_destacadas WHERE id = ?', [r.insertId]);
  return mapPatente(rows[0]);
}

async function actualizar(id, { titulo, descripcion, videoUrl, orden, publicado }) {
  await pool.query(
    `UPDATE patentes_destacadas SET titulo = COALESCE(?, titulo), descripcion = ?, video_url = ?,
     orden = COALESCE(?, orden), publicado = COALESCE(?, publicado) WHERE id = ?`,
    [titulo, descripcion ?? null, videoUrl ?? null, orden, publicado === undefined ? null : (publicado ? 1 : 0), id]
  );
  const [rows] = await pool.query('SELECT * FROM patentes_destacadas WHERE id = ?', [id]);
  return rows[0] ? mapPatente(rows[0]) : null;
}

async function eliminar(id) {
  await pool.query('DELETE FROM patentes_destacadas WHERE id = ?', [id]);
}

module.exports = { listar, crear, actualizar, eliminar };
