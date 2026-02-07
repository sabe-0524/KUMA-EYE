'use client';

import React from 'react';
import { AlertCircle, Upload, X } from 'lucide-react';
import { useDropzone } from 'react-dropzone';
import { useUploadWorkflow } from '@/features/upload-footage/model/useUploadWorkflow';
import { UploadDropzone } from '@/features/upload-footage/ui/UploadDropzone';
import { UploadLocationSelector } from '@/features/upload-footage/ui/UploadLocationSelector';

interface UploadPanelProps {
  onUploadComplete?: () => void;
}

export const UploadPanel: React.FC<UploadPanelProps> = ({ onUploadComplete }) => {
  const {
    cameras,
    selectedCameraId,
    manualLocation,
    useManualLocation,
    frameInterval,
    uploading,
    clientProcessing,
    uploadStatus,
    error,
    setSelectedCameraId,
    setManualLocation,
    setUseManualLocation,
    setFrameInterval,
    setError,
    handleDrop,
    resetUpload,
  } = useUploadWorkflow(onUploadComplete);

  const { getRootProps, getInputProps, isDragActive } = useDropzone({
    onDrop: (acceptedFiles) => {
      void handleDrop(acceptedFiles);
    },
    accept: {
      'video/*': ['.mp4', '.mov', '.avi'],
      'image/*': ['.jpg', '.jpeg', '.png'],
    },
    maxFiles: 1,
    disabled: uploading || clientProcessing || uploadStatus === 'processing',
  });

  return (
    <div className="bg-white/95 backdrop-blur rounded-xl border border-slate-200/70 shadow-sm p-4">
      <h2 className="text-lg font-semibold text-slate-900 mb-4 flex items-center gap-2">
        <Upload className="w-5 h-5" />
        映像アップロード
      </h2>

      <UploadLocationSelector
        cameras={cameras}
        selectedCameraId={selectedCameraId}
        useManualLocation={useManualLocation}
        manualLocation={manualLocation}
        onSelectedCameraIdChange={setSelectedCameraId}
        onUseManualLocationChange={setUseManualLocation}
        onManualLocationChange={setManualLocation}
      />

      <div className="mb-4">
        <label className="block text-sm font-medium text-slate-700 mb-1">フレーム抽出間隔（秒）</label>
        <input
          type="number"
          min="1"
          max="60"
          value={frameInterval}
          onChange={(event) => setFrameInterval(parseInt(event.target.value, 10) || 5)}
          className="w-24 px-3 py-2 border border-slate-200 rounded-md text-sm bg-slate-50/60 focus:ring-2 focus:ring-amber-400 focus:border-amber-400"
        />
      </div>

      <UploadDropzone
        rootProps={getRootProps()}
        inputProps={getInputProps()}
        isDragActive={isDragActive}
        uploading={uploading}
        clientProcessing={clientProcessing}
        uploadStatus={uploadStatus}
        onReset={resetUpload}
      />

      {error && (
        <div className="mt-3 p-3 bg-red-500/10 text-red-700 rounded-md text-sm border border-red-200/80 flex items-center gap-2">
          <AlertCircle className="w-4 h-4 flex-shrink-0" />
          <span>{error}</span>
          <button onClick={() => setError(null)} className="ml-auto">
            <X className="w-4 h-4" />
          </button>
        </div>
      )}
    </div>
  );
};

export default UploadPanel;
