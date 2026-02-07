import React from 'react';
import { Bell, Camera, LogOut, RefreshCw, Settings, Upload } from 'lucide-react';

export type ActivePanel = 'upload' | 'alerts' | 'camera' | null;

interface DashboardHeaderProps {
  userLabel: string;
  activePanel: ActivePanel;
  onRefresh: () => void;
  onOpenSettings: () => void;
  onTogglePanel: (panel: Exclude<ActivePanel, null>) => void;
  onLogout: () => void;
}

export const DashboardHeader: React.FC<DashboardHeaderProps> = ({
  userLabel,
  activePanel,
  onRefresh,
  onOpenSettings,
  onTogglePanel,
  onLogout,
}) => {
  return (
    <header className="bg-gradient-to-r from-amber-700 via-amber-600 to-amber-700 text-white shadow-lg shadow-amber-900/10 border-b border-amber-500/30 relative z-50">
      <div className="px-4 py-3 flex items-center justify-between">
        <h1 className="text-xl font-bold flex items-center gap-2">🐻 クマ検出警報システム</h1>
        <div className="flex items-center gap-3">
          <div className="hidden sm:flex items-center gap-2 px-3 py-1 bg-white/10 border border-white/20 rounded-lg">
            <span className="text-sm">{userLabel}</span>
          </div>

          <button
            onClick={onRefresh}
            className="p-2 hover:bg-white/10 rounded-lg transition-colors"
            title="地図を更新"
            aria-label="地図を更新"
          >
            <RefreshCw className="w-5 h-5" />
          </button>

          <button
            onClick={onOpenSettings}
            className="p-2 hover:bg-white/10 rounded-lg transition-colors"
            title="設定"
            aria-label="設定"
          >
            <Settings className="w-5 h-5" />
          </button>

          <button
            onClick={() => onTogglePanel('camera')}
            className={`p-2 rounded-lg transition-colors ${
              activePanel === 'camera' ? 'bg-white/15' : 'hover:bg-white/10'
            }`}
            title="カメラ登録"
            aria-label="カメラ登録"
          >
            <Camera className="w-5 h-5" />
          </button>

          <button
            onClick={() => onTogglePanel('upload')}
            className={`p-2 rounded-lg transition-colors ${
              activePanel === 'upload' ? 'bg-white/15' : 'hover:bg-white/10'
            }`}
            title="映像をアップロード"
            aria-label="映像をアップロード"
          >
            <Upload className="w-5 h-5" />
          </button>

          <button
            onClick={() => onTogglePanel('alerts')}
            className={`p-2 rounded-lg transition-colors ${
              activePanel === 'alerts' ? 'bg-white/15' : 'hover:bg-white/10'
            }`}
            title="警報一覧"
            aria-label="警報一覧"
          >
            <Bell className="w-5 h-5" />
          </button>

          <button
            onClick={onLogout}
            className="p-2 hover:bg-red-500/80 rounded-lg transition-colors"
            title="ログアウト"
            aria-label="ログアウト"
          >
            <LogOut className="w-5 h-5" />
          </button>
        </div>
      </div>
    </header>
  );
};
