import { createContext, useContext, useState, useEffect } from 'react';
import type { ReactNode } from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { API_URL } from '../lib/config';

interface User {
  id: string;
  name: string;
  email: string;
  wallet_balance: number;
}

interface AuthContextType {
  user: User | null;
  token: string | null;
  isLoading: boolean;
  login: (email: string, password: string) => Promise<void>;
  register: (name: string, email: string, password: string) => Promise<void>;
  logout: () => Promise<void>;
  refresh: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType | null>(null);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [token, setToken] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    async function loadAuth() {
      try {
        const storedUser = await AsyncStorage.getItem('ocm_user');
        const storedToken = await AsyncStorage.getItem('ocm_token');
        if (storedUser && storedToken) {
          setUser(JSON.parse(storedUser));
          setToken(storedToken);
        }
      } catch (err) {
        console.error('Failed to load auth state', err);
      } finally {
        setIsLoading(false);
      }
    }
    loadAuth();
  }, []);

  const persist = async (data: { token: string; user: User }) => {
    setToken(data.token);
    setUser(data.user);
    await AsyncStorage.setItem('ocm_token', data.token);
    await AsyncStorage.setItem('ocm_user', JSON.stringify(data.user));
  };

  const login = async (email: string, password: string) => {
    const res = await fetch(`${API_URL}/auth/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email, password }),
    });
    if (!res.ok) {
      const msg = await res.text();
      throw new Error(msg.trim() || 'Login failed');
    }
    await persist(await res.json());
  };

  const register = async (name: string, email: string, password: string) => {
    const res = await fetch(`${API_URL}/auth/register`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ name, email, password }),
    });
    if (!res.ok) {
      const msg = await res.text();
      throw new Error(msg.trim() || 'Registration failed');
    }
    await persist(await res.json());
  };

  const logout = async () => {
    setUser(null);
    setToken(null);
    await AsyncStorage.removeItem('ocm_user');
    await AsyncStorage.removeItem('ocm_token');
  };

  const refresh = async () => {
    if (!token) return;
    try {
      const res = await fetch(`${API_URL}/auth/me`, {
        headers: { Authorization: `Bearer ${token}` }
      });
      if (res.ok) {
        const updatedUser = await res.json();
        setUser(updatedUser);
        await AsyncStorage.setItem('ocm_user', JSON.stringify(updatedUser));
      }
    } catch {
      // ignore
    }
  };

  return (
    <AuthContext.Provider value={{ user, token, isLoading, login, register, logout, refresh }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth must be used inside AuthProvider');
  return ctx;
}
