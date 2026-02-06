'use client';

import { FormEvent, useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { FirebaseError } from 'firebase/app';
import { useAuth } from '@/shared/providers/AuthProvider';

const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

type AuthMode = 'signIn' | 'signUp';

const getFirebaseAuthErrorMessage = (error: unknown, mode: AuthMode): string => {
  if (!(error instanceof FirebaseError)) {
    return mode === 'signUp'
      ? '新規登録に失敗しました。時間をおいて再度お試しください。'
      : 'ログインに失敗しました。時間をおいて再度お試しください。';
  }

  if (mode === 'signIn') {
    switch (error.code) {
      case 'auth/invalid-email':
        return 'メールアドレスの形式が正しくありません。';
      case 'auth/invalid-credential':
        return 'メールアドレスまたはパスワードが正しくありません。';
      case 'auth/too-many-requests':
        return '試行回数が多すぎます。しばらく待ってからお試しください。';
      default:
        return 'ログインに失敗しました。時間をおいて再度お試しください。';
    }
  }

  switch (error.code) {
    case 'auth/invalid-email':
      return 'メールアドレスの形式が正しくありません。';
    case 'auth/email-already-in-use':
      return 'このメールアドレスは既に登録されています。';
    case 'auth/weak-password':
      return 'パスワードが弱すぎます。より強いパスワードを設定してください。';
    case 'auth/too-many-requests':
      return '試行回数が多すぎます。しばらく待ってからお試しください。';
    default:
      return '新規登録に失敗しました。時間をおいて再度お試しください。';
  }
};

export default function LoginPage() {
  const { user, loading, signInWithGoogle, signInWithEmailPassword, signUpWithEmailPassword } = useAuth();
  const router = useRouter();
  const [authMode, setAuthMode] = useState<AuthMode>('signIn');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [errorMessage, setErrorMessage] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);

  useEffect(() => {
    if (user) {
      router.push('/');
    }
  }, [user, router]);

  const handleModeChange = (mode: AuthMode) => {
    setAuthMode(mode);
    setErrorMessage('');
  };

  const handleGoogleSignIn = async () => {
    try {
      setErrorMessage('');
      await signInWithGoogle();
    } catch (error) {
      console.error('Googleログイン失敗:', error);
      setErrorMessage('Googleログインに失敗しました。時間をおいて再度お試しください。');
    }
  };

  const handleEmailPasswordSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setErrorMessage('');

    const normalizedEmail = email.trim();

    if (!normalizedEmail) {
      setErrorMessage('メールアドレスを入力してください。');
      return;
    }
    if (!EMAIL_PATTERN.test(normalizedEmail)) {
      setErrorMessage('メールアドレスの形式が正しくありません。');
      return;
    }
    if (!password) {
      setErrorMessage('パスワードを入力してください。');
      return;
    }

    if (authMode === 'signUp') {
      if (!confirmPassword) {
        setErrorMessage('確認用パスワードを入力してください。');
        return;
      }
      if (password !== confirmPassword) {
        setErrorMessage('パスワードが一致しません。');
        return;
      }
    }

    try {
      setIsSubmitting(true);
      if (authMode === 'signUp') {
        await signUpWithEmailPassword(normalizedEmail, password);
      } else {
        await signInWithEmailPassword(normalizedEmail, password);
      }
    } catch (error) {
      console.error('認証失敗:', error);
      setErrorMessage(getFirebaseAuthErrorMessage(error, authMode));
    } finally {
      setIsSubmitting(false);
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
            {authMode === 'signUp' ? '新規登録してシステムにアクセス' : 'ログインしてシステムにアクセス'}
          </p>
          <p className="mt-2 text-sm text-slate-500">
            Gmail以外のメールアドレスでも利用できます
          </p>
        </div>

        <div className="mt-8">
          <div className="mb-6 grid grid-cols-2 rounded-lg bg-slate-100 p-1">
            <button
              type="button"
              onClick={() => handleModeChange('signIn')}
              className={`rounded-md px-3 py-2 text-sm font-medium transition-colors ${
                authMode === 'signIn' ? 'bg-white text-slate-900 shadow-sm' : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              ログイン
            </button>
            <button
              type="button"
              onClick={() => handleModeChange('signUp')}
              className={`rounded-md px-3 py-2 text-sm font-medium transition-colors ${
                authMode === 'signUp' ? 'bg-white text-slate-900 shadow-sm' : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              新規登録
            </button>
          </div>

          <form onSubmit={handleEmailPasswordSubmit} className="space-y-4">
            <div>
              <label htmlFor="email" className="block text-sm font-medium text-slate-700 mb-1">
                メールアドレス
              </label>
              <input
                id="email"
                type="email"
                value={email}
                onChange={(event) => setEmail(event.target.value)}
                placeholder="you@example.com"
                autoComplete="email"
                className="w-full px-3 py-2 border border-slate-200 rounded-lg bg-white text-slate-900 placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-slate-400/60 focus:border-slate-300"
              />
            </div>
            <div>
              <label htmlFor="password" className="block text-sm font-medium text-slate-700 mb-1">
                パスワード
              </label>
              <input
                id="password"
                type="password"
                value={password}
                onChange={(event) => setPassword(event.target.value)}
                autoComplete={authMode === 'signUp' ? 'new-password' : 'current-password'}
                className="w-full px-3 py-2 border border-slate-200 rounded-lg bg-white text-slate-900 placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-slate-400/60 focus:border-slate-300"
              />
            </div>
            {authMode === 'signUp' && (
              <div>
                <label htmlFor="confirmPassword" className="block text-sm font-medium text-slate-700 mb-1">
                  パスワード（確認）
                </label>
                <input
                  id="confirmPassword"
                  type="password"
                  value={confirmPassword}
                  onChange={(event) => setConfirmPassword(event.target.value)}
                  autoComplete="new-password"
                  className="w-full px-3 py-2 border border-slate-200 rounded-lg bg-white text-slate-900 placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-slate-400/60 focus:border-slate-300"
                />
              </div>
            )}
            <button
              type="submit"
              disabled={isSubmitting}
              className="w-full px-4 py-3 text-base font-medium rounded-lg text-white bg-slate-800 hover:bg-slate-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-slate-400/60 transition-colors duration-200 disabled:opacity-60 disabled:cursor-not-allowed"
            >
              {isSubmitting ? (authMode === 'signUp' ? '登録中...' : 'ログイン中...') : authMode === 'signUp' ? 'メールアドレスで新規登録' : 'メールアドレスでログイン'}
            </button>
          </form>

          {errorMessage && (
            <div className="mt-4 rounded-md border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">
              {errorMessage}
            </div>
          )}

          <div className="my-6 flex items-center">
            <div className="h-px flex-1 bg-slate-200"></div>
            <span className="mx-3 text-xs text-slate-500">または</span>
            <div className="h-px flex-1 bg-slate-200"></div>
          </div>

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
