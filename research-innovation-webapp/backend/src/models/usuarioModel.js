'use strict';

const { pool } = require('../config/db');

function mapUsuario(row) {
  if (!row) return null;
  return {
    id: row.id,
    nombre: row.nombre,
    email: row.email,
    tipo: row.tipo,
    perfil: row.perfil,
    organizacion: row.organizacion,
    telefono: row.telefono,
    activo: !!row.activo,
    fichaEnviada: !!row.ficha_enviada,
    creadoEn: row.creado_en,
  };
}

async function encontrarPorEmail(email) {
  const [rows] = await pool.query('SELECT * FROM usuarios WHERE email = ?', [email]);
  return rows[0] || null; // incluye password_hash: solo para uso interno de auth
}

async function encontrarPorId(id) {
  const [rows] = await pool.query('SELECT * FROM usuarios WHERE id = ?', [id]);
  return rows[0] || null;
}

async function crear({ nombre, email, passwordHash, perfil, organizacion }) {
  const [resultado] = await pool.query(
    `INSERT INTO usuarios (nombre, email, password_hash, tipo, perfil, organizacion)
     VALUES (?, ?, ?, 'registrado', ?, ?)`,
    [nombre, email, passwordHash, perfil || 'emprendedor', organizacion || null]
  );
  return encontrarPorId(resultado.insertId);
}

async function marcarFichaEnviada(usuarioId) {
  await pool.query('UPDATE usuarios SET ficha_enviada = 1 WHERE id = ?', [usuarioId]);
}

async function listar({ tipo, q, page = 1, porPagina = 20 }) {
  const condiciones = [];
  const params = [];
  if (tipo) {
    condiciones.push('tipo = ?');
    params.push(tipo);
  }
  if (q) {
    condiciones.push('(nombre LIKE ? OR email LIKE ?)');
    params.push(`%${q}%`, `%${q}%`);
  }
  const where = condiciones.length ? `WHERE ${condiciones.join(' AND ')}` : '';
  const offset = (Math.max(1, page) - 1) * porPagina;

  const [rows] = await pool.query(
    `SELECT id, nombre, email, tipo, perfil, organizacion, telefono, activo, ficha_enviada, creado_en
     FROM usuarios ${where} ORDER BY creado_en DESC LIMIT ? OFFSET ?`,
    [...params, Number(porPagina), Number(offset)]
  );
  const [[{ total }]] = await pool.query(`SELECT COUNT(*) AS total FROM usuarios ${where}`, params);
  return { datos: rows.map(mapUsuario), total, page: Number(page), porPagina: Number(porPagina) };
}

async function actualizarPorAdmin(id, cambios) {
  const campos = [];
  const params = [];
  const permitido = { tipo: 'tipo', activo: 'activo', organizacion: 'organizacion', telefono: 'telefono', perfil: 'perfil' };
  for (const [clave, columna] of Object.entries(permitido)) {
    if (cambios[clave] !== undefined) {
      campos.push(`${columna} = ?`);
      params.push(cambios[clave]);
    }
  }
  if (campos.length === 0) return encontrarPorId(id);
  params.push(id);
  await pool.query(`UPDATE usuarios SET ${campos.join(', ')} WHERE id = ?`, params);
  return encontrarPorId(id);
}

module.exports = { mapUsuario, encontrarPorEmail, encontrarPorId, crear, marcarFichaEnviada, listar, actualizarPorAdmin };
