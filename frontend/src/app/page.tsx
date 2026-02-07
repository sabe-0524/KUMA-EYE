'use client';

import React, { useCallback, useEffect, useState } from 'react';
import dynamic from 'next/dynamic';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/shared/providers/AuthProvider';
import type { Alert, DisplayMode, LatLng, Sighting } from '@/shared/types';
import {
  DashboardFooter,
  DashboardHeader,
  DashboardSidePanel,
  type ActivePanel,
} from '@/widgets/dashboard-shell';

const MapView = dynamic(() => import('@/widgets/map').then((module) => module.MapView), {
  ssr: false,
  loading: () => (
    <div className="w-full h-full flex items-center justify-center bg-gradient-to-br from-slate-50 via-amber-50/60 to-emerald-50/40">
      <div className="text-slate-500">地図を読み込み中...</div>
    </div>
  ),
});

export default function HomePage() {
  const { user, loading, logout } = useAuth();
  const router = useRouter();
  const [activePanel, setActivePanel] = useState<ActivePanel>(null);
  const [refreshTrigger, setRefreshTrigger] = useState(0);
  const [displayMode, setDisplayMode] = useState<DisplayMode>('national');
  const [nearbyBounds, setNearbyBounds] = useState<string | null>(null);
  const [isCameraPlacementMode, setIsCameraPlacementMode] = useState(false);
  const [selectedCameraLocation, setSelectedCameraLocation] = useState<LatLng | null>(null);

  useEffect(() => {
    if (!loading && !user) {
      router.push('/login');
    }
  }, [user, loading, router]);

  const refreshMap = useCallback(() => {
    setRefreshTrigger((prev) => prev + 1);
  }, []);

  const handleUploadSuccess = useCallback(() => {
    refreshMap();
  }, [refreshMap]);

  const handleAlertClick = useCallback(
    (alert: Alert) => {
      if (alert.sighting) {
        refreshMap();
        setActivePanel(null);
      }
    },
    [refreshMap]
  );

  const handleSightingClick = useCallback((sighting: Sighting) => {
    console.log('Selected sighting:', sighting);
  }, []);

  const handleDisplayContextChange = useCallback((context: { mode: DisplayMode; bounds: string | null }) => {
    setDisplayMode(context.mode);
    setNearbyBounds(context.bounds);
  }, []);

  const togglePanel = useCallback((panel: Exclude<ActivePanel, null>) => {
    setActivePanel((prev) => (prev === panel ? null : panel));
  }, []);

  const handleLogout = useCallback(async () => {
    try {
      await logout();
      router.push('/login');
    } catch (error) {
      console.error('ログアウト失敗:', error);
    }
  }, [logout, router]);

  if (loading) {
    return (
      <div className="h-screen flex items-center justify-center bg-gradient-to-br from-slate-50 via-amber-50/60 to-emerald-50/40">
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

  const userLabel = user.displayName || user.email || '-';

  return (
    <div className="h-screen flex flex-col bg-slate-50 overflow-hidden">
      <DashboardHeader
        userLabel={userLabel}
        activePanel={activePanel}
        onRefresh={refreshMap}
        onOpenSettings={() => router.push('/settings')}
        onTogglePanel={togglePanel}
        onLogout={handleLogout}
      />

      <div className="flex-1 relative overflow-hidden">
        <div className="absolute inset-0" style={{ isolation: 'isolate', zIndex: 0 }}>
          <MapView
            onSightingSelect={handleSightingClick}
            refreshTrigger={refreshTrigger}
            onDisplayContextChange={handleDisplayContextChange}
            cameraPlacementMode={isCameraPlacementMode}
            cameraPlacementLocation={selectedCameraLocation}
            onCameraPlacementSelect={setSelectedCameraLocation}
          />
        </div>

        <DashboardSidePanel
          activePanel={activePanel}
          displayMode={displayMode}
          nearbyBounds={nearbyBounds}
          isCameraPlacementMode={isCameraPlacementMode}
          selectedCameraLocation={selectedCameraLocation}
          onClose={() => setActivePanel(null)}
          onUploadComplete={handleUploadSuccess}
          onRegisterComplete={refreshMap}
          onPlacementModeChange={setIsCameraPlacementMode}
          onClearSelectedLocation={() => setSelectedCameraLocation(null)}
          onAlertClick={handleAlertClick}
        />
      </div>

      <DashboardFooter />
    </div>
  );
}
