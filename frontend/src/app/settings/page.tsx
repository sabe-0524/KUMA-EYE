'use client';

import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { useRouter } from 'next/navigation';
import { ArrowLeft, RefreshCw, Settings } from 'lucide-react';
import { useAuth } from '@/shared/providers/AuthProvider';
import { getMyProfile } from '@/shared/api';
import type { UserProfile } from '@/shared/types';

export default function SettingsPage() {
  const { user, loading } = useAuth();
  const router = useRouter();
  const [profile, setProfile] = useState<UserProfile | null>(null);
  const [isFetching, setIsFetching] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const displayName = useMemo(() => {
    if (profile?.name) return profile.name;
    return user?.displayName || '-';
  }, [profile?.name, user?.displayName]);

  const loadProfile = useCallback(async () => {
    if (!user) {
      return;
    }

    setIsFetching(true);
    setError(null);
    try {
      const idToken = await user.getIdToken();
      const data = await getMyProfile(idToken);
      setProfile(data);
    } catch (e) {
      console.error('プロフィール取得エラー:', e);
      setError('プロフィール情報の取得に失敗しました。');
    } finally {
      setIsFetching(false);
    }
  }, [user]);

  useEffect(() => {
    if (!loading && !user) {
      router.push('/login');
      return;
    }

    if (user) {
      void loadProfile();
    }
  }, [loading, user, router, loadProfile]);

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-slate-50 via-amber-50/60 to-emerald-50/40">
        <div className="text-center">
          <div className="animate-spin rounded-full h-16 w-16 border-b-2 border-amber-600 mx-auto" />
          <p className="mt-4 text-slate-600">読み込み中...</p>
        </div>
      </div>
    );
  }

  if (!user) {
    return null;
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 via-amber-50/60 to-emerald-50/40">
      <header className="bg-gradient-to-r from-amber-700 via-amber-600 to-amber-700 text-white shadow-lg shadow-amber-900/10 border-b border-amber-500/30">
        <div className="max-w-4xl mx-auto px-4 py-3 flex items-center justify-between gap-3">
          <div className="flex items-center gap-2">
            <Settings className="w-5 h-5" />
            <h1 className="text-lg sm:text-xl font-bold">設定</h1>
          </div>
          <button
            onClick={() => router.push('/')}
            className="inline-flex items-center gap-2 px-3 py-2 rounded-lg bg-white/10 hover:bg-white/20 transition-colors"
          >
            <ArrowLeft className="w-4 h-4" />
            ダッシュボードへ戻る
          </button>
        </div>
      </header>

      <main className="max-w-4xl mx-auto p-4 sm:p-6">
        <section className="bg-white/95 border border-slate-200/70 rounded-xl shadow-md p-5 sm:p-6">
          <div className="flex items-center justify-between mb-5">
            <h2 className="text-lg font-semibold text-slate-900">アカウント情報</h2>
            <button
              onClick={() => {
                void loadProfile();
              }}
              disabled={isFetching}
              className="inline-flex items-center gap-2 px-3 py-2 rounded-lg border border-slate-300 text-slate-700 hover:bg-slate-50 disabled:opacity-60"
            >
              <RefreshCw className={`w-4 h-4 ${isFetching ? 'animate-spin' : ''}`} />
              再取得
            </button>
          </div>

          {error && (
            <div className="mb-4 rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">
              {error}
            </div>
          )}

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 text-sm">
            <div className="rounded-lg border border-slate-200 p-3">
              <p className="text-slate-500">Firebase UID</p>
              <p className="mt-1 font-medium text-slate-900 break-all">{profile?.firebase_uid || '-'}</p>
            </div>
            <div className="rounded-lg border border-slate-200 p-3">
              <p className="text-slate-500">Email</p>
              <p className="mt-1 font-medium text-slate-900 break-all">{profile?.email || user.email || '-'}</p>
            </div>
            <div className="rounded-lg border border-slate-200 p-3">
              <p className="text-slate-500">Name</p>
              <p className="mt-1 font-medium text-slate-900">{displayName}</p>
            </div>
            <div className="rounded-lg border border-slate-200 p-3">
              <p className="text-slate-500">作成日時</p>
              <p className="mt-1 font-medium text-slate-900">
                {profile?.created_at ? new Date(profile.created_at).toLocaleString('ja-JP') : '-'}
              </p>
            </div>
            <div className="rounded-lg border border-slate-200 p-3 sm:col-span-2">
              <p className="text-slate-500">更新日時</p>
              <p className="mt-1 font-medium text-slate-900">
                {profile?.updated_at ? new Date(profile.updated_at).toLocaleString('ja-JP') : '-'}
              </p>
            </div>
          </div>
        </section>
      </main>
    </div>
  );
}
