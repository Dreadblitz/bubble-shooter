'use client';

import { useRef, useEffect, useCallback } from 'react';
import type { DetectedHand } from '@/types/hand-detection';
import { HAND_CONNECTIONS } from '@/types/hand-detection';

interface HandCanvasProps {
  hands: DetectedHand[];
  width: number;
  height: number;
  showConnections?: boolean;
  showLandmarks?: boolean;
  landmarkColor?: string;
  connectionColor?: string;
}

export function HandCanvas({
  hands,
  width,
  height,
  showConnections = true,
  showLandmarks = true,
  landmarkColor = '#00FF00',
  connectionColor = '#FFFFFF',
}: HandCanvasProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);

  const draw = useCallback(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    // Clear canvas
    ctx.clearRect(0, 0, width, height);

    hands.forEach((hand) => {
      const { landmarks } = hand;

      // Draw connections
      if (showConnections) {
        ctx.strokeStyle = connectionColor;
        ctx.lineWidth = 3;

        HAND_CONNECTIONS.forEach(([start, end]) => {
          const startLandmark = landmarks[start];
          const endLandmark = landmarks[end];

          if (startLandmark && endLandmark) {
            ctx.beginPath();
            ctx.moveTo(startLandmark.x * width, startLandmark.y * height);
            ctx.lineTo(endLandmark.x * width, endLandmark.y * height);
            ctx.stroke();
          }
        });
      }

      // Draw landmarks
      if (showLandmarks) {
        landmarks.forEach((landmark, index) => {
          const x = landmark.x * width;
          const y = landmark.y * height;

          // Fingertips are larger
          const isFingertip = [4, 8, 12, 16, 20].includes(index);
          const radius = isFingertip ? 8 : 5;

          // Color based on finger
          let color = landmarkColor;
          if (index >= 1 && index <= 4) color = '#FF6B6B'; // Thumb - red
          if (index >= 5 && index <= 8) color = '#4ECDC4'; // Index - teal
          if (index >= 9 && index <= 12) color = '#45B7D1'; // Middle - blue
          if (index >= 13 && index <= 16) color = '#96CEB4'; // Ring - green
          if (index >= 17 && index <= 20) color = '#FFEAA7'; // Pinky - yellow

          ctx.beginPath();
          ctx.arc(x, y, radius, 0, 2 * Math.PI);
          ctx.fillStyle = color;
          ctx.fill();

          // White border for visibility
          ctx.strokeStyle = '#FFFFFF';
          ctx.lineWidth = 2;
          ctx.stroke();
        });
      }

      // Draw handedness label
      if (landmarks[0]) {
        const wrist = landmarks[0];
        ctx.font = 'bold 16px Inter, sans-serif';
        ctx.fillStyle = hand.handedness === 'Left' ? '#4ECDC4' : '#FF6B6B';
        ctx.strokeStyle = '#000000';
        ctx.lineWidth = 3;
        const label = `${hand.handedness} (${Math.round(hand.score * 100)}%)`;
        const x = wrist.x * width;
        const y = wrist.y * height + 30;
        ctx.strokeText(label, x - 40, y);
        ctx.fillText(label, x - 40, y);
      }
    });
  }, [hands, width, height, showConnections, showLandmarks, landmarkColor, connectionColor]);

  useEffect(() => {
    draw();
  }, [draw]);

  return (
    <canvas
      ref={canvasRef}
      width={width}
      height={height}
      className="absolute top-0 left-0 pointer-events-none"
    />
  );
}
