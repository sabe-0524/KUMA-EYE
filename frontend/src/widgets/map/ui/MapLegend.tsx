import React from 'react';
import { alertLevelEmojis, alertLevelLabels } from '@/shared/types';
import { getAlertColor } from '@/shared/lib/utils';

export const MapLegend: React.FC = () => {
  return (
    <div className="absolute bottom-4 left-4 bg-white/90 backdrop-blur rounded-xl border border-slate-200/70 shadow-lg p-3 z-[1000]">
      <h4 className="font-semibold text-sm text-slate-900 mb-2">警報レベル</h4>
      <div className="space-y-1">
        {(['critical', 'warning', 'caution'] as const).map((level) => (
          <div key={level} className="flex items-center gap-2 text-sm">
            <span className="w-3 h-3 rounded-full" style={{ backgroundColor: getAlertColor(level) }} />
            <span>
              {alertLevelEmojis[level]} {alertLevelLabels[level]}
            </span>
          </div>
        ))}
      </div>
    </div>
  );
};
