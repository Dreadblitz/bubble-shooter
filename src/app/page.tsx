'use client';

import { useEffect, useRef, useState, useCallback } from 'react';
import { useCamera } from '@/hooks/useCamera';
import { useHandDetection } from '@/hooks/useHandDetection';
import { HandCanvas } from '@/components/HandCanvas';
import { Controls } from '@/components/Controls';
import { Stats } from '@/components/Stats';

const VIDEO_WIDTH = 1280;
const VIDEO_HEIGHT = 720;

export default function Home() {
  const { videoRef, isActive: cameraActive, error: cameraError, start: startCamera, stop: stopCamera } = useCamera({
    width: VIDEO_WIDTH,
    height: VIDEO_HEIGHT,
  });

  const { isLoading, isReady, error: detectionError, hands, fps, detect } = useHandDetection();

  const [isRunning, setIsRunning] = useState(false);
  const [showConnections, setShowConnections] = useState(true);
  const [showLandmarks, setShowLandmarks] = useState(true);
  const [videoDimensions, setVideoDimensions] = useState({ width: VIDEO_WIDTH, height: VIDEO_HEIGHT });

  const animationFrameRef = useRef<number | null>(null);
  const containerRef = useRef<HTMLDivElement>(null);

  // Start/stop detection
  const handleToggle = useCallback(async () => {
    if (isRunning) {
      setIsRunning(false);
      if (animationFrameRef.current) {
        cancelAnimationFrame(animationFrameRef.current);
      }
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

  // Update video dimensions on resize
  useEffect(() => {
    const updateDimensions = () => {
      if (containerRef.current) {
        const containerWidth = containerRef.current.clientWidth;
        const aspectRatio = VIDEO_HEIGHT / VIDEO_WIDTH;
        const newHeight = containerWidth * aspectRatio;
        setVideoDimensions({ width: containerWidth, height: newHeight });
      }
    };

    updateDimensions();
    window.addEventListener('resize', updateDimensions);
    return () => window.removeEventListener('resize', updateDimensions);
  }, []);

  const error = cameraError || detectionError;

  return (
    <div className="min-h-screen bg-gradient-to-br from-gray-900 via-gray-800 to-gray-900">
      {/* Header */}
      <header className="border-b border-gray-700/50 bg-gray-900/50 backdrop-blur-sm">
        <div className="container mx-auto px-4 py-4">
          <div className="flex items-center justify-between">
            <div>
              <h1 className="text-2xl font-bold text-white">
                MediaPipe Hand Detection
              </h1>
              <p className="text-sm text-gray-400">
                Real-time hand tracking with 21 landmarks per hand
              </p>
            </div>
            <div className="flex items-center gap-4">
              <a
                href="/game"
                className="px-4 py-2 rounded-lg bg-gradient-to-r from-cyan-600 to-purple-600 hover:from-cyan-500 hover:to-purple-500 text-white text-sm font-medium transition-all"
              >
                Play Bubble Shooter
              </a>
              <a
                href="https://ai.google.dev/edge/mediapipe/solutions/vision/hand_landmarker"
                target="_blank"
                rel="noopener noreferrer"
                className="text-sm text-blue-400 hover:text-blue-300 transition-colors"
              >
                MediaPipe Docs
              </a>
            </div>
          </div>
        </div>
      </header>

      {/* Main Content */}
      <main className="container mx-auto px-4 py-6">
        <div className="grid grid-cols-1 lg:grid-cols-4 gap-6">
          {/* Video Panel */}
          <div className="lg:col-span-3">
            <div
              ref={containerRef}
              className="relative bg-gray-800 rounded-xl overflow-hidden shadow-2xl"
              style={{ aspectRatio: `${VIDEO_WIDTH}/${VIDEO_HEIGHT}` }}
            >
              {/* Video Element */}
              <video
                ref={videoRef}
                className="absolute top-0 left-0 w-full h-full object-cover scale-x-[-1]"
                playsInline
                muted
              />

              {/* Canvas Overlay */}
              <div className="absolute top-0 left-0 w-full h-full scale-x-[-1]">
                <HandCanvas
                  hands={hands}
                  width={videoDimensions.width}
                  height={videoDimensions.height}
                  showConnections={showConnections}
                  showLandmarks={showLandmarks}
                />
              </div>

              {/* Error Overlay */}
              {error && (
                <div className="absolute inset-0 flex items-center justify-center bg-black/80">
                  <div className="text-center p-6">
                    <svg
                      className="w-16 h-16 mx-auto text-red-500 mb-4"
                      fill="none"
                      viewBox="0 0 24 24"
                      stroke="currentColor"
                    >
                      <path
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        strokeWidth={2}
                        d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z"
                      />
                    </svg>
                    <p className="text-red-400 font-medium">{error}</p>
                    <p className="text-gray-500 text-sm mt-2">
                      Please check camera permissions and try again.
                    </p>
                  </div>
                </div>
              )}

              {/* Idle State Overlay */}
              {!isRunning && !error && (
                <div className="absolute inset-0 flex items-center justify-center bg-gray-900/90">
                  <div className="text-center p-6">
                    <svg
                      className="w-24 h-24 mx-auto text-gray-600 mb-4"
                      fill="none"
                      viewBox="0 0 24 24"
                      stroke="currentColor"
                    >
                      <path
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        strokeWidth={1.5}
                        d="M15 10l4.553-2.276A1 1 0 0121 8.618v6.764a1 1 0 01-1.447.894L15 14M5 18h8a2 2 0 002-2V8a2 2 0 00-2-2H5a2 2 0 00-2 2v8a2 2 0 002 2z"
                      />
                    </svg>
                    <p className="text-gray-400 text-lg font-medium">
                      {isLoading ? 'Loading MediaPipe...' : 'Camera inactive'}
                    </p>
                    <p className="text-gray-600 text-sm mt-2">
                      Click &quot;Start Detection&quot; to begin
                    </p>
                  </div>
                </div>
              )}

              {/* Loading Overlay */}
              {isRunning && isLoading && (
                <div className="absolute inset-0 flex items-center justify-center bg-black/60">
                  <div className="flex items-center gap-3 text-white">
                    <svg className="animate-spin h-8 w-8" viewBox="0 0 24 24">
                      <circle
                        className="opacity-25"
                        cx="12"
                        cy="12"
                        r="10"
                        stroke="currentColor"
                        strokeWidth="4"
                        fill="none"
                      />
                      <path
                        className="opacity-75"
                        fill="currentColor"
                        d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z"
                      />
                    </svg>
                    <span>Loading MediaPipe model...</span>
                  </div>
                </div>
              )}
            </div>
          </div>

          {/* Sidebar */}
          <div className="lg:col-span-1 space-y-4">
            <Controls
              isRunning={isRunning}
              onToggle={handleToggle}
              showConnections={showConnections}
              onShowConnectionsChange={setShowConnections}
              showLandmarks={showLandmarks}
              onShowLandmarksChange={setShowLandmarks}
              isLoading={isLoading}
              disabled={!!error}
            />

            <Stats fps={fps} hands={hands} isRunning={isRunning} />
          </div>
        </div>
      </main>

      {/* Footer */}
      <footer className="border-t border-gray-700/50 mt-8">
        <div className="container mx-auto px-4 py-4">
          <p className="text-center text-gray-500 text-sm">
            Built with Next.js, MediaPipe, and Tailwind CSS
          </p>
        </div>
      </footer>
    </div>
  );
}
