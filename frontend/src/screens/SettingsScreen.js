import React, { useState, useEffect, useRef, useCallback } from 'react';
import {
  View, Text, ScrollView, StyleSheet, TouchableOpacity,
  TextInput, Alert, Switch, Modal, Animated, ActivityIndicator,
  Linking, AppState,
} from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useFocusEffect } from '@react-navigation/native';
import { useAuth } from '../hooks/useAuth';
import { colors, spacing, radius, typography } from '../theme';
import {
  getEmailStatus, getEmailConnectURL,
  disconnectEmail, scanEmails, importEmailSubscriptions,
} from '../services/api';

export const INCOME_KEY = '@subtrackr/monthly_income';

export default function SettingsScreen() {
  const { signOut } = useAuth();
  const insets = useSafeAreaInsets();

  const [monthlyIncome, setMonthlyIncome]               = useState('3000');
  const [renewalDays, setRenewalDays]                   = useState('7');
  const [trialDays, setTrialDays]                       = useState('3');
  const [notificationsEnabled, setNotificationsEnabled] = useState(true);
  const [signOutVisible, setSignOutVisible]             = useState(false);
  const fadeAnim = useRef(new Animated.Value(0)).current;

  // ── Email connection state ───────────────────────────────────────────────────
  const [emailStatus, setEmailStatus]   = useState(null); // null | { connected, email }
  const [emailLoading, setEmailLoading] = useState(true);

  // Rescan modal
  const [rescanVisible, setRescanVisible]   = useState(false);
  const [rescanPhase, setRescanPhase]       = useState('idle'); // idle | scanning | results | empty | error
  const [rescanProgress, setRescanProgress] = useState(0);
  const [rescanResults, setRescanResults]   = useState([]);
  const [rescanSelected, setRescanSelected] = useState(new Set());
  const [rescanError, setRescanError]       = useState('');
  const [importing, setImporting]           = useState(false);
  const progressRef    = useRef(null);
  const appStateRef    = useRef(AppState.currentState);
  const appStateSub    = useRef(null);

  // Connect flow (for adding email from settings)
  const [connectPhase, setConnectPhase] = useState('idle'); // idle | awaiting
  const [connectProvider, setConnectProvider] = useState(null);

  useFocusEffect(useCallback(() => {
    AsyncStorage.getItem(INCOME_KEY).then(val => { if (val) setMonthlyIncome(val); });
    loadEmailStatus();
  }, []));

  const loadEmailStatus = async () => {
    setEmailLoading(true);
    try {
      const status = await getEmailStatus();
      setEmailStatus(status);
    } catch {
      setEmailStatus({ connected: false });
    } finally {
      setEmailLoading(false);
    }
  };

  // ── Settings handlers ────────────────────────────────────────────────────────

  const handleSave = async () => {
    const parsed = parseFloat(monthlyIncome);
    if (isNaN(parsed) || parsed <= 0) {
      Alert.alert('Invalid', 'Please enter a valid monthly income.');
      return;
    }
    await AsyncStorage.setItem(INCOME_KEY, String(parsed));
    Alert.alert('Saved', 'Your settings have been saved.');
  };

  const showSignOut = () => {
    setSignOutVisible(true);
    Animated.timing(fadeAnim, { toValue: 1, duration: 200, useNativeDriver: true }).start();
  };

  const hideSignOut = (then) => {
    Animated.timing(fadeAnim, { toValue: 0, duration: 150, useNativeDriver: true }).start(() => {
      setSignOutVisible(false);
      if (then) then();
    });
  };

  // ── Email connect (from Settings) ────────────────────────────────────────────

  const PROVIDERS = [
    { id: 'google',    name: 'Gmail',   color: '#EA4335' },
    { id: 'microsoft', name: 'Outlook', color: '#0078D4' },
    { id: 'yahoo',     name: 'Yahoo',   color: '#6001D2' },
  ];

  const handleConnectEmail = async (providerId) => {
    setConnectProvider(providerId);
    setConnectPhase('awaiting');
    try {
      const { url } = await getEmailConnectURL(providerId);

      // Backend handles the code exchange; when user returns to the app
      // the grant_id is already stored — just reload status.
      if (appStateSub.current) appStateSub.current.remove();
      appStateSub.current = AppState.addEventListener('change', async (nextState) => {
        if (appStateRef.current.match(/inactive|background/) && nextState === 'active') {
          appStateSub.current.remove();
          appStateSub.current = null;
          setConnectPhase('idle');
          await loadEmailStatus();
        }
        appStateRef.current = nextState;
      });

      await Linking.openURL(url);
    } catch (e) {
      setConnectPhase('idle');
      Alert.alert('Error', 'Could not start email connection.');
    }
  };

  const handleDisconnect = () => {
    Alert.alert('Disconnect email', 'Remove your connected email account?', [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Disconnect', style: 'destructive',
        onPress: async () => {
          try {
            await disconnectEmail();
            setEmailStatus({ connected: false });
          } catch {
            Alert.alert('Error', 'Could not disconnect. Please try again.');
          }
        },
      },
    ]);
  };

  // ── Rescan modal ─────────────────────────────────────────────────────────────

  const openRescan = () => {
    setRescanPhase('scanning');
    setRescanProgress(0);
    setRescanResults([]);
    setRescanSelected(new Set());
    setRescanError('');
    setRescanVisible(true);
    startRescan();
  };

  const startRescan = async () => {
    clearInterval(progressRef.current);
    progressRef.current = setInterval(() => {
      setRescanProgress(p => Math.min(p + 2, 88));
    }, 200);

    try {
      const data = await scanEmails();
      clearInterval(progressRef.current);
      setRescanProgress(100);
      const subs = data.subscriptions || [];
      if (subs.length === 0) {
        setTimeout(() => setRescanPhase('empty'), 400);
      } else {
        setRescanResults(subs);
        setRescanSelected(new Set(subs.map((_, i) => i)));
        setTimeout(() => setRescanPhase('results'), 400);
      }
    } catch (e) {
      clearInterval(progressRef.current);
      setRescanError(e?.response?.data?.detail || 'Scan failed. Please try again.');
      setRescanPhase('error');
    }
  };

  const closeRescan = () => {
    clearInterval(progressRef.current);
    setRescanVisible(false);
    setRescanPhase('idle');
  };

  const toggleRescanSelect = (i) => {
    setRescanSelected(prev => {
      const next = new Set(prev);
      if (next.has(i)) next.delete(i); else next.add(i);
      return next;
    });
  };

  const handleRescanImport = async () => {
    const chosen = rescanResults.filter((_, i) => rescanSelected.has(i));
    if (chosen.length === 0) return;
    setImporting(true);
    try {
      await importEmailSubscriptions(chosen);
      closeRescan();
      Alert.alert('Imported', `${chosen.length} subscription${chosen.length !== 1 ? 's' : ''} added.`);
    } catch {
      Alert.alert('Error', 'Import failed. Please try again.');
    } finally {
      setImporting(false);
    }
  };

  // ── Render ───────────────────────────────────────────────────────────────────

  return (
    <ScrollView
      style={styles.container}
      contentContainerStyle={[styles.content, { paddingTop: insets.top + spacing.xxl }]}
    >
      <Text style={styles.title}>Settings</Text>

      {/* ── Financial ── */}
      <Text style={styles.sectionTitle}>Financial</Text>
      <View style={styles.surface}>
        <Text style={styles.label}>Monthly income ($)</Text>
        <TextInput
          style={styles.input}
          value={monthlyIncome}
          onChangeText={setMonthlyIncome}
          keyboardType="decimal-pad"
          placeholderTextColor={colors.textMuted}
        />
        <Text style={styles.hint}>Used to calculate what % of income you spend on subscriptions.</Text>
      </View>

      {/* ── Alerts ── */}
      <Text style={styles.sectionTitle}>Alerts</Text>
      <View style={styles.surface}>
        <View style={styles.switchRow}>
          <Text style={styles.settingLabel}>Enable notifications</Text>
          <Switch
            value={notificationsEnabled}
            onValueChange={setNotificationsEnabled}
            trackColor={{ true: colors.accent }}
            thumbColor={colors.textPrimary}
          />
        </View>
        <View style={styles.divider} />
        <Text style={styles.label}>Renewal alert (days before)</Text>
        <TextInput
          style={styles.input}
          value={renewalDays}
          onChangeText={setRenewalDays}
          keyboardType="number-pad"
          placeholderTextColor={colors.textMuted}
        />
        <Text style={styles.label}>Trial ending alert (days before)</Text>
        <TextInput
          style={styles.input}
          value={trialDays}
          onChangeText={setTrialDays}
          keyboardType="number-pad"
          placeholderTextColor={colors.textMuted}
        />
      </View>

      <TouchableOpacity style={styles.saveBtn} onPress={handleSave}>
        <Text style={styles.saveBtnText}>Save settings</Text>
      </TouchableOpacity>

      {/* ── Connected accounts ── */}
      <Text style={styles.sectionTitle}>Connected accounts</Text>
      <View style={styles.surface}>
        {emailLoading ? (
          <ActivityIndicator color={colors.accent} style={{ paddingVertical: spacing.md }} />
        ) : emailStatus?.connected ? (
          <>
            <View style={styles.connectedRow}>
              <View style={styles.connectedDot} />
              <View style={styles.connectedInfo}>
                <Text style={styles.connectedLabel}>Email connected</Text>
                <Text style={styles.connectedEmail}>{emailStatus.email}</Text>
              </View>
            </View>
            <View style={styles.divider} />
            <View style={styles.emailActions}>
              <TouchableOpacity style={styles.rescanBtn} onPress={openRescan}>
                <Text style={styles.rescanBtnText}>Rescan emails</Text>
              </TouchableOpacity>
              <TouchableOpacity style={styles.disconnectBtn} onPress={handleDisconnect}>
                <Text style={styles.disconnectBtnText}>Disconnect</Text>
              </TouchableOpacity>
            </View>
          </>
        ) : connectPhase === 'awaiting' ? (
          <View style={styles.awaitingRow}>
            <ActivityIndicator color={colors.accent} size="small" />
            <Text style={styles.awaitingText}>Complete sign-in in your browser...</Text>
          </View>
        ) : (
          <>
            <Text style={styles.noEmailText}>No email connected</Text>
            <Text style={styles.hint}>Connect your email to automatically find subscriptions from billing receipts.</Text>
            <View style={styles.providerRow}>
              {PROVIDERS.map(p => (
                <TouchableOpacity
                  key={p.id}
                  style={[styles.providerBtn, { borderColor: p.color + '55' }]}
                  onPress={() => handleConnectEmail(p.id)}
                >
                  <View style={[styles.providerDot, { backgroundColor: p.color }]} />
                  <Text style={styles.providerBtnText}>{p.name}</Text>
                </TouchableOpacity>
              ))}
            </View>
          </>
        )}
      </View>

      {/* ── Account ── */}
      <Text style={styles.sectionTitle}>Account</Text>
      <View style={styles.surface}>
        <TouchableOpacity style={styles.menuRow} onPress={showSignOut}>
          <Text style={styles.menuLabel}>Sign out</Text>
          <Text style={styles.menuArrow}>→</Text>
        </TouchableOpacity>
      </View>

      <Text style={styles.version}>Subtrackr v1.0.0</Text>

      {/* ── Sign out modal ── */}
      <Modal visible={signOutVisible} transparent animationType="none">
        <Animated.View style={[styles.modalScrim, { opacity: fadeAnim }]}>
          <Animated.View style={[styles.modalCard, {
            opacity: fadeAnim,
            transform: [{ scale: fadeAnim.interpolate({ inputRange: [0, 1], outputRange: [0.95, 1] }) }],
          }]}>
            <Text style={styles.modalTitle}>Sign out</Text>
            <Text style={styles.modalBody}>Are you sure you want to sign out of Subtrackr?</Text>
            <View style={styles.modalActions}>
              <TouchableOpacity style={styles.modalCancel} onPress={() => hideSignOut()}>
                <Text style={styles.modalCancelText}>Cancel</Text>
              </TouchableOpacity>
              <TouchableOpacity style={styles.modalConfirm} onPress={() => hideSignOut(signOut)}>
                <Text style={styles.modalConfirmText}>Sign out</Text>
              </TouchableOpacity>
            </View>
          </Animated.View>
        </Animated.View>
      </Modal>

      {/* ── Rescan modal ── */}
      <Modal visible={rescanVisible} transparent animationType="fade">
        <View style={styles.rescanScrim}>
          <View style={styles.rescanCard}>
            {rescanPhase === 'scanning' && (
              <>
                <Text style={styles.rescanTitle}>Scanning your inbox...</Text>
                <View style={styles.progressTrack}>
                  <View style={[styles.progressFill, { width: `${rescanProgress}%` }]} />
                </View>
                <Text style={styles.progressText}>{Math.round(rescanProgress)}%</Text>
                <TouchableOpacity style={styles.rescanCancelBtn} onPress={closeRescan}>
                  <Text style={styles.rescanCancelText}>Cancel</Text>
                </TouchableOpacity>
              </>
            )}

            {rescanPhase === 'empty' && (
              <>
                <Text style={styles.rescanTitle}>No new subscriptions found</Text>
                <Text style={styles.rescanSubtitle}>We couldn't find any new subscription billing emails.</Text>
                <TouchableOpacity style={styles.rescanDoneBtn} onPress={closeRescan}>
                  <Text style={styles.rescanDoneBtnText}>Done</Text>
                </TouchableOpacity>
              </>
            )}

            {rescanPhase === 'error' && (
              <>
                <Text style={styles.rescanTitle}>Scan failed</Text>
                <Text style={styles.rescanSubtitle}>{rescanError}</Text>
                <TouchableOpacity style={styles.rescanDoneBtn} onPress={() => { setRescanPhase('scanning'); setRescanProgress(0); startRescan(); }}>
                  <Text style={styles.rescanDoneBtnText}>Retry</Text>
                </TouchableOpacity>
                <TouchableOpacity style={styles.rescanCancelBtn} onPress={closeRescan}>
                  <Text style={styles.rescanCancelText}>Cancel</Text>
                </TouchableOpacity>
              </>
            )}

            {rescanPhase === 'results' && (
              <>
                <Text style={styles.rescanTitle}>Found {rescanResults.length} subscription{rescanResults.length !== 1 ? 's' : ''}</Text>
                <Text style={styles.rescanSubtitle}>Select which ones to add.</Text>
                <ScrollView style={styles.rescanList} showsVerticalScrollIndicator={false}>
                  {rescanResults.map((sub, i) => (
                    <TouchableOpacity
                      key={i}
                      style={[styles.rescanItem, rescanSelected.has(i) && styles.rescanItemSelected]}
                      onPress={() => toggleRescanSelect(i)}
                      activeOpacity={0.7}
                    >
                      <View style={styles.rescanItemInfo}>
                        <Text style={styles.rescanItemName}>{sub.name}</Text>
                        <Text style={styles.rescanItemMeta}>
                          {sub.category} · ${typeof sub.price === 'number' ? sub.price.toFixed(2) : sub.price}/{sub.billing_cycle === 'annually' ? 'yr' : 'mo'}
                        </Text>
                      </View>
                      <View style={[styles.checkbox, rescanSelected.has(i) && styles.checkboxActive]}>
                        {rescanSelected.has(i) && <Text style={styles.checkmark}>✓</Text>}
                      </View>
                    </TouchableOpacity>
                  ))}
                </ScrollView>
                <View style={styles.rescanActions}>
                  <TouchableOpacity style={styles.rescanCancelBtn} onPress={closeRescan}>
                    <Text style={styles.rescanCancelText}>Cancel</Text>
                  </TouchableOpacity>
                  <TouchableOpacity
                    style={[styles.rescanDoneBtn, (rescanSelected.size === 0 || importing) && styles.rescanDoneBtnDisabled]}
                    onPress={handleRescanImport}
                    disabled={rescanSelected.size === 0 || importing}
                  >
                    {importing
                      ? <ActivityIndicator color={colors.textPrimary} size="small" />
                      : <Text style={styles.rescanDoneBtnText}>Import {rescanSelected.size > 0 ? rescanSelected.size : ''}</Text>
                    }
                  </TouchableOpacity>
                </View>
              </>
            )}
          </View>
        </View>
      </Modal>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.background },
  content: { padding: spacing.xxl, paddingBottom: 100 },
  title: { fontSize: typography.xxl, fontWeight: '500', color: colors.textPrimary, marginBottom: spacing.xl },
  sectionTitle: { fontSize: typography.xs, color: colors.textSecondary, textTransform: 'uppercase', letterSpacing: 0.5, marginBottom: spacing.md },
  surface: { backgroundColor: colors.surface, borderRadius: radius.md, borderWidth: 0.5, borderColor: colors.border, padding: spacing.lg, marginBottom: spacing.xl },
  label: { fontSize: typography.sm, color: colors.textSecondary, marginBottom: spacing.sm },
  hint: { fontSize: typography.xs, color: colors.textMuted, marginTop: spacing.xs, lineHeight: 16 },
  input: { backgroundColor: colors.surfaceAlt, borderRadius: radius.sm, borderWidth: 0.5, borderColor: colors.border, padding: spacing.md, color: colors.textPrimary, fontSize: typography.md, marginBottom: spacing.md },
  switchRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingVertical: spacing.sm },
  settingLabel: { fontSize: typography.md, color: colors.textPrimary },
  divider: { height: 0.5, backgroundColor: colors.border, marginVertical: spacing.md },
  saveBtn: { backgroundColor: colors.accent, borderRadius: radius.md, padding: spacing.lg, alignItems: 'center', marginBottom: spacing.xl },
  saveBtnText: { color: colors.textPrimary, fontSize: typography.md, fontWeight: '500' },

  // Connected accounts
  connectedRow: { flexDirection: 'row', alignItems: 'center', gap: spacing.md },
  connectedDot: { width: 8, height: 8, borderRadius: 4, backgroundColor: colors.success },
  connectedInfo: { flex: 1 },
  connectedLabel: { fontSize: typography.md, color: colors.textPrimary, fontWeight: '500' },
  connectedEmail: { fontSize: typography.sm, color: colors.textSecondary, marginTop: 2 },
  emailActions: { flexDirection: 'row', gap: spacing.md },
  rescanBtn: { flex: 1, backgroundColor: colors.accentMuted, borderRadius: radius.sm, borderWidth: 0.5, borderColor: colors.accentBorder, padding: spacing.md, alignItems: 'center' },
  rescanBtnText: { fontSize: typography.sm, color: colors.accent, fontWeight: '500' },
  disconnectBtn: { flex: 1, borderRadius: radius.sm, borderWidth: 0.5, borderColor: colors.border, padding: spacing.md, alignItems: 'center' },
  disconnectBtnText: { fontSize: typography.sm, color: colors.textSecondary },
  awaitingRow: { flexDirection: 'row', alignItems: 'center', gap: spacing.md, paddingVertical: spacing.sm },
  awaitingText: { fontSize: typography.sm, color: colors.textSecondary, flex: 1 },
  noEmailText: { fontSize: typography.md, color: colors.textPrimary, marginBottom: spacing.xs },
  providerRow: { flexDirection: 'row', gap: spacing.sm, marginTop: spacing.md, flexWrap: 'wrap' },
  providerBtn: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm, borderWidth: 1, borderRadius: radius.sm, paddingHorizontal: spacing.md, paddingVertical: spacing.sm },
  providerDot: { width: 8, height: 8, borderRadius: 4 },
  providerBtnText: { fontSize: typography.sm, color: colors.textPrimary },

  menuRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingVertical: spacing.sm },
  menuLabel: { fontSize: typography.md, color: colors.danger },
  menuArrow: { fontSize: typography.md, color: colors.textSecondary },
  version: { textAlign: 'center', fontSize: typography.xs, color: colors.textMuted, marginTop: spacing.xl },

  // Sign out modal
  modalScrim: { flex: 1, backgroundColor: 'rgba(0,0,0,0.6)', alignItems: 'center', justifyContent: 'center', padding: spacing.xxl },
  modalCard: { backgroundColor: colors.surface, borderRadius: radius.lg, borderWidth: 0.5, borderColor: colors.border, padding: spacing.xxl, width: '100%' },
  modalTitle: { fontSize: typography.xl, fontWeight: '500', color: colors.textPrimary, marginBottom: spacing.sm },
  modalBody: { fontSize: typography.sm, color: colors.textSecondary, lineHeight: 20, marginBottom: spacing.xl },
  modalActions: { flexDirection: 'row', gap: spacing.md },
  modalCancel: { flex: 1, padding: spacing.md, borderRadius: radius.md, borderWidth: 0.5, borderColor: colors.border, alignItems: 'center' },
  modalCancelText: { fontSize: typography.md, color: colors.textSecondary },
  modalConfirm: { flex: 1, padding: spacing.md, borderRadius: radius.md, backgroundColor: colors.danger, alignItems: 'center' },
  modalConfirmText: { fontSize: typography.md, color: colors.textPrimary, fontWeight: '500' },

  // Rescan modal
  rescanScrim: { flex: 1, backgroundColor: 'rgba(0,0,0,0.7)', alignItems: 'center', justifyContent: 'center', padding: spacing.xxl },
  rescanCard: { backgroundColor: colors.surface, borderRadius: radius.lg, borderWidth: 0.5, borderColor: colors.border, padding: spacing.xxl, width: '100%', maxHeight: '80%' },
  rescanTitle: { fontSize: typography.xl, fontWeight: '500', color: colors.textPrimary, marginBottom: spacing.sm },
  rescanSubtitle: { fontSize: typography.sm, color: colors.textSecondary, marginBottom: spacing.lg, lineHeight: 20 },
  rescanList: { maxHeight: 240, marginBottom: spacing.lg },
  rescanItem: { flexDirection: 'row', alignItems: 'center', padding: spacing.md, borderRadius: radius.sm, borderWidth: 0.5, borderColor: colors.border, marginBottom: spacing.sm },
  rescanItemSelected: { borderColor: colors.accentBorder, backgroundColor: colors.accentMuted },
  rescanItemInfo: { flex: 1 },
  rescanItemName: { fontSize: typography.md, color: colors.textPrimary, fontWeight: '500' },
  rescanItemMeta: { fontSize: typography.xs, color: colors.textSecondary, marginTop: 2 },
  rescanActions: { flexDirection: 'row', gap: spacing.md },
  rescanDoneBtn: { flex: 1, backgroundColor: colors.accent, borderRadius: radius.md, padding: spacing.md, alignItems: 'center', justifyContent: 'center' },
  rescanDoneBtnDisabled: { backgroundColor: colors.border },
  rescanDoneBtnText: { fontSize: typography.md, color: colors.textPrimary, fontWeight: '500' },
  rescanCancelBtn: { flex: 1, borderRadius: radius.md, borderWidth: 0.5, borderColor: colors.border, padding: spacing.md, alignItems: 'center' },
  rescanCancelText: { fontSize: typography.md, color: colors.textSecondary },
  progressTrack: { height: 6, backgroundColor: colors.border, borderRadius: 3, overflow: 'hidden', marginVertical: spacing.md },
  progressFill: { height: '100%', backgroundColor: colors.accent, borderRadius: 3 },
  progressText: { fontSize: typography.sm, color: colors.accent, textAlign: 'center', marginBottom: spacing.lg },
  checkbox: { width: 20, height: 20, borderRadius: 5, borderWidth: 1.5, borderColor: colors.border, alignItems: 'center', justifyContent: 'center' },
  checkboxActive: { backgroundColor: colors.accent, borderColor: colors.accent },
  checkmark: { fontSize: 11, color: colors.textPrimary, fontWeight: '600' },
});
