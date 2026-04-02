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

  useEffect(() => {
    const handleDeepLink = async ({ url }) => {
      if (!url) return;

      // Web-redirect format: https://www.subtrackr.live/?oauth_connect=success&subs=...&profile=...
      // Legacy native deep-link format: subtrackr://email-success?subs=...
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

        // Store full OAuth payload for RegisterScreen (unauthenticated path)
        await AsyncStorage.setItem(
          PENDING_OAUTH_DATA_KEY,
          JSON.stringify({ subs, profile }),
        );
        // Store subs separately for EmailScanScreen (authenticated path)
        await AsyncStorage.setItem(PENDING_EMAIL_RESULTS_KEY, JSON.stringify(subs));

        if (!navigationRef.current?.isReady()) return;

        try {
          // Authenticated: jump straight to scan results
          navigationRef.current.navigate('EmailScan', { initialResults: subs });
        } catch {
          // Unauthenticated: go to Register — RegisterScreen will pick up the stored data
          navigationRef.current.navigate('Register');
        }
      } catch {
        // Malformed URL — ignore
      }
    };

    Linking.getInitialURL().then(url => { if (url) handleDeepLink({ url }); });

    // App already running, brought to foreground via deep link
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
