'use client';
import { useEffect } from 'react';
import { useRouter } from 'next/navigation';
import Cookies from 'js-cookie';

export default function Home() {
  const router = useRouter();
  useEffect(() => {
    const token = Cookies.get('token');
    const user = Cookies.get('user');
    if (token && user) {
      try {
        const u = JSON.parse(user);
        router.replace(u.role === 'seller' ? '/seller' : '/admin');
      } catch {
        router.replace('/login');
      }
    } else {
      router.replace('/login');
    }
  }, [router]);
  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-50 dark:bg-gray-950">
      <div className="w-8 h-8 border-2 border-indigo-500 border-t-transparent rounded-full animate-spin" />
    </div>
  );
}
