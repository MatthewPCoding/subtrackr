import React, { useState, useEffect } from 'react';
import {
  View, Text, TextInput, TouchableOpacity,
  StyleSheet, KeyboardAvoidingView, Platform,
  ActivityIndicator, Image, ScrollView, Alert,
} from 'react-native';
import * as Linking from 'expo-linking';
import * as WebBrowser from 'expo-web-browser';
import { login, getEmailLoginURL } from '../services/api';
import { useAuth } from '../hooks/useAuth';
import { colors, spacing, radius, typography } from '../theme';

WebBrowser.maybeCompleteAuthSession();

const SUPPORTED_PROVIDERS = [
  { id: 'google',    name: 'Gmail',   color: '#EA4335', logo: 'https://www.google.com/s2/favicons?domain=gmail.com&sz=64' },
  { id: 'microsoft', name: 'Outlook', color: '#0078D4', logo: 'https://www.google.com/s2/favicons?domain=outlook.com&sz=64' },
];

function ServiceEmblem({ service, onOAuthLogin }) {
  const [loading, setLoading] = useState(false);
  const [hovered, setHovered] = useState(false);
  const [pressed, setPressed] = useState(false);

  // Receive the auth result posted back from the OAuth popup.
  // The popup closes via window.close() so openAuthSessionAsync returns 'dismiss';
  // the actual result arrives here via postMessage.
  useEffect(() => {
    if (typeof window === 'undefined') return;
    const handleMessage = (event) => {
      if (event.origin !== window.location.origin) return;
      if (event.data?.type !== 'auth_result') return;
      setLoading(false);
      const { status, token } = event.data;
      if (status === 'success' && token) {
        onOAuthLogin(token);
      } else if (status === 'no_account') {
        Alert.alert('No account found', 'No Subtrackr account is linked to this email. Please sign up first.');
      } else {
        Alert.alert('Sign-in failed', 'Could not sign in with Google. Please try again.');
      }
    };
    window.addEventListener('message', handleMessage);
    return () => window.removeEventListener('message', handleMessage);
  }, [onOAuthLogin]);

  const handlePress = async () => {
    if (loading) return;
    setLoading(true);
    try {
      const data = await getEmailLoginURL(service.id);
      // openAuthSessionAsync returns 'dismiss' when the popup closes via window.close().
      // The actual result arrives via postMessage (handled above).
      // If the user manually closes the popup with no result, stop the spinner.
      const result = await WebBrowser.openAuthSessionAsync(data.url, 'https://www.subtrackr.live');
      if (result.type === 'dismiss' || result.type === 'cancel') {
        // Give the postMessage a tick to arrive before stopping the spinner;
        // if no message comes, this clears the loading state.
        setTimeout(() => setLoading(false), 300);
      }
    } catch {
      Alert.alert('Error', 'Sign-in failed. Please try again.');
      setLoading(false);
    }
  };

  return (
    <View style={styles.emblemWrapper}>
      {hovered && !loading && (
        <View style={styles.tooltip}>
          <Text style={styles.tooltipText}>{service.name}</Text>
          <View style={styles.tooltipArrow} />
        </View>
      )}
      <TouchableOpacity
        style={[
          styles.emblem,
          { backgroundColor: service.color + '22', borderColor: service.color + '44' },
          hovered && { backgroundColor: service.color + '33', borderColor: service.color },
          pressed && { transform: [{ scale: 0.93 }] },
        ]}
        onPress={handlePress}
        onPressIn={() => setPressed(true)}
        onPressOut={() => setPressed(false)}
        disabled={loading}
        {...(typeof document !== 'undefined' ? {
          onMouseEnter: () => setHovered(true),
          onMouseLeave: () => { setHovered(false); setPressed(false); },
        } : {})}
        activeOpacity={0.8}
      >
        {loading
          ? <ActivityIndicator size="small" color={service.color} />
          : <Image source={{ uri: service.logo }} style={styles.emblemLogo} />
        }
      </TouchableOpacity>
    </View>
  );
}

export default function LoginScreen({ navigation }) {
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading]   = useState(false);
  const [error, setError]       = useState('');
  const { signIn } = useAuth();

  // Handle Google OAuth login result when the backend redirects the main window
  // directly (direct-landing case, no popup). The popup case is handled by the
  // postMessage listener in ServiceEmblem.
  useEffect(() => {
    const checkAuthResult = async () => {
      const url = await Linking.getInitialURL();
      if (!url?.includes('auth_result')) return;

      const parsed = Linking.parse(url);
      const qp     = parsed.queryParams || {};

      // Clean the URL immediately so a refresh doesn't re-trigger this
      if (typeof window !== 'undefined') {
        window.history.replaceState({}, '', window.location.pathname);
      }

      if (qp.auth_result === 'success' && qp.token) {
        signIn(decodeURIComponent(qp.token));
      } else if (qp.auth_result === 'no_account') {
        setError('No account found. Please register first.');
      } else {
        setError('Google sign-in failed. Please try again.');
      }
    };
    checkAuthResult();
  }, [signIn]);

  const handleLogin = async () => {
    if (!username || !password) { setError('Please fill in all fields'); return; }
    setLoading(true);
    setError('');
    try {
      const data = await login(username, password);
      signIn(data.access_token);
    } catch {
      setError('Invalid username or password');
    } finally {
      setLoading(false);
    }
  };

  const handleOAuthLogin = (token) => signIn(token);

  return (
    <KeyboardAvoidingView
      style={styles.container}
      behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
    >
      <ScrollView contentContainerStyle={styles.inner}>
        <View style={styles.logoRow}>
          <Text style={styles.logo}>Sub<Text style={styles.logoAccent}>trackr</Text></Text>
          <Text style={styles.tagline}>Your subscriptions, under control.</Text>
        </View>

        {/* Email OAuth sign-in */}
        <View style={styles.emailSection}>
          <View style={styles.dividerRow}>
            <View style={styles.divider} />
            <Text style={styles.dividerText}>sign in with email</Text>
            <View style={styles.divider} />
          </View>

          <View style={styles.emblems}>
            {SUPPORTED_PROVIDERS.map(service => (
              <ServiceEmblem
                key={service.id}
                service={service}
                onOAuthLogin={handleOAuthLogin}
              />
            ))}
          </View>

          <View style={styles.dividerRow}>
            <View style={styles.divider} />
            <Text style={styles.dividerText}>or use username</Text>
            <View style={styles.divider} />
          </View>
        </View>

        {/* Manual login */}
        <View style={styles.form}>
          {error ? <Text style={styles.errorText}>{error}</Text> : null}

          <Text style={styles.label}>Username</Text>
          <TextInput
            style={styles.input}
            value={username}
            onChangeText={setUsername}
            placeholder="Enter your username"
            placeholderTextColor={colors.textMuted}
            autoCapitalize="none"
          />

          <Text style={styles.label}>Password</Text>
          <TextInput
            style={styles.input}
            value={password}
            onChangeText={setPassword}
            placeholder="Enter your password"
            placeholderTextColor={colors.textMuted}
            secureTextEntry
          />

          <TouchableOpacity style={styles.btn} onPress={handleLogin} disabled={loading}>
            {loading
              ? <ActivityIndicator color={colors.textPrimary} />
              : <Text style={styles.btnText}>Sign in</Text>
            }
          </TouchableOpacity>

          <TouchableOpacity onPress={() => navigation.navigate('Register')}>
            <Text style={styles.link}>
              Don't have an account? <Text style={styles.linkAccent}>Sign up</Text>
            </Text>
          </TouchableOpacity>
        </View>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.background },
  inner: { flexGrow: 1, justifyContent: 'center', padding: spacing.xxl },
  logoRow: { alignItems: 'center', marginBottom: spacing.xxxl },
  logo: { fontSize: 36, fontWeight: '500', color: colors.textPrimary, letterSpacing: 0.5 },
  logoAccent: { color: colors.accent },
  tagline: { fontSize: typography.sm, color: colors.textSecondary, marginTop: spacing.sm },
  emailSection: { marginBottom: spacing.xl },
  dividerRow: { flexDirection: 'row', alignItems: 'center', gap: spacing.md, marginBottom: spacing.lg },
  divider: { flex: 1, height: 0.5, backgroundColor: colors.border },
  dividerText: { fontSize: typography.xs, color: colors.textSecondary, textTransform: 'uppercase', letterSpacing: 0.5 },
  emblems: { flexDirection: 'row', justifyContent: 'center', gap: spacing.lg, marginBottom: spacing.lg },
  emblemWrapper: { alignItems: 'center', position: 'relative' },
  emblem: { width: 56, height: 56, borderRadius: radius.lg, borderWidth: 1, alignItems: 'center', justifyContent: 'center', cursor: 'pointer' },
  emblemLogo: { width: 30, height: 30, borderRadius: 6 },
  tooltip: { position: 'absolute', bottom: 64, backgroundColor: colors.surface, borderRadius: radius.sm, borderWidth: 0.5, borderColor: colors.border, paddingHorizontal: spacing.md, paddingVertical: spacing.xs, zIndex: 99, minWidth: 80, alignItems: 'center' },
  tooltipText: { fontSize: typography.xs, color: colors.textPrimary, fontWeight: '500' },
  tooltipArrow: { position: 'absolute', bottom: -5, width: 8, height: 8, backgroundColor: colors.surface, borderRightWidth: 0.5, borderBottomWidth: 0.5, borderColor: colors.border, transform: [{ rotate: '45deg' }] },
  form: { gap: spacing.md },
  errorText: { fontSize: typography.sm, color: colors.danger, textAlign: 'center', backgroundColor: colors.danger + '11', padding: spacing.md, borderRadius: radius.sm },
  label: { fontSize: typography.sm, color: colors.textSecondary, marginBottom: 4 },
  input: {
    backgroundColor: colors.surface,
    borderRadius: radius.md,
    borderWidth: 0.5,
    borderColor: colors.border,
    padding: spacing.lg,
    color: colors.textPrimary,
    fontSize: typography.md,
    marginBottom: spacing.md,
  },
  btn: {
    backgroundColor: colors.accent,
    borderRadius: radius.md,
    padding: spacing.lg,
    alignItems: 'center',
    marginTop: spacing.sm,
  },
  btnText: { color: colors.textPrimary, fontSize: typography.md, fontWeight: '500' },
  link: { textAlign: 'center', color: colors.textSecondary, fontSize: typography.sm, marginTop: spacing.lg },
  linkAccent: { color: colors.accent },
});
