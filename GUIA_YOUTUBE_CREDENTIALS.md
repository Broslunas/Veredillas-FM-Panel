# Guía: Cómo obtener las Credenciales de YouTube API para Veredillas FM

Para que el panel de administración pueda subir vídeos al canal del podcast automáticamente y **sin requerir inicio de sesión manual** cada vez, necesitas obtener 3 valores e incluirlos en tu archivo `.env.local`:

```env
YOUTUBE_CLIENT_ID="tu_client_id.apps.googleusercontent.com"
YOUTUBE_CLIENT_SECRET="tu_client_secret"
YOUTUBE_REFRESH_TOKEN="tu_refresh_token"
```

A continuación te explicamos paso a paso cómo obtenerlos en menos de 5 minutos.

---

## Paso 1: Crear / Seleccionar Proyecto en Google Cloud Console

1. Entra en **[Google Cloud Console](https://console.cloud.google.com/)** e inicia sesión con una cuenta de Google.
2. En la barra superior, haz clic en el selector de proyectos y pulsa **"Proyecto Nuevo"** (New Project).
3. Nómbralo como **`Veredillas FM Panel`** y haz clic en **Crear**.

---

## Paso 2: Activar la API de YouTube

1. En el menú lateral izquierdo, ve a **APIs y servicios > Biblioteca** (Library).
2. En el buscador escribe **`YouTube Data API v3`**.
3. Haz clic en **YouTube Data API v3** y pulsa el botón azul **Habilitar** (Enable).

---

## Paso 3: Configurar la Pantalla de Consentimiento de OAuth

1. En el menú de la izquierda, ve a **APIs y servicios > Pantalla de consentimiento de OAuth** (OAuth consent screen).
2. Selecciona **Usuario Externo** (External) y haz clic en **Crear**.
3. Completa los datos básicos:
   - **Nombre de la aplicación**: `Veredillas FM Admin`
   - **Correo electrónico de soporte**: Tu email
   - **Datos de contacto del desarrollador**: Tu email
4. Haz clic en **Guardar y continuar**.
5. En la sección **Scopes (Alcances)**, haz clic en **Añadir o quitar alcances** y busca/añade:
   - `https://www.googleapis.com/auth/youtube`
   - `https://www.googleapis.com/auth/youtube.upload`
   - `https://www.googleapis.com/auth/youtube.readonly`
   - `https://www.googleapis.com/auth/youtube.force-ssl`
   - `https://www.googleapis.com/auth/youtubepartner`
   - `https://www.googleapis.com/auth/youtube.channel-memberships.creator`
   *(Si no los ves en la lista, agrégalos manualmente al final).* Haz clic en **Guardar y continuar**.
6. En la sección **Usuarios de prueba (Test users)**, añade el correo electrónico de Google al que pertenece el canal de YouTube del podcast.
7. Haz clic en **Guardar y continuar**.

---

## Paso 4: Crear las Credenciales OAuth (Client ID y Client Secret)

1. En el menú izquierdo, ve a **APIs y servicios > Credenciales** (Credentials).
2. Haz clic en **+ Crear Credenciales > ID de cliente de OAuth** (OAuth Client ID).
3. Selecciona **Tipo de aplicación: Aplicación web** (Web application).
4. Nombre: `Veredillas FM Panel Web`
5. En **URIs de redireccionamiento autorizados** (Authorized redirect URIs), añade:
   - `https://developers.google.com/oauthplayground`
   - `http://localhost:3000/api/youtube/auth/callback`
6. Haz clic en **Crear**.
7. Te aparecerá una ventana flotante con tu **ID de cliente** (`YOUTUBE_CLIENT_ID`) y tu **Secreto de cliente** (`YOUTUBE_CLIENT_SECRET`). Cópialos y guárdalos.

---

## Paso 5: Obtener el `YOUTUBE_REFRESH_TOKEN` (Sin cerrar sesión nunca)

Puedes obtener el Refresh Token de 2 maneras muy sencillas:

### Opción A: Desde Google OAuth Playground (Recomendada y rápida)

1. Entra en **[Google OAuth Playground](https://developers.google.com/oauthplayground)**.
2. Arriba a la derecha, haz clic en el icono de engranaje ⚙️ (**OAuth 2.0 configuration**).
3. Marca la casilla **"Use your own OAuth credentials"**.
4. Pega tu `OAuth Client ID` y `OAuth Client Secret` obtenidos en el Paso 4.
5. En la columna izquierda (*Step 1: Select & authorize APIs*), busca **YouTube Data API v3** o escribe directamente en el recuadro inferior:
   `https://www.googleapis.com/auth/youtube https://www.googleapis.com/auth/youtube.upload`
6. Haz clic en el botón azul **Authorize APIs**.
7. Inicia sesión con la cuenta de Google del **canal de YouTube del podcast** y concede los permisos.
8. Serás redirigido de nuevo al OAuth Playground. En la columna izquierda (*Step 2*), haz clic en el botón azul **"Exchange authorization code for tokens"**.
9. Verás el campo **`Refresh token`**. ¡Copia ese valor! Ese es tu `YOUTUBE_REFRESH_TOKEN`.

---

### Opción B: Desde el propio panel (Una vez configurados Client ID y Secret)

1. En tu `.env.local`, pon el `YOUTUBE_CLIENT_ID` y `YOUTUBE_CLIENT_SECRET`.
2. Inicia el panel y entra en `http://localhost:3000/youtube`.
3. Haz clic en el botón **"Conectar Canal de YouTube"**.
4. Autoriza la cuenta del podcast en Google y el panel guardará/mostrará automáticamente tu `YOUTUBE_REFRESH_TOKEN`.

---

## Paso 6: Pegar en `.env.local`

Añade las 3 líneas a tu archivo `.env.local`:

```env
# YOUTUBE API CREDENTIALS
YOUTUBE_CLIENT_ID="tu_client_id_aqui"
YOUTUBE_CLIENT_SECRET="tu_client_secret_aqui"
YOUTUBE_REFRESH_TOKEN="tu_refresh_token_aqui"
```

¡Y listo! Una vez añadidas estas variables, cualquier administrador que acceda al panel en `/youtube` podrá subir vídeos directamente sin tener que loguearse jamás con la cuenta de YouTube.
