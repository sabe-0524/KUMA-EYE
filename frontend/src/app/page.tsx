'use client';

import React, { useState, useCallback } from 'react';
import dynamic from 'next/dynamic';
import { UploadPanel } from '@/features/upload-footage';
import { CameraRegisterPanel } from '@/features/camera-register';
import { AlertPanel } from '@/widgets/alert-panel';
import { Menu, X, Upload, Bell, Map, RefreshCw, Camera } from 'lucide-react';
import type { Alert, Sighting } from '@/shared/types';

// SSRを無効化してMapViewを読み込む（Leafletはクライアントサイドのみ）
const MapView = dynamic(
  () => import('@/widgets/map/ui/MapView').then(mod => mod.MapView),
  { 
    ssr: false,
    loading: () => (
      <div className="w-full h-full flex items-center justify-center bg-gray-100">
        <div className="text-gray-500">地図を読み込み中...</div>
      </div>
    )
  }
);

type ActivePanel = 'upload' | 'alerts' | 'camera' | null;

export default function HomePage() {
  const [activePanel, setActivePanel] = useState<ActivePanel>(null);
  const [refreshTrigger, setRefreshTrigger] = useState(0);

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

  const togglePanel = (panel: ActivePanel) => {
    setActivePanel(prev => prev === panel ? null : panel);
  };

  return (
    <div className="h-screen flex flex-col bg-gray-100 overflow-hidden">
      {/* ヘッダー */}
      <header className="bg-amber-700 text-white shadow-md relative z-50">
        <div className="px-4 py-3 flex items-center justify-between">
          <h1 className="text-xl font-bold flex items-center gap-2">
            🐻 クマ検出警報システム
          </h1>
          <div className="flex items-center gap-2">
            <button
              onClick={refreshMap}
              className="p-2 hover:bg-amber-600 rounded-lg transition-colors"
              title="地図を更新"
            >
              <RefreshCw className="w-5 h-5" />
            </button>
            <button
              onClick={() => togglePanel('camera')}
              className={`p-2 rounded-lg transition-colors ${
                activePanel === 'camera' ? 'bg-amber-600' : 'hover:bg-amber-600'
              }`}
              title="カメラ登録"
            >
              <Camera className="w-5 h-5" />
            </button>
            <button
              onClick={() => togglePanel('upload')}
              className={`p-2 rounded-lg transition-colors ${
                activePanel === 'upload' ? 'bg-amber-600' : 'hover:bg-amber-600'
              }`}
              title="映像をアップロード"
            >
              <Upload className="w-5 h-5" />
            </button>
            <button
              onClick={() => togglePanel('alerts')}
              className={`p-2 rounded-lg transition-colors ${
                activePanel === 'alerts' ? 'bg-amber-600' : 'hover:bg-amber-600'
              }`}
              title="警報一覧"
            >
              <Bell className="w-5 h-5" />
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
              className="absolute inset-0 bg-black/30 lg:hidden pointer-events-auto"
              onClick={() => setActivePanel(null)}
            />
            
            {/* パネル */}
            <div className="absolute right-0 top-0 bottom-0 w-full max-w-md bg-white shadow-xl flex flex-col pointer-events-auto">
              {/* パネルヘッダー */}
              <div className="flex items-center justify-between p-4 border-b border-gray-200">
                <h2 className="font-semibold text-gray-900">
                  {activePanel === 'upload' ? '映像アップロード' : 
                   activePanel === 'camera' ? 'カメラ管理' : '警報一覧'}
                </h2>
                <button
                  onClick={() => setActivePanel(null)}
                  className="p-1 hover:bg-gray-100 rounded"
                >
                  <X className="w-5 h-5 text-gray-500" />
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
                  <AlertPanel onAlertClick={handleAlertClick} />
                )}
              </div>
            </div>
          </div>
        )}
      </div>

      {/* フッター */}
      <footer className="bg-gray-800 text-gray-400 text-center py-2 text-sm relative z-50">
        © 2024 Bear Detection Alert System
      </footer>
    </div>
  );
}
