'use client';

import { useRef, useState, useCallback, useEffect } from 'react';
import {
  FilesetResolver,
  HandLandmarker,
  type HandLandmarkerResult,
} from '@mediapipe/tasks-vision';
import type { DetectedHand, DetectionConfig } from '@/types/hand-detection';

interface UseHandDetectionReturn {
  isLoading: boolean;
  isReady: boolean;
  error: string | null;
  hands: DetectedHand[];
  handsRef: React.RefObject<DetectedHand[]>;
  fps: number;
  detect: (video: HTMLVideoElement) => void;
  updateConfig: (config: Partial<DetectionConfig>) => void;
}

const DEFAULT_CONFIG: DetectionConfig = {
  maxHands: 2,
  minDetectionConfidence: 0.5,
  minTrackingConfidence: 0.5,
};

export function useHandDetection(
  initialConfig: Partial<DetectionConfig> = {}
): UseHandDetectionReturn {
  const handLandmarkerRef = useRef<HandLandmarker | null>(null);
  const configRef = useRef<DetectionConfig>({ ...DEFAULT_CONFIG, ...initialConfig });
  const lastTimestampRef = useRef<number>(0);
  const fpsCounterRef = useRef<number[]>([]);
  const lastFpsUpdateRef = useRef<number>(0);
  const handsRef = useRef<DetectedHand[]>([]);

  const [isLoading, setIsLoading] = useState(true);
  const [isReady, setIsReady] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [hands, setHands] = useState<DetectedHand[]>([]);
  const [fps, setFps] = useState(0);

  // Initialize MediaPipe HandLandmarker
  useEffect(() => {
    let mounted = true;

    async function initializeHandLandmarker() {
      try {
        const vision = await FilesetResolver.forVisionTasks(
          'https://cdn.jsdelivr.net/npm/@mediapipe/tasks-vision@latest/wasm'
        );

        const handLandmarker = await HandLandmarker.createFromOptions(vision, {
          baseOptions: {
            modelAssetPath:
              'https://storage.googleapis.com/mediapipe-models/hand_landmarker/hand_landmarker/float16/1/hand_landmarker.task',
            delegate: 'GPU',
          },
          runningMode: 'VIDEO',
          numHands: configRef.current.maxHands,
          minHandDetectionConfidence: configRef.current.minDetectionConfidence,
          minTrackingConfidence: configRef.current.minTrackingConfidence,
        });

        if (mounted) {
          handLandmarkerRef.current = handLandmarker;
          setIsLoading(false);
          setIsReady(true);
        }
      } catch (err) {
        if (mounted) {
          const message = err instanceof Error ? err.message : 'Failed to load MediaPipe';
          setError(message);
          setIsLoading(false);
        }
      }
    }

    initializeHandLandmarker();

    return () => {
      mounted = false;
      if (handLandmarkerRef.current) {
        handLandmarkerRef.current.close();
      }
    };
  }, []);

  const detect = useCallback((video: HTMLVideoElement) => {
    if (!handLandmarkerRef.current || !video.videoWidth) return;

    const timestamp = performance.now();

    // Avoid processing same frame
    if (timestamp <= lastTimestampRef.current) return;

    try {
      const result: HandLandmarkerResult = handLandmarkerRef.current.detectForVideo(
        video,
        timestamp
      );

      // Calculate FPS (throttle state updates to once per second)
      fpsCounterRef.current.push(timestamp);
      const oneSecondAgo = timestamp - 1000;
      fpsCounterRef.current = fpsCounterRef.current.filter((t) => t > oneSecondAgo);

      if (timestamp - lastFpsUpdateRef.current >= 500) {
        setFps(fpsCounterRef.current.length);
        lastFpsUpdateRef.current = timestamp;
      }

      // Transform results
      const detectedHands: DetectedHand[] = result.landmarks.map((landmarks, index) => ({
        landmarks: landmarks.map((lm) => ({ x: lm.x, y: lm.y, z: lm.z })),
        worldLandmarks: result.worldLandmarks[index]?.map((lm) => ({
          x: lm.x,
          y: lm.y,
          z: lm.z,
        })) || [],
        handedness:
          (result.handednesses[index]?.[0]?.categoryName as 'Left' | 'Right') || 'Right',
        score: result.handednesses[index]?.[0]?.score || 0,
      }));

      // Update ref immediately (no re-render)
      handsRef.current = detectedHands;
      lastTimestampRef.current = timestamp;
    } catch {
      // Silently handle detection errors (common during video transitions)
    }
  }, []);

  const updateConfig = useCallback((newConfig: Partial<DetectionConfig>) => {
    configRef.current = { ...configRef.current, ...newConfig };

    // Note: HandLandmarker doesn't support runtime config changes
    // Would need to recreate the instance for changes to take effect
  }, []);

  // Sync handsRef to state periodically (for components that need reactive updates)
  useEffect(() => {
    const interval = setInterval(() => {
      setHands(handsRef.current);
    }, 100); // 10fps for state sync is enough for UI

    return () => clearInterval(interval);
  }, []);

  return {
    isLoading,
    isReady,
    error,
    hands,
    handsRef,
    fps,
    detect,
    updateConfig,
  };
}
