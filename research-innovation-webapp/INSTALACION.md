# Instalación y puesta en marcha

Guía paso a paso para dejar la plataforma corriendo en tu computadora (Windows,
mac o Linux). No necesitas experiencia previa con Node.js o MySQL para seguirla.

---

## 1. Requisitos previos

Necesitas instalar dos cosas antes de empezar:

### 1.1. Node.js (versión 18 o superior)

Descarga el instalador desde **https://nodejs.org** (elige la versión "LTS") y
ejecútalo con las opciones por defecto. Para confirmar que quedó instalado,
abre una terminal (`cmd`, PowerShell, o Terminal en Mac/Linux) y ejecuta:

```bash
node --version
npm --version
```

Deberías ver algo como `v18.x.x` o superior (esta plataforma se probó con `v22`).

### 1.2. MySQL o MariaDB

Elige **una** de estas tres opciones:

**Opción A — XAMPP (recomendada si ya lo usas para el curso, Windows/Mac)**
1. Descarga XAMPP desde https://www.apachefriends.org e instálalo.
2. Abre el "Panel de control de XAMPP" e inicia el módulo **MySQL** (no necesitas
   iniciar Apache; el propio backend de Node.js hace esa función).
3. El usuario por defecto es `root` sin contraseña — es lo que asume este
   proyecto en `.env.example`.

**Opción B — MySQL Community Server (Windows/Mac/Linux)**
1. Descarga desde https://dev.mysql.com/downloads/mysql/ e instálalo.
2. Durante la instalación, define una contraseña para el usuario `root` y
   apúntala — la necesitarás en el paso 3.

**Opción C — MariaDB nativo (Linux)**
```bash
sudo apt install mariadb-server
sudo service mariadb start
```

---

## 2. Crear la base de datos

Abre una terminal en la carpeta del proyecto (donde está la carpeta `database/`)
y ejecuta:

```bash
mysql -u root -p --default-character-set=utf8mb4 < database/schema.sql
```

(Si tu MySQL no tiene contraseña para `root`, como en XAMPP por defecto, quita
`-p` del comando.)

> **⚠️ Importante — no te saltes `--default-character-set=utf8mb4`.**
> El archivo `schema.sql` contiene tildes y eñes en español. Sin este parámetro,
> el cliente de MySQL puede interpretar el archivo con una codificación
> incorrecta y los textos quedarán corruptos en la base de datos (por ejemplo
> "ó" se guarda como "Ã³"). Si usas **phpMyAdmin** en vez de la línea de
> comandos, asegúrate de que la codificación de importación esté configurada
> en `utf8mb4` antes de subir el archivo.

Esto crea la base de datos `ri_patentes` con todas las tablas, las cuentas de
demostración y datos de ejemplo ya cargados (ver tabla de credenciales en el
`README.md`).

**Verifica que funcionó:**
```bash
mysql -u root -p -e "USE ri_patentes; SELECT nombre, email, tipo FROM usuarios;"
```
Deberías ver 3 filas: el administrador y las 2 cuentas demo.

---

## 3. Configurar el backend

```bash
cd backend
cp .env.example .env
```

(En Windows con `cmd`, usa `copy .env.example .env` en vez de `cp`.)

Abre el archivo `.env` recién creado con cualquier editor de texto y ajusta:

```ini
DB_USER=root
DB_PASSWORD=            # tu contraseña de MySQL, o vacío si usas XAMPP por defecto
JWT_SECRET=cambia_este_valor_por_uno_generado_aleatoriamente
```

Para generar un `JWT_SECRET` seguro, ejecuta:
```bash
node -e "console.log(require('crypto').randomBytes(48).toString('hex'))"
```
Copia el resultado y pégalo como valor de `JWT_SECRET` en `.env`.

El resto de valores por defecto en `.env.example` ya están listos para
desarrollo local — no necesitas tocarlos salvo que algo en tu máquina use el
puerto 3000 o el puerto 3306 para otra cosa.

---

## 4. Instalar dependencias y arrancar el servidor

Todavía dentro de la carpeta `backend/`:

```bash
npm install
npm start
```

Si todo está bien configurado, verás en la terminal:

```
[arranque] Conexión a MySQL/MariaDB verificada correctamente.

  Research & Innovation — servidor activo
  Sitio público:     http://localhost:3000
  Panel admin:       http://localhost:3000/admin
  API:               http://localhost:3000/api
  Entorno:           development
```

Deja esa terminal abierta — ahí sigue corriendo el servidor. Para detenerlo,
presiona `Ctrl + C`.

> Durante el desarrollo, puedes usar `npm run dev` en vez de `npm start`: reinicia
> el servidor automáticamente cada vez que guardas un cambio en el código.

---

## 5. Abrir la plataforma

Con el servidor corriendo, abre tu navegador en:

- **Sitio público:** http://localhost:3000
- **Panel de administración:** http://localhost:3000/admin — ingresa con
  `admin@researchinnovation.com` / `Admin2026!`

Para probar como usuario, ve a "Iniciar sesión" en el sitio público y usa
cualquiera de las cuentas demo de la tabla en el `README.md`, o crea una
cuenta nueva desde "Registrarse".

---

## 6. Verificar que todo funciona correctamente (opcional pero recomendado)

Con el servidor corriendo, abre una **segunda terminal**, ve a `backend/` y
ejecuta:

```bash
node tests/test-public-api.mjs
node tests/test-admin-api.mjs
```

Cada script simula, contra tu propio servidor, exactamente los mismos pasos
que hace la interfaz (iniciar sesión, enviar una ficha, crear un proyecto,
subir un documento, etc.) e imprime `✓` en cada verificación. Si ves
`✅ TODOS LOS CONTRATOS... FUERON VALIDADOS`, tu instalación está correcta.

---

## 7. Solución de problemas comunes

**`[arranque] No se pudo conectar a la base de datos`**
El servidor de MySQL/MariaDB no está corriendo, o los datos en `.env`
(`DB_USER`, `DB_PASSWORD`, `DB_NAME`) no coinciden con tu instalación.
Verifica que MySQL esté iniciado (en XAMPP, revisa que diga "Running" en
verde junto a MySQL).

**`Error: listen EADDRINUSE: address already in use :::3000`**
Algo más está usando el puerto 3000. Cambia `PORT=3000` a `PORT=3001` (o
cualquier otro puerto libre) en tu `.env` y vuelve a ejecutar `npm start`.

**Los acentos se ven mal (`Ã³` en vez de `ó`) en el sitio o en el panel admin**
La base de datos se importó sin forzar `utf8mb4` (ver la advertencia del
paso 2). Soluciónalo así:
```bash
mysql -u root -p -e "DROP DATABASE ri_patentes;"
mysql -u root -p --default-character-set=utf8mb4 < database/schema.sql
```

**`npm install` falla o se queda colgado**
Verifica tu conexión a internet — `npm install` descarga paquetes desde
internet la primera vez. Si estás detrás de un proxy institucional/universitario,
puede que necesites configurar el proxy de npm.

**Subida de archivos falla con "Tipo de archivo no permitido"**
Es intencional: solo se aceptan PDF, DOC/DOCX, imágenes (PNG/JPG/WEBP),
archivos 3D (STL/OBJ/GLB) y ZIP, hasta 20&nbsp;MB. Se puede ajustar en
`backend/src/middleware/upload.js` (constante `EXTENSIONES_PERMITIDAS`) y
`UPLOAD_MAX_MB` en `.env`.

---

## 8. Reiniciar los datos de demostración

Si durante las pruebas modificas o "ensucias" los datos y quieres volver al
estado inicial, simplemente vuelve a importar el esquema (esto borra todo y
recarga los datos de ejemplo originales):

```bash
mysql -u root -p -e "DROP DATABASE IF EXISTS ri_patentes;"
mysql -u root -p --default-character-set=utf8mb4 < database/schema.sql
```

Los archivos que se hayan subido durante las pruebas (carpeta
`backend/uploads/proyectos/`) no se borran automáticamente con este comando;
puedes eliminarlos a mano si quieres limpiar también los archivos físicos.

---

## 9. Notas para un despliegue más allá de la demostración del curso

Esta guía cubre uso local (tu propia computadora). Si en algún momento el
sistema se despliega en un servidor real accesible por internet, como mínimo:

1. Cambia **todas** las contraseñas de las cuentas de demostración y el
   `JWT_SECRET` por valores propios.
2. Define `NODE_ENV=production` en `.env` (activa cookies `secure`, que
   solo viajan por HTTPS).
3. Sirve el sitio detrás de HTTPS (por ejemplo, con un proxy Nginx + Let's
   Encrypt delante de Node.js).
4. Usa una contraseña real y restringida para el usuario de base de datos
   (no `root` sin contraseña).
5. Considera un servicio de backups automáticos de la base de datos.

Estos puntos están fuera del alcance académico del curso (igual que la
integración de pasarelas de pago o la API de INDECOPI, explícitamente
excluidas en el documento del proyecto), pero quedan anotados aquí para
cuando la consultora decida llevar la plataforma a producción real.
