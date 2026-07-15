'use strict';

const { pool } = require('../config/db');

async function obtenerResumen() {
  const [[usuarios]] = await pool.query(
    `SELECT
       SUM(tipo = 'registrado') AS registrados,
       SUM(tipo = 'cliente')    AS clientes,
       COUNT(*)                 AS total
     FROM usuarios WHERE tipo != 'admin'`
  );
  const [[fichas]] = await pool.query(
    `SELECT SUM(estado = 'pendiente') AS pendientes, SUM(estado = 'en_revision') AS enRevision, COUNT(*) AS total
     FROM fichas_orientativas`
  );
  const [[proyectos]] = await pool.query(
    `SELECT SUM(estado = 'activo') AS activos, SUM(estado = 'otorgado') AS otorgados, COUNT(*) AS total
     FROM proyectos_patente`
  );
  const [[alertas]] = await pool.query(`SELECT SUM(leida = 0) AS sinLeer FROM alertas_proyecto`);
  const [[contactos]] = await pool.query(`SELECT SUM(leido = 0) AS sinLeer, COUNT(*) AS total FROM contactos_web`);

  return {
    usuarios: {
      registrados: Number(usuarios.registrados || 0),
      clientes: Number(usuarios.clientes || 0),
      total: Number(usuarios.total || 0),
    },
    fichas: {
      pendientes: Number(fichas.pendientes || 0),
      enRevision: Number(fichas.enRevision || 0),
      total: Number(fichas.total || 0),
    },
    proyectos: {
      activos: Number(proyectos.activos || 0),
      otorgados: Number(proyectos.otorgados || 0),
      total: Number(proyectos.total || 0),
    },
    alertasSinLeer: Number(alertas.sinLeer || 0),
    contactos: {
      sinLeer: Number(contactos.sinLeer || 0),
      total: Number(contactos.total || 0),
    },
  };
}

module.exports = { obtenerResumen };
