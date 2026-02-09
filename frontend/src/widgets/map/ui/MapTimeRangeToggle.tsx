import React from 'react';
import type { DisplayTimeRange } from '@/shared/types';

interface MapTimeRangeToggleProps {
  timeRange: DisplayTimeRange;
  onChange: (range: DisplayTimeRange) => void;
}

export const MapTimeRangeToggle: React.FC<MapTimeRangeToggleProps> = ({ timeRange, onChange }) => {
  return (
    <div className="absolute top-16 left-4 z-[1000] flex items-center gap-2 bg-white/90 backdrop-blur border border-slate-200/70 shadow-lg rounded-xl px-3 py-2">
      <div className="text-sm text-slate-700">期間:</div>
      <button
        onClick={() => onChange('1d')}
        className={`px-3 py-1 rounded-full text-sm transition-colors ${
          timeRange === '1d' ? 'bg-amber-600 text-white' : 'bg-slate-100 text-slate-700 hover:bg-slate-200'
        }`}
      >
        1日
      </button>
      <button
        onClick={() => onChange('7d')}
        className={`px-3 py-1 rounded-full text-sm transition-colors ${
          timeRange === '7d' ? 'bg-amber-600 text-white' : 'bg-slate-100 text-slate-700 hover:bg-slate-200'
        }`}
      >
        1週間
      </button>
      <button
        onClick={() => onChange('30d')}
        className={`px-3 py-1 rounded-full text-sm transition-colors ${
          timeRange === '30d' ? 'bg-amber-600 text-white' : 'bg-slate-100 text-slate-700 hover:bg-slate-200'
        }`}
      >
        1ヶ月
      </button>
    </div>
  );
};
