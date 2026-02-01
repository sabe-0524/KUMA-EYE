'use client';

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/shared/providers/AuthProvider';

export default function LoginPage() {
  const { user, loading, signInWithGoogle } = useAuth();
  const router = useRouter();

  useEffect(() => {
    if (user) {
      router.push('/');
    }
  }, [user, router]);

  const handleGoogleSignIn = async () => {
    try {
      await signInWithGoogle();
    } catch (error) {
      console.error('ログイン失敗:', error);
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-slate-50 via-slate-50/60 to-stone-100/60">
        <div className="text-center">
          <div className="animate-spin rounded-full h-16 w-16 border-b-2 border-green-600 mx-auto"></div>
          <p className="mt-4 text-slate-600">読み込み中...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-slate-50 via-slate-50/60 to-stone-100/60">
      <div className="max-w-md w-full space-y-8 p-8 bg-white/90 backdrop-blur rounded-2xl border border-slate-200/80 shadow-xl shadow-slate-200/40">
        <div className="text-center">
          <div className="flex justify-center mb-6">
            <div className="text-6xl">🐻</div>
          </div>
          <h2 className="text-3xl font-bold text-slate-900 mb-2">
            クマ検出警報システム
          </h2>
          <p className="text-slate-600">
            ログインしてシステムにアクセス
          </p>
        </div>

        <div className="mt-8">
          <button
            onClick={handleGoogleSignIn}
            className="w-full flex items-center justify-center px-4 py-3 border border-slate-200/80 text-base font-medium rounded-lg text-slate-800 bg-white hover:bg-slate-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-slate-400/60 transition-colors duration-200 shadow-sm hover:shadow-md"
          >
            <svg className="w-5 h-5 mr-3" viewBox="0 0 24 24" fill="currentColor">
              <path d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" fill="#4285F4"/>
              <path d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" fill="#34A853"/>
              <path d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z" fill="#FBBC05"/>
              <path d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" fill="#EA4335"/>
            </svg>
            Googleでログイン
          </button>

          <div className="mt-6 text-center text-sm text-slate-500">
            <p>ログインすることで、利用規約に同意したものとみなされます</p>
          </div>
        </div>

        <div className="mt-8 border-t pt-6">
          <div className="text-sm text-slate-600 space-y-2">
            <p className="flex items-center">
              <span className="mr-2">🔒</span>
              Firebase認証による安全なログイン
            </p>
            <p className="flex items-center">
              <span className="mr-2">🌲</span>
              山林地域の熊目撃情報を管理
            </p>
            <p className="flex items-center">
              <span className="mr-2">📹</span>
              AIによる自動熊検出システム
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}
