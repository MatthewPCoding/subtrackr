import React, { useState, useEffect } from 'react';
import {
  View, Text, TextInput, TouchableOpacity,
  StyleSheet, KeyboardAvoidingView, Platform,
  ActivityIndicator, ScrollView
} from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { register, login, importEmailSubscriptions, PENDING_OAUTH_DATA_KEY } from '../services/api';
import { colors, spacing, radius, typography } from '../theme';
import {
  EmailConnectStep,
  ScanningStep,
  TermsStep
} from './OnboardingSteps';

// Steps:
// 'email'    → connect Gmail/Outlook (OAuth) or skip
// 'username' → choose username (OAuth path only, email pre-filled + locked)
// 'form'     → manual username/email/password (skip path only)
// 'terms'    → T&C with checkbox → creates account + auto-login
// 'scanning' → show pre-loaded subscription results (OAuth path only)
// done       → navigate to MainTabs

export default function RegisterScreen({ navigation }) {
  const [step, setStep] = useState('email');

  // OAuth path — set when user completes OAuth on EmailConnectStep
  const [oauthData, setOauthData]     = useState(null); // { provider, profile, subs }
  const [oauthUsername, setOauthUsername] = useState('');

  // Manual form path
  const [username, setUsername]   = useState('');
  const [email, setEmail]         = useState('');
  const [password, setPassword]   = useState('');

  const [loading, setLoading]     = useState(false);
  const [formError, setFormError] = useState('');
  const [scanResults, setScanResults] = useState(null);

  // If the app was cold-started by an OAuth redirect (full-page), App.js stores
  // the data in AsyncStorage and navigates here. Consume it on mount.
  useEffect(() => {
    (async () => {
      try {
        const raw = await AsyncStorage.getItem(PENDING_OAUTH_DATA_KEY);
        if (!raw) return;
        await AsyncStorage.removeItem(PENDING_OAUTH_DATA_KEY);
        const { subs, profile } = JSON.parse(raw);
        setOauthData({ provider: 'google', profile, subs });
        setStep('username');
      } catch {
        // Malformed or missing — stay on email step
      }
    })();
  }, []);

  const validateForm = () => {
    if (!username) return 'Username is required';
    if (!email)    return 'Email is required';
    if (!email.includes('@')) return 'Enter a valid email';
    if (!password)  return 'Password is required';
    if (password.length < 6) return 'Password must be at least 6 characters';
    return null;
  };

  // Called by EmailConnectStep with typed result
  const handleEmailChoice = (result) => {
    if (result.type === 'skip') {
      setStep('form');
    } else if (result.type === 'oauth') {
      setOauthData(result);
      setStep('username');
    }
    // 'cancel' (browser dismissed) → no-op, stays on email step
  };

  const handleUsernameNext = () => {
    if (!oauthUsername.trim()) { setFormError('Username is required'); return; }
    setFormError('');
    setStep('terms');
  };

  const handleFormNext = () => {
    const error = validateForm();
    if (error) { setFormError(error); return; }
    setFormError('');
    setStep('terms');
  };

  const handleAgree = async () => {
    setLoading(true);
    try {
      if (oauthData) {
        // ── OAuth path: create account with chosen username + Google email ──
        const { profile, subs } = oauthData;
        // Random password — user never sees it; they log in via OAuth
        const autoPass = Math.random().toString(36).slice(2) +
                         Math.random().toString(36).slice(2);
        await register(oauthUsername.trim(), profile.email, autoPass);
        await login(oauthUsername.trim(), autoPass);
        setScanResults(subs);
        setStep('scanning');
      } else {
        // ── Manual form path ──
        await register(username, email, password);
        await login(username, password);
        navigation.navigate('MainTabs');
      }
    } catch (e) {
      const msg = e.response?.data?.detail || 'Registration failed. Please try again.';
      setFormError(msg);
      setStep(oauthData ? 'email' : 'form');
    } finally {
      setLoading(false);
    }
  };

  const handleScanImport = async (selectedSubs) => {
    if (selectedSubs.length > 0) {
      try {
        await importEmailSubscriptions(selectedSubs);
      } catch {
        // Non-fatal — user can add manually
      }
    }
    navigation.navigate('MainTabs');
  };

  const handleScanSkip = () => navigation.navigate('MainTabs');

  // ── Email connect ─────────────────────────────────────────────────────────
  if (step === 'email') {
    return <EmailConnectStep onNext={handleEmailChoice} />;
  }

  // ── Choose username (OAuth path) ──────────────────────────────────────────
  if (step === 'username') {
    return (
      <KeyboardAvoidingView
        style={styles.container}
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
      >
        <ScrollView contentContainerStyle={styles.inner}>
          <View style={styles.logoRow}>
            <Text style={styles.logo}>Sub<Text style={styles.logoAccent}>trackr</Text></Text>
            <Text style={styles.tagline}>
              {oauthData?.profile?.name
                ? `Hi ${oauthData.profile.name.split(' ')[0]}, choose a username`
                : 'Choose your username'}
            </Text>
          </View>

          {formError ? <Text style={styles.errorText}>{formError}</Text> : null}

          <View style={styles.form}>
            <Text style={styles.label}>Email</Text>
            <TextInput
              style={[styles.input, styles.inputLocked]}
              value={oauthData?.profile?.email ?? ''}
              editable={false}
              selectTextOnFocus={false}
            />

            <Text style={styles.label}>Username</Text>
            <TextInput
              style={styles.input}
              value={oauthUsername}
              onChangeText={setOauthUsername}
              placeholder="Choose a username"
              placeholderTextColor={colors.textMuted}
              autoCapitalize="none"
              autoFocus
            />

            <TouchableOpacity style={styles.btn} onPress={handleUsernameNext}>
              <Text style={styles.btnText}>Continue →</Text>
            </TouchableOpacity>
          </View>
        </ScrollView>
      </KeyboardAvoidingView>
    );
  }

  // ── Manual form ───────────────────────────────────────────────────────────
  if (step === 'form') {
    return (
      <KeyboardAvoidingView
        style={styles.container}
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
      >
        <ScrollView contentContainerStyle={styles.inner}>
          <View style={styles.logoRow}>
            <Text style={styles.logo}>Sub<Text style={styles.logoAccent}>trackr</Text></Text>
            <Text style={styles.tagline}>Create your account</Text>
          </View>

          {formError ? <Text style={styles.errorText}>{formError}</Text> : null}

          <View style={styles.form}>
            <Text style={styles.label}>Username</Text>
            <TextInput
              style={styles.input}
              value={username}
              onChangeText={setUsername}
              placeholder="Choose a username"
              placeholderTextColor={colors.textMuted}
              autoCapitalize="none"
            />

            <Text style={styles.label}>Email</Text>
            <TextInput
              style={styles.input}
              value={email}
              onChangeText={setEmail}
              placeholder="Enter your email"
              placeholderTextColor={colors.textMuted}
              autoCapitalize="none"
              keyboardType="email-address"
            />

            <Text style={styles.label}>Password</Text>
            <TextInput
              style={styles.input}
              value={password}
              onChangeText={setPassword}
              placeholder="Create a password (min 6 chars)"
              placeholderTextColor={colors.textMuted}
              secureTextEntry
            />

            <TouchableOpacity style={styles.btn} onPress={handleFormNext}>
              <Text style={styles.btnText}>Continue →</Text>
            </TouchableOpacity>

            <TouchableOpacity onPress={() => navigation.navigate('Login')}>
              <Text style={styles.link}>
                Already have an account? <Text style={styles.linkAccent}>Sign in</Text>
              </Text>
            </TouchableOpacity>
          </View>
        </ScrollView>
      </KeyboardAvoidingView>
    );
  }

  // ── Terms ─────────────────────────────────────────────────────────────────
  if (step === 'terms') {
    return loading
      ? (
        <View style={styles.loadingScreen}>
          <ActivityIndicator color={colors.accent} size="large" />
          <Text style={styles.loadingText}>Creating your account...</Text>
        </View>
      )
      : <TermsStep onAgree={handleAgree} />;
  }

  // ── Scan results (OAuth path only) ────────────────────────────────────────
  if (step === 'scanning') {
    return (
      <ScanningStep
        initialResults={scanResults}
        onImport={handleScanImport}
        onSkip={handleScanSkip}
      />
    );
  }

  return null;
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.background },
  inner: { flexGrow: 1, justifyContent: 'center', padding: spacing.xxl },
  logoRow: { alignItems: 'center', marginBottom: spacing.xxxl },
  logo: { fontSize: 36, fontWeight: '500', color: colors.textPrimary, letterSpacing: 0.5 },
  logoAccent: { color: colors.accent },
  tagline: { fontSize: typography.sm, color: colors.textSecondary, marginTop: spacing.sm },
  form: { gap: spacing.md },
  errorText: { fontSize: typography.sm, color: colors.danger, textAlign: 'center', marginBottom: spacing.md, backgroundColor: colors.danger + '11', padding: spacing.md, borderRadius: radius.sm },
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
  inputLocked: { color: colors.textSecondary, opacity: 0.6 },
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
  loadingScreen: { flex: 1, backgroundColor: colors.background, alignItems: 'center', justifyContent: 'center', gap: spacing.lg },
  loadingText: { fontSize: typography.md, color: colors.textSecondary },
});
