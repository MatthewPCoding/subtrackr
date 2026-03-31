import React, { createContext, useContext, useState, useEffect } from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { logout } from '../services/api';

const AuthContext = createContext(null);

export const AuthProvider = ({ children }) => {
  const [token, setToken] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const load = async () => {
      const stored = await AsyncStorage.getItem('token');
      if (stored) setToken(stored);
      setLoading(false);
    };
    load();
  }, []);

  const signIn = (newToken) => setToken(newToken);

  const signOut = async () => {
    await logout();
    setToken(null);
  };

  return (
    <AuthContext.Provider value={{ token, loading, signIn, signOut }}>
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = () => useContext(AuthContext);
