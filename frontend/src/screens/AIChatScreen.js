import React, { useState, useRef } from 'react';
import {
  View, Text, ScrollView, StyleSheet, TextInput,
  TouchableOpacity, ActivityIndicator, KeyboardAvoidingView, Platform
} from 'react-native';
import { chatWithAI } from '../services/api';
import { colors, spacing, radius, typography } from '../theme';

export default function AIChatScreen() {
  const [messages, setMessages] = useState([
    { role: 'assistant', content: 'Hi! I\'m your Subtrackr assistant. Ask me anything about managing your subscriptions.' }
  ]);
  const [input, setInput] = useState('');
  const [loading, setLoading] = useState(false);
  const scrollRef = useRef(null);

  const send = async () => {
    if (!input.trim() || loading) return;
    const userMsg = { role: 'user', content: input };
    const newMessages = [...messages, userMsg];
    setMessages(newMessages);
    setInput('');
    setLoading(true);

    try {
      const history = newMessages.slice(0, -1).map(m => ({ role: m.role, content: m.content }));
      const response = await chatWithAI(input, history);
      setMessages([...newMessages, { role: 'assistant', content: response }]);
    } catch (e) {
      setMessages([...newMessages, { role: 'assistant', content: 'Sorry, I ran into an issue. Please try again.' }]);
    } finally {
      setLoading(false);
      setTimeout(() => scrollRef.current?.scrollToEnd({ animated: true }), 100);
    }
  };

  return (
    <KeyboardAvoidingView
      style={styles.container}
      behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
      keyboardVerticalOffset={90}
    >
      <View style={styles.header}>
        <Text style={styles.title}>AI Assistant</Text>
        <View style={styles.onlineBadge}>
          <View style={styles.onlineDot} />
          <Text style={styles.onlineText}>Online</Text>
        </View>
      </View>

      <ScrollView
        ref={scrollRef}
        style={styles.messages}
        contentContainerStyle={styles.messagesContent}
        onContentSizeChange={() => scrollRef.current?.scrollToEnd({ animated: true })}
      >
        {messages.map((msg, i) => (
          <View key={i} style={[styles.bubble, msg.role === 'user' ? styles.userBubble : styles.aiBubble]}>
            {msg.role === 'assistant' && <Text style={styles.aiLabel}>Subtrackr AI</Text>}
            <Text style={[styles.bubbleText, msg.role === 'user' && styles.userBubbleText]}>{msg.content}</Text>
          </View>
        ))}
        {loading && (
          <View style={styles.aiBubble}>
            <Text style={styles.aiLabel}>Subtrackr AI</Text>
            <ActivityIndicator color={colors.accent} size="small" />
          </View>
        )}
      </ScrollView>

      <View style={styles.inputRow}>
        <TextInput
          style={styles.input}
          value={input}
          onChangeText={setInput}
          placeholder="Ask me anything..."
          placeholderTextColor={colors.textMuted}
          multiline
          onSubmitEditing={send}
        />
        <TouchableOpacity style={[styles.sendBtn, !input.trim() && styles.sendBtnDisabled]} onPress={send} disabled={!input.trim() || loading}>
          <Text style={styles.sendBtnText}>↑</Text>
        </TouchableOpacity>
      </View>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.background },
  header: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', padding: spacing.xxl, paddingBottom: spacing.md },
  title: { fontSize: typography.xxl, fontWeight: '500', color: colors.textPrimary },
  onlineBadge: { flexDirection: 'row', alignItems: 'center', gap: spacing.xs, backgroundColor: colors.surface, borderRadius: radius.full, paddingHorizontal: spacing.md, paddingVertical: spacing.xs, borderWidth: 0.5, borderColor: colors.border },
  onlineDot: { width: 6, height: 6, borderRadius: 3, backgroundColor: colors.success },
  onlineText: { fontSize: typography.xs, color: colors.textSecondary },
  messages: { flex: 1 },
  messagesContent: { padding: spacing.xxl, gap: spacing.md },
  bubble: { maxWidth: '85%', borderRadius: radius.lg, padding: spacing.lg },
  aiBubble: { backgroundColor: colors.surface, borderWidth: 0.5, borderColor: colors.border, alignSelf: 'flex-start' },
  userBubble: { backgroundColor: colors.accent, alignSelf: 'flex-end' },
  aiLabel: { fontSize: typography.xs, color: colors.accent, marginBottom: spacing.xs, fontWeight: '500' },
  bubbleText: { fontSize: typography.md, color: colors.textPrimary, lineHeight: 22 },
  userBubbleText: { color: colors.textPrimary },
  inputRow: { flexDirection: 'row', padding: spacing.lg, gap: spacing.sm, borderTopWidth: 0.5, borderTopColor: colors.border, backgroundColor: colors.background },
  input: { flex: 1, backgroundColor: colors.surface, borderRadius: radius.md, borderWidth: 0.5, borderColor: colors.border, padding: spacing.md, color: colors.textPrimary, fontSize: typography.md, maxHeight: 100 },
  sendBtn: { width: 44, height: 44, borderRadius: radius.full, backgroundColor: colors.accent, alignItems: 'center', justifyContent: 'center' },
  sendBtnDisabled: { backgroundColor: colors.border },
  sendBtnText: { color: colors.textPrimary, fontSize: typography.xl, fontWeight: '500' },
});
