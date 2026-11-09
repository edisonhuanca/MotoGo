export {isPublicAuthConfig} from './configPolicy';

export function callbackCode(url: string, redirect: string): string | null {
  try {
    const actual = new URL(url), expected = new URL(redirect);
    if (actual.protocol !== expected.protocol || actual.host !== expected.host || actual.pathname !== expected.pathname || actual.username || actual.password) return null;
    // An error from the provider is handled by the caller without exposing URLs.
    if (actual.searchParams.has('error')) throw new Error('OAuth declined');
    const code = actual.searchParams.get('code');
    return code && code.length <= 2048 ? code : null;
  } catch (error) {
    if (error instanceof Error && error.message === 'OAuth declined') throw error;
    return null;
  }
}
