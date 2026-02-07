import React from 'react';
import type { DisplayMode } from '@/shared/types';

interface MapDisplayModeToggleProps {
  displayMode: DisplayMode;
  onChange: (mode: DisplayMode) => void;
}

export const MapDisplayModeToggle: React.FC<MapDisplayModeToggleProps> = ({
  displayMode,
  onChange,
}) => {
  return (
    <div className="absolute top-4 left-4 z-[1000] flex items-center gap-2 bg-white/90 backdrop-blur border border-slate-200/70 shadow-lg rounded-xl px-3 py-2">
      <div className="text-sm text-slate-700">表示:</div>
      <button
        onClick={() => onChange('national')}
        className={`px-3 py-1 rounded-full text-sm transition-colors ${
          displayMode === 'national'
            ? 'bg-amber-600 text-white'
            : 'bg-slate-100 text-slate-700 hover:bg-slate-200'
        }`}
      >
        全国
      </button>
      <button
        onClick={() => onChange('nearby')}
        className={`px-3 py-1 rounded-full text-sm transition-colors ${
          displayMode === 'nearby'
            ? 'bg-emerald-600 text-white'
            : 'bg-slate-100 text-slate-700 hover:bg-slate-200'
        }`}
      >
        現在地付近
      </button>
    </div>
  );
};
