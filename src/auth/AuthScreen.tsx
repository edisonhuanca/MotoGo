import React, {useState} from 'react';
import {
  ActivityIndicator, KeyboardAvoidingView, Platform, ScrollView, StyleSheet,
  Text, TextInput, TouchableOpacity, View,
} from 'react-native';
import {SafeAreaView} from 'react-native-safe-area-context';
import type {AccountRole, Registration, SocialProvider} from './types';

type Props = {
  busy: boolean;
  error: string;
  notice: string;
  onLogin: (email: string, password: string) => Promise<void>;
  onRegister: (registration: Registration) => Promise<void>;
  onSocial: (provider: SocialProvider, role: AccountRole) => Promise<void>;
  onDemo: () => void;
  onClearFeedback: () => void;
};

const DARK = '#11171D', YELLOW = '#FFD42A';

export function AuthScreen({busy, error, notice, onLogin, onRegister, onSocial, onDemo, onClearFeedback}: Props) {
  const [mode, setMode] = useState<'welcome' | 'login' | 'register'>('welcome');
  const [role, setRole] = useState<AccountRole>('pasajero');
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [validation, setValidation] = useState('');

  const changeMode = (next: typeof mode) => {
    setMode(next); setValidation(''); setPassword(''); setShowPassword(false);
    onClearFeedback();
  };
  const submit = async () => {
    const cleanEmail = email.trim().toLowerCase();
    if (mode === 'register' && name.trim().length < 2) return setValidation('Escribe tu nombre completo.');
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(cleanEmail)) return setValidation('Escribe un correo electrónico válido.');
    if (mode === 'register' && password.length < 8) return setValidation('Usa una contraseña de al menos 8 caracteres.');
    if (!password) return setValidation('Escribe tu contraseña.');
    setValidation('');
    if (mode === 'register') await onRegister({name: name.trim(), email: cleanEmail, password, role});
    else await onLogin(cleanEmail, password);
  };
  const roleChoices = <View style={s.roleRow}>
    {(['pasajero', 'conductor'] as AccountRole[]).map(value => <TouchableOpacity
      key={value} accessibilityRole="radio" accessibilityState={{checked: role === value, disabled: busy}}
      accessibilityLabel={value === 'pasajero' ? 'Elegir pasajero' : 'Elegir conductor'}
      disabled={busy} onPress={() => {setRole(value); onClearFeedback();}} style={[s.role, role === value && s.roleSelected]}>
      <Text style={s.roleTitle}>{value === 'pasajero' ? 'Pasajero' : 'Conductor'}</Text>
      <Text style={s.roleDescription}>{value === 'pasajero' ? 'Quiero solicitar viajes' : 'Quiero ofrecer viajes'}</Text>
    </TouchableOpacity>)}
  </View>;

  return <SafeAreaView style={s.safe}>
    <KeyboardAvoidingView style={s.fill} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
      <ScrollView contentContainerStyle={s.scroll} keyboardShouldPersistTaps="handled">
        <View style={s.brand}><Text style={s.logo}>Moto<Text style={s.yellow}>Go</Text></Text><Text style={s.tag}>CHIMBOTE · MOVILIDAD EN MOTO</Text></View>
        <View style={s.panel}>
          {mode !== 'welcome' && <TouchableOpacity disabled={busy} onPress={() => changeMode('welcome')} accessibilityRole="button" accessibilityLabel="Volver al inicio"><Text style={s.back}>‹ Volver al inicio</Text></TouchableOpacity>}
          <Text style={s.eyebrow}>BIENVENIDO A MOTOGO</Text>
          <Text style={s.title}>{mode === 'welcome' ? 'Tu próximo viaje empieza aquí.' : mode === 'register' ? 'Crea tu cuenta' : 'Inicia sesión'}</Text>
          <Text style={s.subtitle}>{mode === 'login' ? 'Ingresa con tu correo o continúa con una red social.' : 'Elige cómo quieres formar parte de MotoGo.'}</Text>
          {mode !== 'login' && roleChoices}
          {mode === 'welcome' ? <>
            <TouchableOpacity accessibilityRole="button" disabled={busy} style={s.primary} onPress={() => changeMode('register')}><Text style={s.primaryText}>Crear cuenta</Text></TouchableOpacity>
            <TouchableOpacity accessibilityRole="button" disabled={busy} style={s.secondary} onPress={() => changeMode('login')}><Text style={s.secondaryText}>Ya tengo una cuenta</Text></TouchableOpacity>
          </> : <View>
            {mode === 'register' && <>
              <Text style={s.label}>Nombre completo</Text>
              <TextInput accessibilityLabel="Nombre completo" autoComplete="name" maxLength={100} editable={!busy} value={name} onChangeText={setName} style={s.input} placeholder="Tu nombre y apellido" placeholderTextColor="#85919B"/>
            </>}
            <Text style={s.label}>Correo electrónico</Text>
            <TextInput accessibilityLabel="Correo electrónico" autoComplete="email" keyboardType="email-address" maxLength={254} autoCapitalize="none" autoCorrect={false} editable={!busy} value={email} onChangeText={setEmail} style={s.input} placeholder="nombre@correo.com" placeholderTextColor="#85919B"/>
            <Text style={s.label}>Contraseña</Text>
            <View style={s.passwordRow}>
              <TextInput accessibilityLabel="Contraseña" autoComplete={mode === 'register' ? 'new-password' : 'current-password'} secureTextEntry={!showPassword} autoCapitalize="none" autoCorrect={false} editable={!busy} value={password} onChangeText={setPassword} style={[s.input, s.passwordInput]} placeholder={mode === 'register' ? 'Al menos 8 caracteres' : 'Tu contraseña'} placeholderTextColor="#85919B" onSubmitEditing={submit}/>
              <TouchableOpacity accessibilityRole="button" accessibilityLabel={showPassword ? 'Ocultar contraseña' : 'Mostrar contraseña'} disabled={busy} onPress={() => setShowPassword(!showPassword)} style={s.passwordToggle}><Text style={s.link}>{showPassword ? 'Ocultar' : 'Mostrar'}</Text></TouchableOpacity>
            </View>
            {mode === 'register' && role === 'conductor' && <Text style={s.note}>Crear una cuenta de conductor no autoriza a realizar viajes. Tu documentación deberá ser revisada antes de operar.</Text>}
            <TouchableOpacity accessibilityRole="button" disabled={busy} style={[s.primary, busy && s.disabled]} onPress={submit}>
              {busy ? <ActivityIndicator color={DARK}/> : <Text style={s.primaryText}>{mode === 'register' ? 'Registrarme como ' + role : 'Entrar a MotoGo'}</Text>}
            </TouchableOpacity>
            <TouchableOpacity accessibilityRole="button" disabled={busy} onPress={() => changeMode(mode === 'login' ? 'register' : 'login')} style={s.switchMode}><Text style={s.link}>{mode === 'login' ? '¿Aún no tienes cuenta? Regístrate' : 'Ya tengo cuenta. Iniciar sesión'}</Text></TouchableOpacity>
          </View>}
          {!!(validation || error) && <Text accessibilityRole="alert" accessibilityLiveRegion="polite" style={s.error}>{validation || error}</Text>}
          {!!notice && <Text accessibilityLiveRegion="polite" style={s.notice}>{notice}</Text>}
          <View style={s.divider}><View style={s.line}/><Text style={s.or}>O CONTINÚA CON</Text><View style={s.line}/></View>
          {(['google', 'facebook'] as SocialProvider[]).map(provider => <TouchableOpacity
            key={provider} accessibilityRole="button" accessibilityLabel={provider === 'google' ? 'Continuar con Google' : 'Continuar con Facebook'} disabled={busy} onPress={() => onSocial(provider, role)} style={[s.social, busy && s.disabled]}>
            <Text style={[s.socialIcon, provider === 'facebook' && {color: '#1877F2'}]}>{provider === 'google' ? 'G' : 'f'}</Text>
            <Text style={s.socialText}>{provider === 'google' ? 'Continuar con Google' : 'Continuar con Facebook'}</Text>
          </TouchableOpacity>)}
          <TouchableOpacity accessibilityRole="button" disabled={busy} onPress={onDemo} style={s.demo}><Text style={s.link}>Explorar la demo sin cuenta →</Text></TouchableOpacity>
          <Text style={s.footer}>Versión de pruebas · Los viajes de demostración se simulan en este dispositivo.</Text>
        </View>
      </ScrollView>
    </KeyboardAvoidingView>
  </SafeAreaView>;
}

const s = StyleSheet.create({
  safe: {flex: 1, backgroundColor: DARK}, fill: {flex: 1},
  scroll: {flexGrow: 1, padding: 24, paddingBottom: 40, alignItems: 'center'},
  brand: {width: '100%', maxWidth: 540, paddingTop: 16, paddingBottom: 28},
  logo: {fontSize: 42, fontWeight: '900', color: 'white', letterSpacing: -2}, yellow: {color: YELLOW},
  tag: {color: '#A2ACB5', fontSize: 10, fontWeight: '800', letterSpacing: 1.5, marginTop: 4},
  panel: {width: '100%', maxWidth: 540, borderRadius: 24, padding: 24, backgroundColor: '#F8F9FA'},
  back: {color: '#56636D', fontWeight: '700', marginBottom: 20},
  eyebrow: {fontSize: 10, fontWeight: '900', color: '#76828C', letterSpacing: 1.5},
  title: {fontSize: 31, lineHeight: 36, fontWeight: '900', color: DARK, marginTop: 10},
  subtitle: {color: '#64727D', fontSize: 14, lineHeight: 21, marginTop: 10, marginBottom: 22},
  roleRow: {flexDirection: 'row', gap: 10, marginBottom: 18},
  role: {flex: 1, padding: 15, borderRadius: 15, borderWidth: 2, borderColor: '#DEE3E7', backgroundColor: 'white'},
  roleSelected: {borderColor: DARK, backgroundColor: '#FFF5BA'},
  roleTitle: {fontSize: 16, fontWeight: '900', color: DARK}, roleDescription: {fontSize: 11, lineHeight: 16, color: '#56636D', marginTop: 5},
  primary: {minHeight: 52, backgroundColor: YELLOW, borderRadius: 13, justifyContent: 'center', alignItems: 'center', padding: 14, marginTop: 8},
  primaryText: {fontSize: 15, fontWeight: '900', color: DARK},
  secondary: {minHeight: 52, borderRadius: 13, borderWidth: 1, borderColor: '#CCD3D9', justifyContent: 'center', alignItems: 'center', marginTop: 10},
  secondaryText: {fontWeight: '800', color: DARK}, disabled: {opacity: 0.5},
  label: {fontSize: 12, fontWeight: '800', color: '#44515B', marginBottom: 8, marginTop: 8},
  input: {minHeight: 52, backgroundColor: 'white', borderWidth: 1, borderColor: '#D5DDE3', borderRadius: 12, paddingHorizontal: 14, fontSize: 15, color: DARK, marginBottom: 8},
  passwordRow: {flexDirection: 'row', alignItems: 'center'}, passwordInput: {flex: 1, paddingRight: 76},
  passwordToggle: {position: 'absolute', right: 14, top: 0, bottom: 8, justifyContent: 'center'},
  link: {fontSize: 12, fontWeight: '800', color: '#344550'}, switchMode: {alignItems: 'center', paddingVertical: 18},
  note: {fontSize: 11, lineHeight: 17, color: '#6F5B19', backgroundColor: '#FFF4C0', padding: 12, borderRadius: 10, marginBottom: 8},
  error: {fontSize: 12, lineHeight: 18, color: '#A12828', backgroundColor: '#FFEEEE', borderRadius: 10, padding: 12, marginTop: 12},
  notice: {fontSize: 12, lineHeight: 18, color: '#205840', backgroundColor: '#E4F5EB', borderRadius: 10, padding: 12, marginTop: 12},
  divider: {flexDirection: 'row', alignItems: 'center', gap: 12, marginVertical: 23}, line: {flex: 1, height: 1, backgroundColor: '#DEE3E7'}, or: {fontSize: 9, fontWeight: '800', color: '#7C8790', letterSpacing: 1},
  social: {minHeight: 50, borderWidth: 1, borderColor: '#D5DDE3', backgroundColor: 'white', borderRadius: 12, flexDirection: 'row', alignItems: 'center', paddingHorizontal: 18, marginBottom: 10},
  socialIcon: {fontSize: 24, fontWeight: '900', width: 32, color: '#4285F4'}, socialText: {flex: 1, textAlign: 'center', fontSize: 13, fontWeight: '800', color: DARK, paddingRight: 32},
  demo: {alignItems: 'center', paddingVertical: 20}, footer: {textAlign: 'center', fontSize: 10, lineHeight: 16, color: '#86919A'},
});
