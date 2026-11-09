# MotoGo Android — Etapa inicial

Proyecto **Expo + React Native + TypeScript** basado en la identidad visual aprobada para MotoGo V2 (negro, amarillo eléctrico, blanco), dirigido a pruebas en Chimbote.

## Ejecutar en Android

1. Instala Node.js LTS en tu computadora.
2. Descomprime esta carpeta y abre una terminal dentro de ella.
3. Ejecuta `npm install`.
4. Ejecuta `npx expo start --tunnel` (puede requerir instalar `@expo/ngrok`).
5. Instala **Expo Go** en tu teléfono Android y escanea el QR que muestra la terminal.

También puedes usar `npx expo start` si la computadora y el celular comparten la misma red Wi-Fi.

## APK independiente de pruebas

El workflow `.github/workflows/android-apk.yml` compila `assembleRelease`, que
incluye el bundle JavaScript/Hermes y permite abrir la aplicación sin Metro ni
Expo Go. En GitHub Actions, descarga el artefacto
`MotoGo-android-standalone-test` e instala el APK incluido.

El workflow verifica el bundle empaquetado, el identificador Android, que la
aplicación no sea depurable, la alineación y la firma. El artefacto incluye el
manifiesto, el informe de firma y `SHA256SUMS`.

Se genera una clave de pruebas nueva en cada ejecución, válida durante 10000
días. No es una firma de producción: para instalar un APK de otra ejecución
puede ser necesario desinstalar el anterior, eliminando sus datos locales.
Los mapas y otros servicios de red siguen necesitando internet.

El APK de pruebas abre sin Google Maps cuando no hay una clave configurada,
para evitar un cierre nativo al iniciar. Se pueden elegir origen y destino y
simular viajes igualmente. Para habilitar el mapa Android, configura
`GOOGLE_MAPS_API_KEY` en el entorno de compilación con una clave válida de
Maps SDK for Android, restringida al paquete y al certificado correspondientes.
`app.config.js` configura juntos el manifiesto y la disponibilidad del mapa.
Actions también instala y abre el APK en un emulador de tablet Android sin
Metro, comprueba la pantalla inicial y navega entre Pasajero y Conductor.

## Incluye
- Inicio con elección de pasajero/conductor, registro e inicio de sesión por correo,
  integración preparada con Google y Facebook y acceso explícito a la demo.
  Las cuentas reales requieren configurar Supabase y los proveedores; consulta
  [la guía de autenticación](docs/authentication.md).
- Interfaz de pasajero con mapa, lugares de ejemplo de Chimbote, origen/destino y tarifa ilustrativa.
- Interfaz de conductor con simulación de aceptación, inicio y fin de viajes.
- Panel administrativo con estadísticas simuladas.
- Guardado local de viajes de prueba usando AsyncStorage.
- Solicitud opcional de permiso de ubicación.

## Limitaciones importantes
- Es una demostración para pruebas, no una plataforma de transporte lista para producción.
- La autenticación necesita un proyecto Supabase configurado. No hay backend de viajes,
  geolocalización compartida, asignación real, rutas calculadas por carretera ni pagos.
- Los puntos de referencia son aproximados y deben validarse antes de cualquier despliegue.
- El cálculo de tarifas utiliza distancia en línea recta y valores inventados **solo para demostrar la interfaz**.
- La conexión de conductor es local; no envía solicitudes a otros teléfonos.
- Requiere acceso a internet para descargar dependencias y mostrar mapas.
- Verificar las autorizaciones locales de transporte en motocicletas antes de planificar operaciones comerciales.

## Próxima etapa
Backend con PostgreSQL/PostGIS, autenticación por teléfono, validación de documentos, viajes con máquina de estados, asignación transaccional y seguimiento GPS seguro. Posteriormente integrar una API de rutas y pagos autorizados.
