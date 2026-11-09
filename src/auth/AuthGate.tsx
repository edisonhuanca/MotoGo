import React, {useEffect, useState} from 'react';
import {ActivityIndicator, Alert, AppState, Linking, StyleSheet, Text, TouchableOpacity, View} from 'react-native';
import {SafeAreaView} from 'react-native-safe-area-context';
import type {Session} from '@supabase/supabase-js';
import {AuthScreen} from './AuthScreen';
import {authClient, authErrorMessage, completeRole, finishAuthCallback, registerAccount,
  requireAuth, restoreProfile, signInSocial, type Profile} from './client';
import type {AccountRole} from './types';

type Props = {children: (account: {profile: Profile | null; demo: boolean; exit: () => void}) => React.ReactNode};

export function AuthGate({children}: Props) {
  const [session, setSession] = useState<Session | null>(null);
  const [profile, setProfile] = useState<Profile | null>(null);
  const [loading, setLoading] = useState(Boolean(authClient));
  const [profileLoading, setProfileLoading] = useState(false);
  const [busy, setBusy] = useState(false);
  const [demo, setDemo] = useState(false);
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');
  const [profileError, setProfileError] = useState('');
  const [attempt, setAttempt] = useState(0);

  const clearFeedback = () => {setError(''); setNotice('');};
  const run = async (action: () => Promise<void>) => {
    setBusy(true); clearFeedback();
    try {await action();} catch (e) {setError(authErrorMessage(e));}
    finally {setBusy(false);}
  };

  useEffect(() => {
    if (!authClient) return;
    const client = authClient;
    let mounted = true;
    const apply = (next: Session | null) => {
      if (!mounted) return;
      setSession(next); setLoading(false);
      if (next) setDemo(false);
    };
    client.auth.getSession().then(({data, error}) => {
      if (error && mounted) setError('No pudimos recuperar tu sesión. Inicia sesión de nuevo.');
      apply(data.session);
    }).catch(() => {if (mounted) {setLoading(false); setError('No pudimos recuperar tu sesión.');}});
    // Do not await other Supabase calls inside the auth lock callback.
    const {data: listener} = client.auth.onAuthStateChange((_event, next) => apply(next));
    const refresh = (state: string) => state === 'active' ? client.auth.startAutoRefresh() : client.auth.stopAutoRefresh();
    refresh(AppState.currentState);
    const appState = AppState.addEventListener('change', refresh);
    const callback = (url: string) => {finishAuthCallback(url).catch(e => {if (mounted) setError(authErrorMessage(e));});};
    const linking = Linking.addEventListener('url', ({url}) => callback(url));
    Linking.getInitialURL().then(url => {if (mounted && url) callback(url);}).catch(() => {});
    return () => {mounted = false; listener.subscription.unsubscribe(); appState.remove(); linking.remove(); client.auth.stopAutoRefresh();};
  }, []);

  useEffect(() => {
    let mounted = true;
    setProfile(null); setProfileError('');
    if (!session?.user.id) {setProfileLoading(false); return;}
    setProfileLoading(true);
    restoreProfile(session.user.id).then(next => {if (mounted) setProfile(next);})
      .catch(e => {if (mounted) setProfileError(authErrorMessage(e));})
      .finally(() => {if (mounted) setProfileLoading(false);});
    return () => {mounted = false;};
  }, [session?.user.id, attempt]);

  const exit = () => {
    if (demo) {setDemo(false); clearFeedback(); return;}
    void (async () => {
      setBusy(true);
      try {
        const {error} = await requireAuth().auth.signOut({scope: 'local'});
        if (error) throw error;
        setSession(null); setProfile(null); clearFeedback();
      } catch (e) {Alert.alert('No pudimos cerrar sesión', authErrorMessage(e));}
      finally {setBusy(false);}
    })();
  };

  if (loading || (session && (profileLoading || (!profile && !profileError)))) return <SafeAreaView style={s.safe}><ActivityIndicator color="#FFD42A" size="large"/><Text style={s.body}>Preparando tu cuenta…</Text></SafeAreaView>;
  if (demo) return children({profile: null, demo: true, exit});
  if (session && profile?.role) return children({profile, demo: false, exit});
  if (session) return <SafeAreaView style={s.safe}>
    <View style={s.card}>
      <Text style={s.title}>{profileError ? 'No pudimos abrir tu cuenta' : 'Elige tu perfil'}</Text>
      <Text style={s.description}>{profileError || '¿Cómo quieres usar MotoGo? Esta elección se guardará en tu cuenta.'}</Text>
      {!!error && <Text accessibilityRole="alert" style={s.error}>{error}</Text>}
      {profileError ? <TouchableOpacity accessibilityRole="button" style={s.button} onPress={() => setAttempt(attempt + 1)}><Text>Reintentar</Text></TouchableOpacity> :
        (['pasajero', 'conductor'] as AccountRole[]).map(role => <TouchableOpacity key={role} accessibilityRole="button" disabled={busy} style={s.button} onPress={() => void run(async () => {setProfile(await completeRole(role));})}><Text style={s.buttonText}>{role === 'pasajero' ? 'Ser pasajero' : 'Ser conductor'}</Text></TouchableOpacity>)}
      <TouchableOpacity accessibilityRole="button" disabled={busy} onPress={exit} style={s.exit}><Text>Cerrar sesión</Text></TouchableOpacity>
    </View>
  </SafeAreaView>;
  return <AuthScreen busy={busy} error={error} notice={notice} onClearFeedback={clearFeedback}
    onDemo={() => {clearFeedback(); setDemo(true);}}
    onLogin={(email, password) => run(async () => {const {error} = await requireAuth().auth.signInWithPassword({email, password}); if (error) throw error;})}
    onRegister={registration => run(async () => {const signedIn = await registerAccount(registration); if (!signedIn) setNotice('Revisa tu correo y confirma tu cuenta. Después podrás iniciar sesión.');})}
    onSocial={(provider, role) => run(() => signInSocial(provider, role))}/>;
}

const s = StyleSheet.create({
  safe: {flex: 1, backgroundColor: '#11171D', justifyContent: 'center', alignItems: 'center', padding: 24},
  body: {color: '#C9D1D7', marginTop: 18}, card: {width: '100%', maxWidth: 480, backgroundColor: '#F8F9FA', borderRadius: 22, padding: 24},
  title: {fontSize: 25, fontWeight: '900', color: '#11171D'}, description: {fontSize: 14, lineHeight: 22, color: '#65717C', marginVertical: 16},
  button: {padding: 16, borderRadius: 12, backgroundColor: '#FFD42A', alignItems: 'center', marginVertical: 6}, buttonText: {fontWeight: '900'},
  exit: {alignItems: 'center', padding: 16}, error: {color: '#A12828', marginBottom: 12},
});
