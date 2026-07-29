# Seguimiento de Logística — Fase 1

Esqueleto de la app: login (2 usuarios) + subida diaria de los 2 archivos Excel +
guardado del historial de estatus (para saber, día a día, desde cuándo tiene
cada orden su estatus actual).

## Qué incluye esta primera versión

- Página de login (`/login`) usando Supabase Auth.
- Página de subida diaria (`/upload`), protegida — pide login.
- Al subir los 2 archivos, se leen en el navegador, y se envían a
  `/api/process-daily`, que:
  - Compara el ESTATUS de cada orden contra el que tenía guardado.
  - Si cambió: actualiza la fecha desde la que tiene ese estatus a la
    FECHA DE REPORTE de hoy.
  - Si no cambió: mantiene la fecha que ya tenía (sigue acumulando días).
  - Guarda también los datos de producto en una tabla aparte.
- Te muestra un resumen: cuántas órdenes son nuevas, cuántas cambiaron de
  estatus hoy, y cuántas siguen igual.

Todavía **no** incluye: el dashboard visual (semáforo, pestañas de estatus,
transportadoras, dinero, producto), ni las notificaciones de WhatsApp. Eso es
la Fase 2 en adelante.

## Cómo desplegarlo (paso a paso)

### 1. Subir el código a GitHub

1. Entra a github.com, haz clic en el botón verde **"New"** (o el símbolo **+**
   arriba a la derecha → "New repository").
2. Ponle un nombre, por ejemplo `seguimiento-logistica`. Déjalo en **Private**.
   No marques ninguna casilla de "Add README" (ya viene uno en este proyecto).
3. Clic en **"Create repository"**.
4. En la página que aparece, busca el enlace **"uploading an existing file"**
   (o ve a la pestaña "Add file" → "Upload files").
5. Arrastra **todo el contenido** de la carpeta que te compartí (todos los
   archivos y carpetas, incluido `src/`, `package.json`, etc. — **menos** la
   carpeta `node_modules` si la ves, esa no hace falta subirla).
6. Abajo, en "Commit changes", clic en **"Commit changes"** para confirmar.

### 2. Crear las tablas en Supabase

1. Entra a tu proyecto en supabase.com.
2. En el menú de la izquierda, busca **"SQL Editor"**.
3. Clic en **"New query"**.
4. Abre el archivo `supabase_schema.sql` (que viene en este proyecto), copia
   **todo** su contenido, y pégalo ahí.
5. Clic en **"Run"** (o Ctrl+Enter). Debe decir "Success. No rows returned".

### 3. Crear tus 2 usuarios (Administrador y Usuario)

1. En Supabase, ve a **Authentication** → **Users**.
2. Clic en **"Add user"** → **"Create new user"**.
3. Pon tu correo y una contraseña para ti (Administrador). Marca
   "Auto Confirm User" para no tener que verificar el correo.
4. Repite el proceso para crear el segundo usuario ("Usuario").

### 4. Obtener las 3 claves que necesita la app

1. En Supabase, ve a **Project Settings** (ícono de engranaje) → **API**.
2. Copia estos 3 valores, los vas a necesitar en el siguiente paso:
   - **Project URL**
   - **anon public** key
   - **service_role** key (¡esta es secreta, no la compartas ni la subas a GitHub!)

### 5. Desplegar en Vercel

1. Entra a vercel.com, clic en **"Add New..."** → **"Project"**.
2. Elige **"Import"** el repositorio `seguimiento-logistica` que acabas de subir
   a GitHub (Vercel te va a pedir autorizar acceso a tus repos si es la primera
   vez).
3. Antes de darle a "Deploy", despliega la sección **"Environment Variables"**
   y agrega estas 3, con los valores que copiaste de Supabase:
   - `NEXT_PUBLIC_SUPABASE_URL`
   - `NEXT_PUBLIC_SUPABASE_ANON_KEY`
   - `SUPABASE_SERVICE_ROLE_KEY`
4. Clic en **"Deploy"**. Espera 1-2 minutos.
5. Cuando termine, Vercel te da una URL (algo como
   `seguimiento-logistica.vercel.app`) — esa es tu app, ya funcionando.

### 6. Probarla

1. Entra a la URL que te dio Vercel.
2. Inicia sesión con el correo/contraseña de Administrador que creaste en
   Supabase.
3. Sube tus 2 archivos Excel del día y dale a "Procesar y guardar historial".
4. Deberías ver el resumen con los números de órdenes procesadas.

Si algo falla en cualquier paso, copia el mensaje de error exacto y lo revisamos.
