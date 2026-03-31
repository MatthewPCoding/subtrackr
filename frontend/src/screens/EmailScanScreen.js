import React, { useState, useEffect, useRef } from 'react';
import {
  View, Text, ScrollView, StyleSheet, TouchableOpacity,
  Image, ActivityIndicator, Alert,
} from 'react-native';
import * as WebBrowser from 'expo-web-browser';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import {
  getEmailConnectURL, importEmailSubscriptions,
  getEmailStatus, disconnectEmail,
} from '../services/api';
import { colors, spacing, radius, typography } from '../theme';

WebBrowser.maybeCompleteAuthSession();

const COMING_SOON = new Set(['yahoo', 'icloud', 'proton', 'zoho']);

const PROVIDERS = [
  { id: 'google',    name: 'Gmail',   color: '#EA4335', logo: 'https://www.google.com/s2/favicons?domain=gmail.com&sz=64' },
  { id: 'microsoft', name: 'Outlook', color: '#0078D4', logo: 'https://www.google.com/s2/favicons?domain=outlook.com&sz=64' },
  { id: 'yahoo',     name: 'Yahoo',   color: '#6001D2', logo: 'https://www.google.com/s2/favicons?domain=yahoo.com&sz=64' },
  { id: 'icloud',    name: 'iCloud',  color: '#3A7BD5', logo: 'https://www.google.com/s2/favicons?domain=icloud.com&sz=64' },
];

const SCAN_HINTS = [
  'Searching for billing emails…',
  'Detecting subscription names…',
  'Matching prices and cycles…',
  'Finalizing results…',
];

// ── Main screen ───────────────────────────────────────────────────────────────

export default function EmailScanScreen({ navigation, route }) {
  const insets = useSafeAreaInsets();

  // phase: idle | awaiting | results | done
  const [phase, setPhase] = useState('idle');
  const [connectedEmail, setConnectedEmail] = useState(null);
  const [results, setResults] = useState([]);
  const [selected, setSelected] = useState(new Set());
  const [importing, setImporting] = useState(false);
  const [error, setError] = useState('');

  // Fake progress bar for the awaiting phase
  const [progress, setProgress] = useState(0);
  const progressRef = useRef(null);

  // Show results immediately if passed in via navigation params (from deep link)
  useEffect(() => {
    const initialResults = route.params?.initialResults;
    if (Array.isArray(initialResults)) {
      setResults(initialResults);
      setSelected(new Set(initialResults.map((_, i) => i)));
      setPhase(initialResults.length > 0 ? 'results' : 'idle');
      return;
    }
    checkStatus();
  }, []);

  // Animate progress bar while awaiting OAuth result
  useEffect(() => {
    if (phase === 'awaiting') {
      setProgress(0);
      progressRef.current = setInterval(() => {
        setProgress(p => {
          if (p >= 85) { clearInterval(progressRef.current); return 85; }
          return p + 3;
        });
      }, 200);
    } else {
      clearInterval(progressRef.current);
      if (phase === 'results') setProgress(100);
    }
    return () => clearInterval(progressRef.current);
  }, [phase]);

  const checkStatus = async () => {
    try {
      const status = await getEmailStatus();
      if (status.connected) setConnectedEmail(status.email);
    } catch {}
  };

  const handleConnect = async (providerId) => {
    if (COMING_SOON.has(providerId)) {
      const name = PROVIDERS.find(p => p.id === providerId)?.name ?? providerId;
      Alert.alert('Coming soon', `${name} integration is coming soon. Try Gmail or Outlook.`);
      return;
    }

    setError('');
    try {
      const data = await getEmailConnectURL(providerId);
      if (data.coming_soon) {
        Alert.alert('Coming soon', data.message ?? 'This provider is coming soon.');
        return;
      }

      // Open in-app browser; it closes automatically when the server redirects
      // to subtrackr:// and returns the full URL here.
      setPhase('awaiting');
      const result = await WebBrowser.openAuthSessionAsync(data.url, 'subtrackr://');

      if (result.type === 'success') {
        const match = result.url.match(/[?&]subs=([^&]+)/);
        const subs = match ? JSON.parse(decodeURIComponent(match[1])) : [];
        setResults(subs);
        setSelected(new Set(subs.map((_, i) => i)));
        setPhase(subs.length > 0 ? 'results' : 'idle');
      } else {
        setPhase('idle'); // user cancelled
      }
    } catch {
      setError('Could not load the OAuth URL. Please try again.');
      setPhase('idle');
    }
  };

  const toggleSelect = (i) => {
    setSelected(prev => {
      const next = new Set(prev);
      next.has(i) ? next.delete(i) : next.add(i);
      return next;
    });
  };

  const handleImport = async () => {
    const toImport = results.filter((_, i) => selected.has(i));
    if (toImport.length === 0) {
      Alert.alert('Nothing selected', 'Select at least one subscription to import.');
      return;
    }
    setImporting(true);
    try {
      await importEmailSubscriptions(toImport);
    } catch {
      // Non-fatal
    }
    setImporting(false);
    setPhase('done');
    setResults([]);
  };

  const handleDisconnect = () => {
    Alert.alert('Disconnect email', `Remove ${connectedEmail}?`, [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Disconnect',
        style: 'destructive',
        onPress: async () => {
          await disconnectEmail();
          setConnectedEmail(null);
          setPhase('idle');
        },
      },
    ]);
  };

  // ── Render phases ──────────────────────────────────────────────────────────

  if (phase === 'awaiting') return (
    <ScanningScreen progress={progress} insets={insets} />
  );

  if (phase === 'done') return (
    <DoneScreen navigation={navigation} insets={insets} />
  );

  if (phase === 'results') return (
    <ResultsScreen
      results={results}
      selected={selected}
      importing={importing}
      onToggle={toggleSelect}
      onImport={handleImport}
      onBack={() => setPhase('idle')}
      insets={insets}
    />
  );

  // ── Idle: connect screen ───────────────────────────────────────────────────
  return (
    <ScrollView
      style={styles.container}
      contentContainerStyle={[styles.content, { paddingTop: insets.top + spacing.xxl }]}
    >
      <TouchableOpacity onPress={() => navigation.goBack()} hitSlop={12}>
        <Text style={styles.backText}>← Back</Text>
      </TouchableOpacity>

      <View style={styles.hero}>
        <View style={styles.heroIcon}>
          <Text style={styles.heroEmoji}>📬</Text>
        </View>
        <Text style={styles.heroTitle}>Import from email</Text>
        <Text style={styles.heroSubtitle}>
          Connect your inbox and we'll automatically detect subscriptions from your billing emails. We only read receipt subject lines — nothing personal.
        </Text>
      </View>

      {/* Already connected */}
      {connectedEmail && (
        <View style={styles.connectedCard}>
          <View style={{ flex: 1 }}>
            <Text style={styles.connectedLabel}>Connected</Text>
            <Text style={styles.connectedEmail}>{connectedEmail}</Text>
          </View>
          <View style={styles.connectedActions}>
            <TouchableOpacity
              style={styles.rescanBtn}
              onPress={() => handleConnect(connectedEmail.includes('@gmail') ? 'google' : 'microsoft')}
            >
              <Text style={styles.rescanBtnText}>Scan again</Text>
            </TouchableOpacity>
            <TouchableOpacity onPress={handleDisconnect} hitSlop={8}>
              <Text style={styles.disconnectText}>Disconnect</Text>
            </TouchableOpacity>
          </View>
        </View>
      )}

      {/* Provider buttons */}
      {!connectedEmail && (
        <>
          <Text style={styles.sectionLabel}>Choose your email provider</Text>
          <View style={styles.providerGrid}>
            {PROVIDERS.map(p => (
              <TouchableOpacity
                key={p.id}
                style={[styles.providerCard, { borderColor: `${p.color}44` }]}
                onPress={() => handleConnect(p.id)}
                activeOpacity={0.7}
              >
                <Image source={{ uri: p.logo }} style={styles.providerLogo} />
                <Text style={styles.providerName}>{p.name}</Text>
                {COMING_SOON.has(p.id) && (
                  <Text style={styles.comingSoonBadge}>Soon</Text>
                )}
              </TouchableOpacity>
            ))}
          </View>
        </>
      )}

      {error ? <Text style={styles.errorText}>{error}</Text> : null}

      <View style={styles.privacyNote}>
        <Text style={styles.privacyText}>
          🔒 Only billing email subject lines are analyzed. Email content is never stored.
        </Text>
      </View>
    </ScrollView>
  );
}

// ── Sub-screens ───────────────────────────────────────────────────────────────

function ScanningScreen({ progress, insets }) {
  const hintIndex = Math.min(Math.floor(progress / 25), SCAN_HINTS.length - 1);
  return (
    <View style={[styles.centered, { paddingTop: insets.top, paddingHorizontal: spacing.xxl }]}>
      <View style={styles.heroIcon}>
        <Text style={styles.heroEmoji}>🔍</Text>
      </View>
      <Text style={styles.heroTitle}>Scanning your inbox…</Text>
      <Text style={styles.heroSubtitle}>Looking for subscription receipts and billing emails.</Text>

      <View style={styles.progressTrack}>
        <View style={[styles.progressFill, { width: `${progress}%` }]} />
      </View>
      <Text style={styles.progressPct}>{Math.round(progress)}%</Text>

      <View style={styles.hintList}>
        {SCAN_HINTS.map((hint, i) => (
          <View key={i} style={styles.hintRow}>
            <Text style={[styles.hintDot, i <= hintIndex && styles.hintDotActive]}>
              {i < hintIndex ? '✓' : '·'}
            </Text>
            <Text style={[styles.hintText, i <= hintIndex && styles.hintTextActive]}>{hint}</Text>
          </View>
        ))}
      </View>
    </View>
  );
}

function ResultsScreen({ results, selected, importing, onToggle, onImport, onBack, insets }) {
  const selCount = selected.size;

  return (
    <View style={[styles.container, { paddingTop: insets.top }]}>
      <View style={styles.resultsHeader}>
        <TouchableOpacity onPress={onBack} hitSlop={12}>
          <Text style={styles.backText}>← Back</Text>
        </TouchableOpacity>
      </View>

      <ScrollView contentContainerStyle={styles.resultsList}>
        <View style={styles.heroIcon}>
          <Text style={styles.heroEmoji}>{results.length > 0 ? '✅' : '🤷'}</Text>
        </View>
        <Text style={styles.heroTitle}>
          {results.length > 0 ? `Found ${results.length} subscription${results.length === 1 ? '' : 's'}` : 'Nothing found'}
        </Text>
        <Text style={styles.heroSubtitle}>
          {results.length > 0
            ? 'Select the ones you want to add to Subtrackr.'
            : 'No billing emails were detected. You can add subscriptions manually from the Subscriptions tab.'}
        </Text>

        {results.map((sub, i) => (
          <TouchableOpacity
            key={i}
            style={[styles.resultCard, selected.has(i) && styles.resultCardSelected]}
            onPress={() => onToggle(i)}
            activeOpacity={0.7}
          >
            <View style={[styles.checkbox, selected.has(i) && styles.checkboxActive]}>
              {selected.has(i) && <Text style={styles.checkmark}>✓</Text>}
            </View>
            {sub.website
              ? <Image source={{ uri: `https://www.google.com/s2/favicons?domain=${sub.website}&sz=32` }} style={styles.resultLogo} />
              : <View style={styles.resultLogoFallback}><Text style={styles.resultLogoLetter}>{sub.name[0]}</Text></View>
            }
            <View style={{ flex: 1 }}>
              <Text style={styles.resultName}>{sub.name}</Text>
              <Text style={styles.resultMeta}>{sub.category} · {sub.billing_cycle}</Text>
            </View>
            <Text style={styles.resultPrice}>${sub.price.toFixed(2)}</Text>
          </TouchableOpacity>
        ))}
      </ScrollView>

      {results.length > 0 && (
        <View style={[styles.importBar, { paddingBottom: insets.bottom + spacing.lg }]}>
          <TouchableOpacity
            style={[styles.importBtn, (selCount === 0 || importing) && styles.importBtnDisabled]}
            onPress={onImport}
            disabled={selCount === 0 || importing}
          >
            {importing
              ? <ActivityIndicator color={colors.textPrimary} size="small" />
              : <Text style={styles.importBtnText}>
                  Import {selCount} subscription{selCount === 1 ? '' : 's'}
                </Text>
            }
          </TouchableOpacity>
        </View>
      )}
    </View>
  );
}

function DoneScreen({ navigation, insets }) {
  return (
    <View style={[styles.centered, { paddingTop: insets.top }]}>
      <View style={[styles.heroIcon, { backgroundColor: `${colors.success}22` }]}>
        <Text style={styles.heroEmoji}>🎉</Text>
      </View>
      <Text style={styles.heroTitle}>All done!</Text>
      <Text style={styles.heroSubtitle}>Your subscriptions have been imported. Review them in the Subscriptions tab.</Text>
      <TouchableOpacity
        style={styles.doneBtn}
        onPress={() => navigation.navigate('MainTabs', { screen: 'Subscriptions' })}
      >
        <Text style={styles.doneBtnText}>View subscriptions</Text>
      </TouchableOpacity>
    </View>
  );
}

// ── Styles ────────────────────────────────────────────────────────────────────

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.background },
  content: { padding: spacing.xxl, paddingBottom: 100 },
  centered: { flex: 1, backgroundColor: colors.background, alignItems: 'center', justifyContent: 'center', padding: spacing.xxl },
  backText: { fontSize: typography.md, color: colors.accent, marginBottom: spacing.xl },

  hero: { alignItems: 'center', marginBottom: spacing.xxl },
  heroIcon: { width: 72, height: 72, borderRadius: 36, backgroundColor: colors.accentMuted, alignItems: 'center', justifyContent: 'center', marginBottom: spacing.lg },
  heroEmoji: { fontSize: 32 },
  heroTitle: { fontSize: typography.xxl, fontWeight: '500', color: colors.textPrimary, textAlign: 'center', marginBottom: spacing.sm },
  heroSubtitle: { fontSize: typography.md, color: colors.textSecondary, textAlign: 'center', lineHeight: 22 },

  connectedCard: { backgroundColor: colors.surface, borderRadius: radius.md, borderWidth: 0.5, borderColor: `${colors.success}44`, padding: spacing.lg, flexDirection: 'row', alignItems: 'center', gap: spacing.md, marginBottom: spacing.xl },
  connectedLabel: { fontSize: typography.xs, color: colors.success, textTransform: 'uppercase', letterSpacing: 0.5, marginBottom: 2 },
  connectedEmail: { fontSize: typography.md, color: colors.textPrimary, fontWeight: '500' },
  connectedActions: { alignItems: 'flex-end', gap: spacing.sm },
  rescanBtn: { backgroundColor: colors.accentMuted, borderRadius: radius.sm, paddingHorizontal: spacing.md, paddingVertical: spacing.xs },
  rescanBtnText: { fontSize: typography.xs, color: colors.accent },
  disconnectText: { fontSize: typography.xs, color: colors.danger },

  sectionLabel: { fontSize: typography.xs, color: colors.textSecondary, textTransform: 'uppercase', letterSpacing: 0.5, marginBottom: spacing.md },
  providerGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.md, marginBottom: spacing.xl },
  providerCard: { flex: 1, minWidth: '45%', backgroundColor: colors.surface, borderRadius: radius.md, borderWidth: 0.5, padding: spacing.lg, alignItems: 'center', gap: spacing.sm },
  providerLogo: { width: 36, height: 36, borderRadius: 8 },
  providerName: { fontSize: typography.sm, color: colors.textPrimary, fontWeight: '500' },
  comingSoonBadge: { fontSize: typography.xs, color: colors.textMuted, backgroundColor: colors.surfaceAlt, borderRadius: radius.xs, paddingHorizontal: 6, paddingVertical: 2 },

  errorText: { fontSize: typography.sm, color: colors.danger, textAlign: 'center', marginBottom: spacing.lg },
  privacyNote: { backgroundColor: colors.surface, borderRadius: radius.md, borderWidth: 0.5, borderColor: colors.border, padding: spacing.md },
  privacyText: { fontSize: typography.xs, color: colors.textSecondary, textAlign: 'center', lineHeight: 18 },

  progressTrack: { width: '100%', height: 6, backgroundColor: colors.border, borderRadius: 3, overflow: 'hidden', marginTop: spacing.xl, marginBottom: spacing.sm },
  progressFill: { height: '100%', backgroundColor: colors.accent, borderRadius: 3 },
  progressPct: { fontSize: typography.sm, color: colors.accent, marginBottom: spacing.xl },
  hintList: { width: '100%', gap: spacing.md },
  hintRow: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm },
  hintDot: { fontSize: typography.md, color: colors.textMuted, width: 20 },
  hintDotActive: { color: colors.success },
  hintText: { fontSize: typography.md, color: colors.textMuted },
  hintTextActive: { color: colors.textSecondary },

  resultsHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingHorizontal: spacing.xxl, paddingTop: spacing.xl, paddingBottom: spacing.md },
  resultsList: { padding: spacing.xxl, paddingTop: spacing.md, paddingBottom: 120 },
  resultCard: { backgroundColor: colors.surface, borderRadius: radius.md, borderWidth: 0.5, borderColor: colors.border, padding: spacing.lg, flexDirection: 'row', alignItems: 'center', gap: spacing.md, marginBottom: spacing.sm },
  resultCardSelected: { borderColor: colors.accentBorder, backgroundColor: '#1a1428' },
  checkbox: { width: 22, height: 22, borderRadius: 6, borderWidth: 1.5, borderColor: colors.border, alignItems: 'center', justifyContent: 'center', flexShrink: 0 },
  checkboxActive: { backgroundColor: colors.accent, borderColor: colors.accent },
  checkmark: { fontSize: 12, color: colors.textPrimary, fontWeight: '600' },
  resultLogo: { width: 32, height: 32, borderRadius: 6 },
  resultLogoFallback: { width: 32, height: 32, borderRadius: 6, backgroundColor: colors.surfaceAlt, alignItems: 'center', justifyContent: 'center' },
  resultLogoLetter: { fontSize: typography.md, color: colors.accent, fontWeight: '500' },
  resultName: { fontSize: typography.md, fontWeight: '500', color: colors.textPrimary, marginBottom: 2 },
  resultMeta: { fontSize: typography.xs, color: colors.textSecondary },
  resultPrice: { fontSize: typography.md, fontWeight: '500', color: colors.accent },

  importBar: { position: 'absolute', bottom: 0, left: 0, right: 0, backgroundColor: colors.background, borderTopWidth: 0.5, borderTopColor: colors.border, paddingHorizontal: spacing.xxl, paddingTop: spacing.lg },
  importBtn: { backgroundColor: colors.accent, borderRadius: radius.md, padding: spacing.lg, alignItems: 'center' },
  importBtnDisabled: { opacity: 0.4 },
  importBtnText: { color: colors.textPrimary, fontSize: typography.md, fontWeight: '500' },

  doneBtn: { backgroundColor: colors.accent, borderRadius: radius.md, paddingHorizontal: spacing.xxl, paddingVertical: spacing.lg, marginTop: spacing.xl },
  doneBtnText: { color: colors.textPrimary, fontSize: typography.md, fontWeight: '500' },
});
