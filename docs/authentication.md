# Cuentas de MotoGo

## Estado de esta versión

La aplicación incluye bienvenida, registro por correo para pasajero o conductor,
inicio de sesión, confirmación de correo, sesión persistente y cierre de sesión.
Google y Facebook usan Supabase OAuth con PKCE S256 y retorno al APK.

Sin un proyecto configurado, los formularios y botones muestran que el acceso
todavía no está habilitado. No crean cuentas locales ficticias ni guardan
contraseñas. «Explorar la demo sin cuenta» permite probar la interfaz existente.
Los viajes continúan siendo simulaciones locales incluso después de iniciar sesión.

## Activar un proyecto

1. Crea o selecciona el proyecto Supabase dedicado a MotoGo.
2. Aplica `supabase/migrations/202611090001_accounts.sql` desde las migraciones
   del proyecto o el editor SQL. La migración crea `public.profiles`; si ya existe
   una tabla con ese nombre, revisa la compatibilidad en vez de eliminar datos.
3. En Authentication, habilita Email con confirmación de correo y una longitud
   mínima de contraseña de 8 caracteres. Configura el envío de correos del proyecto
   según el uso esperado; la aplicación no proporciona un servicio SMTP.
4. Añade **exactamente** `motogo://auth/callback` a las URLs de redirección
   autorizadas. No uses comodines amplios.
5. Copia `.env.example` a `.env` para desarrollo. Establece
   `EXPO_PUBLIC_SUPABASE_URL` y `EXPO_PUBLIC_SUPABASE_PUBLISHABLE_KEY` con la URL
   HTTPS del proyecto y su clave pública publishable (o la antigua `anon`).
   Nunca uses `service_role`, `sb_secret_`, contraseñas ni secretos OAuth en el APK.
   La configuración rechaza claves de servidor antes de empaquetarlas.
6. Para GitHub Actions, crea las variables de repositorio con esos mismos nombres
   en `edisonhuanca/MotoGo`. Son valores públicos que quedarán incluidos en el APK.
   Un cambio requiere una nueva compilación.

## Google y Facebook

En los paneles de Google y Meta, crea los clientes correspondientes y autoriza
la URL HTTPS de callback que muestra Supabase para cada proveedor, normalmente
`https://<proyecto>.supabase.co/auth/v1/callback`.

Introduce sus identificadores y secretos **únicamente en la configuración del
proveedor en Supabase**. La app no debe recibir esos secretos. Habilita el
proveedor y después configura `EXPO_PUBLIC_AUTH_GOOGLE_ENABLED=true` o
`EXPO_PUBLIC_AUTH_FACEBOOK_ENABLED=true` en el entorno de compilación/variables
de repositorio. No habilites las opciones hasta terminar la configuración.

El navegador presenta el consentimiento del proveedor. El código vuelve a
`motogo://auth/callback` y se intercambia con el verificador PKCE del dispositivo.
Las URLs de otros esquemas, hosts o rutas se ignoran. Una cancelación no crea
una sesión. Abre la confirmación de correo en el dispositivo con la app o, una
vez confirmado el correo, inicia sesión con correo y contraseña.

## Perfiles y permisos

- Cada cuenta solo puede leer su propio perfil y modificar su nombre.
- El perfil pasajero/conductor se establece una sola vez. Los metadatos sociales
  no otorgan permisos administrativos ni pueden cambiar un perfil existente.
- Todo conductor empieza con `driver_status=pending`. Solo una operación
  administrativa de confianza en el servidor puede aprobarlo; el cliente no
  dispone de esa operación. Crear cuenta no habilita servicios de transporte reales.
- El panel Admin existente está disponible únicamente dentro de la demo local.
- Los viajes locales se separan por ID de cuenta; la demo mantiene su propio almacén.

Las sesiones Android se cifran con Expo SecureStore/Keystore. Los valores grandes
se dividen en fragmentos Unicode y se publica un manifiesto solo después de
guardarlos por completo. Las contraseñas solo se envían a Supabase por HTTPS.

## Comprobaciones

`npm test` prueba callbacks, rechazo de claves de servidor, almacenamiento seguro
y reglas de PostgreSQL/RLS usando PGlite, sin acceder a datos o cuentas reales.
`npx tsc --noEmit` comprueba los tipos. El workflow instala el APK release en una
tablet Android emulada y comprueba bienvenida, ambos registros, validación,
opciones sociales, entrada/salida de la demo y reinicio sin Metro.

Cuando el proyecto y los proveedores estén activos, valida con cuentas de prueba:
registro pasajero/conductor y confirmación de correo; contraseña incorrecta;
Google/Facebook aceptados y cancelados; sesión tras reiniciar y cierre de sesión;
cuenta existente que conserva su perfil al elegir otro rol antes de OAuth.
Estas operaciones externas no se consideran verificadas solo por mostrar sus botones.
