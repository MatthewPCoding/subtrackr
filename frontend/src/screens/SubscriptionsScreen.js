import React, { useState, useCallback } from 'react';
import {
  View, Text, ScrollView, StyleSheet, Image, TouchableOpacity,
  Modal, TextInput, RefreshControl, ActivityIndicator, Switch, Alert,
  KeyboardAvoidingView, Platform
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useFocusEffect } from '@react-navigation/native';
import { getSubscriptions, createSubscription, deleteSubscription, getUnreadAlerts } from '../services/api';
import { searchServices } from '../data/services-data';
import { colors, spacing, radius, typography } from '../theme';

const daysUntil = (dateStr) => {
  if (!dateStr) return null;
  return Math.ceil((new Date(dateStr) - new Date()) / 86400000);
};

const TrialBadge = ({ sub }) => {
  if (!sub.is_trial) return null;
  const days = daysUntil(sub.trial_end_date);
  const color = days === null ? colors.accent
    : days <= 3  ? colors.danger
    : days <= 7  ? colors.warning
    : colors.accent;
  const label = days === null  ? 'Trial'
    : days <= 0  ? 'Trial ended'
    : days === 1 ? '1 day left'
    : `${days}d left`;
  return (
    <View style={[styles.trialBadge, { backgroundColor: `${color}22`, borderColor: `${color}44` }]}>
      <Text style={[styles.trialText, { color }]}>{label}</Text>
    </View>
  );
};

const CATEGORIES = ['streaming', 'music', 'software', 'food', 'fitness', 'clothing', 'gaming', 'cloud', 'productivity', 'other'];

export default function SubscriptionsScreen({ navigation }) {
  const insets = useSafeAreaInsets();
  const [subscriptions, setSubscriptions] = useState([]);
  const [forgottenIds, setForgottenIds] = useState(new Set());
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [modalVisible, setModalVisible] = useState(false);
  const [saving, setSaving] = useState(false);

  const [name, setName] = useState('');
  const [category, setCategory] = useState('streaming');
  const [price, setPrice] = useState('');
  const [billingCycle, setBillingCycle] = useState('monthly');
  const [website, setWebsite] = useState('');
  const [isTrial, setIsTrial] = useState(false);

  const [suggestions, setSuggestions] = useState([]);
  const [selectedService, setSelectedService] = useState(null);
  const [selectedTier, setSelectedTier] = useState(null);

  const load = async () => {
    try {
      const [subs, alerts] = await Promise.all([getSubscriptions(), getUnreadAlerts()]);
      setSubscriptions(subs);
      setForgottenIds(new Set(
        alerts.filter(a => a.alert_type === 'forgotten').map(a => a.subscription_id)
      ));
    } catch (e) { console.error(e); }
    finally { setLoading(false); setRefreshing(false); }
  };

  useFocusEffect(useCallback(() => { load(); }, []));

  const resetForm = () => {
    setName(''); setCategory('streaming'); setPrice('');
    setBillingCycle('monthly'); setWebsite(''); setIsTrial(false);
    setSuggestions([]); setSelectedService(null); setSelectedTier(null);
  };

  const handleNameChange = (text) => {
    setName(text);
    setSelectedService(null);
    setSelectedTier(null);
    const results = searchServices(text);
    setSuggestions(results);
  };

  const selectService = (service) => {
    setName(service.name);
    setWebsite(service.website);
    setCategory(service.category);
    setSelectedService(service);
    setSelectedTier(null);
    setPrice('');
    setSuggestions([]);
  };

  const selectTier = (tier) => {
    setSelectedTier(tier);
    setPrice(billingCycle === 'annually'
      ? (tier.price * 12).toFixed(2)
      : tier.price.toFixed(2)
    );
  };

  const handleBillingCycle = (cycle) => {
    setBillingCycle(cycle);
    if (selectedTier) {
      setPrice(cycle === 'annually'
        ? (selectedTier.price * 12).toFixed(2)
        : selectedTier.price.toFixed(2)
      );
    }
  };

  const handleAdd = async () => {
    if (!name || !price) return alert('Name and price are required');
    setSaving(true);
    try {
      await createSubscription({
        name,
        category,
        price: parseFloat(price),
        billing_cycle: billingCycle,
        website,
        is_trial: isTrial
      });
      setModalVisible(false);
      resetForm();
      load();
    } catch (e) {
      alert('Failed to add subscription');
    } finally { setSaving(false); }
  };

  const handleDelete = (id, subName) => {
    Alert.alert('Remove subscription', `Remove ${subName}?`, [
      { text: 'Cancel', style: 'cancel' },
      { text: 'Remove', style: 'destructive', onPress: async () => { await deleteSubscription(id); load(); } },
    ]);
  };

  if (loading) return (
    <View style={styles.center}><ActivityIndicator color={colors.accent} size="large" /></View>
  );

  return (
    <View style={styles.container}>
      <ScrollView
        contentContainerStyle={[styles.content, { paddingTop: insets.top + spacing.xxl }]}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={() => { setRefreshing(true); load(); }} tintColor={colors.accent} />}
      >
        <View style={styles.header}>
          <Text style={styles.title}>Subscriptions</Text>
          <View style={styles.headerActions}>
            <TouchableOpacity style={styles.importBtn} onPress={() => navigation.navigate('EmailScan')}>
              <Text style={styles.importBtnText}>📬 Import</Text>
            </TouchableOpacity>
            <TouchableOpacity style={styles.addBtn} onPress={() => setModalVisible(true)}>
              <Text style={styles.addBtnText}>+ Add</Text>
            </TouchableOpacity>
          </View>
        </View>

        {subscriptions.length === 0 ? (
          <View style={styles.empty}>
            <Text style={styles.emptyText}>No subscriptions yet. Add your first one!</Text>
          </View>
        ) : subscriptions.map(sub => {
          const forgotten = forgottenIds.has(sub.id);
          return (
            <TouchableOpacity
              key={sub.id}
              style={[styles.subItem, forgotten && styles.subItemForgotten]}
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
                <View style={styles.subNameRow}>
                  <Text style={styles.subName}>{sub.name}</Text>
                  <TrialBadge sub={sub} />
                  {forgotten && (
                    <View style={styles.forgottenBadge}>
                      <Text style={styles.forgottenText}>💤 Forgotten</Text>
                    </View>
                  )}
                </View>
                <Text style={styles.subMeta}>{sub.category} · {sub.billing_cycle}</Text>
              </View>
              <View style={styles.subRight}>
                <Text style={styles.subPrice}>${sub.price.toFixed(2)}</Text>
                <TouchableOpacity onPress={() => handleDelete(sub.id, sub.name)}>
                  <Text style={styles.deleteBtn}>Remove</Text>
                </TouchableOpacity>
              </View>
            </TouchableOpacity>
          );
        })}
      </ScrollView>

      {/* Add Subscription Modal */}
      <Modal visible={modalVisible} animationType="slide" transparent>
        <KeyboardAvoidingView
          style={styles.modalOverlay}
          behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        >
          <View style={styles.modal}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>Add subscription</Text>
              <TouchableOpacity onPress={() => { setModalVisible(false); resetForm(); }}>
                <Text style={styles.modalClose}>✕</Text>
              </TouchableOpacity>
            </View>

            <ScrollView showsVerticalScrollIndicator={false} keyboardShouldPersistTaps="handled">

              {/* Service name with search */}
              <Text style={styles.label}>Search or enter service name</Text>
              <TextInput
                style={styles.input}
                value={name}
                onChangeText={handleNameChange}
                placeholder="e.g. Netflix, Spotify..."
                placeholderTextColor={colors.textMuted}
              />

              {/* Search suggestions */}
              {suggestions.length > 0 && (
                <View style={styles.suggestionsBox}>
                  {suggestions.map((service, i) => (
                    <TouchableOpacity
                      key={i}
                      style={[styles.suggestionRow, i < suggestions.length - 1 && styles.suggestionBorder]}
                      onPress={() => selectService(service)}
                    >
                      <Image
                        source={{ uri: `https://www.google.com/s2/favicons?domain=${service.website}&sz=32` }}
                        style={styles.suggestionLogo}
                      />
                      <View style={styles.suggestionInfo}>
                        <Text style={styles.suggestionName}>{service.name}</Text>
                        <Text style={styles.suggestionCat}>{service.category}</Text>
                      </View>
                      <Text style={styles.suggestionArrow}>→</Text>
                    </TouchableOpacity>
                  ))}
                </View>
              )}

              {/* Tier selection — only show if service is selected */}
              {selectedService && selectedService.tiers.length > 0 && (
                <>
                  <Text style={styles.label}>Select a plan</Text>
                  <View style={styles.tiersBox}>
                    {selectedService.tiers.map((tier, i) => (
                      <TouchableOpacity
                        key={i}
                        style={[styles.tierRow, selectedTier?.name === tier.name && styles.tierRowActive]}
                        onPress={() => selectTier(tier)}
                      >
                        <Text style={[styles.tierName, selectedTier?.name === tier.name && styles.tierNameActive]}>
                          {tier.name}
                        </Text>
                        <Text style={[styles.tierPrice, selectedTier?.name === tier.name && styles.tierPriceActive]}>
                          {billingCycle === 'annually'
                            ? `$${(tier.price * 12).toFixed(2)}/yr`
                            : `$${tier.price.toFixed(2)}/mo`
                          }
                        </Text>
                      </TouchableOpacity>
                    ))}
                  </View>
                </>
              )}

              {/* Price — manual override */}
              <Text style={styles.label}>Price {selectedTier ? '(autofilled)' : ''}</Text>
              <TextInput
                style={styles.input}
                value={price}
                onChangeText={setPrice}
                placeholder="0.00"
                placeholderTextColor={colors.textMuted}
                keyboardType="decimal-pad"
              />

              {/* Website */}
              <Text style={styles.label}>Website {selectedService ? '(autofilled)' : '(for logo)'}</Text>
              <TextInput
                style={styles.input}
                value={website}
                onChangeText={setWebsite}
                placeholder="e.g. netflix.com"
                placeholderTextColor={colors.textMuted}
                autoCapitalize="none"
              />

              {/* Billing cycle */}
              <Text style={styles.label}>Billing cycle</Text>
              <View style={styles.toggleRow}>
                {['monthly', 'annually'].map(c => (
                  <TouchableOpacity
                    key={c}
                    style={[styles.toggleBtn, billingCycle === c && styles.toggleBtnActive]}
                    onPress={() => handleBillingCycle(c)}
                  >
                    <Text style={[styles.toggleText, billingCycle === c && styles.toggleTextActive]}>{c}</Text>
                  </TouchableOpacity>
                ))}
              </View>

              {/* Category */}
              <Text style={styles.label}>Category {selectedService ? '(autofilled)' : ''}</Text>
              <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.catScroll}>
                {CATEGORIES.map(cat => (
                  <TouchableOpacity
                    key={cat}
                    style={[styles.catChip, category === cat && styles.catChipActive]}
                    onPress={() => setCategory(cat)}
                  >
                    <Text style={[styles.catText, category === cat && styles.catTextActive]}>{cat}</Text>
                  </TouchableOpacity>
                ))}
              </ScrollView>

              {/* Trial toggle */}
              <View style={styles.switchRow}>
                <Text style={styles.label}>Free trial?</Text>
                <Switch
                  value={isTrial}
                  onValueChange={setIsTrial}
                  trackColor={{ true: colors.accent }}
                  thumbColor={colors.textPrimary}
                />
              </View>

              <TouchableOpacity style={styles.saveBtn} onPress={handleAdd} disabled={saving}>
                {saving
                  ? <ActivityIndicator color={colors.textPrimary} />
                  : <Text style={styles.saveBtnText}>Add subscription</Text>
                }
              </TouchableOpacity>
            </ScrollView>
          </View>
        </KeyboardAvoidingView>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.background },
  content: { padding: spacing.xxl, paddingBottom: 100 },
  center: { flex: 1, backgroundColor: colors.background, alignItems: 'center', justifyContent: 'center' },
  header: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: spacing.xl },
  headerActions: { flexDirection: 'row', gap: spacing.sm, alignItems: 'center' },
  importBtn: { borderRadius: radius.md, paddingHorizontal: spacing.md, paddingVertical: spacing.sm, borderWidth: 0.5, borderColor: colors.accentBorder },
  importBtnText: { color: colors.accent, fontSize: typography.sm, fontWeight: '500' },
  title: { fontSize: typography.xxl, fontWeight: '500', color: colors.textPrimary },
  addBtn: { backgroundColor: colors.accent, borderRadius: radius.md, paddingHorizontal: spacing.lg, paddingVertical: spacing.sm },
  addBtnText: { color: colors.textPrimary, fontSize: typography.sm, fontWeight: '500' },
  empty: { alignItems: 'center', paddingVertical: spacing.xxxl },
  emptyText: { fontSize: typography.md, color: colors.textSecondary },
  subItem: { backgroundColor: colors.surface, borderRadius: radius.md, borderWidth: 0.5, borderColor: colors.border, padding: spacing.lg, flexDirection: 'row', alignItems: 'center', gap: spacing.md, marginBottom: spacing.sm },
  subItemForgotten: { opacity: 0.7, borderColor: `${colors.danger}44` },
  subLogo: { width: 44, height: 44, borderRadius: radius.sm, backgroundColor: colors.surfaceAlt, alignItems: 'center', justifyContent: 'center', overflow: 'hidden' },
  logoImg: { width: 40, height: 40, borderRadius: radius.sm },
  logoFallback: { fontSize: typography.xl, fontWeight: '500', color: colors.accent },
  subInfo: { flex: 1 },
  subNameRow: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm, marginBottom: 2 },
  subName: { fontSize: typography.md, fontWeight: '500', color: colors.textPrimary },
  subMeta: { fontSize: typography.xs, color: colors.textSecondary },
  subRight: { alignItems: 'flex-end', gap: 4 },
  subPrice: { fontSize: typography.md, fontWeight: '500', color: colors.accent },
  deleteBtn: { fontSize: typography.xs, color: colors.danger },
  trialBadge: { borderRadius: radius.sm, borderWidth: 0.5, paddingHorizontal: 6, paddingVertical: 2 },
  trialText: { fontSize: typography.xs },
  forgottenBadge: { backgroundColor: `${colors.danger}20`, borderRadius: radius.sm, borderWidth: 0.5, borderColor: `${colors.danger}44`, paddingHorizontal: 6, paddingVertical: 2 },
  forgottenText: { fontSize: typography.xs, color: colors.danger },
  modalOverlay: { flex: 1, backgroundColor: '#000000aa', justifyContent: 'flex-end' },
  modal: { backgroundColor: colors.surface, borderTopLeftRadius: radius.xl, borderTopRightRadius: radius.xl, padding: spacing.xxl, maxHeight: '90%' },
  modalHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: spacing.xl },
  modalTitle: { fontSize: typography.xl, fontWeight: '500', color: colors.textPrimary },
  modalClose: { fontSize: typography.xl, color: colors.textSecondary },
  label: { fontSize: typography.sm, color: colors.textSecondary, marginBottom: spacing.sm },
  input: { backgroundColor: colors.surfaceAlt, borderRadius: radius.md, borderWidth: 0.5, borderColor: colors.border, padding: spacing.lg, color: colors.textPrimary, fontSize: typography.md, marginBottom: spacing.lg },
  suggestionsBox: { backgroundColor: colors.surfaceAlt, borderRadius: radius.md, borderWidth: 0.5, borderColor: colors.border, marginBottom: spacing.lg, overflow: 'hidden' },
  suggestionRow: { flexDirection: 'row', alignItems: 'center', padding: spacing.md, gap: spacing.md },
  suggestionBorder: { borderBottomWidth: 0.5, borderBottomColor: colors.border },
  suggestionLogo: { width: 28, height: 28, borderRadius: 6 },
  suggestionInfo: { flex: 1 },
  suggestionName: { fontSize: typography.md, color: colors.textPrimary, fontWeight: '500' },
  suggestionCat: { fontSize: typography.xs, color: colors.textSecondary },
  suggestionArrow: { fontSize: typography.md, color: colors.textSecondary },
  tiersBox: { backgroundColor: colors.surfaceAlt, borderRadius: radius.md, borderWidth: 0.5, borderColor: colors.border, marginBottom: spacing.lg, overflow: 'hidden' },
  tierRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', padding: spacing.md, borderBottomWidth: 0.5, borderBottomColor: colors.border },
  tierRowActive: { backgroundColor: colors.accentMuted },
  tierName: { fontSize: typography.md, color: colors.textPrimary },
  tierNameActive: { color: colors.accent, fontWeight: '500' },
  tierPrice: { fontSize: typography.md, color: colors.textSecondary },
  tierPriceActive: { color: colors.accent },
  toggleRow: { flexDirection: 'row', gap: spacing.sm, marginBottom: spacing.lg },
  toggleBtn: { flex: 1, padding: spacing.md, borderRadius: radius.md, borderWidth: 0.5, borderColor: colors.border, alignItems: 'center' },
  toggleBtnActive: { backgroundColor: colors.accentMuted, borderColor: colors.accent },
  toggleText: { fontSize: typography.sm, color: colors.textSecondary },
  toggleTextActive: { color: colors.accent, fontWeight: '500' },
  catScroll: { marginBottom: spacing.lg },
  catChip: { paddingHorizontal: spacing.lg, paddingVertical: spacing.sm, borderRadius: radius.full, borderWidth: 0.5, borderColor: colors.border, marginRight: spacing.sm },
  catChipActive: { backgroundColor: colors.accentMuted, borderColor: colors.accent },
  catText: { fontSize: typography.sm, color: colors.textSecondary },
  catTextActive: { color: colors.accent },
  switchRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: spacing.xl },
  saveBtn: { backgroundColor: colors.accent, borderRadius: radius.md, padding: spacing.lg, alignItems: 'center', marginTop: spacing.sm, marginBottom: spacing.xxl },
  saveBtnText: { color: colors.textPrimary, fontSize: typography.md, fontWeight: '500' },
});
