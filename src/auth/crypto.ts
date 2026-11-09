import {Platform} from 'react-native';
import * as ExpoCrypto from 'expo-crypto';

// Supabase PKCE must use native randomness and S256 on Hermes as on the web.
// Only fill the WebCrypto functions used by PKCE; preserve any native provider.
if (Platform.OS !== 'web') {
  const crypto = globalThis.crypto ?? ({} as Crypto);
  if (!crypto.getRandomValues) Object.defineProperty(crypto, 'getRandomValues', {value: ExpoCrypto.getRandomValues});
  if (!crypto.subtle) Object.defineProperty(crypto, 'subtle', {value: {
    async digest(algorithm: string | {name: string}, data: ArrayBuffer | ArrayBufferView) {
      const name = typeof algorithm === 'string' ? algorithm : algorithm.name;
      if (name !== 'SHA-256') throw new Error('Unsupported digest algorithm');
      return ExpoCrypto.digest(ExpoCrypto.CryptoDigestAlgorithm.SHA256, data as BufferSource);
    },
  }});
  if (!globalThis.crypto) Object.defineProperty(globalThis, 'crypto', {value: crypto});
}
