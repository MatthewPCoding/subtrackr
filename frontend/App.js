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
  const pendingNavigate = useRef(null);

  // Fire any queued navigation once NavigationContainer is ready.
  const handleNavigationReady = useCallback(() => {
    if (pendingNavigate.current) {
      navigationRef.current.navigate(pendingNavigate.current);
      pendingNavigate.current = null;
    }
  }, []);

  const navigate = useCallback((screen) => {
    if (navigationRef.current?.isReady()) {
      navigationRef.current.navigate(screen);
    } else {
      pendingNavigate.current = screen;
    }
  }, []);

  // ── postMessage from oauth-callback.html (registration, web only) ───────────
  // oauth-callback.html sends: { oauth_connect, subs, profile, ... }
  // subs and profile arrive as encoded strings and are parsed here.
  useEffect(() => {
    if (typeof window === 'undefined') return;

    const handleMessage = async (event) => {
      if (event.origin !== 'https://www.subtrackr.live') return;
      if (event.data?.oauth_connect !== 'success') return;

      try {
        const subs    = JSON.parse(decodeURIComponent(event.data.subs    || '[]'));
        const profile = JSON.parse(decodeURIComponent(event.data.profile || '{}'));

        await AsyncStorage.setItem(PENDING_OAUTH_DATA_KEY,    JSON.stringify({ subs, profile }));
        await AsyncStorage.setItem(PENDING_EMAIL_RESULTS_KEY, JSON.stringify(subs));
        navigate('Register');
      } catch {}
    };

    window.addEventListener('message', handleMessage);
    return () => window.removeEventListener('message', handleMessage);
  }, [navigate]);

  // ── Linking: fallback for when oauth-callback.html redirects the main window ─
  // If the popup was blocked or window.opener was null, oauth-callback.html
  // redirects to https://www.subtrackr.live/?oauth_connect=success&...
  // Linking.getInitialURL picks this up on cold start.
  useEffect(() => {
    const handleURL = async (url) => {
      if (!url?.includes('oauth_connect=success')) return;
      try {
        const parsed  = Linking.parse(url);
        const qp      = parsed.queryParams || {};
        const subs    = JSON.parse(decodeURIComponent(qp.subs    || '[]'));
        const profile = JSON.parse(decodeURIComponent(qp.profile || '{}'));

        await AsyncStorage.setItem(PENDING_OAUTH_DATA_KEY,    JSON.stringify({ subs, profile }));
        await AsyncStorage.setItem(PENDING_EMAIL_RESULTS_KEY, JSON.stringify(subs));

        if (typeof window !== 'undefined') {
          window.history.replaceState({}, '', window.location.pathname);
        }
        navigate('Register');
      } catch {}
    };

    Linking.getInitialURL().then(url => { if (url) handleURL(url); });
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
