import React from 'react';
import { Loader2 } from 'lucide-react';
import type { Camera } from '@/shared/types';

interface CameraListProps {
  cameras: Camera[];
  isLoading: boolean;
}

export const CameraList: React.FC<CameraListProps> = ({ cameras, isLoading }) => {
  return (
    <div>
      <h3 className="font-semibold text-slate-800 mb-3">登録済みカメラ</h3>
      {isLoading ? (
        <div className="text-center py-4 text-slate-500">
          <Loader2 className="w-5 h-5 animate-spin mx-auto mb-2" />
          読み込み中...
        </div>
      ) : cameras.length === 0 ? (
        <p className="text-slate-500 text-sm text-center py-4">登録されたカメラはありません</p>
      ) : (
        <div className="space-y-2 max-h-64 overflow-y-auto">
          {cameras.map((camera) => (
            <div key={camera.id} className="p-3 bg-slate-50/70 rounded-lg border border-slate-200/80">
              <div className="flex items-start justify-between">
                <div>
                  <p className="font-medium text-slate-800">{camera.name}</p>
                  <p className="text-xs text-slate-500 mt-1">
                    {camera.latitude.toFixed(4)}, {camera.longitude.toFixed(4)}
                  </p>
                  {camera.description && (
                    <p className="text-sm text-slate-600 mt-1">{camera.description}</p>
                  )}
                </div>
                <span
                  className={`text-xs px-2 py-1 rounded-full ${
                    camera.is_active
                      ? 'bg-green-500/10 text-green-700 border border-green-200/80'
                      : 'bg-slate-100 text-slate-500 border border-slate-200/80'
                  }`}
                >
                  {camera.is_active ? '有効' : '無効'}
                </span>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
};
