import React, { useEffect, useRef, useCallback } from 'react';
import { View, StyleSheet, Linking } from 'react-native';
import { NavigationContainer } from '@react-navigation/native';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { AuthProvider, useAuth } from './src/hooks/useAuth';
import AppNavigator from './src/navigation/AppNavigator';
import AuthNavigator from './src/navigation/AuthNavigator';
import SupportChat from './src/components/SupportChat';
import { colors } from './src/theme';
import { PENDING_EMAIL_RESULTS_KEY, PENDING_OAUTH_DATA_KEY } from './src/services/api';

// ── OAuth URL param detection (web only, runs before React renders) ───────────
//
// Two cases land here:
//   1. Popup  — window.opener exists: relay result to parent window and close.
//   2. Direct — main window redirected here: stash data in _pendingOAuth so the
//               app can consume it once the NavigationContainer is ready.
//
let _pendingOAuth = null; // { subs, profile }

if (typeof window !== 'undefined') {
  const params = new URLSearchParams(window.location.search);
  const status = params.get('oauth_connect');

  if (status) {
    try {
      if (status === 'success') {
        const subs    = JSON.parse(decodeURIComponent(params.get('subs')    || '[]'));
        const profile = JSON.parse(decodeURIComponent(params.get('profile') || '{}'));

        if (window.opener) {
          // Case 1 — popup: forward to parent and close immediately
          window.opener.postMessage(
            { type: 'oauth_connect', status: 'success', subs, profile },
            window.location.origin,
          );
          window.close();
        } else {
          // Case 2 — direct landing: stash and clean the URL
          _pendingOAuth = { subs, profile };
          window.history.replaceState({}, '', window.location.pathname);
        }
      } else if (status === 'error') {
        if (window.opener) {
          window.opener.postMessage(
            { type: 'oauth_connect', status: 'error' },
            window.location.origin,
          );
          window.close();
        }
      }
    } catch {}
  }
}
// ─────────────────────────────────────────────────────────────────────────────

function RootNavigator() {
  const { token, loading } = useAuth();
  if (loading) return null;
  return token ? (
    <View style={styles.root}>
      <AppNavigator />
      <SupportChat />
    </View>
  ) : (
    <AuthNavigator />
  );
}

export default function App() {
  const navigationRef = useRef(null);

  // Called by NavigationContainer once the navigator is mounted and ready.
  // Handles the direct-landing OAuth case (_pendingOAuth) with correct timing.
  const handleNavigationReady = useCallback(async () => {
    if (!_pendingOAuth) return;
    const data    = _pendingOAuth;
    _pendingOAuth = null;

    try {
      await AsyncStorage.setItem(PENDING_OAUTH_DATA_KEY,     JSON.stringify(data));
      await AsyncStorage.setItem(PENDING_EMAIL_RESULTS_KEY,  JSON.stringify(data.subs));
      navigationRef.current.navigate('Register');
    } catch {}
  }, []);

  // ── postMessage listener: popup → parent (web only) ────────────────────────
  useEffect(() => {
    if (typeof window === 'undefined') return;

    const handleMessage = async (event) => {
      if (event.origin !== window.location.origin) return;
      if (event.data?.type !== 'oauth_connect')     return;
      if (event.data.status !== 'success')          return;

      const { subs, profile } = event.data;
      try {
        await AsyncStorage.setItem(PENDING_OAUTH_DATA_KEY,    JSON.stringify({ subs, profile }));
        await AsyncStorage.setItem(PENDING_EMAIL_RESULTS_KEY, JSON.stringify(subs));
        if (navigationRef.current?.isReady()) {
          navigationRef.current.navigate('Register');
        }
      } catch {}
    };

    window.addEventListener('message', handleMessage);
    return () => window.removeEventListener('message', handleMessage);
  }, []);

  // ── Deep link handler: native + full-page redirect fallback ────────────────
  useEffect(() => {
    const handleDeepLink = async ({ url }) => {
      if (!url) return;

      const isOAuthSuccess =
        url.includes('oauth_connect=success') || url.includes('email-success');
      if (!isOAuthSuccess) return;

      const subsMatch    = url.match(/[?&]subs=([^&]+)/);
      const profileMatch = url.match(/[?&]profile=([^&]+)/);
      if (!subsMatch) return;

      try {
        const subs    = JSON.parse(decodeURIComponent(subsMatch[1]));
        const profile = profileMatch
          ? JSON.parse(decodeURIComponent(profileMatch[1]))
          : {};

        await AsyncStorage.setItem(PENDING_OAUTH_DATA_KEY,    JSON.stringify({ subs, profile }));
        await AsyncStorage.setItem(PENDING_EMAIL_RESULTS_KEY, JSON.stringify(subs));

        if (!navigationRef.current?.isReady()) return;
        try {
          navigationRef.current.navigate('EmailScan', { initialResults: subs });
        } catch {
          navigationRef.current.navigate('Register');
        }
      } catch {}
    };

    Linking.getInitialURL().then(url => { if (url) handleDeepLink({ url }); });
    const sub = Linking.addEventListener('url', handleDeepLink);
    return () => sub.remove();
  }, []);

  return (
    <SafeAreaProvider>
      <AuthProvider>
        <NavigationContainer ref={navigationRef} onReady={handleNavigationReady}>
          <RootNavigator />
        </NavigationContainer>
      </AuthProvider>
    </SafeAreaProvider>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: colors.background },
});
