import React from 'react';
import { X } from 'lucide-react';
import { CameraRegisterPanel } from '@/features/camera-register';
import { UploadPanel } from '@/features/upload-footage';
import { AlertPanel } from '@/widgets/alert-panel';
import type { Alert, DisplayMode, LatLng } from '@/shared/types';
import type { ActivePanel } from '@/widgets/dashboard-shell/ui/DashboardHeader';

interface DashboardSidePanelProps {
  activePanel: ActivePanel;
  displayMode: DisplayMode;
  nearbyBounds: string | null;
  isCameraPlacementMode: boolean;
  selectedCameraLocation: LatLng | null;
  onClose: () => void;
  onUploadComplete: () => void;
  onRegisterComplete: () => void;
  onPlacementModeChange: (enabled: boolean) => void;
  onClearSelectedLocation: () => void;
  onAlertClick: (alert: Alert) => void;
}

const getPanelTitle = (activePanel: ActivePanel): string => {
  if (activePanel === 'upload') return '映像アップロード';
  if (activePanel === 'camera') return 'カメラ管理';
  return '警報一覧';
};

export const DashboardSidePanel: React.FC<DashboardSidePanelProps> = ({
  activePanel,
  displayMode,
  nearbyBounds,
  isCameraPlacementMode,
  selectedCameraLocation,
  onClose,
  onUploadComplete,
  onRegisterComplete,
  onPlacementModeChange,
  onClearSelectedLocation,
  onAlertClick,
}) => {
  if (!activePanel) {
    return null;
  }

  return (
    <div className="absolute inset-0 pointer-events-none" style={{ zIndex: 9999 }}>
      <div className="absolute inset-0 bg-black/40 lg:hidden pointer-events-auto" onClick={onClose} />

      <div className="absolute right-0 top-0 bottom-0 w-full max-w-md bg-white/95 backdrop-blur-md border-l border-slate-200/70 shadow-2xl flex flex-col pointer-events-auto">
        <div className="flex items-center justify-between p-4 border-b border-slate-200/70 bg-slate-50/70">
          <h2 className="font-semibold text-slate-900">{getPanelTitle(activePanel)}</h2>
          <button onClick={onClose} className="p-1 hover:bg-slate-200/60 rounded">
            <X className="w-5 h-5 text-slate-500" />
          </button>
        </div>

        <div className="flex-1 overflow-y-auto">
          {activePanel === 'upload' && (
            <div className="p-4">
              <UploadPanel onUploadComplete={onUploadComplete} />
            </div>
          )}

          {activePanel === 'camera' && (
            <div className="p-4">
              <CameraRegisterPanel
                onRegisterComplete={onRegisterComplete}
                placementMode={isCameraPlacementMode}
                selectedLocation={selectedCameraLocation}
                onPlacementModeChange={onPlacementModeChange}
                onClearSelectedLocation={onClearSelectedLocation}
              />
            </div>
          )}

          {activePanel === 'alerts' && (
            <AlertPanel onAlertClick={onAlertClick} displayMode={displayMode} nearbyBounds={nearbyBounds} />
          )}
        </div>
      </div>
    </div>
  );
};
