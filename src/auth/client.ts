import 'react-native-url-polyfill/auto';
import './crypto';
import Constants from 'expo-constants';
import {createClient} from '@supabase/supabase-js';
import {makeRedirectUri} from 'expo-auth-session';
import * as WebBrowser from 'expo-web-browser';
import {authStorage} from './secureStorage';
import {callbackCode, isPublicAuthConfig} from './policy';
import type {AccountRole, Registration, SocialProvider} from './types';

WebBrowser.maybeCompleteAuthSession();
const config = Constants.expoConfig?.extra?.auth;
const url = typeof config?.url === 'string' ? config.url : '';
const key = typeof config?.publishableKey === 'string' ? config.publishableKey : '';
export const authClient = isPublicAuthConfig(url, key) ? createClient(url, key, {
  auth: {storage: authStorage, storageKey: 'motogo-session', persistSession: true,
    autoRefreshToken: true, detectSessionInUrl: false, flowType: 'pkce'},
}) : null;
export const authRedirect = makeRedirectUri({scheme: 'motogo', path: 'auth/callback'});
const pendingRoleKey = 'motogo-pending-role';
const callbackRequests = new Map<string, Promise<void>>();

export type Profile = {id: string; full_name: string; role: AccountRole | null; driver_status: string};

export function requireAuth() {
  if (!authClient) throw new Error('El registro y el acceso a cuentas aún no están habilitados en esta versión de pruebas. Puedes explorar la demo sin cuenta.');
  return authClient;
}

export async function finishAuthCallback(url: string): Promise<boolean> {
  const code = callbackCode(url, authRedirect);
  if (!code) return false;
  let request = callbackRequests.get(code);
  if (!request) {
    request = (async () => {
      const flowId = new URL(url).searchParams.get('flow_id');
      const {error} = await requireAuth().auth.exchangeCodeForSession(code, flowId ? {flowId} : undefined);
      if (error) throw error;
    })();
    if (callbackRequests.size >= 8) callbackRequests.delete(callbackRequests.keys().next().value!);
    callbackRequests.set(code, request);
  }
  await request;
  return true;
}

export async function registerAccount({name, email, password, role}: Registration) {
  const {data, error} = await requireAuth().auth.signUp({email, password, options: {
    emailRedirectTo: authRedirect, data: {full_name: name, role},
  }});
  if (error) throw error;
  return Boolean(data.session);
}

export async function signInSocial(provider: SocialProvider, role: AccountRole) {
  const client = requireAuth();
  if (config?.[provider + 'Enabled'] !== true) throw new Error(`El acceso con ${provider === 'google' ? 'Google' : 'Facebook'} aún no está habilitado en esta versión de pruebas.`);
  await authStorage.setItem(pendingRoleKey, role);
  const {data, error} = await client.auth.signInWithOAuth({provider, options: {redirectTo: authRedirect, skipBrowserRedirect: true}});
  if (error || !data.url) {await authStorage.removeItem(pendingRoleKey); throw error || new Error('No pudimos iniciar el acceso con la red social.');}
  const result = await WebBrowser.openAuthSessionAsync(data.url, authRedirect);
  if (result.type === 'success') {
    if (!await finishAuthCallback(result.url)) throw new Error('No pudimos confirmar el acceso. Inténtalo de nuevo.');
  } else await authStorage.removeItem(pendingRoleKey);
}

export async function fetchProfile(userId: string): Promise<Profile> {
  const {data, error} = await requireAuth().from('profiles').select('id,full_name,role,driver_status').eq('id', userId).single();
  if (error) throw new Error('No pudimos cargar tu perfil. Revisa tu conexión e inténtalo de nuevo.');
  if (data.role !== null && data.role !== 'pasajero' && data.role !== 'conductor') throw new Error('El perfil de esta cuenta no es válido.');
  return data as Profile;
}

export async function completeRole(role: AccountRole): Promise<Profile> {
  const {data, error} = await requireAuth().rpc('complete_onboarding', {selected_role: role});
  if (error) throw new Error('No pudimos guardar tu perfil. Inténtalo de nuevo.');
  const profile = Array.isArray(data) ? data[0] : data;
  if (!profile?.id || (profile.role !== 'pasajero' && profile.role !== 'conductor')) throw new Error('No pudimos confirmar tu perfil. Inténtalo de nuevo.');
  return profile as Profile;
}

export async function restoreProfile(userId: string) {
  let profile = await fetchProfile(userId);
  const pendingRole = await authStorage.getItem(pendingRoleKey);
  if (profile.role === null && (pendingRole === 'pasajero' || pendingRole === 'conductor')) profile = await completeRole(pendingRole);
  await authStorage.removeItem(pendingRoleKey);
  return profile;
}

export function authErrorMessage(error: unknown) {
  const code = typeof error === 'object' && error && 'code' in error ? error.code : '';
  if (code === 'invalid_credentials') return 'Correo o contraseña incorrectos.';
  if (code === 'email_not_confirmed') return 'Confirma tu correo electrónico antes de iniciar sesión.';
  if (code === 'over_email_send_rate_limit' || code === 'over_request_rate_limit') return 'Espera unos minutos antes de intentarlo de nuevo.';
  if (code === 'weak_password') return 'Elige una contraseña más segura, de al menos 8 caracteres.';
  if (error instanceof TypeError) return 'No pudimos conectar. Revisa tu conexión a internet.';
  if (error instanceof Error && /^(El registro|El acceso|No pudimos|El perfil)/.test(error.message)) return error.message;
  return 'No pudimos completar el acceso. Revisa tus datos e inténtalo de nuevo.';
}
