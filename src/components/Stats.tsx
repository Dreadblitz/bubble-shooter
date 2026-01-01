'use client';

import type { DetectedHand } from '@/types/hand-detection';
import { LANDMARK_NAMES } from '@/types/hand-detection';

interface StatsProps {
  fps: number;
  hands: DetectedHand[];
  isRunning: boolean;
}

export function Stats({ fps, hands, isRunning }: StatsProps) {
  const getFpsColor = (fps: number) => {
    if (fps >= 25) return 'text-green-400';
    if (fps >= 15) return 'text-yellow-400';
    return 'text-red-400';
  };

  return (
    <div className="bg-gray-900/80 backdrop-blur-sm rounded-xl p-4 space-y-4">
      <h2 className="text-lg font-semibold text-white border-b border-gray-700 pb-2">
        Statistics
      </h2>

      {/* FPS Counter */}
      <div className="flex items-center justify-between">
        <span className="text-gray-400">FPS</span>
        <span className={`text-2xl font-mono font-bold ${getFpsColor(fps)}`}>
          {isRunning ? fps : '--'}
        </span>
      </div>

      {/* Hands Detected */}
      <div className="flex items-center justify-between">
        <span className="text-gray-400">Hands Detected</span>
        <span className="text-2xl font-mono font-bold text-white">
          {isRunning ? hands.length : '--'}
        </span>
      </div>

      {/* Status */}
      <div className="flex items-center justify-between">
        <span className="text-gray-400">Status</span>
        <span
          className={`px-2 py-1 rounded text-sm font-medium ${
            isRunning
              ? 'bg-green-600/20 text-green-400'
              : 'bg-gray-600/20 text-gray-400'
          }`}
        >
          {isRunning ? 'Running' : 'Stopped'}
        </span>
      </div>

      {/* Hand Details */}
      {isRunning && hands.length > 0 && (
        <div className="border-t border-gray-700 pt-3 space-y-3">
          <h3 className="text-sm font-medium text-gray-400">Hand Details</h3>
          {hands.map((hand, index) => (
            <div
              key={index}
              className="bg-gray-800/50 rounded-lg p-3 space-y-2"
            >
              <div className="flex items-center justify-between">
                <span
                  className={`font-medium ${
                    hand.handedness === 'Left' ? 'text-[#4ECDC4]' : 'text-[#FF6B6B]'
                  }`}
                >
                  {hand.handedness} Hand
                </span>
                <span className="text-gray-400 text-sm">
                  {Math.round(hand.score * 100)}% confidence
                </span>
              </div>

              {/* Key landmarks */}
              <div className="text-xs text-gray-500 space-y-1">
                <div className="flex justify-between">
                  <span>{LANDMARK_NAMES[8]}:</span>
                  <span className="font-mono">
                    ({(hand.landmarks[8].x * 100).toFixed(0)}%,{' '}
                    {(hand.landmarks[8].y * 100).toFixed(0)}%)
                  </span>
                </div>
                <div className="flex justify-between">
                  <span>{LANDMARK_NAMES[4]}:</span>
                  <span className="font-mono">
                    ({(hand.landmarks[4].x * 100).toFixed(0)}%,{' '}
                    {(hand.landmarks[4].y * 100).toFixed(0)}%)
                  </span>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Empty state */}
      {isRunning && hands.length === 0 && (
        <div className="text-center py-4 text-gray-500 text-sm">
          No hands detected. Show your hands to the camera.
        </div>
      )}
    </div>
  );
}
