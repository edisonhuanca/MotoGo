import assert from 'node:assert/strict';
import {test} from 'node:test';
import {createChunkedStorage} from '../chunkedStorage';
import {callbackCode, isPublicAuthConfig} from '../policy';
import {createRequire} from 'node:module';

function fixture() {
  const values = new Map<string, string>();
  let generation = 0;
  let failKey = '';
  const store = {
    getItem: async (key: string) => values.get(key) ?? null,
    setItem: async (key: string, value: string) => {
      if (key === failKey) throw new Error('Keychain write failed');
      values.set(key, value);
    },
    removeItem: async (key: string) => {values.delete(key);},
  };
  return {values, storage: createChunkedStorage(store, () => String(++generation)), failOn: (key: string) => {failKey = key;}};
}

test('large Unicode sessions round-trip without splitting characters or oversized chunks', async () => {
  const {storage, values} = fixture();
  const value = JSON.stringify({refresh_token: 'x'.repeat(6000), name: 'José 🏍️'.repeat(400)});
  await storage.setItem('session', value);
  assert.equal(await storage.getItem('session'), value);
  for (const chunk of values.values()) assert.ok(Buffer.byteLength(chunk, 'utf8') < 2048);
});

test('a failed session replacement retains the previous committed session', async () => {
  const {storage, values, failOn} = fixture();
  await storage.setItem('session', 'previous');
  failOn('session.2.1');
  await assert.rejects(storage.setItem('session', 'next'.repeat(500)));
  assert.equal(await storage.getItem('session'), 'previous');
  assert.ok([...values.keys()].every(key => !key.startsWith('session.2.')));
});

test('a failed manifest commit does not corrupt the previous session', async () => {
  const {storage, failOn} = fixture();
  await storage.setItem('session', 'previous');
  failOn('session.manifest');
  await assert.rejects(storage.setItem('session', 'next'));
  assert.equal(await storage.getItem('session'), 'previous');
});

test('missing chunks never return a partial authentication token', async () => {
  const {storage, values} = fixture();
  await storage.setItem('session', 'a'.repeat(1000));
  values.delete('session.1.1');
  assert.equal(await storage.getItem('session'), null);
});

test('sign-out removes session manifest and all committed chunks', async () => {
  const {storage, values} = fixture();
  await storage.setItem('session', 'a'.repeat(2000));
  await storage.removeItem('session');
  assert.equal(await storage.getItem('session'), null);
  assert.equal(values.size, 0);
});

test('auth configuration accepts public keys and rejects server keys or HTTP endpoints', () => {
  const jwt = (role: string) => 'header.' + Buffer.from(JSON.stringify({role})).toString('base64url') + '.signature';
  assert.equal(isPublicAuthConfig('https://project.supabase.co', jwt('anon')), true);
  assert.equal(isPublicAuthConfig('https://project.supabase.co', jwt('service_role')), false);
  assert.equal(isPublicAuthConfig('https://project.supabase.co', 'sb_secret_never_ship_to_a_client'), false);
  assert.equal(isPublicAuthConfig('https://project.supabase.co', 'sb_publishable_example_public_key'), true);
  assert.equal(isPublicAuthConfig('http://project.supabase.co', jwt('anon')), false);
});

test('Expo config refuses to package a server secret before it reaches the client', () => {
  const require = createRequire(import.meta.url);
  const path = require.resolve('../../../app.config.js');
  const previousUrl = process.env.EXPO_PUBLIC_SUPABASE_URL;
  const previousKey = process.env.EXPO_PUBLIC_SUPABASE_PUBLISHABLE_KEY;
  try {
    process.env.EXPO_PUBLIC_SUPABASE_URL = 'https://project.supabase.co';
    process.env.EXPO_PUBLIC_SUPABASE_PUBLISHABLE_KEY = 'sb_secret_never_ship_this';
    delete require.cache[path];
    assert.throws(() => require(path), /public publishable\/anon key/);
  } finally {
    if (previousUrl === undefined) delete process.env.EXPO_PUBLIC_SUPABASE_URL; else process.env.EXPO_PUBLIC_SUPABASE_URL = previousUrl;
    if (previousKey === undefined) delete process.env.EXPO_PUBLIC_SUPABASE_PUBLISHABLE_KEY; else process.env.EXPO_PUBLIC_SUPABASE_PUBLISHABLE_KEY = previousKey;
    delete require.cache[path];
  }
});

test('only the exact OAuth callback route can provide an authorization code', () => {
  const redirect = 'motogo://auth/callback';
  assert.equal(callbackCode(redirect + '?code=expected', redirect), 'expected');
  for (const url of ['evil://auth/callback?code=x', 'motogo://evil/callback?code=x', 'motogo://user@auth/callback?code=x', 'motogo://auth/other?code=x', redirect + '#access_token=unexpected', redirect + '?code=']) {
    assert.equal(callbackCode(url, redirect), null);
  }
  assert.throws(() => callbackCode(redirect + '?error=access_denied', redirect));
});
