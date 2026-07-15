'use strict';

const { pool } = require('../config/db');
const notificacionModel = require('./notificacionModel');

function mapProyecto(row) {
  return {
    id: row.id,
    usuarioId: row.usuario_id,
    usuarioNombre: row.usuario_nombre,
    usuarioEmail: row.usuario_email,
    titulo: row.titulo,
    numeroExpediente: row.numero_expediente,
    tipoPatente: row.tipo_patente,
    porcentajeAvance: row.porcentaje_avance,
    estado: row.estado,
    fechaInicio: row.fecha_inicio,
    fechaEstimada: row.fecha_estimada,
    notasInternas: row.notas_internas,
    creadoEn: row.creado_en,
    actualizadoEn: row.actualizado_en,
  };
}

function mapFase(row) {
  return {
    id: row.id,
    faseId: row.fase_id,
    nombre: row.nombre,
    descripcion: row.descripcion,
    orden: row.orden,
    estado: row.estado,
    fechaInicio: row.fecha_inicio,
    fechaFin: row.fecha_fin,
    nota: row.nota,
    observacion: row.observacion,
    actualizadoEn: row.actualizado_en,
  };
}

function mapDocumento(row) {
  return {
    id: row.id,
    proyectoId: row.proyecto_id,
    nombre: row.nombre,
    tipo: row.tipo,
    tamanoKb: row.tamano_kb,
    subidoPor: row.subido_por,
    esPublicoCliente: !!row.es_publico_cliente,
    pendiente: !!row.pendiente,
    creadoEn: row.creado_en,
  };
}

function mapAlerta(row) {
  return {
    id: row.id,
    proyectoId: row.proyecto_id,
    tipo: row.tipo,
    mensaje: row.mensaje,
    fechaLimite: row.fecha_limite,
    leida: !!row.leida,
    creadoEn: row.creado_en,
  };
}

const SELECT_PROYECTO_BASE = `
  SELECT p.*, u.nombre AS usuario_nombre, u.email AS usuario_email
  FROM proyectos_patente p JOIN usuarios u ON u.id = p.usuario_id
`;

async function obtenerCatalogoFases() {
  const [rows] = await pool.query('SELECT * FROM fases_proceso ORDER BY orden ASC');
  return rows;
}

async function obtenerPorUsuario(usuarioId) {
  const [rows] = await pool.query(`${SELECT_PROYECTO_BASE} WHERE p.usuario_id = ? ORDER BY p.creado_en DESC LIMIT 1`, [usuarioId]);
  return rows[0] ? mapProyecto(rows[0]) : null;
}

async function obtenerPorId(id) {
  const [rows] = await pool.query(`${SELECT_PROYECTO_BASE} WHERE p.id = ?`, [id]);
  return rows[0] ? mapProyecto(rows[0]) : null;
}

async function listarFases(proyectoId) {
  const [rows] = await pool.query(
    `SELECT sf.*, fp.nombre, fp.descripcion, fp.orden
     FROM seguimiento_fases sf JOIN fases_proceso fp ON fp.id = sf.fase_id
     WHERE sf.proyecto_id = ? ORDER BY fp.orden ASC`,
    [proyectoId]
  );
  return rows.map(mapFase);
}

async function listarDocumentos(proyectoId, { soloPublicos = false } = {}) {
  const where = soloPublicos ? 'WHERE proyecto_id = ? AND es_publico_cliente = 1' : 'WHERE proyecto_id = ?';
  const [rows] = await pool.query(`SELECT * FROM documentos_proyecto ${where} ORDER BY creado_en DESC`, [proyectoId]);
  return rows.map(mapDocumento);
}

async function obtenerDocumentoCrudo(id) {
  const [rows] = await pool.query('SELECT * FROM documentos_proyecto WHERE id = ?', [id]);
  return rows[0] || null;
}

async function listarAlertas(proyectoId) {
  const [rows] = await pool.query('SELECT * FROM alertas_proyecto WHERE proyecto_id = ? ORDER BY creado_en DESC', [proyectoId]);
  return rows.map(mapAlerta);
}

async function listarTodos({ estado, q } = {}) {
  const condiciones = [];
  const params = [];
  if (estado) {
    condiciones.push('p.estado = ?');
    params.push(estado);
  }
  if (q) {
    condiciones.push('(p.titulo LIKE ? OR p.numero_expediente LIKE ? OR u.nombre LIKE ? OR u.email LIKE ?)');
    params.push(`%${q}%`, `%${q}%`, `%${q}%`, `%${q}%`);
  }
  const where = condiciones.length ? `WHERE ${condiciones.join(' AND ')}` : '';
  const [rows] = await pool.query(`${SELECT_PROYECTO_BASE} ${where} ORDER BY p.actualizado_en DESC`, params);
  return rows.map(mapProyecto);
}

/**
 * Crea un proyecto para un usuario y siembra automáticamente su línea de
 * seguimiento con todas las fases del catálogo (todas en estado 'pendiente').
 * También promueve al usuario a tipo 'cliente' si aún era 'registrado', y
 * le notifica. Todo dentro de una transacción: si algo falla, no queda un
 * proyecto a medio crear.
 */
async function crear({ usuarioId, titulo, numeroExpediente, tipoPatente, fechaInicio, fechaEstimada }) {
  const conn = await pool.getConnection();
  try {
    await conn.beginTransaction();

    const [rProyecto] = await conn.query(
      `INSERT INTO proyectos_patente (usuario_id, titulo, numero_expediente, tipo_patente, fecha_inicio, fecha_estimada)
       VALUES (?, ?, ?, ?, ?, ?)`,
      [usuarioId, titulo, numeroExpediente || null, tipoPatente || 'invencion', fechaInicio, fechaEstimada || null]
    );
    const proyectoId = rProyecto.insertId;

    const [fases] = await conn.query('SELECT id FROM fases_proceso ORDER BY orden ASC');
    if (fases.length > 0) {
      const values = fases.map(() => '(?, ?, "pendiente")').join(', ');
      const params = fases.flatMap((f) => [proyectoId, f.id]);
      await conn.query(`INSERT INTO seguimiento_fases (proyecto_id, fase_id, estado) VALUES ${values}`, params);
    }

    await conn.query("UPDATE usuarios SET tipo = 'cliente' WHERE id = ? AND tipo = 'registrado'", [usuarioId]);

    await notificacionModel.crear({
      usuarioId,
      icono: 'ti-rocket',
      mensaje: 'Tu proyecto fue registrado en Research & Innovation',
      detalle: `Ahora puedes seguir el avance de "${titulo}" desde el panel de Seguimiento.`,
      tipo: 'proyecto',
    }, conn);

    await conn.commit();
    return obtenerPorId(proyectoId);
  } catch (err) {
    await conn.rollback();
    throw err;
  } finally {
    conn.release();
  }
}

async function actualizar(id, cambios) {
  const mapaColumnas = {
    titulo: 'titulo', numeroExpediente: 'numero_expediente', tipoPatente: 'tipo_patente',
    porcentajeAvance: 'porcentaje_avance', estado: 'estado', fechaEstimada: 'fecha_estimada', notasInternas: 'notas_internas',
  };
  const campos = [];
  const params = [];
  for (const [clave, columna] of Object.entries(mapaColumnas)) {
    if (cambios[clave] !== undefined) {
      campos.push(`${columna} = ?`);
      params.push(cambios[clave]);
    }
  }
  if (campos.length === 0) return obtenerPorId(id);
  params.push(id);
  await pool.query(`UPDATE proyectos_patente SET ${campos.join(', ')} WHERE id = ?`, params);
  return obtenerPorId(id);
}

/**
 * Actualiza una fase del seguimiento y, si el estado cambió, genera
 * automáticamente una notificación para el cliente dueño del proyecto.
 * Este es el punto que en la versión simulada no existía: antes, cambiar
 * de fase no avisaba a nadie.
 */
async function actualizarFase(proyectoId, faseId, cambios) {
  const [antesRows] = await pool.query(
    `SELECT sf.estado, fp.nombre FROM seguimiento_fases sf JOIN fases_proceso fp ON fp.id = sf.fase_id
     WHERE sf.proyecto_id = ? AND sf.fase_id = ?`,
    [proyectoId, faseId]
  );
  if (antesRows.length === 0) return null;
  const estadoAnterior = antesRows[0].estado;
  const nombreFase = antesRows[0].nombre;

  const campos = [];
  const params = [];
  const mapaColumnas = { estado: 'estado', fechaInicio: 'fecha_inicio', fechaFin: 'fecha_fin', nota: 'nota', observacion: 'observacion' };
  for (const [clave, columna] of Object.entries(mapaColumnas)) {
    if (cambios[clave] !== undefined) {
      campos.push(`${columna} = ?`);
      params.push(cambios[clave]);
    }
  }
  if (campos.length > 0) {
    params.push(proyectoId, faseId);
    await pool.query(`UPDATE seguimiento_fases SET ${campos.join(', ')} WHERE proyecto_id = ? AND fase_id = ?`, params);
  }

  if (cambios.estado && cambios.estado !== estadoAnterior) {
    const proyecto = await obtenerPorId(proyectoId);
    const mensajesPorEstado = {
      activo: `La fase "${nombreFase}" está ahora en curso.`,
      completado: `La fase "${nombreFase}" fue completada.`,
      con_observacion: `Hay una observación en la fase "${nombreFase}".`,
      pendiente: `La fase "${nombreFase}" quedó pendiente.`,
    };
    await notificacionModel.crear({
      usuarioId: proyecto.usuarioId,
      icono: cambios.estado === 'con_observacion' ? 'ti-alert-triangle' : 'ti-timeline',
      mensaje: mensajesPorEstado[cambios.estado] || `Actualización en "${nombreFase}"`,
      detalle: cambios.observacion || cambios.nota || null,
      tipo: 'proyecto',
    });
  }

  const [rows] = await pool.query(
    `SELECT sf.*, fp.nombre, fp.descripcion, fp.orden
     FROM seguimiento_fases sf JOIN fases_proceso fp ON fp.id = sf.fase_id
     WHERE sf.proyecto_id = ? AND sf.fase_id = ?`,
    [proyectoId, faseId]
  );
  return mapFase(rows[0]);
}

async function agregarDocumento({ proyectoId, nombre, rutaArchivo, tipo, tamanoKb, subidoPor, esPublicoCliente = true }) {
  const [r] = await pool.query(
    `INSERT INTO documentos_proyecto (proyecto_id, nombre, ruta_archivo, tipo, tamano_kb, subido_por, es_publico_cliente, pendiente)
     VALUES (?, ?, ?, ?, ?, ?, ?, 0)`,
    [proyectoId, nombre, rutaArchivo, tipo || null, tamanoKb || null, subidoPor, esPublicoCliente ? 1 : 0]
  );
  return r.insertId;
}

async function actualizarDocumento(id, { esPublicoCliente, pendiente }) {
  const campos = [];
  const params = [];
  if (esPublicoCliente !== undefined) { campos.push('es_publico_cliente = ?'); params.push(esPublicoCliente ? 1 : 0); }
  if (pendiente !== undefined) { campos.push('pendiente = ?'); params.push(pendiente ? 1 : 0); }
  if (campos.length === 0) return;
  params.push(id);
  await pool.query(`UPDATE documentos_proyecto SET ${campos.join(', ')} WHERE id = ?`, params);
}

async function eliminarDocumento(id) {
  await pool.query('DELETE FROM documentos_proyecto WHERE id = ?', [id]);
}

async function agregarAlerta({ proyectoId, tipo, mensaje, fechaLimite }) {
  const [r] = await pool.query(
    'INSERT INTO alertas_proyecto (proyecto_id, tipo, mensaje, fecha_limite) VALUES (?, ?, ?, ?)',
    [proyectoId, tipo || 'info', mensaje, fechaLimite || null]
  );
  const proyecto = await obtenerPorId(proyectoId);
  await notificacionModel.crear({
    usuarioId: proyecto.usuarioId,
    icono: tipo === 'urgente' ? 'ti-alert-triangle' : 'ti-bell',
    mensaje,
    detalle: fechaLimite ? `Fecha límite: ${fechaLimite}` : null,
    tipo: 'proyecto',
  });
  return r.insertId;
}

async function actualizarAlerta(id, { leida }) {
  await pool.query('UPDATE alertas_proyecto SET leida = ? WHERE id = ?', [leida ? 1 : 0, id]);
}

async function eliminarAlerta(id) {
  await pool.query('DELETE FROM alertas_proyecto WHERE id = ?', [id]);
}

module.exports = {
  obtenerCatalogoFases, obtenerPorUsuario, obtenerPorId, listarFases, listarDocumentos,
  obtenerDocumentoCrudo, listarAlertas, listarTodos, crear, actualizar, actualizarFase,
  agregarDocumento, actualizarDocumento, eliminarDocumento, agregarAlerta, actualizarAlerta, eliminarAlerta,
};
