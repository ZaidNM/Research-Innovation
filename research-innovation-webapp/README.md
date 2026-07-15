# Research & Innovation SAC — Plataforma web

Sistema web de captación, orientación y seguimiento de clientes para servicios
de patentes. Proyecto del curso *Herramientas Gráficas para Tecnologías de la
Información* — UNHEVAL, 2026.

Este paquete contiene la plataforma **completa y funcional**: sitio público,
área de usuario, panel de administración y backend con base de datos real.
Ya no es una maqueta — cada botón que antes mostraba "función disponible en
la versión final" ahora funciona de verdad.

➡️ **Para ponerlo en marcha, sigue [`INSTALACION.md`](./INSTALACION.md).**
➡️ **Para entender las decisiones de diseño, lee [`ARQUITECTURA.md`](./ARQUITECTURA.md).**

## Qué incluye

- **Sitio público** con contenido editable desde el panel admin (hero,
  servicios, FAQ, aliados, patentes destacadas, datos de contacto).
- **Área de usuario**: biblioteca virtual con seguimiento real de lectura,
  ficha de orientación, panel de seguimiento de patente con línea de tiempo,
  documentos descargables/subibles, y notificaciones reales.
- **Panel de administración** (`/admin`, rol único `admin`): gestión de
  usuarios, bandeja de fichas de orientación, creación y seguimiento de
  proyectos de patente por cliente (con notificación automática al cambiar
  de fase), carga de documentos, biblioteca virtual (CRUD), contenido del
  sitio público, FAQ, patentes destacadas, bandeja de mensajes de contacto,
  y envío de notificaciones individuales o masivas.
- **Backend REST** en Node.js/Express con autenticación JWT + cookie
  httpOnly, contraseñas con bcrypt, control de acceso por rol, carga de
  archivos validada, y base de datos MySQL/MariaDB.

## Stack técnico

| Capa | Tecnología |
|---|---|
| Backend | Node.js 18+, Express 4 |
| Base de datos | MySQL 8+ / MariaDB 10.6+ |
| Autenticación | JWT (jsonwebtoken) + bcryptjs + cookies httpOnly |
| Carga de archivos | multer |
| Frontend | HTML, CSS y JavaScript nativos (sin build step, sin frameworks) |

## Cuentas de demostración

| Rol | Correo | Contraseña |
|---|---|---|
| Administrador | `admin@researchinnovation.com` | `Admin2026!` |
| Cliente activo (con proyecto en curso) | `cliente@demo.com` | `Cliente2026!` |
| Usuario registrado | `usuario@demo.com` | `Usuario2026!` |

**Cambia estas contraseñas antes de cualquier uso más allá de la demo o
sustentación del curso.**

## Inicio rápido

```bash
# 1. Base de datos
mysql -u root --default-character-set=utf8mb4 < database/schema.sql

# 2. Backend
cd backend
cp .env.example .env    # y edita los valores, ver INSTALACION.md
npm install
npm start

# 3. Abrir en el navegador
#    Sitio público:  http://localhost:3000
#    Panel admin:     http://localhost:3000/admin
```

Instrucciones detalladas, solución de problemas comunes y opciones para
Windows (XAMPP) en [`INSTALACION.md`](./INSTALACION.md).
