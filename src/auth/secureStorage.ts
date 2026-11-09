import {Platform} from 'react-native';
import * as SecureStore from 'expo-secure-store';
import {randomUUID} from 'expo-crypto';
import {createChunkedStorage} from './chunkedStorage';

const options = {
  keychainService: 'motogo-auth',
  keychainAccessible: SecureStore.WHEN_UNLOCKED_THIS_DEVICE_ONLY,
};

export const authStorage = Platform.OS === 'web' ? {
  getItem: async (key: string) => globalThis.localStorage.getItem(key),
  setItem: async (key: string, value: string) => {globalThis.localStorage.setItem(key, value);},
  removeItem: async (key: string) => {globalThis.localStorage.removeItem(key);},
} : createChunkedStorage({
  getItem: key => SecureStore.getItemAsync(key, options),
  setItem: (key, value) => SecureStore.setItemAsync(key, value, options),
  removeItem: key => SecureStore.deleteItemAsync(key, options),
}, randomUUID);
