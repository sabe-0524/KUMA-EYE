'use client';

import { useState } from 'react';
import { updateNotificationSettings } from '@/shared/api';
import { useAuth } from '@/shared/providers/AuthProvider';
import type { UserProfile } from '@/shared/types';

interface UseNotificationSettingsResult {
  isSaving: boolean;
  error: string | null;
  updateEmailOptIn: (enabled: boolean) => Promise<UserProfile | null>;
}

export const useNotificationSettings = (): UseNotificationSettingsResult => {
  const { user, setProfileData } = useAuth();
  const [isSaving, setIsSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const updateEmailOptIn = async (enabled: boolean): Promise<UserProfile | null> => {
    if (!user) {
      setError('ログイン状態を確認できません。');
      return null;
    }

    setIsSaving(true);
    setError(null);
    try {
      const idToken = await user.getIdToken();
      const updated = await updateNotificationSettings(enabled, idToken);
      setProfileData(updated);
      return updated;
    } catch (e) {
      console.error('通知設定の更新に失敗しました:', e);
      setError('通知設定の更新に失敗しました。');
      return null;
    } finally {
      setIsSaving(false);
    }
  };

  return {
    isSaving,
    error,
    updateEmailOptIn,
  };
};
