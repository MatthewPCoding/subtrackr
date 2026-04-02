import axios from 'axios';
import AsyncStorage from '@react-native-async-storage/async-storage';

// ── API base URL ──────────────────────────────────────────────────────────────
// Set EXPO_PUBLIC_API_URL in your .env to override (e.g. http://127.0.0.1:8000 for local dev)
const BASE_URL = process.env.EXPO_PUBLIC_API_URL || 'https://subtrackr-z1c7.onrender.com';

const api = axios.create({ baseURL: BASE_URL });

api.interceptors.request.use(async (config) => {
  const token = await AsyncStorage.getItem('token');
  if (token) config.headers.Authorization = `Bearer ${token}`;
  return config;
});

// ── Auth ──────────────────────────────────────────────────────────────────────

export const register = async (username, email, password) => {
  const res = await api.post('/auth/register', { username, email, password });
  return res.data;
};

export const login = async (username, password) => {
  const params = new URLSearchParams();
  params.append('username', username);
  params.append('password', password);
  const res = await api.post('/auth/login', params, {
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
  });
  await AsyncStorage.setItem('token', res.data.access_token);
  return res.data;
};

export const logout = async () => {
  await AsyncStorage.removeItem('token');
};

// ── Subscriptions ─────────────────────────────────────────────────────────────

export const getSubscriptions = async () => {
  const res = await api.get('/subscriptions/');
  return res.data;
};

export const createSubscription = async (data) => {
  const res = await api.post('/subscriptions/', data);
  return res.data;
};

export const updateSubscription = async (id, data) => {
  const res = await api.put(`/subscriptions/${id}`, data);
  return res.data;
};

export const deleteSubscription = async (id) => {
  const res = await api.delete(`/subscriptions/${id}`);
  return res.data;
};

// ── Analytics ─────────────────────────────────────────────────────────────────

export const getAnalyticsSummary = async (monthlyIncome) => {
  const res = await api.get(`/analytics/summary?monthly_income=${monthlyIncome}`);
  return res.data;
};

// ── Alerts ────────────────────────────────────────────────────────────────────

export const getAlerts = async () => {
  const res = await api.get('/alerts/');
  return res.data;
};

export const getUnreadAlerts = async () => {
  const res = await api.get('/alerts/unread');
  return res.data;
};

export const markAlertRead = async (id) => {
  const res = await api.put(`/alerts/${id}/read`);
  return res.data;
};

export const markAllAlertsRead = async () => {
  const res = await api.put('/alerts/read-all');
  return res.data;
};

export const deleteAlert = async (id) => {
  const res = await api.delete(`/alerts/${id}`);
  return res.data;
};

// ── Auth OAuth ────────────────────────────────────────────────────────────────

// GET /auth/connect/{provider} — returns { url } for OAuth sign-in (no Gmail scan)
export const getEmailLoginURL = async (provider) => {
  const res = await api.get(`/auth/connect/${provider}`);
  return res.data;
};

// ── Email OAuth ───────────────────────────────────────────────────────────────

// Key used to hand off scan results from the deep-link handler (App.js)
// to whichever screen needs to display them (onboarding or EmailScanScreen).
export const PENDING_EMAIL_RESULTS_KEY = '@subtrackr/pending_email_results';

// Public — no auth required. Returns { url } for Google/Microsoft,
// or { coming_soon: true } for all other providers.
export const getEmailConnectURL = async (provider) => {
  const res = await api.get(`/email/connect/${provider}`);
  return res.data;
};

export const getEmailStatus = async () => {
  const res = await api.get('/email/status');
  return res.data;
};

export const disconnectEmail = async () => {
  const res = await api.delete('/email/disconnect');
  return res.data;
};

// POST /email/import — auth required
export const importEmailSubscriptions = async (subscriptions) => {
  const res = await api.post('/email/import', { subscriptions });
  return res.data;
};

// ── AI ────────────────────────────────────────────────────────────────────────

export const chatWithAI = async (message, history = []) => {
  const res = await api.post('/ai/chat', { message, history });
  return res.data.response;
};

export const getAISuggestions = async (monthlyIncome) => {
  const res = await api.get(`/ai/suggestions?monthly_income=${monthlyIncome}`);
  return res.data.response;
};

export const getMonthlyReport = async (monthlyIncome) => {
  const res = await api.get(`/ai/report?monthly_income=${monthlyIncome}`);
  return res.data.response;
};

export const getDeals = async (subscriptionId) => {
  const res = await api.get(`/ai/deals/${subscriptionId}`);
  return res.data.response;
};

// ── Savings ───────────────────────────────────────────────────────────────────

export const getAudit = async (monthlyIncome) => {
  const res = await api.get(`/savings/audit?monthly_income=${monthlyIncome}`);
  return res.data;
};

export const getAlternatives = async (subscriptionId) => {
  const res = await api.get(`/savings/alternatives/${subscriptionId}`);
  return res.data;
};
