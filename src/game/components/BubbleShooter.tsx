'use client';

import { useRef, useEffect, useCallback, useMemo, RefObject } from 'react';
import type { DetectedHand } from '@/types/hand-detection';
import type { GameConfig } from '../types';
import { DEFAULT_CONFIG } from '../types';
import { useGameEngine } from '../hooks/useGameEngine';
import { usePinchGesture } from '../hooks/usePinchGesture';
import { renderGame } from '../engine/renderer';

interface BubbleShooterProps {
  handsRef: RefObject<DetectedHand[]>;
  isRunning: boolean;
  config?: Partial<GameConfig>;
  videoRef?: RefObject<HTMLVideoElement | null>;
}

export function BubbleShooter({
  handsRef,
  isRunning,
  config: customConfig,
  videoRef,
}: BubbleShooterProps) {
  const config: GameConfig = useMemo(
    () => ({ ...DEFAULT_CONFIG, ...customConfig }),
    [customConfig]
  );

  const canvasRef = useRef<HTMLCanvasElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);

  const { gameState, trajectoryPoints, updateGame, resetGame } = useGameEngine(config);
  const { pinchState, pinchStateRef, updatePinch, resetPinch } = usePinchGesture(config);

  // Store latest values in refs for the render loop
  const gameStateRef = useRef(gameState);
  const trajectoryPointsRef = useRef(trajectoryPoints);

  useEffect(() => { gameStateRef.current = gameState; }, [gameState]);
  useEffect(() => { trajectoryPointsRef.current = trajectoryPoints; }, [trajectoryPoints]);

  // DEBUG: Log pinchState changes
  useEffect(() => {
    if (pinchState.isPinching) {
      console.log('[DEBUG] Pinch detected!', {
        isPinching: pinchState.isPinching,
        startPosition: pinchState.startPosition,
        currentPosition: pinchState.currentPosition,
        pullVector: pinchState.pullVector,
      });
    }
  }, [pinchState]);

  // Game loop: update pinch AND game state every frame
  useEffect(() => {
    if (!isRunning || !containerRef.current) return;

    let animationId: number;
    const container = containerRef.current;
    let frameCount = 0;

    const gameLoop = () => {
      const rect = container.getBoundingClientRect();
      const currentHands = handsRef.current ?? [];
      const video = videoRef?.current;

      // Get actual video dimensions
      const videoDimensions = video && video.videoWidth > 0
        ? { width: video.videoWidth, height: video.videoHeight }
        : undefined;

      // Log every 60 frames (about once per second)
      if (frameCount % 60 === 0 && currentHands.length > 0) {
        console.log('[DEBUG] Hands:', currentHands.length, 'Rect:', rect.width, rect.height, 'Video:', videoDimensions);
      }
      frameCount++;

      // Update pinch state from hand tracking - returns new state synchronously
      const currentPinchState = updatePinch(currentHands, rect, videoDimensions);

      // Update game state every frame with the CURRENT pinch state (no delay!)
      updateGame(currentPinchState);

      animationId = requestAnimationFrame(gameLoop);
    };

    animationId = requestAnimationFrame(gameLoop);

    return () => cancelAnimationFrame(animationId);
  }, [isRunning, updatePinch, updateGame, handsRef]);

  // Render game loop (decoupled from React state updates)
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas || !isRunning) return;

    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    let animationId: number;

    const renderLoop = () => {
      const video = videoRef?.current || null;
      const currentHands = handsRef.current ?? [];
      renderGame(ctx, gameStateRef.current, config, trajectoryPointsRef.current, video, currentHands);
      animationId = requestAnimationFrame(renderLoop);
    };

    animationId = requestAnimationFrame(renderLoop);

    return () => cancelAnimationFrame(animationId);
  }, [isRunning, config, videoRef, handsRef]);

  // Handle restart on click
  const handleClick = useCallback(() => {
    if (gameState.phase === 'GAME_OVER') {
      resetGame();
      resetPinch();
    }
  }, [gameState.phase, resetGame, resetPinch]);

  // Reset game when starting
  useEffect(() => {
    if (isRunning) {
      resetGame();
      resetPinch();
    }
  }, [isRunning, resetGame, resetPinch]);

  return (
    <div
      ref={containerRef}
      className="relative"
      style={{ width: config.canvasWidth, height: config.canvasHeight }}
      onClick={handleClick}
    >
      <canvas
        ref={canvasRef}
        width={config.canvasWidth}
        height={config.canvasHeight}
        className="rounded-xl shadow-2xl"
        style={{
          boxShadow: '0 0 40px rgba(100, 0, 150, 0.3), 0 0 80px rgba(0, 200, 255, 0.1)',
        }}
      />

      {/* Pinch indicator overlay */}
      {isRunning && pinchState.isPinching && pinchState.currentPosition && (
        <div
          className="absolute pointer-events-none"
          style={{
            left: pinchState.currentPosition.x - 15,
            top: pinchState.currentPosition.y - 15,
            width: 30,
            height: 30,
            borderRadius: '50%',
            border: '2px solid rgba(255, 255, 255, 0.8)',
            boxShadow: '0 0 10px rgba(255, 255, 255, 0.5)',
          }}
        />
      )}

      {/* Not running overlay */}
      {!isRunning && (
        <div className="absolute inset-0 flex items-center justify-center bg-black/80 rounded-xl">
          <div className="text-center">
            <h2 className="text-2xl font-bold text-cyan-400 mb-2">BUBBLE SHOOTER</h2>
            <p className="text-gray-400">Start detection to play</p>
          </div>
        </div>
      )}
    </div>
  );
}
