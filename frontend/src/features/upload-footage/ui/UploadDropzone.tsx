import React from 'react';
import { AlertCircle, CheckCircle, Loader2, Upload } from 'lucide-react';
import type { UploadStatus } from '@/shared/types';

interface UploadDropzoneProps {
  rootProps: React.HTMLAttributes<HTMLDivElement>;
  inputProps: React.InputHTMLAttributes<HTMLInputElement>;
  isDragActive: boolean;
  uploading: boolean;
  clientProcessing: boolean;
  uploadStatus: UploadStatus | null;
  onReset: () => void;
}

export const UploadDropzone: React.FC<UploadDropzoneProps> = ({
  rootProps,
  inputProps,
  isDragActive,
  uploading,
  clientProcessing,
  uploadStatus,
  onReset,
}) => {
  return (
    <div
      {...rootProps}
      className={`
        border-2 border-dashed rounded-xl p-6 text-center cursor-pointer transition-colors
        ${isDragActive ? 'border-amber-400 bg-amber-50/60' : 'border-slate-200 hover:border-slate-300 bg-slate-50/40'}
        ${uploading || uploadStatus === 'processing' ? 'opacity-50 cursor-not-allowed' : ''}
      `}
    >
      <input {...inputProps} />

      {clientProcessing ? (
        <div className="flex flex-col items-center gap-2">
          <Loader2 className="w-8 h-8 animate-spin text-blue-600" />
          <p className="text-sm text-slate-600">動画をフレーム化中...</p>
        </div>
      ) : uploading ? (
        <div className="flex flex-col items-center gap-2">
          <Loader2 className="w-8 h-8 animate-spin text-blue-600" />
          <p className="text-sm text-slate-600">アップロード中...</p>
        </div>
      ) : uploadStatus === 'processing' ? (
        <div className="flex flex-col items-center gap-2">
          <Loader2 className="w-8 h-8 animate-spin text-orange-600" />
          <p className="text-sm text-slate-600">熊を検出中...</p>
        </div>
      ) : uploadStatus === 'completed' ? (
        <div className="flex flex-col items-center gap-2">
          <CheckCircle className="w-8 h-8 text-green-600" />
          <p className="text-sm text-green-600">処理完了！</p>
          <button
            onClick={(event) => {
              event.stopPropagation();
              onReset();
            }}
            className="text-xs text-amber-700 hover:underline"
          >
            新しいファイルをアップロード
          </button>
        </div>
      ) : uploadStatus === 'failed' ? (
        <div className="flex flex-col items-center gap-2">
          <AlertCircle className="w-8 h-8 text-red-600" />
          <p className="text-sm text-red-600">処理に失敗しました</p>
          <button
            onClick={(event) => {
              event.stopPropagation();
              onReset();
            }}
            className="text-xs text-amber-700 hover:underline"
          >
            再試行
          </button>
        </div>
      ) : (
        <>
          <Upload className="w-8 h-8 mx-auto mb-2 text-slate-400" />
          <p className="text-sm text-slate-600">
            {isDragActive ? 'ドロップしてアップロード' : 'クリックまたはドラッグ＆ドロップ'}
          </p>
          <p className="text-xs text-slate-400 mt-1">動画はブラウザで画像化して送信します</p>
        </>
      )}
    </div>
  );
};
