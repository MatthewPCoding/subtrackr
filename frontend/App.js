import React, { useEffect, useRef, useCallback } from 'react';
import { View, StyleSheet } from 'react-native';
import * as Linking from 'expo-linking';
import { NavigationContainer } from '@react-navigation/native';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { AuthProvider, useAuth } from './src/hooks/useAuth';
import AppNavigator from './src/navigation/AppNavigator';
import AuthNavigator from './src/navigation/AuthNavigator';
import SupportChat from './src/components/SupportChat';
import { colors } from './src/theme';
import { PENDING_EMAIL_RESULTS_KEY, PENDING_OAUTH_DATA_KEY } from './src/services/api';

// ── OAuth popup relay (web only, runs before React) ───────────────────────────
// When the backend redirects the OAuth popup back to this domain, this code
// runs immediately, posts the result to the parent window, and closes the popup.
// Uses new URL() rather than URLSearchParams(window.location.search) — more
// reliable in Expo Web where the router may rewrite location.search.
if (typeof window !== 'undefined' && window.opener) {
  try {
    const url         = new URL(window.location.href);
    const oauthStatus = url.searchParams.get('oauth_connect');
    const authStatus  = url.searchParams.get('auth_result');

    if (oauthStatus) {
      if (oauthStatus === 'success') {
        const subs    = JSON.parse(decodeURIComponent(url.searchParams.get('subs')    || '[]'));
        const profile = JSON.parse(decodeURIComponent(url.searchParams.get('profile') || '{}'));
        window.opener.postMessage(
          { type: 'oauth_connect', status: 'success', subs, profile },
          window.location.origin,
        );
      } else {
        window.opener.postMessage(
          { type: 'oauth_connect', status: 'error' },
          window.location.origin,
        );
      }
      window.close();
    } else if (authStatus) {
      if (authStatus === 'success') {
        const token = decodeURIComponent(url.searchParams.get('token') || '');
        window.opener.postMessage(
          { type: 'auth_result', status: 'success', token },
          window.location.origin,
        );
      } else {
        window.opener.postMessage(
          { type: 'auth_result', status: authStatus },
          window.location.origin,
        );
      }
      window.close();
    }
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
  const navigationRef   = useRef(null);
  const pendingNavigate = useRef(null); // queued screen name to navigate when ready

  // Navigate once the NavigationContainer is mounted and ready.
  const handleNavigationReady = useCallback(() => {
    if (pendingNavigate.current) {
      navigationRef.current.navigate(pendingNavigate.current);
      pendingNavigate.current = null;
    }
  }, []);

  // Helper — navigate now if ready, otherwise queue for onReady.
  const navigate = useCallback((screen) => {
    if (navigationRef.current?.isReady()) {
      navigationRef.current.navigate(screen);
    } else {
      pendingNavigate.current = screen;
    }
  }, []);

  // ── postMessage listener: popup → parent (registration, web only) ──────────
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
        navigate('Register');
      } catch {}
    };

    window.addEventListener('message', handleMessage);
    return () => window.removeEventListener('message', handleMessage);
  }, [navigate]);

  // ── Linking: detect OAuth redirect on initial load and URL changes ──────────
  // Handles the direct-landing case (main window navigated to the redirect URL)
  // and native deep links. auth_result (login) is handled inside LoginScreen
  // because it needs access to signIn from AuthContext.
  useEffect(() => {
    const handleURL = async (url) => {
      if (!url) return;
      if (!url.includes('oauth_connect=success')) return;

      try {
        const parsed  = Linking.parse(url);
        const qp      = parsed.queryParams || {};
        const subs    = JSON.parse(decodeURIComponent(qp.subs    || '[]'));
        const profile = JSON.parse(decodeURIComponent(qp.profile || '{}'));

        await AsyncStorage.setItem(PENDING_OAUTH_DATA_KEY,    JSON.stringify({ subs, profile }));
        await AsyncStorage.setItem(PENDING_EMAIL_RESULTS_KEY, JSON.stringify(subs));

        // Clean query params from the address bar (web only)
        if (typeof window !== 'undefined') {
          window.history.replaceState({}, '', window.location.pathname);
        }

        navigate('Register');
      } catch {}
    };

    // App opened via OAuth redirect (cold start)
    Linking.getInitialURL().then(url => { if (url) handleURL(url); });

    // URL changed while app was already open (native foreground deep link)
    const sub = Linking.addEventListener('url', ({ url }) => handleURL(url));
    return () => sub.remove();
  }, [navigate]);

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
