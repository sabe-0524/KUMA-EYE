import JSZip from 'jszip';

const waitForEvent = (target: EventTarget, event: string): Promise<void> => {
  return new Promise((resolve, reject) => {
    const onSuccess = () => {
      cleanup();
      resolve();
    };
    const onError = () => {
      cleanup();
      reject(new Error(`Failed to load video for ${event}`));
    };
    const cleanup = () => {
      target.removeEventListener(event, onSuccess);
      target.removeEventListener('error', onError);
    };

    target.addEventListener(event, onSuccess, { once: true });
    target.addEventListener('error', onError, { once: true });
  });
};

export const createFramesZipFromVideo = async (file: File, intervalSeconds: number): Promise<File> => {
  const zip = new JSZip();
  const video = document.createElement('video');
  video.preload = 'metadata';
  video.muted = true;
  video.playsInline = true;

  const objectUrl = URL.createObjectURL(file);
  video.src = objectUrl;

  try {
    await waitForEvent(video, 'loadedmetadata');
    await waitForEvent(video, 'loadeddata');

    const duration = Number.isFinite(video.duration) ? video.duration : 0;
    const width = video.videoWidth || 1280;
    const height = video.videoHeight || 720;
    const canvas = document.createElement('canvas');
    canvas.width = width;
    canvas.height = height;
    const context = canvas.getContext('2d');

    if (!context) {
      throw new Error('Canvas not supported');
    }

    const interval = Math.max(1, intervalSeconds || 5);
    const times: number[] = [];
    if (duration > 0) {
      for (let t = 0; t < duration; t += interval) {
        times.push(t);
      }
    }
    if (times.length === 0) {
      times.push(0);
    }

    let index = 0;
    let hasSeeked = false;
    for (const time of times) {
      const targetTime = Math.min(time, duration || 0);
      if (!hasSeeked || Math.abs(video.currentTime - targetTime) > 0.01) {
        video.currentTime = targetTime;
        await waitForEvent(video, 'seeked');
        hasSeeked = true;
      }

      context.drawImage(video, 0, 0, canvas.width, canvas.height);
      const blob = await new Promise<Blob>((resolve, reject) => {
        canvas.toBlob(
          (result) => {
            if (!result) {
              reject(new Error('Failed to encode frame'));
              return;
            }
            resolve(result);
          },
          'image/jpeg',
          0.9
        );
      });
      zip.file(`frame_${String(index).padStart(6, '0')}.jpg`, blob);
      index += 1;
    }

    const zipBlob = await zip.generateAsync({ type: 'blob' });
    return new File([zipBlob], `${file.name.replace(/\.[^/.]+$/, '')}_frames.zip`, {
      type: 'application/zip',
    });
  } finally {
    URL.revokeObjectURL(objectUrl);
  }
};
