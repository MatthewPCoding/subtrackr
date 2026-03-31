import React, { useState } from 'react';
import {
  View, Text, TouchableOpacity, StyleSheet, Modal,
  ScrollView, ActivityIndicator, TextInput, KeyboardAvoidingView, Platform
} from 'react-native';
import { chatWithAI } from '../services/api';
import { colors, spacing, radius, typography } from '../theme';

const HELP_TOPICS = [
  { id: 1, question: 'How do I add a subscription?', answer: 'Tap the "Subscriptions" tab at the bottom, then hit the "+ Add" button in the top right. Fill in the service name, price, billing cycle, and category. The logo will load automatically if you enter the website.' },
  { id: 2, question: 'How do free trials work?', answer: 'When adding a subscription, toggle "Free trial" on. You\'ll get an alert a few days before your trial ends so you can cancel before being charged.' },
  { id: 3, question: 'Why is my spending total wrong?', answer: 'Annual subscriptions are divided by 12 to show their monthly equivalent. Make sure your billing cycle is set correctly for each subscription.' },
  { id: 4, question: 'How do I set up renewal alerts?', answer: 'Alerts are generated automatically. Go to Settings to adjust how many days in advance you\'re notified before renewals and trial endings.' },
  { id: 5, question: 'How do I remove a subscription?', answer: 'Go to the Subscriptions tab, find the subscription, and tap "Remove" on the right side. This marks it as inactive but keeps your history.' },
  { id: 6, question: 'What does the AI assistant do?', answer: 'The AI can chat with you about managing subscriptions, generate your monthly spending report, find deals on your services, and suggest ways to save money.' },
];

export default function SupportChat() {
  const [open, setOpen] = useState(false);
  const [step, setStep] = useState('topics'); // 'topics' | 'answer' | 'chat'
  const [selectedTopic, setSelectedTopic] = useState(null);
  const [chatMessages, setChatMessages] = useState([]);
  const [input, setInput] = useState('');
  const [loading, setLoading] = useState(false);

  const reset = () => {
    setStep('topics');
    setSelectedTopic(null);
    setChatMessages([]);
    setInput('');
  };

  const selectTopic = (topic) => {
    setSelectedTopic(topic);
    setStep('answer');
  };

  const goToChat = () => {
    setChatMessages([
      { role: 'assistant', content: 'No problem! Tell me what you need help with and I\'ll do my best to assist.' }
    ]);
    setStep('chat');
  };

  const sendChat = async () => {
    if (!input.trim() || loading) return;
    const userMsg = { role: 'user', content: input };
    const newMessages = [...chatMessages, userMsg];
    setChatMessages(newMessages);
    setInput('');
    setLoading(true);
    try {
      const history = newMessages.slice(0, -1);
      const response = await chatWithAI(input, history);
      setChatMessages([...newMessages, { role: 'assistant', content: response }]);
    } catch {
      setChatMessages([...newMessages, { role: 'assistant', content: 'Sorry, something went wrong. Please try again.' }]);
    } finally {
      setLoading(false);
    }
  };

  return (
    <>
      {/* Floating button */}
      <TouchableOpacity style={styles.fab} onPress={() => { setOpen(true); reset(); }}>
        <Text style={styles.fabIcon}>💬</Text>
      </TouchableOpacity>

      {/* Modal */}
      <Modal visible={open} animationType="slide" transparent>
        <KeyboardAvoidingView style={styles.overlay} behavior={Platform.OS === 'ios' ? 'padding' : 'height'}>
          <View style={styles.sheet}>
            {/* Header */}
            <View style={styles.sheetHeader}>
              <View>
                <Text style={styles.sheetTitle}>Help & Support</Text>
                <Text style={styles.sheetSub}>How can we help you?</Text>
              </View>
              <TouchableOpacity onPress={() => setOpen(false)}>
                <Text style={styles.closeBtn}>✕</Text>
              </TouchableOpacity>
            </View>

            {/* Topics */}
            {step === 'topics' && (
              <ScrollView showsVerticalScrollIndicator={false}>
                <Text style={styles.sectionLabel}>Common questions</Text>
                {HELP_TOPICS.map(topic => (
                  <TouchableOpacity key={topic.id} style={styles.topicRow} onPress={() => selectTopic(topic)}>
                    <Text style={styles.topicText}>{topic.question}</Text>
                    <Text style={styles.topicArrow}>→</Text>
                  </TouchableOpacity>
                ))}
                <TouchableOpacity style={styles.chatBtn} onPress={goToChat}>
                  <Text style={styles.chatBtnText}>Talk to AI support →</Text>
                </TouchableOpacity>
              </ScrollView>
            )}

            {/* Answer */}
            {step === 'answer' && selectedTopic && (
              <View style={styles.answerContainer}>
                <TouchableOpacity onPress={() => setStep('topics')} style={styles.backBtn}>
                  <Text style={styles.backText}>← Back</Text>
                </TouchableOpacity>
                <Text style={styles.answerQuestion}>{selectedTopic.question}</Text>
                <View style={styles.answerBox}>
                  <Text style={styles.answerText}>{selectedTopic.answer}</Text>
                </View>
                <Text style={styles.helpfulLabel}>Was this helpful?</Text>
                <View style={styles.helpfulRow}>
                  <TouchableOpacity style={styles.helpfulBtn} onPress={() => setOpen(false)}>
                    <Text style={styles.helpfulBtnText}>Yes, thanks!</Text>
                  </TouchableOpacity>
                  <TouchableOpacity style={[styles.helpfulBtn, styles.helpfulBtnOutline]} onPress={goToChat}>
                    <Text style={styles.helpfulBtnOutlineText}>No, get help</Text>
                  </TouchableOpacity>
                </View>
              </View>
            )}

            {/* Live chat */}
            {step === 'chat' && (
              <View style={styles.chatContainer}>
                <TouchableOpacity onPress={() => setStep('topics')} style={styles.backBtn}>
                  <Text style={styles.backText}>← Back</Text>
                </TouchableOpacity>
                <ScrollView style={styles.chatMessages} contentContainerStyle={{ gap: spacing.sm }}>
                  {chatMessages.map((msg, i) => (
                    <View key={i} style={[styles.bubble, msg.role === 'user' ? styles.userBubble : styles.aiBubble]}>
                      <Text style={[styles.bubbleText, msg.role === 'user' && styles.userBubbleText]}>{msg.content}</Text>
                    </View>
                  ))}
                  {loading && (
                    <View style={styles.aiBubble}>
                      <ActivityIndicator color={colors.accent} size="small" />
                    </View>
                  )}
                </ScrollView>
                <View style={styles.chatInputRow}>
                  <TextInput
                    style={styles.chatInput}
                    value={input}
                    onChangeText={setInput}
                    placeholder="Type your question..."
                    placeholderTextColor={colors.textMuted}
                  />
                  <TouchableOpacity style={styles.sendBtn} onPress={sendChat} disabled={!input.trim() || loading}>
                    <Text style={styles.sendText}>↑</Text>
                  </TouchableOpacity>
                </View>
              </View>
            )}
          </View>
        </KeyboardAvoidingView>
      </Modal>
    </>
  );
}

const styles = StyleSheet.create({
  fab: { position: 'absolute', bottom: 80, right: 20, width: 52, height: 52, borderRadius: 26, backgroundColor: colors.accent, alignItems: 'center', justifyContent: 'center', zIndex: 999, shadowColor: colors.accent, shadowOffset: { width: 0, height: 4 }, shadowOpacity: 0.3, shadowRadius: 8, elevation: 8 },
  fabIcon: { fontSize: 22 },
  overlay: { flex: 1, justifyContent: 'flex-end', backgroundColor: '#000000aa' },
  sheet: { backgroundColor: colors.surface, borderTopLeftRadius: radius.xl, borderTopRightRadius: radius.xl, padding: spacing.xxl, maxHeight: '80%' },
  sheetHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: spacing.xl },
  sheetTitle: { fontSize: typography.xl, fontWeight: '500', color: colors.textPrimary },
  sheetSub: { fontSize: typography.sm, color: colors.textSecondary, marginTop: 2 },
  closeBtn: { fontSize: typography.xl, color: colors.textSecondary },
  sectionLabel: { fontSize: typography.xs, color: colors.textSecondary, textTransform: 'uppercase', letterSpacing: 0.5, marginBottom: spacing.md },
  topicRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingVertical: spacing.md, borderBottomWidth: 0.5, borderBottomColor: colors.border },
  topicText: { fontSize: typography.md, color: colors.textPrimary, flex: 1, marginRight: spacing.sm },
  topicArrow: { fontSize: typography.md, color: colors.textSecondary },
  chatBtn: { marginTop: spacing.xl, padding: spacing.lg, backgroundColor: colors.accentMuted, borderRadius: radius.md, borderWidth: 0.5, borderColor: colors.accentBorder, alignItems: 'center' },
  chatBtnText: { color: colors.accent, fontSize: typography.md, fontWeight: '500' },
  answerContainer: { flex: 1 },
  backBtn: { marginBottom: spacing.lg },
  backText: { fontSize: typography.sm, color: colors.accent },
  answerQuestion: { fontSize: typography.lg, fontWeight: '500', color: colors.textPrimary, marginBottom: spacing.lg },
  answerBox: { backgroundColor: colors.surfaceAlt, borderRadius: radius.md, padding: spacing.lg, marginBottom: spacing.xl },
  answerText: { fontSize: typography.md, color: colors.textSecondary, lineHeight: 22 },
  helpfulLabel: { fontSize: typography.sm, color: colors.textSecondary, marginBottom: spacing.md },
  helpfulRow: { flexDirection: 'row', gap: spacing.md },
  helpfulBtn: { flex: 1, backgroundColor: colors.accent, borderRadius: radius.md, padding: spacing.md, alignItems: 'center' },
  helpfulBtnText: { color: colors.textPrimary, fontSize: typography.sm, fontWeight: '500' },
  helpfulBtnOutline: { backgroundColor: 'transparent', borderWidth: 0.5, borderColor: colors.border },
  helpfulBtnOutlineText: { color: colors.textSecondary, fontSize: typography.sm },
  chatContainer: { flex: 1, minHeight: 300 },
  chatMessages: { flex: 1, marginBottom: spacing.md },
  bubble: { maxWidth: '85%', borderRadius: radius.lg, padding: spacing.md },
  aiBubble: { backgroundColor: colors.surfaceAlt, alignSelf: 'flex-start' },
  userBubble: { backgroundColor: colors.accent, alignSelf: 'flex-end' },
  bubbleText: { fontSize: typography.sm, color: colors.textPrimary, lineHeight: 20 },
  userBubbleText: { color: colors.textPrimary },
  chatInputRow: { flexDirection: 'row', gap: spacing.sm, marginTop: spacing.sm },
  chatInput: { flex: 1, backgroundColor: colors.surfaceAlt, borderRadius: radius.md, borderWidth: 0.5, borderColor: colors.border, padding: spacing.md, color: colors.textPrimary, fontSize: typography.md },
  sendBtn: { width: 44, height: 44, borderRadius: radius.full, backgroundColor: colors.accent, alignItems: 'center', justifyContent: 'center' },
  sendText: { color: colors.textPrimary, fontSize: typography.lg, fontWeight: '500' },
});
