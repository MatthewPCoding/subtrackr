import React, { useState } from 'react';
import {
  View, Text, ScrollView, StyleSheet, Image, TouchableOpacity,
  ActivityIndicator, Alert, Linking
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { getDeals, getAlternatives, deleteSubscription } from '../services/api';
import { colors, spacing, radius, typography } from '../theme';

const daysUntil = (dateStr) => {
  if (!dateStr) return null;
  return Math.ceil((new Date(dateStr) - new Date()) / 86400000);
};

const formatDate = (dateStr) => {
  if (!dateStr) return null;
  return new Date(dateStr).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
};

const renewalColor = (days) => {
  if (days === null) return colors.textSecondary;
  if (days <= 1) return colors.danger;
  if (days <= 7) return colors.warning;
  return colors.textPrimary;
};

const renewalLabel = (days) => {
  if (days === null) return '';
  if (days < 0) return 'Overdue';
  if (days === 0) return 'Today';
  if (days === 1) return 'Tomorrow';
  return `In ${days} days`;
};

export default function SubscriptionDetailScreen({ route, navigation }) {
  const insets = useSafeAreaInsets();
  const { subscription: sub } = route.params;

  const [deals, setDeals] = useState('');
  const [loadingDeals, setLoadingDeals] = useState(false);
  const [alternatives, setAlternatives] = useState(null);
  const [loadingAlt, setLoadingAlt] = useState(false);

  const fetchDeals = async () => {
    setLoadingDeals(true);
    try {
      const result = await getDeals(sub.id);
      setDeals(result);
    } catch {
      Alert.alert('Error', 'Could not load deals. Try again.');
    } finally {
      setLoadingDeals(false);
    }
  };

  const fetchAlternatives = async () => {
    setLoadingAlt(true);
    try {
      const result = await getAlternatives(sub.id);
      setAlternatives(result);
    } catch {
      Alert.alert('Error', 'Could not load alternatives. Try again.');
    } finally {
      setLoadingAlt(false);
    }
  };

  const handleDelete = () => {
    Alert.alert(
      'Remove subscription',
      `Remove ${sub.name}? This can't be undone.`,
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Remove',
          style: 'destructive',
          onPress: async () => {
            try {
              await deleteSubscription(sub.id);
              navigation.goBack();
            } catch {
              Alert.alert('Error', 'Could not remove subscription.');
            }
          },
        },
      ]
    );
  };

  const renewalDays = daysUntil(sub.next_billing_date);
  const trialDays = daysUntil(sub.trial_end_date);
  const trialColor = trialDays === null ? colors.accent
    : trialDays <= 3 ? colors.danger
    : trialDays <= 7 ? colors.warning
    : colors.accent;

  return (
    <ScrollView style={styles.container} contentContainerStyle={[styles.content, { paddingTop: insets.top + spacing.xxl }]}>
      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity onPress={() => navigation.goBack()} hitSlop={12}>
          <Text style={styles.backText}>← Back</Text>
        </TouchableOpacity>
        <TouchableOpacity onPress={handleDelete} hitSlop={12}>
          <Text style={styles.removeText}>Remove</Text>
        </TouchableOpacity>
      </View>

      {/* Hero */}
      <View style={styles.hero}>
        <View style={styles.logoWrap}>
          {sub.logo_url
            ? <Image source={{ uri: sub.logo_url }} style={styles.logo} />
            : <Text style={styles.logoFallback}>{sub.name[0]}</Text>
          }
        </View>
        <View style={styles.heroInfo}>
          <Text style={styles.heroName}>{sub.name}</Text>
          <View style={styles.badgeRow}>
            <View style={styles.categoryBadge}>
              <Text style={styles.categoryText}>{sub.category}</Text>
            </View>
            {sub.is_trial && (
              <View style={[styles.trialBadge, { backgroundColor: `${trialColor}20`, borderColor: `${trialColor}44` }]}>
                <Text style={[styles.trialText, { color: trialColor }]}>
                  {trialDays !== null && trialDays >= 0 ? `${trialDays}d trial` : 'Trial'}
                </Text>
              </View>
            )}
          </View>
        </View>
        <View style={styles.priceBlock}>
          <Text style={styles.heroPrice}>${sub.price.toFixed(2)}</Text>
          <Text style={styles.heroCycle}>/{sub.billing_cycle === 'annually' ? 'yr' : 'mo'}</Text>
        </View>
      </View>

      {/* Info grid */}
      <View style={styles.infoGrid}>
        {sub.next_billing_date && (
          <View style={styles.infoCard}>
            <Text style={styles.infoLabel}>Next billing</Text>
            <Text style={[styles.infoValue, { color: renewalColor(renewalDays) }]}>
              {formatDate(sub.next_billing_date)}
            </Text>
            <Text style={[styles.infoSub, { color: renewalColor(renewalDays) }]}>
              {renewalLabel(renewalDays)}
            </Text>
          </View>
        )}
        <View style={styles.infoCard}>
          <Text style={styles.infoLabel}>Billing</Text>
          <Text style={styles.infoValue}>{sub.billing_cycle}</Text>
        </View>
        {sub.last_used && (
          <View style={styles.infoCard}>
            <Text style={styles.infoLabel}>Last used</Text>
            <Text style={styles.infoValue}>{formatDate(sub.last_used)}</Text>
          </View>
        )}
        {sub.trial_end_date && (
          <View style={styles.infoCard}>
            <Text style={styles.infoLabel}>Trial ends</Text>
            <Text style={[styles.infoValue, { color: trialColor }]}>
              {formatDate(sub.trial_end_date)}
            </Text>
          </View>
        )}
        {sub.website && (
          <View style={styles.infoCard}>
            <Text style={styles.infoLabel}>Website</Text>
            <TouchableOpacity onPress={() => Linking.openURL(`https://${sub.website}`)}>
              <Text style={[styles.infoValue, styles.link]}>{sub.website}</Text>
            </TouchableOpacity>
          </View>
        )}
        <View style={styles.infoCard}>
          <Text style={styles.infoLabel}>Added</Text>
          <Text style={styles.infoValue}>{formatDate(sub.created_at)}</Text>
        </View>
      </View>

      {/* Deals */}
      <Text style={styles.sectionTitle}>Deals & savings</Text>
      {deals ? (
        <View style={styles.aiCard}>
          <View style={styles.aiCardHeader}>
            <Text style={styles.aiCardLabel}>✦ AI analysis</Text>
            <TouchableOpacity onPress={() => setDeals('')}>
              <Text style={styles.refreshText}>Refresh</Text>
            </TouchableOpacity>
          </View>
          <Text style={styles.aiText}>{deals}</Text>
        </View>
      ) : (
        <TouchableOpacity style={styles.primaryBtn} onPress={fetchDeals} disabled={loadingDeals}>
          {loadingDeals
            ? <><ActivityIndicator color={colors.textPrimary} size="small" /><Text style={styles.primaryBtnText}>Finding deals…</Text></>
            : <Text style={styles.primaryBtnText}>✦  Find deals for {sub.name}</Text>
          }
        </TouchableOpacity>
      )}

      {/* Alternatives */}
      <Text style={[styles.sectionTitle, { marginTop: spacing.xl }]}>Cheaper alternatives</Text>
      {alternatives ? (
        <View style={styles.aiCard}>
          <View style={styles.aiCardHeader}>
            <Text style={styles.aiCardLabel}>✦ AI analysis</Text>
            <TouchableOpacity onPress={() => setAlternatives(null)}>
              <Text style={styles.refreshText}>Refresh</Text>
            </TouchableOpacity>
          </View>
          <Text style={styles.aiText}>{alternatives.suggestions}</Text>
        </View>
      ) : (
        <TouchableOpacity style={styles.outlineBtn} onPress={fetchAlternatives} disabled={loadingAlt}>
          {loadingAlt
            ? <><ActivityIndicator color={colors.accent} size="small" /><Text style={styles.outlineBtnText}>Searching…</Text></>
            : <Text style={styles.outlineBtnText}>Show alternatives</Text>
          }
        </TouchableOpacity>
      )}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.background },
  content: { padding: spacing.xxl, paddingBottom: 100 },
  header: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: spacing.xl },
  backText: { fontSize: typography.md, color: colors.accent },
  removeText: { fontSize: typography.sm, color: colors.danger },
  hero: { backgroundColor: colors.surface, borderRadius: radius.lg, borderWidth: 0.5, borderColor: colors.border, padding: spacing.xl, flexDirection: 'row', alignItems: 'center', gap: spacing.lg, marginBottom: spacing.xl },
  logoWrap: { width: 56, height: 56, borderRadius: radius.md, backgroundColor: colors.surfaceAlt, alignItems: 'center', justifyContent: 'center', overflow: 'hidden', flexShrink: 0 },
  logo: { width: 52, height: 52, borderRadius: radius.md },
  logoFallback: { fontSize: typography.xxl, fontWeight: '500', color: colors.accent },
  heroInfo: { flex: 1 },
  heroName: { fontSize: typography.xl, fontWeight: '500', color: colors.textPrimary, marginBottom: spacing.sm },
  badgeRow: { flexDirection: 'row', gap: spacing.sm, flexWrap: 'wrap' },
  categoryBadge: { backgroundColor: colors.surfaceAlt, borderRadius: radius.sm, paddingHorizontal: 8, paddingVertical: 3, borderWidth: 0.5, borderColor: colors.border },
  categoryText: { fontSize: typography.xs, color: colors.textSecondary },
  trialBadge: { borderRadius: radius.sm, paddingHorizontal: 8, paddingVertical: 3, borderWidth: 0.5 },
  trialText: { fontSize: typography.xs },
  priceBlock: { alignItems: 'flex-end' },
  heroPrice: { fontSize: typography.xxl, fontWeight: '500', color: colors.accent },
  heroCycle: { fontSize: typography.xs, color: colors.textSecondary, textAlign: 'right' },
  infoGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.md, marginBottom: spacing.xl },
  infoCard: { flex: 1, minWidth: '45%', backgroundColor: colors.surface, borderRadius: radius.md, borderWidth: 0.5, borderColor: colors.border, padding: spacing.lg },
  infoLabel: { fontSize: typography.xs, color: colors.textSecondary, textTransform: 'uppercase', letterSpacing: 0.5, marginBottom: spacing.xs },
  infoValue: { fontSize: typography.md, fontWeight: '500', color: colors.textPrimary },
  infoSub: { fontSize: typography.xs, marginTop: 2 },
  link: { color: colors.accent },
  sectionTitle: { fontSize: typography.xs, color: colors.textSecondary, textTransform: 'uppercase', letterSpacing: 0.5, marginBottom: spacing.md },
  primaryBtn: { backgroundColor: colors.accent, borderRadius: radius.md, padding: spacing.lg, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: spacing.sm, marginBottom: spacing.md },
  primaryBtnText: { color: colors.textPrimary, fontSize: typography.md, fontWeight: '500' },
  outlineBtn: { borderRadius: radius.md, padding: spacing.lg, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: spacing.sm, marginBottom: spacing.md, borderWidth: 1, borderColor: colors.accentBorder },
  outlineBtnText: { color: colors.accent, fontSize: typography.md, fontWeight: '500' },
  aiCard: { backgroundColor: colors.surface, borderRadius: radius.md, borderWidth: 0.5, borderColor: colors.border, padding: spacing.lg, marginBottom: spacing.md },
  aiCardHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: spacing.md },
  aiCardLabel: { fontSize: typography.xs, color: colors.accent, fontWeight: '600', letterSpacing: 0.5 },
  refreshText: { fontSize: typography.xs, color: colors.textSecondary },
  aiText: { fontSize: typography.sm, color: colors.textSecondary, lineHeight: 22 },
});
