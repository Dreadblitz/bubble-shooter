'use client';

import { useRef, useState, useCallback, useEffect } from 'react';
import type { CameraConfig } from '@/types/hand-detection';

interface UseCameraReturn {
  videoRef: React.RefObject<HTMLVideoElement | null>;
  stream: MediaStream | null;
  isActive: boolean;
  error: string | null;
  start: () => Promise<void>;
  stop: () => void;
}

const DEFAULT_CONFIG: CameraConfig = {
  width: 1280,
  height: 720,
  facingMode: 'user',
};

export function useCamera(config: Partial<CameraConfig> = {}): UseCameraReturn {
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const [stream, setStream] = useState<MediaStream | null>(null);
  const [isActive, setIsActive] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const finalConfig = { ...DEFAULT_CONFIG, ...config };

  const start = useCallback(async () => {
    setError(null);

    try {
      const mediaStream = await navigator.mediaDevices.getUserMedia({
        video: {
          width: { ideal: finalConfig.width },
          height: { ideal: finalConfig.height },
          facingMode: finalConfig.facingMode,
        },
        audio: false,
      });

      if (videoRef.current) {
        videoRef.current.srcObject = mediaStream;
        await videoRef.current.play();
      }

      setStream(mediaStream);
      setIsActive(true);
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Failed to access camera';
      setError(message);
      setIsActive(false);
    }
  }, [finalConfig.width, finalConfig.height, finalConfig.facingMode]);

  const stop = useCallback(() => {
    if (stream) {
      stream.getTracks().forEach((track) => track.stop());
      setStream(null);
    }

    if (videoRef.current) {
      videoRef.current.srcObject = null;
    }

    setIsActive(false);
  }, [stream]);

  useEffect(() => {
    return () => {
      if (stream) {
        stream.getTracks().forEach((track) => track.stop());
      }
    };
  }, [stream]);

  return {
    videoRef,
    stream,
    isActive,
    error,
    start,
    stop,
  };
}
