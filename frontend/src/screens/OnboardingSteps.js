import React, { useState, useEffect, useRef, useCallback } from 'react';
import {
  View, Text, StyleSheet, TouchableOpacity, ScrollView, Image,
  ActivityIndicator, Alert,
} from 'react-native';
import * as WebBrowser from 'expo-web-browser';
import { colors, spacing, radius, typography } from '../theme';
import { getEmailConnectURL } from '../services/api';

WebBrowser.maybeCompleteAuthSession();

const COMING_SOON_PROVIDERS = new Set(['yahoo', 'icloud', 'proton', 'zoho']);

// ── Email services data ───────────────────────────────────────────────────────

const EMAIL_SERVICES = [
  { id: 'google',    name: 'Gmail',   color: '#EA4335', letter: 'G', logo: 'https://www.google.com/s2/favicons?domain=gmail.com&sz=64' },
  { id: 'microsoft', name: 'Outlook', color: '#0078D4', letter: 'O', logo: 'https://www.google.com/s2/favicons?domain=outlook.com&sz=64' },
  { id: 'yahoo', name: 'Yahoo Mail', color: '#6001D2', letter: 'Y', logo: 'https://www.google.com/s2/favicons?domain=yahoo.com&sz=64' },
  { id: 'icloud', name: 'iCloud Mail', color: '#3A82F7', letter: 'i', logo: 'https://www.google.com/s2/favicons?domain=icloud.com&sz=64' },
  { id: 'proton', name: 'Proton Mail', color: '#6D4AFF', letter: 'P', logo: 'https://www.google.com/s2/favicons?domain=proton.me&sz=64' },
  { id: 'zoho', name: 'Zoho Mail', color: '#E42527', letter: 'Z', logo: 'https://www.google.com/s2/favicons?domain=zoho.com&sz=64' },
];

// ── Email Service Emblem ──────────────────────────────────────────────────────

function ServiceEmblem({ service, onSelect, loading }) {
  const [hovered, setHovered] = useState(false);
  const [pressed, setPressed] = useState(false);

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
        onPress={() => onSelect(service.id)}
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
          : <Image source={{ uri: service.logo }} style={styles.emblemLogo} onError={() => {}} />
        }
      </TouchableOpacity>
    </View>
  );
}

// ── Step 1: Email Connect ─────────────────────────────────────────────────────

export function EmailConnectStep({ onNext }) {
  const [loadingProvider, setLoadingProvider] = useState(null);

  const handleSelectService = async (serviceId) => {
    if (loadingProvider) return;
    if (COMING_SOON_PROVIDERS.has(serviceId)) {
      const name = EMAIL_SERVICES.find(s => s.id === serviceId)?.name || serviceId;
      Alert.alert('Coming soon', `${name} integration is coming soon. Try Gmail or Outlook.`);
      return;
    }

    setLoadingProvider(serviceId);
    try {
      const data = await getEmailConnectURL(serviceId);
      if (data.coming_soon) {
        Alert.alert('Coming soon', data.message || 'This provider is coming soon.');
        return;
      }

      const result = await WebBrowser.openAuthSessionAsync(
        data.url,
        'https://www.subtrackr.live',
      );
      if (result.type !== 'success') return; // cancelled — stay on screen

      if (result.url.includes('oauth_connect=error')) {
        Alert.alert('Connection failed', 'Could not connect your email. Please try again.');
        return;
      }

      const subsMatch    = result.url.match(/[?&]subs=([^&]+)/);
      const profileMatch = result.url.match(/[?&]profile=([^&]+)/);
      const subs    = subsMatch    ? JSON.parse(decodeURIComponent(subsMatch[1]))    : [];
      const profile = profileMatch ? JSON.parse(decodeURIComponent(profileMatch[1])) : {};
      onNext({ type: 'oauth', provider: serviceId, subs, profile });
    } catch {
      Alert.alert('Error', 'Could not connect. Please try again.');
    } finally {
      setLoadingProvider(null);
    }
  };

  return (
    <View style={styles.container}>
      <ScrollView contentContainerStyle={styles.inner}>
        <View style={styles.iconCircle}>
          <Text style={styles.iconText}>📬</Text>
        </View>
        <Text style={styles.title}>Find your subscriptions</Text>
        <Text style={styles.subtitle}>
          Connect your email and we'll automatically detect subscriptions from your billing emails. Nothing is stored — we only scan for receipts.
        </Text>

        <View style={styles.emblems}>
          {EMAIL_SERVICES.map(service => (
            <ServiceEmblem
              key={service.id}
              service={service}
              onSelect={handleSelectService}
              loading={loadingProvider === service.id}
            />
          ))}
        </View>

        <View style={styles.privacyNote}>
          <Text style={styles.privacyText}>
            🔒 We never store your emails or read personal messages. Only billing receipts are analyzed.
          </Text>
        </View>

        <TouchableOpacity style={styles.skipBtn} onPress={() => onNext({ type: 'skip' })}>
          <Text style={styles.skipText}>Skip, I'll add manually</Text>
        </TouchableOpacity>
      </ScrollView>
    </View>
  );
}

// ── Step 2: Scanning ──────────────────────────────────────────────────────────
// initialResults - pre-loaded results from deep link; skips OAuth entirely
// provider       - used only when initialResults is absent (runs OAuth flow)
// onImport       - called with array of selected subscription objects
// onSkip         - called when user skips without importing

export function ScanningStep({ initialResults, onImport, onSkip }) {
  const subs = Array.isArray(initialResults) ? initialResults : [];

  const [phase, setPhase]       = useState(subs.length > 0 ? 'results' : 'empty');
  const [results]               = useState(subs);
  const [selected, setSelected] = useState(new Set(subs.map((_, i) => i)));
  const [errorMsg]              = useState('');
  const progressRef             = useRef(null);

  useEffect(() => {
    return () => clearInterval(progressRef.current);
  }, []);

  const toggleSelect = (i) => {
    setSelected(prev => {
      const next = new Set(prev);
      if (next.has(i)) next.delete(i); else next.add(i);
      return next;
    });
  };

  const handleImport = () => {
    const chosen = results.filter((_, i) => selected.has(i));
    onImport(chosen);
  };

  const HINTS = [
    'Searching for billing emails...',
    'Detecting subscription names...',
    'Matching prices and dates...',
  ];

  // ── Opening ──
  if (phase === 'opening') {
    return (
      <View style={styles.container}>
        <View style={styles.inner}>
          <ActivityIndicator color={colors.accent} size="large" style={{ marginBottom: spacing.xl }} />
          <Text style={styles.title}>Connecting...</Text>
        </View>
      </View>
    );
  }

  // ── Awaiting browser ──
  if (phase === 'awaiting') {
    return (
      <View style={styles.container}>
        <View style={styles.inner}>
          <View style={styles.iconCircle}>
            <Text style={styles.iconText}>📧</Text>
          </View>
          <Text style={styles.title}>Complete sign-in in your browser</Text>
          <Text style={styles.subtitle}>
            Once you approve access, we'll scan your inbox automatically.
          </Text>
          <View style={styles.awaitingPulse}>
            <ActivityIndicator color={colors.accent} />
            <Text style={styles.awaitingText}>Waiting for connection...</Text>
          </View>
          <TouchableOpacity style={styles.skipBtn} onPress={onSkip}>
            <Text style={styles.skipText}>Cancel</Text>
          </TouchableOpacity>
        </View>
      </View>
    );
  }

  // ── Scanning ──
  if (phase === 'scanning') {
    return (
      <View style={styles.container}>
        <View style={styles.inner}>
          <View style={styles.iconCircle}>
            <Text style={styles.iconText}>🔍</Text>
          </View>
          <Text style={styles.title}>Scanning your inbox...</Text>
          <Text style={styles.subtitle}>Looking for subscription receipts and billing emails.</Text>
          <View style={styles.progressTrack}>
            <View style={[styles.progressFill, { width: `${progress}%` }]} />
          </View>
          <Text style={styles.progressText}>{Math.round(progress)}%</Text>
          <View style={styles.scanningHints}>
            {HINTS.map((hint, i) => (
              <View key={i} style={styles.hintRow}>
                <Text style={[styles.hintDot, progress > i * 33 && styles.hintDotActive]}>
                  {progress > i * 33 ? '✓' : '·'}
                </Text>
                <Text style={[styles.scanHint, progress > i * 33 && styles.scanHintActive]}>
                  {hint}
                </Text>
              </View>
            ))}
          </View>
        </View>
      </View>
    );
  }

  // ── Empty results ──
  if (phase === 'empty') {
    return (
      <View style={styles.container}>
        <View style={styles.inner}>
          <View style={[styles.iconCircle, { backgroundColor: colors.border }]}>
            <Text style={styles.iconText}>🔍</Text>
          </View>
          <Text style={styles.title}>No subscriptions found</Text>
          <Text style={styles.subtitle}>
            We couldn't find any subscription billing emails. You can add them manually.
          </Text>
          <TouchableOpacity style={styles.allowBtn} onPress={onSkip}>
            <Text style={styles.allowBtnText}>Continue →</Text>
          </TouchableOpacity>
        </View>
      </View>
    );
  }

  // ── Error ──
  if (phase === 'error') {
    return (
      <View style={styles.container}>
        <View style={styles.inner}>
          <View style={[styles.iconCircle, { backgroundColor: colors.danger + '22' }]}>
            <Text style={styles.iconText}>⚠️</Text>
          </View>
          <Text style={styles.title}>Something went wrong</Text>
          <Text style={styles.subtitle}>{errorMsg}</Text>
          <TouchableOpacity style={styles.allowBtn} onPress={() => { setPhase('opening'); setErrorMsg(''); }}>
            <Text style={styles.allowBtnText}>Try again</Text>
          </TouchableOpacity>
          <TouchableOpacity style={styles.skipBtn} onPress={onSkip}>
            <Text style={styles.skipText}>Skip</Text>
          </TouchableOpacity>
        </View>
      </View>
    );
  }

  // ── Results ──
  const selectedCount = selected.size;
  return (
    <View style={styles.container}>
      <ScrollView contentContainerStyle={styles.inner}>
        <View style={[styles.iconCircle, { backgroundColor: colors.success + '22' }]}>
          <Text style={styles.iconText}>✅</Text>
        </View>
        <Text style={styles.title}>Found {results.length} subscription{results.length !== 1 ? 's' : ''}</Text>
        <Text style={styles.subtitle}>Select which ones to import. You can edit them anytime.</Text>

        <View style={styles.foundList}>
          {results.map((sub, i) => (
            <TouchableOpacity
              key={i}
              style={[styles.foundItem, selected.has(i) && styles.foundItemSelected]}
              onPress={() => toggleSelect(i)}
              activeOpacity={0.7}
            >
              <Image
                source={{ uri: `https://www.google.com/s2/favicons?domain=${sub.website || sub.name.toLowerCase().replace(/\s/g, '')}.com&sz=32` }}
                style={styles.foundLogo}
              />
              <View style={styles.foundInfo}>
                <Text style={styles.foundName}>{sub.name}</Text>
                <Text style={styles.foundMeta}>
                  {sub.category} · ${typeof sub.price === 'number' ? sub.price.toFixed(2) : sub.price}/{sub.billing_cycle === 'annually' ? 'yr' : 'mo'}
                </Text>
              </View>
              <View style={[styles.checkbox, selected.has(i) && styles.checkboxActive]}>
                {selected.has(i) && <Text style={styles.checkmark}>✓</Text>}
              </View>
            </TouchableOpacity>
          ))}
        </View>

        <TouchableOpacity
          style={[styles.allowBtn, selectedCount === 0 && styles.allowBtnDisabled]}
          onPress={handleImport}
          disabled={selectedCount === 0}
        >
          <Text style={styles.allowBtnText}>
            Import {selectedCount > 0 ? `${selectedCount} selected` : 'selected'}
          </Text>
        </TouchableOpacity>
        <TouchableOpacity style={styles.skipBtn} onPress={onSkip}>
          <Text style={styles.skipText}>Skip</Text>
        </TouchableOpacity>
      </ScrollView>
    </View>
  );
}

// ── Step 3: Terms & Conditions ────────────────────────────────────────────────

export function TermsStep({ onAgree }) {
  const [agreed, setAgreed] = useState(false);
  const [scrolledToBottom, setScrolledToBottom] = useState(false);

  const handleScroll = ({ nativeEvent }) => {
    const { layoutMeasurement, contentOffset, contentSize } = nativeEvent;
    const isBottom = layoutMeasurement.height + contentOffset.y >= contentSize.height - 40;
    if (isBottom) setScrolledToBottom(true);
  };

  return (
    <View style={styles.container}>
      <View style={styles.termsInner}>
        <Text style={styles.title}>Terms of Service</Text>
        <Text style={styles.subtitle}>Please read and agree before continuing.</Text>

        <ScrollView
          style={styles.termsScroll}
          onScroll={handleScroll}
          scrollEventThrottle={16}
          showsVerticalScrollIndicator
        >
          <Text style={styles.termsText}>
            {`Last updated: March 2026\n\n1. ACCEPTANCE OF TERMS\n\nBy accessing and using Subtrackr ("the App"), you accept and agree to be bound by these Terms of Service. If you do not agree, please do not use the App.\n\n2. USE OF THE SERVICE\n\nSubtrackr is a personal subscription management tool. You may use it to track, manage, and analyze your subscription services. You agree to use the App only for lawful purposes and in accordance with these Terms.\n\n3. YOUR ACCOUNT\n\nYou are responsible for maintaining the confidentiality of your account credentials. You agree to notify us immediately of any unauthorized access to your account.\n\n4. PRIVACY & DATA\n\nWe take your privacy seriously. We collect only the information necessary to provide the service. We do not sell your personal data to third parties. Email scanning features (when enabled) only analyze billing-related emails and never store email content. All data is encrypted in transit and at rest.\n\n5. SUBSCRIPTION DATA\n\nThe subscription information you enter is yours. We use it only to provide the service features you request, including spending analysis, alerts, and AI-powered recommendations.\n\n6. AI FEATURES\n\nThe AI-powered features in Subtrackr are provided for informational purposes only. They do not constitute financial advice. Always verify pricing and deals directly with service providers.\n\n7. THIRD PARTY SERVICES\n\nSubtrackr may display logos and information from third-party services for identification purposes. We are not affiliated with, endorsed by, or sponsored by any third-party subscription service.\n\n8. LIMITATION OF LIABILITY\n\nSubtrackr is provided "as is" without warranties of any kind. We are not liable for any indirect, incidental, or consequential damages arising from your use of the App.\n\n9. CHANGES TO TERMS\n\nWe may update these Terms from time to time. We will notify you of significant changes via email or in-app notification. Continued use of the App after changes constitutes acceptance.\n\n10. CONTACT\n\nIf you have questions about these Terms, please contact us through the app's support feature.\n\nThank you for using Subtrackr.`}
          </Text>
        </ScrollView>

        {!scrolledToBottom && (
          <Text style={styles.scrollHint}>Scroll to read all terms ↓</Text>
        )}

        <TouchableOpacity style={styles.checkRow} onPress={() => setAgreed(!agreed)}>
          <View style={[styles.checkbox, agreed && styles.checkboxActive]}>
            {agreed && <Text style={styles.checkmark}>✓</Text>}
          </View>
          <Text style={styles.checkLabel}>
            I have read and agree to the Terms of Service
          </Text>
        </TouchableOpacity>

        <TouchableOpacity
          style={[styles.allowBtn, !agreed && styles.allowBtnDisabled]}
          onPress={onAgree}
          disabled={!agreed}
        >
          <Text style={styles.allowBtnText}>Create my account</Text>
        </TouchableOpacity>
      </View>
    </View>
  );
}

// ── Styles ────────────────────────────────────────────────────────────────────

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.background },
  inner: { flexGrow: 1, padding: spacing.xxl, justifyContent: 'center' },
  termsInner: { flex: 1, padding: spacing.xxl, paddingTop: spacing.xxxl },
  iconCircle: { width: 72, height: 72, borderRadius: 36, backgroundColor: colors.accentMuted, alignItems: 'center', justifyContent: 'center', marginBottom: spacing.xl, alignSelf: 'center' },
  iconText: { fontSize: 32 },
  title: { fontSize: typography.xxl, fontWeight: '500', color: colors.textPrimary, textAlign: 'center', marginBottom: spacing.md },
  subtitle: { fontSize: typography.md, color: colors.textSecondary, textAlign: 'center', lineHeight: 22, marginBottom: spacing.xxl },

  // Emblems grid
  emblems: { flexDirection: 'row', flexWrap: 'wrap', justifyContent: 'center', gap: spacing.lg, marginBottom: spacing.xl },
  emblemWrapper: { alignItems: 'center', position: 'relative' },
  emblem: { width: 64, height: 64, borderRadius: radius.lg, borderWidth: 1, alignItems: 'center', justifyContent: 'center', cursor: 'pointer' },
  emblemLogo: { width: 36, height: 36, borderRadius: 8 },

  // Tooltip
  tooltip: { position: 'absolute', bottom: 72, backgroundColor: colors.surface, borderRadius: radius.sm, borderWidth: 0.5, borderColor: colors.border, paddingHorizontal: spacing.md, paddingVertical: spacing.xs, zIndex: 99, minWidth: 80, alignItems: 'center' },
  tooltipText: { fontSize: typography.xs, color: colors.textPrimary, fontWeight: '500', whiteSpace: 'nowrap' },
  tooltipArrow: { position: 'absolute', bottom: -5, width: 8, height: 8, backgroundColor: colors.surface, borderRightWidth: 0.5, borderBottomWidth: 0.5, borderColor: colors.border, transform: [{ rotate: '45deg' }] },

  privacyNote: { backgroundColor: colors.surface, borderRadius: radius.md, borderWidth: 0.5, borderColor: colors.border, padding: spacing.md, marginBottom: spacing.lg },
  privacyText: { fontSize: typography.xs, color: colors.textSecondary, lineHeight: 18, textAlign: 'center' },
  skipBtn: { alignItems: 'center', paddingVertical: spacing.lg },
  skipText: { fontSize: typography.md, color: colors.textSecondary },
  allowBtn: { backgroundColor: colors.accent, borderRadius: radius.md, padding: spacing.lg, alignItems: 'center', marginBottom: spacing.md },
  allowBtnDisabled: { backgroundColor: colors.border },
  allowBtnText: { color: colors.textPrimary, fontSize: typography.md, fontWeight: '500' },

  progressTrack: { height: 6, backgroundColor: colors.border, borderRadius: 3, overflow: 'hidden', marginBottom: spacing.sm },
  progressFill: { height: '100%', backgroundColor: colors.accent, borderRadius: 3 },
  progressText: { fontSize: typography.sm, color: colors.accent, textAlign: 'center', marginBottom: spacing.xl },
  scanningHints: { gap: spacing.md },
  hintRow: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm },
  hintDot: { fontSize: typography.md, color: colors.textMuted, width: 20 },
  hintDotActive: { color: colors.success },
  scanHint: { fontSize: typography.md, color: colors.textMuted },
  scanHintActive: { color: colors.textSecondary },

  foundList: { gap: spacing.sm, marginBottom: spacing.lg },
  foundItem: { backgroundColor: colors.surface, borderRadius: radius.md, borderWidth: 0.5, borderColor: colors.border, padding: spacing.lg, flexDirection: 'row', alignItems: 'center', gap: spacing.md },
  foundLogo: { width: 32, height: 32, borderRadius: 6 },
  foundInfo: { flex: 1 },
  foundName: { fontSize: typography.md, fontWeight: '500', color: colors.textPrimary },
  foundMeta: { fontSize: typography.xs, color: colors.textSecondary },
  foundItemSelected: { borderColor: colors.accentBorder, backgroundColor: colors.accentMuted },
  awaitingPulse: { flexDirection: 'row', alignItems: 'center', gap: spacing.md, backgroundColor: colors.surface, borderRadius: radius.md, borderWidth: 0.5, borderColor: colors.border, padding: spacing.lg, marginBottom: spacing.xl },
  awaitingText: { fontSize: typography.md, color: colors.textSecondary },
  checkbox: { width: 22, height: 22, borderRadius: 6, borderWidth: 1.5, borderColor: colors.border, alignItems: 'center', justifyContent: 'center', flexShrink: 0 },
  checkboxActive: { backgroundColor: colors.accent, borderColor: colors.accent },
  checkmark: { fontSize: 12, color: colors.textPrimary, fontWeight: '600' },

  termsScroll: { flex: 1, backgroundColor: colors.surface, borderRadius: radius.md, borderWidth: 0.5, borderColor: colors.border, padding: spacing.lg, marginBottom: spacing.md },
  termsText: { fontSize: typography.sm, color: colors.textSecondary, lineHeight: 22 },
  scrollHint: { fontSize: typography.xs, color: colors.textMuted, textAlign: 'center', marginBottom: spacing.sm },
  checkRow: { flexDirection: 'row', alignItems: 'center', gap: spacing.md, marginBottom: spacing.lg, paddingVertical: spacing.sm },
  checkbox: { width: 22, height: 22, borderRadius: 6, borderWidth: 1.5, borderColor: colors.border, alignItems: 'center', justifyContent: 'center', flexShrink: 0 },
  checkboxActive: { backgroundColor: colors.accent, borderColor: colors.accent },
  checkmark: { fontSize: 13, color: colors.textPrimary, fontWeight: '500' },
  checkLabel: { fontSize: typography.sm, color: colors.textSecondary, flex: 1, lineHeight: 20 },
});
