import React, { useEffect, useState, useCallback } from 'react';
import {
  View, Text, ScrollView, StyleSheet, Image,
  TouchableOpacity, RefreshControl, ActivityIndicator
} from 'react-native';
import { useFocusEffect } from '@react-navigation/native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { getSubscriptions, getAnalyticsSummary, getUnreadAlerts } from '../services/api';
import { colors, spacing, radius, typography } from '../theme';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { INCOME_KEY } from './SettingsScreen';

const daysUntil = (dateStr) => {
  if (!dateStr) return null;
  return Math.ceil((new Date(dateStr) - new Date()) / 86400000);
};

export default function DashboardScreen({ navigation }) {
  const insets = useSafeAreaInsets();
  const [subscriptions, setSubscriptions] = useState([]);
  const [summary, setSummary] = useState(null);
  const [unreadCount, setUnreadCount] = useState(0);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  const load = async () => {
    try {
      const stored = await AsyncStorage.getItem(INCOME_KEY);
      const income = parseFloat(stored) || 3000;
      const [subs, sum, alerts] = await Promise.all([
        getSubscriptions(),
        getAnalyticsSummary(income),
        getUnreadAlerts(),
      ]);
      setSubscriptions(subs);
      setSummary(sum);
      setUnreadCount(alerts.length);
    } catch (e) {
      console.error(e);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  useFocusEffect(useCallback(() => { load(); }, []));

  const onRefresh = () => { setRefreshing(true); load(); };

  if (loading) return (
    <View style={styles.center}>
      <ActivityIndicator color={colors.accent} size="large" />
    </View>
  );

  const topSubs = subscriptions.slice(0, 4);
  const upcomingRenewals = subscriptions
    .filter(sub => { const d = daysUntil(sub.next_billing_date); return d !== null && d >= 0 && d <= 7; })
    .sort((a, b) => new Date(a.next_billing_date) - new Date(b.next_billing_date));

  return (
    <ScrollView
      style={styles.container}
      contentContainerStyle={[styles.content, { paddingTop: insets.top + spacing.xxl }]}
      refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={colors.accent} />}
    >
      {/* Header */}
      <View style={styles.header}>
        <View>
          <Text style={styles.greeting}>Good day</Text>
          <Text style={styles.headline}>Here's your overview</Text>
        </View>
        <TouchableOpacity style={styles.notifBtn} onPress={() => navigation.navigate('Alerts')}>
          <View style={styles.notifIcon} />
          {unreadCount > 0 && <View style={styles.notifDot} />}
        </TouchableOpacity>
      </View>

      {/* Spend card */}
      {summary && (
        <View style={styles.spendCard}>
          <Text style={styles.spendLabel}>Total monthly spend</Text>
          <Text style={styles.spendAmount}>${summary.total_monthly_spending.toFixed(2)}</Text>
          <Text style={styles.spendSub}>
            That's <Text style={styles.spendAccent}>{summary.spending_percentage}%</Text> of your monthly income
          </Text>
          <View style={styles.spendGlow} />
        </View>
      )}

      {/* Stats row */}
      {summary && (
        <View style={styles.statsRow}>
          <View style={styles.statCard}>
            <Text style={styles.statLabel}>Subscriptions</Text>
            <Text style={styles.statValue}>
              {summary.subscription_count} <Text style={styles.statAccent}>active</Text>
            </Text>
          </View>
          <View style={styles.statCard}>
            <Text style={styles.statLabel}>Annual spend</Text>
            <Text style={styles.statValue}>
              $<Text style={styles.statAccent}>{summary.total_annual_spending.toFixed(0)}</Text>
            </Text>
          </View>
        </View>
      )}

      {/* Renewal banners */}
      {upcomingRenewals.length > 0 && (
        <>
          <Text style={styles.sectionTitle}>Renewing soon</Text>
          <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.renewalScroll} contentContainerStyle={styles.renewalScrollContent}>
            {upcomingRenewals.map(sub => {
              const days = daysUntil(sub.next_billing_date);
              const dayLabel = days === 0 ? 'Today' : days === 1 ? 'Tomorrow' : `In ${days} days`;
              const urgent = days <= 1;
              return (
                <View key={sub.id} style={[styles.renewalCard, urgent && styles.renewalCardUrgent]}>
                  <View style={styles.renewalLogo}>
                    {sub.logo_url
                      ? <Image source={{ uri: sub.logo_url }} style={styles.renewalLogoImg} />
                      : <Text style={styles.renewalLogoFallback}>{sub.name[0]}</Text>
                    }
                  </View>
                  <Text style={styles.renewalName} numberOfLines={1}>{sub.name}</Text>
                  <Text style={[styles.renewalDays, urgent && styles.renewalDaysUrgent]}>{dayLabel}</Text>
                  <Text style={styles.renewalPrice}>${sub.price.toFixed(2)}</Text>
                </View>
              );
            })}
          </ScrollView>
        </>
      )}

      {/* Category bars */}
      {summary && Object.keys(summary.category_breakdown).length > 0 && (
        <>
          <Text style={styles.sectionTitle}>Spend by category</Text>
          <View style={styles.surface}>
            {Object.entries(summary.category_breakdown).map(([cat, amt], i) => {
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

      {/* Recent subscriptions */}
      <View style={styles.sectionHeader}>
        <Text style={styles.sectionTitle}>Subscriptions</Text>
        <TouchableOpacity onPress={() => navigation.navigate('Subscriptions')}>
          <Text style={styles.seeAll}>See all</Text>
        </TouchableOpacity>
      </View>

      {topSubs.map(sub => (
        <TouchableOpacity
          key={sub.id}
          style={styles.subItem}
          onPress={() => navigation.navigate('SubscriptionDetail', { subscription: sub })}
          activeOpacity={0.7}
        >
          <View style={styles.subLogo}>
            {sub.logo_url
              ? <Image source={{ uri: sub.logo_url }} style={styles.logoImg} />
              : <Text style={styles.logoFallback}>{sub.name[0]}</Text>
            }
          </View>
          <View style={styles.subInfo}>
            <Text style={styles.subName}>{sub.name}</Text>
            <Text style={styles.subCat}>{sub.category}</Text>
          </View>
          {sub.is_trial && <View style={styles.trialBadge}><Text style={styles.trialText}>Trial</Text></View>}
          <Text style={styles.subPrice}>${sub.price.toFixed(2)}</Text>
        </TouchableOpacity>
      ))}

      {subscriptions.length === 0 && (
        <View style={styles.empty}>
          <Text style={styles.emptyText}>No subscriptions yet.</Text>
          <TouchableOpacity style={styles.addBtn} onPress={() => navigation.navigate('Subscriptions')}>
            <Text style={styles.addBtnText}>Add your first subscription</Text>
          </TouchableOpacity>
        </View>
      )}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.background },
  content: { padding: spacing.xxl, paddingBottom: 100 },
  center: { flex: 1, backgroundColor: colors.background, alignItems: 'center', justifyContent: 'center' },
  header: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: spacing.xxl },
  greeting: { fontSize: typography.sm, color: colors.textSecondary, marginBottom: 4 },
  headline: { fontSize: typography.xxl, fontWeight: '500', color: colors.textPrimary },
  notifBtn: { width: 40, height: 40, borderRadius: radius.full, backgroundColor: colors.surface, borderWidth: 0.5, borderColor: colors.border, alignItems: 'center', justifyContent: 'center', position: 'relative' },
  notifIcon: { width: 14, height: 12, borderWidth: 1.5, borderColor: colors.textSecondary, borderRadius: 6 },
  notifDot: { width: 8, height: 8, borderRadius: 4, backgroundColor: colors.accent, position: 'absolute', top: 7, right: 7 },
  spendCard: { backgroundColor: colors.surface, borderRadius: radius.lg, borderWidth: 0.5, borderColor: colors.border, padding: spacing.xl, marginBottom: spacing.md, overflow: 'hidden' },
  spendLabel: { fontSize: typography.xs, color: colors.textSecondary, textTransform: 'uppercase', letterSpacing: 0.5, marginBottom: spacing.sm },
  spendAmount: { fontSize: typography.display, fontWeight: '500', color: colors.textPrimary, marginBottom: 4 },
  spendSub: { fontSize: typography.sm, color: colors.textSecondary },
  spendAccent: { color: colors.accent },
  spendGlow: { position: 'absolute', top: -40, right: -40, width: 120, height: 120, borderRadius: 60, backgroundColor: colors.accentMuted },
  statsRow: { flexDirection: 'row', gap: spacing.md, marginBottom: spacing.xl },
  statCard: { flex: 1, backgroundColor: colors.surface, borderRadius: radius.md, borderWidth: 0.5, borderColor: colors.border, padding: spacing.lg },
  statLabel: { fontSize: typography.xs, color: colors.textSecondary, textTransform: 'uppercase', letterSpacing: 0.5, marginBottom: spacing.sm },
  statValue: { fontSize: typography.xl, fontWeight: '500', color: colors.textPrimary },
  statAccent: { color: colors.accent, fontSize: typography.md },
  sectionTitle: { fontSize: typography.xs, color: colors.textSecondary, textTransform: 'uppercase', letterSpacing: 0.5, marginBottom: spacing.md },
  sectionHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: spacing.md },
  seeAll: { fontSize: typography.sm, color: colors.accent },
  surface: { backgroundColor: colors.surface, borderRadius: radius.md, borderWidth: 0.5, borderColor: colors.border, padding: spacing.lg, marginBottom: spacing.xl },
  barRow: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm, marginBottom: spacing.md },
  barLabel: { fontSize: typography.sm, color: colors.textSecondary, width: 72 },
  barTrack: { flex: 1, height: 6, backgroundColor: colors.border, borderRadius: 3, overflow: 'hidden' },
  barFill: { height: '100%', backgroundColor: colors.accent, borderRadius: 3 },
  barAmt: { fontSize: typography.sm, color: colors.textPrimary, width: 36, textAlign: 'right' },
  renewalScroll: { marginBottom: spacing.xl },
  renewalScrollContent: { gap: spacing.md, paddingRight: spacing.xxl },
  renewalCard: { backgroundColor: colors.surface, borderRadius: radius.md, borderWidth: 0.5, borderColor: `${colors.warning}44`, padding: spacing.md, width: 120, alignItems: 'center', gap: spacing.xs },
  renewalCardUrgent: { borderColor: colors.danger, backgroundColor: '#1a1212' },
  renewalLogo: { width: 36, height: 36, borderRadius: radius.sm, backgroundColor: colors.surfaceAlt, alignItems: 'center', justifyContent: 'center', overflow: 'hidden' },
  renewalLogoImg: { width: 32, height: 32, borderRadius: radius.sm },
  renewalLogoFallback: { fontSize: typography.lg, fontWeight: '500', color: colors.accent },
  renewalName: { fontSize: typography.xs, fontWeight: '500', color: colors.textPrimary, textAlign: 'center' },
  renewalDays: { fontSize: typography.xs, color: colors.warning },
  renewalDaysUrgent: { color: colors.danger, fontWeight: '600' },
  renewalPrice: { fontSize: typography.sm, fontWeight: '500', color: colors.accent },
  subItem: { backgroundColor: colors.surface, borderRadius: radius.md, borderWidth: 0.5, borderColor: colors.border, padding: spacing.lg, flexDirection: 'row', alignItems: 'center', gap: spacing.md, marginBottom: spacing.sm },
  subLogo: { width: 40, height: 40, borderRadius: radius.sm, backgroundColor: colors.surfaceAlt, alignItems: 'center', justifyContent: 'center', overflow: 'hidden' },
  logoImg: { width: 36, height: 36, borderRadius: radius.sm },
  logoFallback: { fontSize: typography.lg, fontWeight: '500', color: colors.accent },
  subInfo: { flex: 1 },
  subName: { fontSize: typography.md, fontWeight: '500', color: colors.textPrimary, marginBottom: 2 },
  subCat: { fontSize: typography.xs, color: colors.textSecondary },
  subPrice: { fontSize: typography.md, fontWeight: '500', color: colors.accent },
  trialBadge: { backgroundColor: colors.accentMuted, borderRadius: radius.sm, paddingHorizontal: 6, paddingVertical: 2 },
  trialText: { fontSize: typography.xs, color: colors.accent },
  empty: { alignItems: 'center', paddingVertical: spacing.xxxl },
  emptyText: { fontSize: typography.md, color: colors.textSecondary, marginBottom: spacing.lg },
  addBtn: { backgroundColor: colors.accent, borderRadius: radius.md, paddingHorizontal: spacing.xl, paddingVertical: spacing.md },
  addBtnText: { color: colors.textPrimary, fontSize: typography.md, fontWeight: '500' },
});
