'use strict';

const express = require('express');
const { requireAuth, requireRole } = require('../middleware/auth');
const { uploadDocumento } = require('../middleware/upload');

const usuariosAdmin = require('../controllers/admin/usuariosAdminController');
const fichasAdmin = require('../controllers/admin/fichasAdminController');
const proyectosAdmin = require('../controllers/admin/proyectosAdminController');
const bibliotecaAdmin = require('../controllers/admin/bibliotecaAdminController');
const contenidoAdmin = require('../controllers/admin/contenidoAdminController');
const faqsAdmin = require('../controllers/admin/faqsAdminController');
const patentesAdmin = require('../controllers/admin/patentesAdminController');
const contactosAdmin = require('../controllers/admin/contactosAdminController');
const notificacionesAdmin = require('../controllers/admin/notificacionesAdminController');
const statsAdmin = require('../controllers/admin/statsAdminController');

const router = express.Router();

// Toda /api/admin/* exige sesión activa Y rol 'admin' (rol único, sin
// distinción interna entre Gerencia / Especialista / Modelador 3D / Comercial).
router.use(requireAuth, requireRole('admin'));

// ── Dashboard ─────────────────────────────────────────────
router.get('/stats', statsAdmin.resumen);

// ── Usuarios ──────────────────────────────────────────────
router.get('/usuarios', usuariosAdmin.listar);
router.get('/usuarios/:id', usuariosAdmin.obtener);
router.patch('/usuarios/:id', usuariosAdmin.actualizar);

// ── Fichas de orientación ─────────────────────────────────
router.get('/fichas', fichasAdmin.listar);
router.get('/fichas/:id', fichasAdmin.obtener);
router.patch('/fichas/:id', fichasAdmin.actualizar);

// ── Proyectos y seguimiento ───────────────────────────────
router.get('/fases-catalogo', proyectosAdmin.catalogoFases);
router.get('/proyectos', proyectosAdmin.listar);
router.post('/proyectos', proyectosAdmin.crear);
router.get('/proyectos/:id', proyectosAdmin.obtener);
router.patch('/proyectos/:id', proyectosAdmin.actualizar);
router.patch('/proyectos/:id/fases/:faseId', proyectosAdmin.actualizarFase);
router.post('/proyectos/:id/documentos', uploadDocumento.single('archivo'), proyectosAdmin.subirDocumento);
router.get('/documentos/:docId/descargar', proyectosAdmin.descargarDocumento);
router.patch('/documentos/:docId', proyectosAdmin.actualizarDocumento);
router.delete('/documentos/:docId', proyectosAdmin.eliminarDocumento);
router.post('/proyectos/:id/alertas', proyectosAdmin.agregarAlerta);
router.patch('/alertas/:alertaId', proyectosAdmin.actualizarAlerta);
router.delete('/alertas/:alertaId', proyectosAdmin.eliminarAlerta);

// ── Biblioteca ────────────────────────────────────────────
router.get('/biblioteca/categorias', bibliotecaAdmin.listarCategorias);
router.post('/biblioteca/categorias', bibliotecaAdmin.crearCategoria);
router.patch('/biblioteca/categorias/:id', bibliotecaAdmin.actualizarCategoria);
router.delete('/biblioteca/categorias/:id', bibliotecaAdmin.eliminarCategoria);
router.get('/biblioteca/articulos', bibliotecaAdmin.listarArticulos);
router.post('/biblioteca/articulos', bibliotecaAdmin.crearArticulo);
router.patch('/biblioteca/articulos/:id', bibliotecaAdmin.actualizarArticulo);
router.delete('/biblioteca/articulos/:id', bibliotecaAdmin.eliminarArticulo);

// ── Contenido público del sitio ───────────────────────────
router.get('/contenido', contenidoAdmin.obtenerTodo);
router.put('/contenido/:clave', contenidoAdmin.guardarClave);

// ── FAQ ───────────────────────────────────────────────────
router.get('/faqs', faqsAdmin.listar);
router.post('/faqs', faqsAdmin.crear);
router.patch('/faqs/:id', faqsAdmin.actualizar);
router.delete('/faqs/:id', faqsAdmin.eliminar);

// ── Patentes destacadas ───────────────────────────────────
router.get('/patentes-destacadas', patentesAdmin.listar);
router.post('/patentes-destacadas', patentesAdmin.crear);
router.patch('/patentes-destacadas/:id', patentesAdmin.actualizar);
router.delete('/patentes-destacadas/:id', patentesAdmin.eliminar);

// ── Mensajes de contacto ──────────────────────────────────
router.get('/contactos', contactosAdmin.listar);
router.patch('/contactos/:id/leido', contactosAdmin.marcarLeido);

// ── Notificaciones (envío) ────────────────────────────────
router.post('/notificaciones', notificacionesAdmin.enviar);

module.exports = router;
