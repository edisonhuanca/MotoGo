/** Only a public Supabase client key may be embedded in the APK.
 * @param {string} url
 * @param {string} key
 * @returns {boolean}
 */
function isPublicAuthConfig(url, key) {
  try {
    if (new URL(url).protocol !== 'https:') return false;
    if (key.startsWith('sb_publishable_')) return key.length > 20;
    const encoded = key.split('.')[1];
    if (!encoded) return false;
    const base64 = encoded.replace(/-/g, '+').replace(/_/g, '/');
    const payload = JSON.parse(atob(base64.padEnd(Math.ceil(base64.length / 4) * 4, '=')));
    return payload.role === 'anon';
  } catch {return false;}
}

module.exports = {isPublicAuthConfig};
