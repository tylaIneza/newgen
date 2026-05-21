'use client';
import { useState, useEffect, useCallback } from 'react';
import Cookies from 'js-cookie';
import { authApi } from '@/lib/api';
import type { User } from '@/types';

export function useAuth() {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const userCookie = Cookies.get('user');
    const token = Cookies.get('token');
    if (userCookie && token) {
      try {
        setUser(JSON.parse(userCookie));
      } catch {
        Cookies.remove('user');
        Cookies.remove('token');
      }
    }
    setLoading(false);
  }, []);

  const login = useCallback(async (email: string, password: string) => {
    const { data } = await authApi.login(email, password);
    Cookies.set('token', data.token, { expires: 1, secure: true, sameSite: 'strict' });
    Cookies.set('user', JSON.stringify(data.user), { expires: 1 });
    setUser(data.user);
    return data.user;
  }, []);

  const logout = useCallback(async () => {
    try { await authApi.logout(); } catch {}
    Cookies.remove('token');
    Cookies.remove('user');
    setUser(null);
  }, []);

  const hasPermission = useCallback(
    (permission: string) => user?.permissions?.includes(permission) || false,
    [user]
  );

  const isAdmin = user?.role === 'admin' || user?.role === 'manager';

  return { user, loading, login, logout, hasPermission, isAdmin };
}
