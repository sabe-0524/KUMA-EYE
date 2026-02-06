'use client';

import React, { useState, useCallback, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import dynamic from 'next/dynamic';
import { UploadPanel } from '@/features/upload-footage';
import { CameraRegisterPanel } from '@/features/camera-register';
import { AlertPanel } from '@/widgets/alert-panel';
import { X, Upload, Bell, RefreshCw, Camera, LogOut, Settings } from 'lucide-react';
import { useAuth } from '@/shared/providers/AuthProvider';
import type { Alert, DisplayMode, Sighting } from '@/shared/types';

// SSRを無効化してMapViewを読み込む（Leafletはクライアントサイドのみ）
const MapView = dynamic(
  () => import('@/widgets/map/ui/MapView').then(mod => mod.MapView),
  { 
    ssr: false,
    loading: () => (
      <div className="w-full h-full flex items-center justify-center bg-gradient-to-br from-slate-50 via-amber-50/60 to-emerald-50/40">
        <div className="text-slate-500">地図を読み込み中...</div>
      </div>
    )
  }
);

type ActivePanel = 'upload' | 'alerts' | 'camera' | null;

export default function HomePage() {
  const { user, loading, logout } = useAuth();
  const router = useRouter();
  const [activePanel, setActivePanel] = useState<ActivePanel>(null);
  const [refreshTrigger, setRefreshTrigger] = useState(0);
  const [displayMode, setDisplayMode] = useState<DisplayMode>('national');
  const [nearbyBounds, setNearbyBounds] = useState<string | null>(null);

  // 未認証の場合はログインページにリダイレクト
  useEffect(() => {
    if (!loading && !user) {
      router.push('/login');
    }
  }, [user, loading, router]);

  // 地図データを更新
  const refreshMap = useCallback(() => {
    setRefreshTrigger(prev => prev + 1);
  }, []);

  // アップロード成功時
  const handleUploadSuccess = useCallback(() => {
    refreshMap();
  }, [refreshMap]);

  // 警報クリック時に地図を更新してパネルを閉じる
  const handleAlertClick = useCallback((alert: Alert) => {
    if (alert.sighting) {
      refreshMap();
      setActivePanel(null);
    }
  }, [refreshMap]);

  // 目撃情報クリック時
  const handleSightingClick = useCallback((sighting: Sighting) => {
    console.log('Selected sighting:', sighting);
  }, []);

  const handleDisplayContextChange = useCallback((context: { mode: DisplayMode; bounds: string | null }) => {
    setDisplayMode(context.mode);
    setNearbyBounds(context.bounds);
  }, []);

  const togglePanel = (panel: ActivePanel) => {
    setActivePanel(prev => prev === panel ? null : panel);
  };

  const handleLogout = async () => {
    try {
      await logout();
      router.push('/login');
    } catch (error) {
      console.error('ログアウト失敗:', error);
    }
  };

  // ローディング中
  if (loading) {
    return (
      <div className="h-screen flex items-center justify-center bg-gradient-to-br from-slate-50 via-amber-50/60 to-emerald-50/40">
        <div className="text-center">
          <div className="animate-spin rounded-full h-16 w-16 border-b-2 border-amber-600 mx-auto"></div>
          <p className="mt-4 text-slate-600">読み込み中...</p>
        </div>
      </div>
    );
  }

  // 未認証（リダイレクト処理中）
  if (!user) {
    return null;
  }

  return (
    <div className="h-screen flex flex-col bg-slate-50 overflow-hidden">
      {/* ヘッダー */}
      <header className="bg-gradient-to-r from-amber-700 via-amber-600 to-amber-700 text-white shadow-lg shadow-amber-900/10 border-b border-amber-500/30 relative z-50">
        <div className="px-4 py-3 flex items-center justify-between">
          <h1 className="text-xl font-bold flex items-center gap-2">
            🐻 クマ検出警報システム
          </h1>
          <div className="flex items-center gap-3">
            <div className="hidden sm:flex items-center gap-2 px-3 py-1 bg-white/10 border border-white/20 rounded-lg">
              <span className="text-sm">{user.displayName || user.email}</span>
            </div>
            <button
              onClick={refreshMap}
              className="p-2 hover:bg-white/10 rounded-lg transition-colors"
              title="地図を更新"
            >
              <RefreshCw className="w-5 h-5" />
            </button>
            <button
              onClick={() => router.push('/settings')}
              className="p-2 hover:bg-white/10 rounded-lg transition-colors"
              title="設定"
            >
              <Settings className="w-5 h-5" />
            </button>
            <button
              onClick={() => togglePanel('camera')}
              className={`p-2 rounded-lg transition-colors ${
                activePanel === 'camera' ? 'bg-white/15' : 'hover:bg-white/10'
              }`}
              title="カメラ登録"
            >
              <Camera className="w-5 h-5" />
            </button>
            <button
              onClick={() => togglePanel('upload')}
              className={`p-2 rounded-lg transition-colors ${
                activePanel === 'upload' ? 'bg-white/15' : 'hover:bg-white/10'
              }`}
              title="映像をアップロード"
            >
              <Upload className="w-5 h-5" />
            </button>
            <button
              onClick={() => togglePanel('alerts')}
              className={`p-2 rounded-lg transition-colors ${
                activePanel === 'alerts' ? 'bg-white/15' : 'hover:bg-white/10'
              }`}
              title="警報一覧"
            >
              <Bell className="w-5 h-5" />
            </button>
            <button
              onClick={handleLogout}
              className="p-2 hover:bg-red-500/80 rounded-lg transition-colors"
              title="ログアウト"
            >
              <LogOut className="w-5 h-5" />
            </button>
          </div>
        </div>
      </header>

      {/* メインコンテンツ */}
      <div className="flex-1 relative overflow-hidden">
        {/* 地図 - isolateで独自のstacking contextを作成 */}
        <div className="absolute inset-0" style={{ isolation: 'isolate', zIndex: 0 }}>
          <MapView
            onSightingSelect={handleSightingClick}
            refreshTrigger={refreshTrigger}
            onDisplayContextChange={handleDisplayContextChange}
          />
        </div>

        {/* サイドパネル */}
        {activePanel && (
          <div 
            className="absolute inset-0 pointer-events-none"
            style={{ zIndex: 9999 }}
          >
            {/* オーバーレイ（モバイル用） */}
            <div
              className="absolute inset-0 bg-black/40 lg:hidden pointer-events-auto"
              onClick={() => setActivePanel(null)}
            />
            
            {/* パネル */}
            <div className="absolute right-0 top-0 bottom-0 w-full max-w-md bg-white/95 backdrop-blur-md border-l border-slate-200/70 shadow-2xl flex flex-col pointer-events-auto">
              {/* パネルヘッダー */}
              <div className="flex items-center justify-between p-4 border-b border-slate-200/70 bg-slate-50/70">
                <h2 className="font-semibold text-slate-900">
                  {activePanel === 'upload' ? '映像アップロード' : 
                   activePanel === 'camera' ? 'カメラ管理' : '警報一覧'}
                </h2>
                <button
                  onClick={() => setActivePanel(null)}
                  className="p-1 hover:bg-slate-200/60 rounded"
                >
                  <X className="w-5 h-5 text-slate-500" />
                </button>
              </div>
              
              {/* パネルコンテンツ */}
              <div className="flex-1 overflow-y-auto">
                {activePanel === 'upload' && (
                  <div className="p-4">
                    <UploadPanel onUploadComplete={handleUploadSuccess} />
                  </div>
                )}
                {activePanel === 'camera' && (
                  <div className="p-4">
                    <CameraRegisterPanel onRegisterComplete={refreshMap} />
                  </div>
                )}
                {activePanel === 'alerts' && (
                  <AlertPanel
                    onAlertClick={handleAlertClick}
                    displayMode={displayMode}
                    nearbyBounds={nearbyBounds}
                  />
                )}
              </div>
            </div>
          </div>
        )}
      </div>

      {/* フッター */}
      <footer className="bg-slate-900 text-slate-400 text-center py-2 text-sm border-t border-slate-800 relative z-50">
        © 2024 Bear Detection Alert System
      </footer>
    </div>
  );
}
