import React, { useEffect, useRef } from 'react';
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

// ── OAuth popup relay (web only) ──────────────────────────────────────────────
// When the backend redirects the OAuth popup back to this URL with
// ?oauth_connect=success&subs=...&profile=..., this code runs immediately
// (before React renders), sends the result to the parent window, and closes.
if (typeof window !== 'undefined' && window.opener) {
  try {
    const params = new URLSearchParams(window.location.search);
    const status = params.get('oauth_connect');
    if (status === 'success') {
      const subs    = JSON.parse(decodeURIComponent(params.get('subs')    || '[]'));
      const profile = JSON.parse(decodeURIComponent(params.get('profile') || '{}'));
      window.opener.postMessage(
        { type: 'oauth_connect', status: 'success', subs, profile },
        window.location.origin,
      );
    } else if (status === 'error') {
      window.opener.postMessage(
        { type: 'oauth_connect', status: 'error' },
        window.location.origin,
      );
    }
    if (status) window.close();
  } catch {}
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

  // ── postMessage listener: receives OAuth result from the popup (web only) ──
  useEffect(() => {
    if (typeof window === 'undefined') return;

    const handleMessage = async (event) => {
      if (event.origin !== window.location.origin) return;
      if (event.data?.type !== 'oauth_connect') return;

      if (event.data.status !== 'success') return;

      const { subs, profile } = event.data;
      try {
        await AsyncStorage.setItem(
          PENDING_OAUTH_DATA_KEY,
          JSON.stringify({ subs, profile }),
        );
        await AsyncStorage.setItem(PENDING_EMAIL_RESULTS_KEY, JSON.stringify(subs));

        if (navigationRef.current?.isReady()) {
          navigationRef.current.navigate('Register');
        }
      } catch {}
    };

    window.addEventListener('message', handleMessage);
    return () => window.removeEventListener('message', handleMessage);
  }, []);

  // ── Deep link handler: native app + full-page redirect fallback ────────────
  useEffect(() => {
    const handleDeepLink = async ({ url }) => {
      if (!url) return;

      // Web full-page redirect: https://www.subtrackr.live/?oauth_connect=success&...
      // Legacy native deep-link:  subtrackr://email-success?subs=...
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

        await AsyncStorage.setItem(
          PENDING_OAUTH_DATA_KEY,
          JSON.stringify({ subs, profile }),
        );
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
        <NavigationContainer ref={navigationRef}>
          <RootNavigator />
        </NavigationContainer>
      </AuthProvider>
    </SafeAreaProvider>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: colors.background },
});
