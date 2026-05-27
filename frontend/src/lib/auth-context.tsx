'use client';

import { createContext, useContext, useEffect, useState, useMemo, useCallback, ReactNode } from 'react';
import { auth as authApi } from '@/lib/api';
import type { User } from '@/types';

interface AuthContextValue {
  user: User | null;
  token: string | null;
  login: (token: string, user: User) => void;
  logout: () => void;
  updateUser: (u: Partial<User>) => void;
  isAuthenticated: boolean;
  isModerator: boolean;
  isAdmin: boolean;
  hydrated: boolean;
  verificationPromptOpen: boolean;
  verificationMessage: string | null;
  promptVerification: (message?: string) => void;
  closeVerificationPrompt: () => void;
  loginPromptOpen: boolean;
  promptLogin: () => void;
  closeLoginPrompt: () => void;
}

const AuthContext = createContext<AuthContextValue | null>(null);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [token, setToken] = useState<string | null>(null);
  const [hydrated, setHydrated] = useState(false);
  const [verificationPromptOpen, setVerificationPromptOpen] = useState(false);
  const [verificationMessage, setVerificationMessage] = useState<string | null>(null);
  const [loginPromptOpen, setLoginPromptOpen] = useState(false);

  // Rehydrate session from httpOnly cookie on every page load.
  useEffect(() => {
    authApi.me()
      .then(({ data, token: t }) => {
        setUser(data);
        setToken(t);
      })
      .catch(() => { /* Not logged in — normal state */ })
      .finally(() => setHydrated(true));
  }, []);

  // Listen for email verification from other tabs (BroadcastChannel)
  useEffect(() => {
    try {
      const bc = new BroadcastChannel('auth');
      bc.onmessage = (e) => {
        if (e.data?.type === 'email_verified') {
          setUser((prev) => prev ? { ...prev, email_verified: true } : prev);
        }
      };
      return () => bc.close();
    } catch { /* BroadcastChannel not supported */ }
  }, []);

  const login = useCallback((t: string, u: User) => {
    setToken(t);
    setUser(u);
  }, []);

  const updateUser = useCallback((patch: Partial<User>) => {
    setUser((prev) => (prev ? { ...prev, ...patch } : prev));
  }, []);

  const logout = useCallback(() => {
    authApi.logout().catch(() => { /* best-effort */ });
    setToken(null);
    setUser(null);
  }, []);

  const promptVerification = useCallback((message?: string) => {
    setVerificationMessage(message ?? null);
    setVerificationPromptOpen(true);
  }, []);

  const closeVerificationPrompt = useCallback(() => {
    setVerificationPromptOpen(false);
    setVerificationMessage(null);
  }, []);

  const promptLogin = useCallback(() => setLoginPromptOpen(true), []);
  const closeLoginPrompt = useCallback(() => setLoginPromptOpen(false), []);

  const value = useMemo<AuthContextValue>(() => ({
    user,
    token,
    login,
    logout,
    updateUser,
    isAuthenticated: !!user,
    isModerator: user?.role === 'moderator' || user?.role === 'admin',
    isAdmin: user?.role === 'admin',
    hydrated,
    verificationPromptOpen,
    verificationMessage,
    promptVerification,
    closeVerificationPrompt,
    loginPromptOpen,
    promptLogin,
    closeLoginPrompt,
  }), [
    user, token, hydrated,
    verificationPromptOpen, verificationMessage,
    loginPromptOpen,
    login, logout, updateUser,
    promptVerification, closeVerificationPrompt,
    promptLogin, closeLoginPrompt,
  ]);

  return (
    <AuthContext.Provider value={value}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth must be used within AuthProvider');
  return ctx;
}
