const {expo} = require('./app.json');
const {isPublicAuthConfig} = require('./src/auth/configPolicy');

const googleMapsApiKey = process.env.GOOGLE_MAPS_API_KEY?.trim();
const authUrl = process.env.EXPO_PUBLIC_SUPABASE_URL?.trim() || '';
const authKey = process.env.EXPO_PUBLIC_SUPABASE_PUBLISHABLE_KEY?.trim() || '';
if ((authUrl || authKey) && !isPublicAuthConfig(authUrl, authKey)) {
  throw new Error('Configure an HTTPS Supabase URL and a public publishable/anon key. Server secret keys must never be embedded in an APK.');
}

module.exports = {
  ...expo,
  plugins: [...(expo.plugins || []), 'expo-secure-store', 'expo-web-browser'],
  android: {
    ...expo.android,
    ...(googleMapsApiKey && {
      config: {googleMaps: {apiKey: googleMapsApiKey}},
    }),
  },
  extra: {
    ...expo.extra,
    androidMapsEnabled: Boolean(googleMapsApiKey),
    auth: {
      url: authUrl,
      publishableKey: authKey,
      googleEnabled: process.env.EXPO_PUBLIC_AUTH_GOOGLE_ENABLED === 'true',
      facebookEnabled: process.env.EXPO_PUBLIC_AUTH_FACEBOOK_ENABLED === 'true',
    },
  },
};
