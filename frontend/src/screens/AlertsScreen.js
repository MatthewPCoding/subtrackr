import React, { useState, useCallback } from 'react';
import {
  View, Text, ScrollView, StyleSheet, TouchableOpacity,
  RefreshControl, ActivityIndicator, Alert
} from 'react-native';
import { useFocusEffect } from '@react-navigation/native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { getAlerts, markAlertRead, markAllAlertsRead, deleteAlert } from '../services/api';
import { colors, spacing, radius, typography } from '../theme';

const ALERT_META = {
  renewal:      { label: 'Renewal',      icon: '🔔', color: colors.warning, bg: '#fbbf2420' },
  trial_ending: { label: 'Trial Ending', icon: '⏱',  color: colors.accent,  bg: '#a78bfa20' },
  forgotten:    { label: 'Forgotten',    icon: '💤', color: colors.danger,  bg: '#f8717120' },
  price_change: { label: 'Price Change', icon: '💰', color: colors.success, bg: '#34d39920' },
};

const formatDate = (dateStr) => {
  const date = new Date(dateStr);
  const now = new Date();
  const days = Math.floor((now - date) / 86400000);
  if (days === 0) return 'Today';
  if (days === 1) return 'Yesterday';
  if (days < 7) return `${days} days ago`;
  return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
};

export default function AlertsScreen() {
  const insets = useSafeAreaInsets();
  const [alerts, setAlerts] = useState([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  const load = async () => {
    try {
      const data = await getAlerts();
      setAlerts(data);
    } catch (e) { console.error(e); }
    finally { setLoading(false); setRefreshing(false); }
  };

  useFocusEffect(useCallback(() => { load(); }, []));

  const handleRead = async (id) => {
    await markAlertRead(id);
    load();
  };

  const handleDelete = async (id) => {
    await deleteAlert(id);
    load();
  };

  const handleReadAll = () => {
    Alert.alert('Mark all read', 'Mark all alerts as read?', [
      { text: 'Cancel', style: 'cancel' },
      { text: 'Mark all', onPress: async () => { await markAllAlertsRead(); load(); } }
    ]);
  };

  const unread = alerts.filter(a => !a.is_read);
  const read = alerts.filter(a => a.is_read);

  if (loading) return (
    <View style={styles.center}><ActivityIndicator color={colors.accent} size="large" /></View>
  );

  const renderAlert = (alert) => {
    const meta = ALERT_META[alert.alert_type] ?? {
      label: alert.alert_type, icon: '•', color: colors.accent, bg: colors.accentMuted,
    };
    return (
      <View key={alert.id} style={[styles.alertCard, !alert.is_read && styles.alertCardUnread]}>
        <View style={[styles.iconBadge, { backgroundColor: meta.bg }]}>
          <Text style={styles.iconText}>{meta.icon}</Text>
        </View>
        <View style={styles.alertBody}>
          <Text style={[styles.alertType, { color: meta.color }]}>{meta.label}</Text>
          <Text style={styles.alertMsg}>{alert.message}</Text>
          <Text style={styles.alertDate}>{formatDate(alert.created_at)}</Text>
        </View>
        <View style={styles.alertActions}>
          {!alert.is_read && (
            <TouchableOpacity onPress={() => handleRead(alert.id)} style={styles.readBtnWrap}>
              <Text style={styles.readBtn}>Read</Text>
            </TouchableOpacity>
          )}
          <TouchableOpacity onPress={() => handleDelete(alert.id)}>
            <Text style={styles.deleteBtn}>✕</Text>
          </TouchableOpacity>
        </View>
      </View>
    );
  };

  return (
    <ScrollView
      style={styles.container}
      contentContainerStyle={[styles.content, { paddingTop: insets.top + spacing.xxl }]}
      refreshControl={<RefreshControl refreshing={refreshing} onRefresh={() => { setRefreshing(true); load(); }} tintColor={colors.accent} />}
    >
      <View style={styles.header}>
        <View>
          <Text style={styles.title}>Alerts</Text>
          {unread.length > 0 && <Text style={styles.unreadCount}>{unread.length} unread</Text>}
        </View>
        {unread.length > 0 && (
          <TouchableOpacity onPress={handleReadAll}>
            <Text style={styles.readAllBtn}>Mark all read</Text>
          </TouchableOpacity>
        )}
      </View>

      {alerts.length === 0 ? (
        <View style={styles.empty}>
          <View style={styles.emptyIconWrap}>
            <Text style={styles.emptyIcon}>✓</Text>
          </View>
          <Text style={styles.emptyTitle}>All caught up</Text>
          <Text style={styles.emptyText}>
            No alerts right now. We'll notify you when a subscription needs attention.
          </Text>
        </View>
      ) : (
        <>
          {unread.length > 0 && (
            <>
              <Text style={styles.sectionLabel}>Unread</Text>
              {unread.map(renderAlert)}
            </>
          )}
          {read.length > 0 && (
            <>
              <Text style={[styles.sectionLabel, unread.length > 0 && styles.sectionLabelSpaced]}>
                Read
              </Text>
              {read.map(renderAlert)}
            </>
          )}
        </>
      )}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.background },
  content: { padding: spacing.xxl, paddingBottom: 100 },
  center: { flex: 1, backgroundColor: colors.background, alignItems: 'center', justifyContent: 'center' },
  header: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: spacing.xl },
  title: { fontSize: typography.xxl, fontWeight: '500', color: colors.textPrimary },
  unreadCount: { fontSize: typography.sm, color: colors.accent, marginTop: 2 },
  readAllBtn: { fontSize: typography.sm, color: colors.accent },
  sectionLabel: { fontSize: typography.xs, color: colors.textSecondary, textTransform: 'uppercase', letterSpacing: 0.5, marginBottom: spacing.md },
  sectionLabelSpaced: { marginTop: spacing.xl },
  empty: { alignItems: 'center', paddingVertical: spacing.xxxl, paddingHorizontal: spacing.xxl },
  emptyIconWrap: { width: 56, height: 56, borderRadius: 28, backgroundColor: colors.surface, borderWidth: 0.5, borderColor: colors.border, alignItems: 'center', justifyContent: 'center', marginBottom: spacing.lg },
  emptyIcon: { fontSize: typography.xl, color: colors.success },
  emptyTitle: { fontSize: typography.xl, fontWeight: '500', color: colors.textPrimary, marginBottom: spacing.sm },
  emptyText: { fontSize: typography.sm, color: colors.textSecondary, textAlign: 'center', lineHeight: 20 },
  alertCard: { backgroundColor: colors.surface, borderRadius: radius.md, borderWidth: 0.5, borderColor: colors.border, padding: spacing.lg, flexDirection: 'row', alignItems: 'flex-start', gap: spacing.md, marginBottom: spacing.sm },
  alertCardUnread: { borderColor: colors.accentBorder, backgroundColor: '#1a1428' },
  iconBadge: { width: 36, height: 36, borderRadius: radius.sm, alignItems: 'center', justifyContent: 'center', flexShrink: 0 },
  iconText: { fontSize: typography.md },
  alertBody: { flex: 1 },
  alertType: { fontSize: typography.xs, fontWeight: '600', textTransform: 'uppercase', letterSpacing: 0.5, marginBottom: 4 },
  alertMsg: { fontSize: typography.sm, color: colors.textPrimary, lineHeight: 20, marginBottom: 4 },
  alertDate: { fontSize: typography.xs, color: colors.textSecondary },
  alertActions: { alignItems: 'flex-end', gap: spacing.sm },
  readBtnWrap: { backgroundColor: colors.accentMuted, borderRadius: radius.sm, paddingHorizontal: spacing.sm, paddingVertical: 3 },
  readBtn: { fontSize: typography.xs, color: colors.accent },
  deleteBtn: { fontSize: typography.sm, color: colors.textSecondary },
});
