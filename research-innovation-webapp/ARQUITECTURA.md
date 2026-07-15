# Arquitectura del sistema — Research & Innovation SAC

Este documento describe el diseño técnico del backend y el panel de administración
que completan la plataforma. Complementa (no reemplaza) el Capítulo III del
documento del proyecto, que cubre el modelado BPMN del proceso de negocio.

---

## 1. Visión general

Antes de este trabajo, el sistema era una maqueta: todo el "backend" vivía en
`localStorage` del navegador. No existía servidor, base de datos real, ni forma
de que la empresa administrara nada. La arquitectura que se implementa aquí
resuelve exactamente eso, con un **monolito simple de tres capas**, deliberadamente
sin microservicios ni frameworks pesados — apropiado para el tamaño del proyecto
y para que sea mantenible por el propio equipo de estudiantes.

```
┌──────────────────────────────────────────────────────────────────┐
│                         NAVEGADOR (cliente)                       │
│                                                                    │
│   Sitio público + área de usuario   |   Panel de administración   │
│   (public/index.html, app.js)       |   (admin/index.html, .js)   │
└───────────────────┬─────────────────────────────┬────────────────┘
                    │  fetch() + cookie httpOnly    │
                    ▼                                ▼
┌──────────────────────────────────────────────────────────────────┐
│                   SERVIDOR NODE.JS / EXPRESS                      │
│                         (un solo proceso)                         │
│                                                                    │
│  Middlewares globales: helmet, morgan, cookie-parser, JSON body   │
│  ┌──────────────────────────────────────────────────────────┐    │
│  │  /api/auth        registro, login, logout, sesión actual  │    │
│  │  /api/public       contenido editable, FAQ, contacto      │    │
│  │  /api/biblioteca   categorías y artículos (usuario auth)  │    │
│  │  /api/ficha        ficha de orientación (usuario auth)    │    │
│  │  /api/proyectos    seguimiento propio (rol cliente)       │    │
│  │  /api/notificaciones                                      │    │
│  │  /api/admin/*      TODO lo administrativo (rol admin)     │    │
│  └──────────────────────────────────────────────────────────┘    │
│  Archivos estáticos: /  → public/   /admin → admin/                │
│  Archivos subidos:   uploads/proyectos/<id>/... (multer)          │
└───────────────────────────────┬──────────────────────────────────┘
                                 │ mysql2 (pool de conexiones)
                                 ▼
                    ┌───────────────────────────┐
                    │   MySQL / MariaDB           │
                    │   base de datos ri_patentes │
                    └───────────────────────────┘
```

**Por qué un monolito de un solo proceso:** sirve la API, el sitio público y el
panel admin desde el mismo servidor Express en el mismo puerto. Esto elimina
problemas de CORS, simplifica el despliegue a "un solo `npm start`" y es
apropiado para el volumen de tráfico que tendrá esta plataforma. Si el
proyecto creciera de forma significativa, el primer paso natural de escalado
sería separar el servido de archivos estáticos a un CDN — no dividir en
microservicios.

**Por qué SQL con consultas explícitas y no un ORM:** cada función de
`src/models/*.js` ejecuta una consulta parametrizada visible y auditable.
Para un proyecto académico que debe sustentarse oralmente, esto es más
defendible que la "magia" de un ORM — el docente puede pedir "muéstrame la
consulta" y está justo ahí, y corresponde 1 a 1 con el `database.sql` ya
diseñado y documentado en el Capítulo III.

---

## 2. Modelo de roles (modificado según lo solicitado)

El organigrama funcional de la empresa (Gerencia, Especialista en patentes,
Modelador 3D, Gestión comercial) **no se traduce en 4 roles de sistema**. Se
implementa como **un único rol `admin`**, sin distinción interna de permisos:
quien tenga esa cuenta ve y gestiona todo el panel administrativo.

| `tipo` en `usuarios` | Alcance |
|---|---|
| `registrado` | Biblioteca virtual, ficha de orientación |
| `cliente` | Todo lo de `registrado` + panel de seguimiento de su propia patente |
| `admin` | Panel `/admin` completo: usuarios, fichas, proyectos/seguimiento de **todos** los clientes, contenido del sitio, biblioteca, FAQ, patentes destacadas, mensajes de contacto, envío de notificaciones |

Un usuario pasa de `registrado` a `cliente` **solo cuando el admin le crea un
proyecto** desde el panel (`POST /api/admin/proyectos`). Esto reemplaza el
botón "Demo: activar cliente" que existía en la maqueta original — que
permitía que cualquier visitante se auto-promoviera a cliente con un clic, un
hueco de seguridad real. Ahora la promoción de rol es una acción exclusiva del
admin.

---

## 3. Autenticación y sesiones

- **Contraseñas:** `bcryptjs`, 12 rondas. Nunca se guardan ni se devuelven en texto plano.
- **Token de sesión:** JWT firmado (HS256) guardado en una **cookie httpOnly**
  (`ri_token`) — no en `localStorage`, para reducir la superficie de robo por XSS.
  El JWT incluye `sub` (id de usuario), `tipo` y `jti` (id de sesión).
- **Revocación real:** cada login inserta una fila en la tabla `sesiones` con
  el `jti`. Cada request autenticado verifica que esa fila siga existiendo y no
  haya expirado. Esto es lo que permite un "cerrar sesión" que de verdad
  invalida el acceso del lado servidor, no solo borra la cookie del navegador
  — algo que ninguna versión anterior tenía porque no existía backend.
- **Autorización:** middleware `requireRole('admin')`, `requireRole('cliente','registrado')`,
  etc., aplicado por ruta. `/api/admin/*` completo exige `admin`.
- **Límite de intentos:** `express-rate-limit` en `/auth/login`, `/auth/registro`
  y `/public/contacto` para mitigar fuerza bruta y spam.

---

## 4. Contenido editable del sitio público (lo que pediste como "entorno editable")

Se agregó la tabla `contenido_publico` (clave → JSON) para que el admin edite,
sin tocar código, exactamente el mismo texto que antes estaba escrito a mano en
`index.html`: hero, servicios, sección "nosotros", pasos del proceso,
estadísticas del contador animado, aliados del carrusel y datos de contacto.
A esto se suman tres tablas de contenido estructurado:

- `faqs` — preguntas frecuentes (antes hardcodeadas en el HTML)
- `patentes_destacadas` — las 3 tarjetas de "Patentes otorgadas" con video
- `articulos_biblioteca` / `categorias_biblioteca` — ya existían en el diseño
  original, ahora con CRUD completo desde el panel

El sitio público (`public/app.js`) pide este contenido a la API al cargar y
lo renderiza dinámicamente. Si la API no responde, el HTML conserva el texto
de respaldo original como reserva — el sitio no se rompe.

---

## 5. Seguimiento de patentes (el núcleo del panel admin)

Flujo completo, de punta a punta:

1. Un usuario `registrado` envía su **ficha de orientación** (`POST /api/ficha`).
2. El admin la revisa en la bandeja (`/api/admin/fichas`) y decide iniciar el servicio.
3. El admin crea un **proyecto** para ese usuario (`POST /api/admin/proyectos`).
   Esto, en una sola transacción SQL: crea la fila en `proyectos_patente`, siembra
   las 9 fases del catálogo (`fases_proceso`) en estado `pendiente`, promueve al
   usuario a `cliente`, y le envía una notificación de bienvenida.
4. El admin actualiza el estado de cada fase conforme avanza el trámite real
   (`PATCH /api/admin/proyectos/:id/fases/:faseId`). **Cada cambio de estado
   genera automáticamente una notificación para el cliente** — este es el punto
   que en la maqueta original no existía: antes, cambiar de fase no avisaba a nadie.
5. El admin sube documentos del expediente (`POST /api/admin/proyectos/:id/documentos`,
   con `multer`, validación de extensión y límite de tamaño) y puede marcarlos
   como visibles u ocultos para el cliente.
6. El cliente ve su línea de tiempo, descarga documentos reales, y puede subir
   los que le falten (ej. el poder notarial pendiente) desde su propio panel.

---

## 6. Estructura de carpetas entregada

```
research-innovation/
├── README.md                    ← empezar por aquí
├── INSTALACION.md                ← guía paso a paso para poner todo en marcha
├── ARQUITECTURA.md               ← este documento
├── database/
│   └── schema.sql                ← esquema completo + datos de demostración
├── backend/
│   ├── package.json
│   ├── .env.example
│   ├── src/
│   │   ├── server.js             ← punto de entrada
│   │   ├── app.js                ← configuración de Express
│   │   ├── config/db.js
│   │   ├── middleware/           ← auth, upload, manejo de errores
│   │   ├── models/                ← una función por consulta SQL
│   │   ├── controllers/           ← lógica de cada endpoint
│   │   │   └── admin/             ← controladores exclusivos del panel admin
│   │   └── routes/
│   ├── tests/                     ← scripts para verificar la instalación
│   └── uploads/seed/              ← PDFs de ejemplo del cliente demo
├── public/                        ← sitio público + área de usuario (servido en /)
│   ├── index.html
│   ├── styles.css
│   └── app.js
└── admin/                         ← panel de administración (servido en /admin)
    ├── index.html
    ├── admin.css
    └── admin.js
```

---

## 7. Qué queda deliberadamente fuera de esta entrega

Estas decisiones no son omisiones accidentales — se excluyen por la misma
razón que el Capítulo 1.4.3 del documento del proyecto excluye pasarelas de
pago e integración directa con INDECOPI: son piezas que requieren contratar
un servicio externo (proveedor de correo transaccional, pasarela de pago) que
el equipo no controla ni puede probar de forma autocontenida:

- **Envío real de correos** (verificación de email, recuperación de contraseña
  por correo) — requiere credenciales de un servicio como SendGrid o Amazon SES.
- **Pasarela de pagos** para las alertas de tasas pendientes.
- **Integración por API con la mesa de partes virtual de INDECOPI.**

Todo lo demás que se identificó como faltante en el análisis previo —
backend real, autenticación segura, panel admin, notificaciones y seguimiento
por usuario, carga de archivos, bandeja de contactos y fichas — queda
implementado y probado en esta entrega.
