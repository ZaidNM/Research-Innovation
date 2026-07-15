'use strict';

const { pool } = require('../config/db');
const usuarioModel = require('./usuarioModel');

function mapFicha(row) {
  if (!row) return null;
  let documentacion = [];
  try {
    documentacion = row.documentacion ? JSON.parse(row.documentacion) : [];
  } catch {
    documentacion = [];
  }
  return {
    id: row.id,
    usuarioId: row.usuario_id,
    usuarioNombre: row.usuario_nombre,
    usuarioEmail: row.usuario_email,
    tituloProyecto: row.titulo_proyecto,
    descripcion: row.descripcion,
    sector: row.sector,
    tipoProteccion: row.tipo_proteccion,
    nivelTrl: row.nivel_trl,
    documentacion,
    yaDivulgada: row.ya_divulgada,
    tieneSocios: row.tiene_socios,
    dudas: row.dudas,
    estado: row.estado,
    notasAdmin: row.notas_admin,
    enviadaEn: row.enviada_en,
    actualizadaEn: row.actualizada_en,
  };
}

const SELECT_BASE = `
  SELECT f.*, u.nombre AS usuario_nombre, u.email AS usuario_email
  FROM fichas_orientativas f JOIN usuarios u ON u.id = f.usuario_id
`;

async function obtenerPorUsuario(usuarioId) {
  const [rows] = await pool.query(`${SELECT_BASE} WHERE f.usuario_id = ?`, [usuarioId]);
  return mapFicha(rows[0]);
}

async function obtenerPorId(id) {
  const [rows] = await pool.query(`${SELECT_BASE} WHERE f.id = ?`, [id]);
  return mapFicha(rows[0]);
}

/** Crea la ficha si no existe, o la reemplaza si el usuario ya había enviado una (permite reenviar/corregir). */
async function crearOActualizar(usuarioId, datos) {
  const documentacionJson = JSON.stringify(datos.documentacion || []);
  await pool.query(
    `INSERT INTO fichas_orientativas
       (usuario_id, titulo_proyecto, descripcion, sector, tipo_proteccion, nivel_trl, documentacion, ya_divulgada, tiene_socios, dudas, estado)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'pendiente')
     ON DUPLICATE KEY UPDATE
       titulo_proyecto = VALUES(titulo_proyecto), descripcion = VALUES(descripcion), sector = VALUES(sector),
       tipo_proteccion = VALUES(tipo_proteccion), nivel_trl = VALUES(nivel_trl), documentacion = VALUES(documentacion),
       ya_divulgada = VALUES(ya_divulgada), tiene_socios = VALUES(tiene_socios), dudas = VALUES(dudas),
       estado = 'pendiente'`,
    [
      usuarioId, datos.tituloProyecto, datos.descripcion, datos.sector || null,
      datos.tipoProteccion || 'no_definido', datos.nivelTrl || null, documentacionJson,
      datos.yaDivulgada || 'nose', datos.tieneSocios || 'no', datos.dudas || null,
    ]
  );
  await usuarioModel.marcarFichaEnviada(usuarioId);
  return obtenerPorUsuario(usuarioId);
}

async function listar({ estado, q } = {}) {
  const condiciones = [];
  const params = [];
  if (estado) {
    condiciones.push('f.estado = ?');
    params.push(estado);
  }
  if (q) {
    condiciones.push('(f.titulo_proyecto LIKE ? OR u.nombre LIKE ? OR u.email LIKE ?)');
    params.push(`%${q}%`, `%${q}%`, `%${q}%`);
  }
  const where = condiciones.length ? `WHERE ${condiciones.join(' AND ')}` : '';
  const [rows] = await pool.query(`${SELECT_BASE} ${where} ORDER BY f.enviada_en DESC`, params);
  return rows.map(mapFicha);
}

async function actualizarEstado(id, { estado, notasAdmin }) {
  await pool.query(
    'UPDATE fichas_orientativas SET estado = COALESCE(?, estado), notas_admin = COALESCE(?, notas_admin) WHERE id = ?',
    [estado || null, notasAdmin ?? null, id]
  );
  return obtenerPorId(id);
}

module.exports = { obtenerPorUsuario, obtenerPorId, crearOActualizar, listar, actualizarEstado };
