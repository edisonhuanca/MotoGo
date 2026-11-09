const {expo} = require('./app.json');

const googleMapsApiKey = process.env.GOOGLE_MAPS_API_KEY?.trim();

module.exports = {
  ...expo,
  android: {
    ...expo.android,
    ...(googleMapsApiKey && {
      config: {googleMaps: {apiKey: googleMapsApiKey}},
    }),
  },
  extra: {
    ...expo.extra,
    androidMapsEnabled: Boolean(googleMapsApiKey),
  },
};
