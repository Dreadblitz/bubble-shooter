'use client';

import { useEffect, useState, useCallback } from 'react';
import { useCamera } from '@/hooks/useCamera';
import { useHandDetection } from '@/hooks/useHandDetection';
import { GrabDemo } from '@/game';
import Link from 'next/link';

const VIDEO_WIDTH = 640;
const VIDEO_HEIGHT = 480;

export default function GamePage() {
  const { videoRef, isActive: cameraActive, error: cameraError, start: startCamera, stop: stopCamera } = useCamera({
    width: VIDEO_WIDTH,
    height: VIDEO_HEIGHT,
  });

  const { isLoading, isReady, error: detectionError, handsRef, fps, detect } = useHandDetection();

  const [isRunning, setIsRunning] = useState(false);

  // Start/stop detection
  const handleToggle = useCallback(async () => {
    if (isRunning) {
      setIsRunning(false);
      stopCamera();
    } else {
      await startCamera();
      setIsRunning(true);
    }
  }, [isRunning, startCamera, stopCamera]);

  // Detection loop effect
  useEffect(() => {
    if (!isRunning || !cameraActive || !isReady) {
      return;
    }

    let frameId: number;

    const runDetectionLoop = () => {
      if (videoRef.current) {
        detect(videoRef.current);
      }
      frameId = requestAnimationFrame(runDetectionLoop);
    };

    frameId = requestAnimationFrame(runDetectionLoop);

    return () => {
      cancelAnimationFrame(frameId);
    };
  }, [isRunning, cameraActive, isReady, videoRef, detect]);

  const error = cameraError || detectionError;

  return (
    <div className="min-h-screen bg-gradient-to-br from-gray-900 via-purple-900/20 to-gray-900">
      {/* Header */}
      <header className="border-b border-purple-700/30 bg-gray-900/80 backdrop-blur-sm">
        <div className="container mx-auto px-4 py-3">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-4">
              <Link
                href="/"
                className="text-gray-400 hover:text-white transition-colors"
              >
                ← Back
              </Link>
              <div>
                <h1 className="text-xl font-bold text-transparent bg-clip-text bg-gradient-to-r from-orange-400 to-cyan-500">
                  GRAB & DROP
                </h1>
                <p className="text-xs text-gray-500">
                  Pinch near ball to grab • Release to drop
                </p>
              </div>
            </div>
            <div className="flex items-center gap-4">
              {isRunning && (
                <div className="flex items-center gap-2 text-sm">
                  <span className="text-gray-500">FPS:</span>
                  <span className={`font-mono ${fps >= 25 ? 'text-green-400' : fps >= 15 ? 'text-yellow-400' : 'text-red-400'}`}>
                    {fps}
                  </span>
                </div>
              )}
              <button
                onClick={handleToggle}
                disabled={isLoading}
                className={`px-4 py-2 rounded-lg font-medium text-sm transition-all ${
                  isRunning
                    ? 'bg-red-600 hover:bg-red-700 text-white'
                    : 'bg-gradient-to-r from-cyan-600 to-purple-600 hover:from-cyan-500 hover:to-purple-500 text-white'
                } disabled:opacity-50`}
              >
                {isLoading ? 'Loading...' : isRunning ? 'Stop' : 'Start Game'}
              </button>
            </div>
          </div>
        </div>
      </header>

      {/* Main Content */}
      <main className="container mx-auto px-4 py-6">
        {error && (
          <div className="mb-4 p-4 bg-red-900/50 border border-red-500 rounded-lg text-red-300">
            {error}
          </div>
        )}

        <div className="flex justify-center">
          {/* Hidden video element for camera capture */}
          <video
            ref={videoRef}
            className="hidden"
            playsInline
            muted
          />

          {/* Game Canvas */}
          <GrabDemo
            handsRef={handsRef}
            isRunning={isRunning && isReady}
            videoRef={videoRef}
          />
        </div>
      </main>
    </div>
  );
}
