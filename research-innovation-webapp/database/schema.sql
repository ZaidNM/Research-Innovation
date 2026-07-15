-- ═══════════════════════════════════════════════════════════
-- Research & Innovation SAC — Esquema de Base de Datos (v2)
-- Motor: MySQL 8.0+ / MariaDB 10.6+
-- Codificación: UTF-8 (utf8mb4)
--
-- Este archivo AMPLÍA el schema original del proyecto académico.
-- Cambios respecto a la versión entregada como Sprint de diseño:
--   1. usuarios.tipo ahora incluye 'admin' (rol único de administración,
--      reemplaza los 4 roles funcionales descritos en el documento:
--      Gerencia, Especialista en patentes, Modelador 3D y Gestión
--      comercial — todos operan ahora bajo una sola cuenta admin).
--   2. Se agregan 4 tablas nuevas para que el contenido público y la
--      biblioteca sean editables desde el panel admin, y para llevar
--      trazabilidad real de lectura de artículos por usuario:
--        - contenido_publico
--        - faqs
--        - patentes_destacadas
--        - lecturas_articulos
--   3. Los hashes de las cuentas demo/admin son bcrypt reales y
--      funcionan con las contraseñas documentadas en INSTALACION.md
--      (el archivo original traía hashes de ejemplo no válidos).
-- ═══════════════════════════════════════════════════════════

-- IMPORTANTE: fuerza la codificación de la sesión de importación a utf8mb4.
-- Sin esta línea, si el cliente `mysql` se conecta con su charset por defecto
-- (latin1 en muchas instalaciones), los acentos y símbolos de este archivo
-- (que está guardado en UTF-8) se guardan MAL en la base de datos con doble
-- codificación (ej. "ó" termina como "Ã³"). Ver INSTALACION.md.
SET NAMES utf8mb4;

CREATE DATABASE IF NOT EXISTS ri_patentes
  CHARACTER SET utf8mb4
  COLLATE utf8mb4_unicode_ci;

USE ri_patentes;

-- ───────────────────────────────────────────────
-- TABLA: usuarios
-- tipo: 'registrado' accede a biblioteca y ficha;
--       'cliente'    accede además al panel de seguimiento;
--       'admin'      accede al panel de administración (rol único).
-- ───────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS usuarios (
  id           INT UNSIGNED     AUTO_INCREMENT PRIMARY KEY,
  nombre       VARCHAR(120)     NOT NULL,
  email        VARCHAR(180)     NOT NULL UNIQUE,
  password_hash VARCHAR(255)    NOT NULL,           -- bcrypt hash
  tipo         ENUM('registrado','cliente','admin')
               NOT NULL DEFAULT 'registrado',
  perfil       ENUM('emprendedor','investigador','universitario','empresa','otro')
               DEFAULT 'emprendedor',
  organizacion VARCHAR(200)     DEFAULT NULL,       -- universidad, empresa, etc.
  telefono     VARCHAR(20)      DEFAULT NULL,
  activo       TINYINT(1)       NOT NULL DEFAULT 1,
  ficha_enviada TINYINT(1)      NOT NULL DEFAULT 0,
  creado_en    DATETIME         NOT NULL DEFAULT CURRENT_TIMESTAMP,
  actualizado_en DATETIME       NOT NULL DEFAULT CURRENT_TIMESTAMP
               ON UPDATE CURRENT_TIMESTAMP,
  INDEX idx_email (email),
  INDEX idx_tipo  (tipo)
) ENGINE=InnoDB;

-- ───────────────────────────────────────────────
-- TABLA: sesiones
-- Un registro por sesión activa. Permite invalidar el acceso
-- desde el servidor (logout real, no solo borrar la cookie).
-- ───────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS sesiones (
  id           INT UNSIGNED     AUTO_INCREMENT PRIMARY KEY,
  usuario_id   INT UNSIGNED     NOT NULL,
  token        VARCHAR(255)     NOT NULL UNIQUE,     -- jti del JWT (uuid)
  user_agent   VARCHAR(255)     DEFAULT NULL,
  expira_en    DATETIME         NOT NULL,
  creado_en    DATETIME         NOT NULL DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (usuario_id) REFERENCES usuarios(id) ON DELETE CASCADE,
  INDEX idx_token (token)
) ENGINE=InnoDB;

-- ───────────────────────────────────────────────
-- TABLA: categorias_biblioteca
-- ───────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS categorias_biblioteca (
  id           INT UNSIGNED     AUTO_INCREMENT PRIMARY KEY,
  slug         VARCHAR(60)      NOT NULL UNIQUE,
  nombre       VARCHAR(120)     NOT NULL,
  icono        VARCHAR(60)      DEFAULT NULL,
  orden        TINYINT UNSIGNED NOT NULL DEFAULT 0
) ENGINE=InnoDB;

-- ───────────────────────────────────────────────
-- TABLA: articulos_biblioteca
-- ───────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS articulos_biblioteca (
  id             INT UNSIGNED   AUTO_INCREMENT PRIMARY KEY,
  categoria_id   INT UNSIGNED   NOT NULL,
  titulo         VARCHAR(255)   NOT NULL,
  descripcion    TEXT           NOT NULL,
  contenido      LONGTEXT       DEFAULT NULL,
  icono          VARCHAR(60)    DEFAULT NULL,
  tiempo_lectura TINYINT UNSIGNED NOT NULL DEFAULT 5,
  publicado      TINYINT(1)     NOT NULL DEFAULT 1,
  creado_en      DATETIME       NOT NULL DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (categoria_id) REFERENCES categorias_biblioteca(id)
    ON DELETE RESTRICT,
  FULLTEXT INDEX ft_contenido (titulo, descripcion)
) ENGINE=InnoDB;

-- ───────────────────────────────────────────────
-- TABLA: lecturas_articulos   [NUEVA]
-- Registra qué usuario leyó qué artículo. Reemplaza el contador
-- "artículos leídos" que antes vivía solo en localStorage.
-- ───────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS lecturas_articulos (
  id           INT UNSIGNED   AUTO_INCREMENT PRIMARY KEY,
  usuario_id   INT UNSIGNED   NOT NULL,
  articulo_id  INT UNSIGNED   NOT NULL,
  leido_en     DATETIME       NOT NULL DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (usuario_id)  REFERENCES usuarios(id) ON DELETE CASCADE,
  FOREIGN KEY (articulo_id) REFERENCES articulos_biblioteca(id) ON DELETE CASCADE,
  UNIQUE KEY uq_usuario_articulo (usuario_id, articulo_id)
) ENGINE=InnoDB;

-- ───────────────────────────────────────────────
-- TABLA: fichas_orientativas
-- ───────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS fichas_orientativas (
  id             INT UNSIGNED   AUTO_INCREMENT PRIMARY KEY,
  usuario_id     INT UNSIGNED   NOT NULL,
  titulo_proyecto VARCHAR(255)  NOT NULL,
  descripcion    TEXT           NOT NULL,
  sector         VARCHAR(120)   DEFAULT NULL,
  tipo_proteccion ENUM(
    'patente','modelo_utilidad','marca','derecho_autor','no_definido'
  )              DEFAULT 'no_definido',
  nivel_trl      VARCHAR(10)    DEFAULT NULL,
  documentacion  TEXT           DEFAULT NULL,        -- JSON array de docs disponibles
  ya_divulgada   ENUM('si','no','nose') DEFAULT 'nose',
  tiene_socios   ENUM('si','no')  DEFAULT 'no',
  dudas          TEXT           DEFAULT NULL,
  estado         ENUM('pendiente','en_revision','atendida')
               NOT NULL DEFAULT 'pendiente',
  notas_admin    TEXT           DEFAULT NULL,        -- [NUEVO] respuesta interna del admin
  enviada_en     DATETIME       NOT NULL DEFAULT CURRENT_TIMESTAMP,
  actualizada_en DATETIME       NOT NULL DEFAULT CURRENT_TIMESTAMP
               ON UPDATE CURRENT_TIMESTAMP,
  FOREIGN KEY (usuario_id) REFERENCES usuarios(id) ON DELETE CASCADE,
  UNIQUE KEY uq_usuario_ficha (usuario_id),
  INDEX idx_estado (estado)
) ENGINE=InnoDB;

-- ───────────────────────────────────────────────
-- TABLA: proyectos_patente
-- ───────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS proyectos_patente (
  id             INT UNSIGNED   AUTO_INCREMENT PRIMARY KEY,
  usuario_id     INT UNSIGNED   NOT NULL,
  titulo         VARCHAR(255)   NOT NULL,
  numero_expediente VARCHAR(60) DEFAULT NULL,
  tipo_patente   ENUM('invencion','modelo_utilidad','diseno_industrial','otro')
               DEFAULT 'invencion',
  porcentaje_avance TINYINT UNSIGNED NOT NULL DEFAULT 0,
  estado         ENUM('activo','pausado','cerrado','otorgado')
               NOT NULL DEFAULT 'activo',
  fecha_inicio   DATE           NOT NULL,
  fecha_estimada DATE           DEFAULT NULL,
  notas_internas TEXT           DEFAULT NULL,
  creado_en      DATETIME       NOT NULL DEFAULT CURRENT_TIMESTAMP,
  actualizado_en DATETIME       NOT NULL DEFAULT CURRENT_TIMESTAMP
               ON UPDATE CURRENT_TIMESTAMP,
  FOREIGN KEY (usuario_id) REFERENCES usuarios(id) ON DELETE CASCADE,
  INDEX idx_estado (estado)
) ENGINE=InnoDB;

-- ───────────────────────────────────────────────
-- TABLA: fases_proceso (catálogo fijo, editado solo por migraciones)
-- ───────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS fases_proceso (
  id             INT UNSIGNED   AUTO_INCREMENT PRIMARY KEY,
  nombre         VARCHAR(150)   NOT NULL,
  descripcion    TEXT           DEFAULT NULL,
  orden          TINYINT UNSIGNED NOT NULL DEFAULT 0
) ENGINE=InnoDB;

-- ───────────────────────────────────────────────
-- TABLA: seguimiento_fases
-- ───────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS seguimiento_fases (
  id             INT UNSIGNED   AUTO_INCREMENT PRIMARY KEY,
  proyecto_id    INT UNSIGNED   NOT NULL,
  fase_id        INT UNSIGNED   NOT NULL,
  estado         ENUM('pendiente','activo','completado','con_observacion')
               NOT NULL DEFAULT 'pendiente',
  fecha_inicio   DATE           DEFAULT NULL,
  fecha_fin      DATE           DEFAULT NULL,
  nota           TEXT           DEFAULT NULL,
  observacion    TEXT           DEFAULT NULL,
  creado_en      DATETIME       NOT NULL DEFAULT CURRENT_TIMESTAMP,
  actualizado_en DATETIME       NOT NULL DEFAULT CURRENT_TIMESTAMP
               ON UPDATE CURRENT_TIMESTAMP,
  FOREIGN KEY (proyecto_id) REFERENCES proyectos_patente(id) ON DELETE CASCADE,
  FOREIGN KEY (fase_id)    REFERENCES fases_proceso(id) ON DELETE RESTRICT,
  UNIQUE KEY uq_proyecto_fase (proyecto_id, fase_id),
  INDEX idx_estado (estado)
) ENGINE=InnoDB;

-- ───────────────────────────────────────────────
-- TABLA: documentos_proyecto
-- ───────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS documentos_proyecto (
  id             INT UNSIGNED   AUTO_INCREMENT PRIMARY KEY,
  proyecto_id    INT UNSIGNED   NOT NULL,
  nombre         VARCHAR(255)   NOT NULL,
  ruta_archivo   VARCHAR(512)   NOT NULL,
  tipo           VARCHAR(80)    DEFAULT NULL,
  tamano_kb      INT UNSIGNED   DEFAULT NULL,
  subido_por     ENUM('empresa','cliente') DEFAULT 'empresa',
  es_publico_cliente TINYINT(1) NOT NULL DEFAULT 1,
  pendiente      TINYINT(1)     NOT NULL DEFAULT 0,
  creado_en      DATETIME       NOT NULL DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (proyecto_id) REFERENCES proyectos_patente(id) ON DELETE CASCADE,
  INDEX idx_proyecto (proyecto_id)
) ENGINE=InnoDB;

-- ───────────────────────────────────────────────
-- TABLA: alertas_proyecto
-- ───────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS alertas_proyecto (
  id             INT UNSIGNED   AUTO_INCREMENT PRIMARY KEY,
  proyecto_id    INT UNSIGNED   NOT NULL,
  tipo           ENUM('urgente','tasa','observacion','recordatorio','info')
               NOT NULL DEFAULT 'info',
  mensaje        TEXT           NOT NULL,
  fecha_limite   DATE           DEFAULT NULL,
  leida          TINYINT(1)     NOT NULL DEFAULT 0,
  creado_en      DATETIME       NOT NULL DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (proyecto_id) REFERENCES proyectos_patente(id) ON DELETE CASCADE,
  INDEX idx_leida (leida)
) ENGINE=InnoDB;

-- ───────────────────────────────────────────────
-- TABLA: notificaciones
-- ───────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS notificaciones (
  id             INT UNSIGNED   AUTO_INCREMENT PRIMARY KEY,
  usuario_id     INT UNSIGNED   NOT NULL,
  icono          VARCHAR(60)    DEFAULT 'ti-bell',
  mensaje        VARCHAR(255)   NOT NULL,
  detalle        TEXT           DEFAULT NULL,
  leida          TINYINT(1)     NOT NULL DEFAULT 0,
  tipo           ENUM('sistema','proyecto','evento','promocion')
               DEFAULT 'sistema',
  creado_en      DATETIME       NOT NULL DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (usuario_id) REFERENCES usuarios(id) ON DELETE CASCADE,
  INDEX idx_usuario_leida (usuario_id, leida)
) ENGINE=InnoDB;

-- ───────────────────────────────────────────────
-- TABLA: contactos_web
-- ───────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS contactos_web (
  id             INT UNSIGNED   AUTO_INCREMENT PRIMARY KEY,
  nombre         VARCHAR(150)   NOT NULL,
  email          VARCHAR(180)   NOT NULL,
  asunto         VARCHAR(255)   DEFAULT NULL,
  mensaje        TEXT           NOT NULL,
  leido          TINYINT(1)     NOT NULL DEFAULT 0,
  creado_en      DATETIME       NOT NULL DEFAULT CURRENT_TIMESTAMP,
  INDEX idx_leido (leido)
) ENGINE=InnoDB;

-- ───────────────────────────────────────────────
-- TABLA: contenido_publico   [NUEVA]
-- Almacén clave→JSON para los bloques editables del sitio público
-- (hero, servicios, nosotros, estadísticas, aliados, contacto).
-- El admin edita estos valores; el sitio público los consume.
-- ───────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS contenido_publico (
  clave          VARCHAR(80)    NOT NULL PRIMARY KEY,
  valor          LONGTEXT       NOT NULL,             -- JSON
  actualizado_en DATETIME       NOT NULL DEFAULT CURRENT_TIMESTAMP
               ON UPDATE CURRENT_TIMESTAMP
) ENGINE=InnoDB;

-- ───────────────────────────────────────────────
-- TABLA: faqs   [NUEVA]
-- ───────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS faqs (
  id         INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  pregunta   VARCHAR(255) NOT NULL,
  respuesta  TEXT         NOT NULL,
  orden      TINYINT UNSIGNED NOT NULL DEFAULT 0,
  publicado  TINYINT(1)   NOT NULL DEFAULT 1
) ENGINE=InnoDB;

-- ───────────────────────────────────────────────
-- TABLA: patentes_destacadas   [NUEVA]
-- Reemplaza las 3 tarjetas de video fijas de la sección "Patentes
-- otorgadas" por contenido editable desde el panel admin.
-- ───────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS patentes_destacadas (
  id          INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  titulo      VARCHAR(200) NOT NULL,
  descripcion VARCHAR(255) DEFAULT NULL,
  video_url   VARCHAR(500) DEFAULT NULL,
  orden       TINYINT UNSIGNED NOT NULL DEFAULT 0,
  publicado   TINYINT(1)   NOT NULL DEFAULT 1
) ENGINE=InnoDB;


-- ═══════════════════════════════════════════════
-- DATOS INICIALES
-- ═══════════════════════════════════════════════

-- Categorías de biblioteca
INSERT INTO categorias_biblioteca (slug, nombre, icono, orden) VALUES
  ('fundamentos',  'Fundamentos',         'ti-book',           1),
  ('proceso',      'El proceso',           'ti-timeline',       2),
  ('tipos',        'Tipos de protección', 'ti-certificate',    3),
  ('errores',      'Errores comunes',      'ti-alert-triangle', 4);

-- Fases estándar del proceso de patentamiento
INSERT INTO fases_proceso (nombre, descripcion, orden) VALUES
  ('Diagnóstico de patentabilidad',  'Evaluación técnica de novedad, nivel inventivo y aplicación industrial.', 1),
  ('Redacción del documento técnico','Elaboración de descripción, antecedentes, reivindicaciones y dibujos.',  2),
  ('Modelado 3D del prototipo',       'Representación digital del invento para reforzar la descripción técnica.',3),
  ('Preparación y revisión final',    'Revisión integral del expediente antes de la presentación oficial.',     4),
  ('Presentación ante INDECOPI',      'Presentación formal de la solicitud y obtención del número de expediente.',5),
  ('Examen de forma',                 'INDECOPI verifica que la solicitud cumple los requisitos formales.',     6),
  ('Publicación en Gaceta Oficial',   'La solicitud es publicada para el período de oposición de terceros.',   7),
  ('Examen de fondo',                 'INDECOPI evalúa la novedad y nivel inventivo de la invención.',         8),
  ('Resolución final',                'INDECOPI emite la resolución concediendo o denegando la patente.',      9);

-- Artículos de biblioteca (muestra)
INSERT INTO articulos_biblioteca (categoria_id, titulo, descripcion, icono, tiempo_lectura) VALUES
  (1, '¿Qué es una patente de invención?',
      'Conoce los requisitos legales de novedad, nivel inventivo y aplicación industrial.',
      'ti-bulb', 8),
  (1, 'Diferencias: Patente vs Modelo de Utilidad',
      'Aprende cuándo corresponde solicitar cada tipo de protección y sus alcances.',
      'ti-file-description', 6),
  (4, 'Cómo NO arruinar tu novedad',
      'Exposición pública prematura, publicaciones y ferias: errores que invalidan una patente.',
      'ti-alert-triangle', 10),
  (2, 'El proceso de patentamiento en Perú (INDECOPI)',
      'Fases del trámite, plazos estimados y costos de las tasas oficiales actualizadas.',
      'ti-timeline', 12),
  (2, 'Cómo redactar las reivindicaciones de una patente',
      'La parte más crítica del documento técnico: qué proteger y cómo formularlo.',
      'ti-edit', 15),
  (3, 'Marcas, derechos de autor y diseños industriales',
      'Cuándo una creación no necesita patente sino otro tipo de propiedad intelectual.',
      'ti-certificate', 9),
  (3, 'Software e IA: ¿se puede patentar?',
      'El tratamiento legal del software en Perú y las alternativas de protección disponibles.',
      'ti-cpu', 11),
  (4, 'Sociedades de inventores: problemas de titularidad',
      'Cómo definir correctamente la titularidad cuando varios colaboradores participan.',
      'ti-users', 7);

-- FAQ (contenido ya existente en el sitio, ahora editable)
INSERT INTO faqs (pregunta, respuesta, orden, publicado) VALUES
  ('¿Cuánto tiempo toma patentar una invención?',
   'El proceso puede tomar entre 2 a 4 años dependiendo del tipo de patente y la carga de INDECOPI. Nosotros acompañamos todo el proceso para hacerlo lo más ágil posible.', 1, 1),
  ('¿Qué necesito para iniciar el proceso?',
   'Solo necesitas una descripción de tu invención y una reunión inicial con nuestro equipo. Nosotros nos encargamos del resto: diagnóstico, redacción, trámites y seguimiento.', 2, 1),
  ('¿Trabajan con proyectos universitarios?',
   'Sí, trabajamos directamente con universidades, grupos de investigación y tesistas que deseen proteger sus desarrollos tecnológicos.', 3, 1),
  ('¿Mi idea puede patentarse si ya existe algo parecido?',
   'Puede ser patentable si tiene características nuevas y distintas. El diagnóstico de patentabilidad que realizamos evalúa exactamente eso.', 4, 1),
  ('¿Cuánto cuesta el servicio?',
   'El costo varía según el tipo y complejidad de la patente. Ofrecemos una consulta inicial gratuita para evaluar tu caso y darte un presupuesto personalizado.', 5, 1);

-- Patentes destacadas (placeholders ya existentes en el sitio, ahora editables)
INSERT INTO patentes_destacadas (titulo, descripcion, video_url, orden, publicado) VALUES
  ('Proyecto #1', 'Video explosión 3D', NULL, 1, 1),
  ('Proyecto #2', 'Video explosión 3D', NULL, 2, 1),
  ('Proyecto #3', 'Video explosión 3D', NULL, 3, 1);

-- Contenido público editable (texto ya existente en el sitio, movido a BD)
INSERT INTO contenido_publico (clave, valor) VALUES
('hero', JSON_OBJECT(
  'eyebrow', 'Consultoría en propiedad intelectual',
  'tituloLinea1', 'Protege lo que tu mente crea.',
  'tituloAccent', 'Patenta tu innovación.',
  'descripcion', 'Diagnóstico, redacción y seguimiento de patentes para universidades, emprendedores e inventores en todo el Perú.'
)),
('servicios', JSON_OBJECT(
  'tag', 'Servicios',
  'titulo', '¿Qué hacemos por ti?',
  'subtitulo', 'Consultoría integral en propiedad intelectual, desde el diagnóstico inicial hasta la obtención de tu patente.',
  'items', JSON_ARRAY(
    JSON_OBJECT('icono','ti-stethoscope','titulo','Diagnóstico de patentabilidad','descripcion','Evaluamos si tu invención cumple los requisitos de novedad, nivel inventivo y aplicación industrial antes de iniciar el proceso formal.'),
    JSON_OBJECT('icono','ti-file-description','titulo','Redacción de patentes','descripcion','Elaboramos el documento técnico, informe de viabilidad, memoria descriptiva y reivindicaciones con rigor profesional.'),
    JSON_OBJECT('icono','ti-timeline','titulo','Seguimiento de solicitud','descripcion','Acompañamiento completo en cada etapa del proceso ante INDECOPI hasta la obtención de tu patente.')
  )
)),
('nosotros', JSON_OBJECT(
  'tag', 'Sobre nosotros',
  'titulo', 'Innovación que protege ideas reales',
  'descripcion', 'Somos una consultora especializada en propiedad intelectual. Acompañamos a emprendedores, investigadores y universidades en el proceso de patentar sus inventos con rigor técnico y compromiso total.'
)),
('proceso', JSON_OBJECT(
  'tag', 'Proceso',
  'titulo', '¿Cómo trabajamos?',
  'subtitulo', 'Un proceso claro y transparente desde el primer contacto hasta la patente en tus manos.',
  'pasos', JSON_ARRAY(
    JSON_OBJECT('numero','1','titulo','Consulta inicial','descripcion','Analizamos tu invención y respondemos tus dudas.'),
    JSON_OBJECT('numero','2','titulo','Diagnóstico','descripcion','Evaluamos la viabilidad y novedad de tu idea.'),
    JSON_OBJECT('numero','3','titulo','Redacción','descripcion','Elaboramos toda la documentación técnica.'),
    JSON_OBJECT('numero','4','titulo','Seguimiento','descripcion','Gestionamos el proceso hasta obtener la patente.')
  )
)),
('patentes_seccion', JSON_OBJECT(
  'tag', 'Patentes otorgadas',
  'titulo', 'Proyectos que protegimos',
  'subtitulo', 'Cada patente representa una historia de innovación. Aquí algunos proyectos con modelado 3D incluido.'
)),
('estadisticas', JSON_ARRAY(
  JSON_OBJECT('valor',50,'etiqueta','Patentes otorgadas','estilo','accent'),
  JSON_OBJECT('valor',8,'etiqueta','Años de experiencia','estilo','light'),
  JSON_OBJECT('valor',100,'etiqueta','% de compromiso','estilo','accent'),
  JSON_OBJECT('valor',15,'etiqueta','Universidades aliadas','estilo','light')
)),
('aliados', JSON_ARRAY(
  'UNMSM','PUCP','UNI','INDECOPI','Startup Innovadora','CONCYTEC','USMP','UNHEVAL','Empresa Tech A'
)),
('contacto_info', JSON_OBJECT(
  'email', 'contacto@researchinnovation.com',
  'telefono', '+51 900 000 000',
  'whatsapp', '51900000000',
  'direccion', 'Huánuco, Perú',
  'linkedin', 'Research & Innovation'
));

-- ═══════════════════════════════════════════════
-- CUENTAS INICIALES
-- Contraseñas documentadas en INSTALACION.md — CAMBIAR en producción.
-- ═══════════════════════════════════════════════

-- Cuenta admin única (reemplaza los 4 roles funcionales del organigrama)
INSERT INTO usuarios (nombre, email, password_hash, tipo, activo) VALUES
  ('Administrador Research & Innovation', 'admin@researchinnovation.com',
   '$2a$12$95fP8Icq4VzwfQoE0MU34OakKEism2kn8zFocUlKMbJxpqBFfK/L2',
   'admin', 1);
   -- contraseña: Admin2026!

-- Usuarios de demostración
INSERT INTO usuarios (nombre, email, password_hash, tipo, perfil, organizacion, ficha_enviada) VALUES
  ('Demo Cliente', 'cliente@demo.com',
   '$2a$12$Sasn8jI14o6o0KE7R05cQuukSb2LCUwypx8p1OWczYLp6dBy/LUly',
   'cliente', 'investigador', 'UNHEVAL', 1),
   -- contraseña: Cliente2026!
  ('Demo Usuario', 'usuario@demo.com',
   '$2a$12$b6hmehECC0ccpjCTZYYh5eKduA1MwwTVyvI8JFtH58Yj059JsTiqa',
   'registrado', 'universitario', 'UNHEVAL', 0);
   -- contraseña: Usuario2026!

-- Ficha orientativa enviada por el usuario demo cliente
INSERT INTO fichas_orientativas
  (usuario_id, titulo_proyecto, descripcion, sector, tipo_proteccion, nivel_trl, documentacion, ya_divulgada, tiene_socios, dudas, estado)
VALUES
  (2, 'Sistema de filtración de agua mediante nanomateriales',
      'Dispositivo de filtración que utiliza una membrana con nanomateriales para remover contaminantes de agua a nivel comunitario.',
      'Tecnología ambiental', 'patente', '4',
      JSON_ARRAY('boceto','memoria_descriptiva'), 'no', 'no',
      '¿Cuánto tiempo toma el examen de fondo en INDECOPI?', 'atendida');

-- Proyecto de demostración para el cliente (usuario_id=2 es 'Demo Cliente')
INSERT INTO proyectos_patente (usuario_id, titulo, numero_expediente, tipo_patente, porcentaje_avance, estado, fecha_inicio) VALUES
  (2, 'Sistema de filtración de agua mediante nanomateriales', '000892-2025/DIN', 'invencion', 55, 'activo', '2025-03-12');

-- Seguimiento de fases del proyecto demo
INSERT INTO seguimiento_fases (proyecto_id, fase_id, estado, fecha_inicio, fecha_fin, nota) VALUES
  (1, 1, 'completado',    '2025-03-12', '2025-03-14', 'Invención evaluada como patentable. Novedad y nivel inventivo confirmados.'),
  (1, 2, 'completado',    '2025-03-15', '2025-03-28', 'Documento técnico completado: descripción, antecedentes, reivindicaciones y dibujos.'),
  (1, 3, 'completado',    '2025-03-29', '2025-04-10', 'Modelo tridimensional elaborado e integrado al expediente técnico.'),
  (1, 4, 'completado',    '2025-04-11', '2025-04-20', 'Expediente revisado y validado por el especialista senior.'),
  (1, 5, 'con_observacion','2025-04-21', '2025-05-05', 'Solicitud presentada. Número de expediente: 000892-2025/DIN.'),
  (1, 6, 'pendiente',     NULL,         NULL,          NULL),
  (1, 7, 'pendiente',     NULL,         NULL,          NULL),
  (1, 8, 'pendiente',     NULL,         NULL,          NULL),
  (1, 9, 'pendiente',     NULL,         NULL,          NULL);

UPDATE seguimiento_fases
SET observacion = 'Se requiere subsanar observación formal: adjuntar poder de representación notarial antes del 18 jun 2025.'
WHERE proyecto_id = 1 AND fase_id = 5;

-- Documentos del proyecto demo (rutas relativas a backend/uploads/)
INSERT INTO documentos_proyecto (proyecto_id, nombre, ruta_archivo, tipo, tamano_kb, subido_por, es_publico_cliente, pendiente) VALUES
  (1, 'Documento técnico v2.pdf',     'seed/doc_tecnico_v2.pdf',     'pdf', 1,    'empresa', 1, 0),
  (1, 'Solicitud INDECOPI.pdf',       'seed/solicitud_indecopi.pdf', 'pdf', 1,    'empresa', 1, 0),
  (1, 'Poder de representación.pdf',  'seed/pendiente.pdf',          'pdf', 0,    'cliente', 1, 1);

-- Alertas del proyecto demo
INSERT INTO alertas_proyecto (proyecto_id, tipo, mensaje, fecha_limite) VALUES
  (1, 'urgente',     'Adjuntar poder notarial antes del 18 jun 2025.',     '2025-06-18'),
  (1, 'recordatorio','Próximo seguimiento programado: 25 jun 2025.',       '2025-06-25'),
  (1, 'tasa',        'Tasa de mantenimiento año 1: vence en agosto 2025.', '2025-08-01');

-- Notificaciones del usuario demo cliente (usuario_id=2)
INSERT INTO notificaciones (usuario_id, icono, mensaje, detalle, leida, tipo) VALUES
  (2, 'ti-alert-triangle', 'Acción requerida: adjuntar poder notarial',
      'Tienes hasta el 18 jun 2025 para subsanar la observación de forma.', 0, 'proyecto'),
  (2, 'ti-check',          'Solicitud presentada ante INDECOPI',
      'Tu expediente fue registrado con el N° 000892-2025/DIN.', 0, 'proyecto'),
  (2, 'ti-calendar',       'Evento: Taller de Propiedad Intelectual',
      'Research & Innovation organiza un taller gratuito el 28 jun 2025.', 1, 'evento'),
  (2, 'ti-star',           'Modelado 3D completado',
      'El modelo tridimensional de tu prototipo ha sido integrado al expediente.', 1, 'proyecto');
