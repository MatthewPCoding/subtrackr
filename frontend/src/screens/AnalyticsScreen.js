import React, { useState, useCallback } from 'react';
import {
  View, Text, ScrollView, StyleSheet, ActivityIndicator,
  TouchableOpacity, RefreshControl, Alert
} from 'react-native';
import { useFocusEffect } from '@react-navigation/native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { getAnalyticsSummary, getAudit, getAISuggestions, getMonthlyReport } from '../services/api';
import { colors, spacing, radius, typography } from '../theme';
import { INCOME_KEY } from './SettingsScreen';

const HEALTH_META = {
  Excellent: { icon: '✓', color: colors.success },
  Good:      { icon: '✓', color: colors.success },
  Fair:      { icon: '⚠', color: colors.warning },
  High:      { icon: '✕', color: colors.danger },
};

export default function AnalyticsScreen() {
  const insets = useSafeAreaInsets();
  const [summary, setSummary] = useState(null);
  const [audit, setAudit] = useState(null);
  const [monthlyIncome, setMonthlyIncome] = useState(3000);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  const [suggestions, setSuggestions] = useState('');
  const [loadingSuggestions, setLoadingSuggestions] = useState(false);

  const [aiReport, setAiReport] = useState('');
  const [loadingReport, setLoadingReport] = useState(false);

  const load = async () => {
    try {
      const stored = await AsyncStorage.getItem(INCOME_KEY);
      const income = parseFloat(stored) || 3000;
      setMonthlyIncome(income);
      const [sum, aud] = await Promise.all([
        getAnalyticsSummary(income),
        getAudit(income),
      ]);
      setSummary(sum);
      setAudit(aud);
    } catch (e) { console.error(e); }
    finally { setLoading(false); setRefreshing(false); }
  };

  useFocusEffect(useCallback(() => { load(); }, []));

  const fetchSuggestions = async () => {
    setLoadingSuggestions(true);
    try {
      const result = await getAISuggestions(monthlyIncome);
      setSuggestions(result);
    } catch {
      Alert.alert('Error', 'Could not load suggestions. Try again.');
    } finally {
      setLoadingSuggestions(false);
    }
  };

  const fetchReport = async () => {
    setLoadingReport(true);
    try {
      const report = await getMonthlyReport(monthlyIncome);
      setAiReport(report);
    } catch {
      Alert.alert('Error', 'Could not generate report. Try again.');
    } finally {
      setLoadingReport(false);
    }
  };

  if (loading) return (
    <View style={styles.center}><ActivityIndicator color={colors.accent} size="large" /></View>
  );

  const healthMeta = audit ? (HEALTH_META[audit.health_rating] ?? { icon: '–', color: colors.textSecondary }) : null;

  return (
    <ScrollView
      style={styles.container}
      contentContainerStyle={[styles.content, { paddingTop: insets.top + spacing.xxl }]}
      refreshControl={<RefreshControl refreshing={refreshing} onRefresh={() => { setRefreshing(true); load(); }} tintColor={colors.accent} />}
    >
      <Text style={styles.title}>Analytics</Text>

      {/* Stats grid */}
      {summary && (
        <>
          <View style={styles.statsGrid}>
            <View style={styles.statCard}>
              <Text style={styles.statLabel}>Monthly</Text>
              <Text style={styles.statValue}>${summary.total_monthly_spending.toFixed(2)}</Text>
            </View>
            <View style={styles.statCard}>
              <Text style={styles.statLabel}>Annual</Text>
              <Text style={styles.statValue}>${summary.total_annual_spending.toFixed(0)}</Text>
            </View>
            <View style={styles.statCard}>
              <Text style={styles.statLabel}>Of income</Text>
              <Text style={[styles.statValue, { color: summary.spending_percentage > 15 ? colors.danger : colors.accent }]}>
                {summary.spending_percentage}%
              </Text>
            </View>
            <View style={styles.statCard}>
              <Text style={styles.statLabel}>Active subs</Text>
              <Text style={styles.statValue}>{summary.subscription_count}</Text>
            </View>
          </View>

          {/* Category bars */}
          {Object.keys(summary.category_breakdown).length > 0 && (
            <>
              <Text style={styles.sectionTitle}>Spend by category</Text>
              <View style={styles.surface}>
                {Object.entries(summary.category_breakdown).map(([cat, amt]) => {
                  const pct = (amt / summary.total_monthly_spending) * 100;
                  return (
                    <View key={cat} style={styles.barRow}>
                      <Text style={styles.barLabel}>{cat}</Text>
                      <View style={styles.barTrack}>
                        <View style={[styles.barFill, { width: `${pct}%` }]} />
                      </View>
                      <Text style={styles.barAmt}>${amt.toFixed(0)}</Text>
                    </View>
                  );
                })}
              </View>
            </>
          )}
        </>
      )}

      {/* Audit */}
      {audit && healthMeta && (
        <>
          <Text style={styles.sectionTitle}>Subscription audit</Text>

          {/* Health card */}
          <View style={[styles.surface, { marginBottom: spacing.md }]}>
            <View style={styles.healthRow}>
              <View style={[styles.healthIconWrap, { backgroundColor: `${healthMeta.color}20` }]}>
                <Text style={[styles.healthIcon, { color: healthMeta.color }]}>{healthMeta.icon}</Text>
              </View>
              <View style={{ flex: 1 }}>
                <Text style={[styles.healthRating, { color: healthMeta.color }]}>{audit.health_rating}</Text>
                <Text style={styles.healthMsg}>{audit.health_message}</Text>
              </View>
            </View>
            {audit.potential_monthly_savings > 0 && (
              <View style={styles.savingsCard}>
                <Text style={styles.savingsLabel}>Potential savings</Text>
                <Text style={styles.savingsAmount}>${audit.potential_monthly_savings.toFixed(2)}<Text style={styles.savingsPer}>/mo</Text></Text>
                <Text style={styles.savingsSub}>${audit.potential_annual_savings.toFixed(0)} per year</Text>
              </View>
            )}
          </View>

          {/* Overlaps */}
          {audit.overlaps.length > 0 && (
            <>
              <Text style={styles.sectionTitle}>Overlapping services</Text>
              {audit.overlaps.map((o, i) => (
                <View key={i} style={[styles.flagCard, { borderColor: `${colors.warning}44` }]}>
                  <Text style={styles.flagIcon}>⚠</Text>
                  <View style={{ flex: 1 }}>
                    <Text style={styles.flagTitle}>{o.services.join(' + ')}</Text>
                    <Text style={styles.flagMsg}>{o.message}</Text>
                  </View>
                </View>
              ))}
            </>
          )}

          {/* Bundles */}
          {audit.bundle_opportunities.length > 0 && (
            <>
              <Text style={styles.sectionTitle}>Bundle opportunities</Text>
              {audit.bundle_opportunities.map((b, i) => (
                <View key={i} style={[styles.flagCard, { borderColor: `${colors.success}44` }]}>
                  <Text style={styles.flagIcon}>✦</Text>
                  <View style={{ flex: 1 }}>
                    <Text style={styles.flagTitle}>{b.bundle_name}</Text>
                    <Text style={styles.flagMsg}>{b.message}</Text>
                  </View>
                </View>
              ))}
            </>
          )}
        </>
      )}

      {/* AI Suggestions */}
      <Text style={styles.sectionTitle}>AI suggestions</Text>
      {suggestions ? (
        <View style={styles.aiCard}>
          <View style={styles.aiCardHeader}>
            <Text style={styles.aiCardLabel}>✦ Personalized advice</Text>
            <TouchableOpacity onPress={() => setSuggestions('')}>
              <Text style={styles.refreshText}>Refresh</Text>
            </TouchableOpacity>
          </View>
          <Text style={styles.aiText}>{suggestions}</Text>
        </View>
      ) : (
        <TouchableOpacity style={styles.outlineBtn} onPress={fetchSuggestions} disabled={loadingSuggestions}>
          {loadingSuggestions
            ? <><ActivityIndicator color={colors.accent} size="small" /><Text style={styles.outlineBtnText}>Analyzing your subscriptions…</Text></>
            : <Text style={styles.outlineBtnText}>✦  Get AI suggestions</Text>
          }
        </TouchableOpacity>
      )}

      {/* Monthly report */}
      <Text style={[styles.sectionTitle, { marginTop: spacing.xl }]}>Monthly report</Text>
      {aiReport ? (
        <View style={styles.aiCard}>
          <View style={styles.aiCardHeader}>
            <Text style={styles.aiCardLabel}>✦ AI-generated report</Text>
            <TouchableOpacity onPress={fetchReport} disabled={loadingReport}>
              {loadingReport
                ? <ActivityIndicator color={colors.accent} size="small" />
                : <Text style={styles.refreshText}>Regenerate</Text>
              }
            </TouchableOpacity>
          </View>
          <Text style={styles.aiText}>{aiReport}</Text>
        </View>
      ) : (
        <TouchableOpacity style={styles.primaryBtn} onPress={fetchReport} disabled={loadingReport}>
          {loadingReport
            ? <><ActivityIndicator color={colors.textPrimary} size="small" /><Text style={styles.primaryBtnText}>Generating report…</Text></>
            : <Text style={styles.primaryBtnText}>Generate monthly report</Text>
          }
        </TouchableOpacity>
      )}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.background },
  content: { padding: spacing.xxl, paddingBottom: 100 },
  center: { flex: 1, backgroundColor: colors.background, alignItems: 'center', justifyContent: 'center' },
  title: { fontSize: typography.xxl, fontWeight: '500', color: colors.textPrimary, marginBottom: spacing.xl },
  sectionTitle: { fontSize: typography.xs, color: colors.textSecondary, textTransform: 'uppercase', letterSpacing: 0.5, marginBottom: spacing.md },
  statsGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.md, marginBottom: spacing.xl },
  statCard: { flex: 1, minWidth: '45%', backgroundColor: colors.surface, borderRadius: radius.md, borderWidth: 0.5, borderColor: colors.border, padding: spacing.lg },
  statLabel: { fontSize: typography.xs, color: colors.textSecondary, textTransform: 'uppercase', letterSpacing: 0.5, marginBottom: spacing.sm },
  statValue: { fontSize: typography.xl, fontWeight: '500', color: colors.accent },
  surface: { backgroundColor: colors.surface, borderRadius: radius.md, borderWidth: 0.5, borderColor: colors.border, padding: spacing.lg, marginBottom: spacing.xl },
  barRow: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm, marginBottom: spacing.md },
  barLabel: { fontSize: typography.sm, color: colors.textSecondary, width: 80 },
  barTrack: { flex: 1, height: 6, backgroundColor: colors.border, borderRadius: 3, overflow: 'hidden' },
  barFill: { height: '100%', backgroundColor: colors.accent, borderRadius: 3 },
  barAmt: { fontSize: typography.sm, color: colors.textPrimary, width: 36, textAlign: 'right' },
  healthRow: { flexDirection: 'row', alignItems: 'flex-start', gap: spacing.md, marginBottom: spacing.md },
  healthIconWrap: { width: 36, height: 36, borderRadius: radius.sm, alignItems: 'center', justifyContent: 'center', flexShrink: 0 },
  healthIcon: { fontSize: typography.lg, fontWeight: '700' },
  healthRating: { fontSize: typography.md, fontWeight: '600', marginBottom: 2 },
  healthMsg: { fontSize: typography.sm, color: colors.textSecondary, lineHeight: 18 },
  savingsCard: { backgroundColor: colors.accentMuted, borderRadius: radius.sm, padding: spacing.md, borderWidth: 0.5, borderColor: colors.accentBorder },
  savingsLabel: { fontSize: typography.xs, color: colors.accent, marginBottom: 4, textTransform: 'uppercase', letterSpacing: 0.5 },
  savingsAmount: { fontSize: typography.xxl, fontWeight: '500', color: colors.accent },
  savingsPer: { fontSize: typography.sm, fontWeight: '400' },
  savingsSub: { fontSize: typography.sm, color: colors.accent, opacity: 0.7 },
  flagCard: { backgroundColor: colors.surface, borderRadius: radius.md, borderWidth: 0.5, padding: spacing.lg, marginBottom: spacing.sm, flexDirection: 'row', alignItems: 'flex-start', gap: spacing.md },
  flagIcon: { fontSize: typography.md, color: colors.textSecondary, marginTop: 1 },
  flagTitle: { fontSize: typography.md, fontWeight: '500', color: colors.textPrimary, marginBottom: 4 },
  flagMsg: { fontSize: typography.sm, color: colors.textSecondary, lineHeight: 18 },
  outlineBtn: { borderRadius: radius.md, padding: spacing.lg, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: spacing.sm, marginBottom: spacing.md, borderWidth: 1, borderColor: colors.accentBorder },
  outlineBtnText: { color: colors.accent, fontSize: typography.md, fontWeight: '500' },
  primaryBtn: { backgroundColor: colors.accent, borderRadius: radius.md, padding: spacing.lg, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: spacing.sm, marginBottom: spacing.md },
  primaryBtnText: { color: colors.textPrimary, fontSize: typography.md, fontWeight: '500' },
  aiCard: { backgroundColor: colors.surface, borderRadius: radius.md, borderWidth: 0.5, borderColor: colors.border, padding: spacing.lg, marginBottom: spacing.md },
  aiCardHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: spacing.md },
  aiCardLabel: { fontSize: typography.xs, color: colors.accent, fontWeight: '600', letterSpacing: 0.5 },
  refreshText: { fontSize: typography.xs, color: colors.textSecondary },
  aiText: { fontSize: typography.sm, color: colors.textSecondary, lineHeight: 22 },
});
