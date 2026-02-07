'use client';

import React from 'react';
import { Bell, Loader2, MapPin } from 'lucide-react';
import { useAuth } from '@/shared/providers/AuthProvider';
import { useNotificationSettings } from '../model/useNotificationSettings';

const locationStatusLabel = {
  idle: '待機中',
  watching: '共有中',
  permission_denied: '許可なし',
  error: 'エラー',
} as const;

const locationStatusStyle = {
  idle: 'bg-slate-100 text-slate-700 border-slate-200',
  watching: 'bg-emerald-100 text-emerald-700 border-emerald-200',
  permission_denied: 'bg-amber-100 text-amber-700 border-amber-200',
  error: 'bg-red-100 text-red-700 border-red-200',
} as const;

export const NotificationSettingsCard: React.FC = () => {
  const { profile, locationSyncStatus, locationSyncError } = useAuth();
  const { isSaving, error, updateEmailOptIn } = useNotificationSettings();

  const emailOptIn = profile?.email_opt_in ?? false;
  const isProfileReady = profile !== null;
  const updatedAt = profile?.location_updated_at
    ? new Date(profile.location_updated_at).toLocaleString('ja-JP')
    : '未送信';

  return (
    <section className="bg-white/95 border border-slate-200/70 rounded-xl shadow-md p-5 sm:p-6">
      <div className="flex items-center gap-2 mb-5">
        <Bell className="w-5 h-5 text-amber-600" />
        <h2 className="text-lg font-semibold text-slate-900">通知設定</h2>
      </div>

      <div className="flex items-start justify-between gap-4">
        <div>
          <p className="text-sm font-medium text-slate-900">メール通知を受け取る</p>
          <p className="text-sm text-slate-600 mt-1">
            ONのとき、現在地に近いクマ検出アラートをSMTPメールで受信します。
          </p>
        </div>
        <button
          type="button"
          onClick={() => {
            void updateEmailOptIn(!emailOptIn);
          }}
          disabled={isSaving || !isProfileReady}
          className={`relative inline-flex h-7 w-12 items-center rounded-full transition-colors ${
            emailOptIn ? 'bg-emerald-600' : 'bg-slate-300'
          } disabled:opacity-60`}
          aria-pressed={emailOptIn}
          aria-label="メール通知の有効化"
        >
          <span
            className={`inline-block h-5 w-5 transform rounded-full bg-white transition-transform ${
              emailOptIn ? 'translate-x-6' : 'translate-x-1'
            }`}
          />
        </button>
      </div>

      <div className="mt-4 pt-4 border-t border-slate-200 space-y-3 text-sm">
        <div className="flex items-center gap-2">
          <MapPin className="w-4 h-4 text-slate-500" />
          <span className="text-slate-700">位置情報共有状態</span>
          <span
            className={`px-2 py-0.5 rounded-full border text-xs font-medium ${
              locationStatusStyle[locationSyncStatus]
            }`}
          >
            {locationStatusLabel[locationSyncStatus]}
          </span>
          {isSaving && <Loader2 className="w-4 h-4 animate-spin text-slate-500" />}
        </div>

        <div className="text-slate-600">
          最終位置更新: <span className="font-medium text-slate-900">{updatedAt}</span>
        </div>

        {!isProfileReady && (
          <div className="rounded-lg border border-slate-200 bg-slate-50 px-3 py-2 text-sm text-slate-700">
            通知設定を読み込み中です...
          </div>
        )}

        {(error || locationSyncError) && (
          <div className="rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">
            {error || locationSyncError}
          </div>
        )}

        {locationSyncStatus === 'permission_denied' && (
          <div className="rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-sm text-amber-800">
            ブラウザで位置情報共有を許可すると、近傍通知の精度が向上します。
          </div>
        )}
      </div>
    </section>
  );
};
