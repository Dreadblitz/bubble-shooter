'use client';

import { useCallback, useRef, useState, useEffect } from 'react';
import type { GameState, GameConfig, Projectile, Vector2D, PinchState } from '../types';
import { DEFAULT_CONFIG } from '../types';
import {
  createInitialGrid,
  addBubbleToGrid,
  findMatches,
  removeMatches,
  findFloatingBubbles,
  addNewRow,
  checkGameOver,
  calculateDangerLevel,
  getRandomColor,
} from '../engine/grid';
import {
  updateProjectile,
  calculateLaunchVelocity,
  predictTrajectory,
} from '../engine/physics';

interface UseGameEngineReturn {
  gameState: GameState;
  trajectoryPoints: Vector2D[];
  updateGame: (pinchState: PinchState) => void;
  resetGame: () => void;
}

function getInitialState(config: GameConfig): GameState {
  return {
    phase: 'IDLE',
    score: 0,
    bubbles: createInitialGrid(5, config),
    projectile: null,
    nextBubbleColor: getRandomColor(),
    pinchState: {
      isPinching: false,
      startPosition: null,
      currentPosition: null,
      pullVector: null,
    },
    dangerLevel: 0,
    rowsAdded: 0,
  };
}

export function useGameEngine(config: GameConfig = DEFAULT_CONFIG): UseGameEngineReturn {
  const [gameState, setGameState] = useState<GameState>(() => getInitialState(config));
  const [trajectoryPoints, setTrajectoryPoints] = useState<Vector2D[]>([]);

  const lastNewRowTimeRef = useRef<number>(0);
  const wasAimingRef = useRef(false);
  const initializedRef = useRef(false);

  // Initialize time ref on mount
  useEffect(() => {
    if (!initializedRef.current) {
      lastNewRowTimeRef.current = Date.now();
      initializedRef.current = true;
    }
  }, []);

  const resetGame = useCallback(() => {
    setGameState(getInitialState(config));
    setTrajectoryPoints([]);
    lastNewRowTimeRef.current = Date.now();
    wasAimingRef.current = false;
  }, [config]);

  const updateGame = useCallback(
    (pinchState: PinchState) => {
      setGameState((prev) => {
        if (prev.phase === 'GAME_OVER') {
          return prev;
        }

        // DEBUG: Log pinch state when isPinching
        if (pinchState.isPinching && pinchState.startPosition) {
          const isInLauncherZone = pinchState.startPosition.y > config.canvasHeight * 0.5;
          console.log('[DEBUG] updateGame called with isPinching=true', {
            startY: pinchState.startPosition.y,
            launcherZone: config.canvasHeight * 0.5,
            isInLauncherZone,
            currentPhase: prev.phase,
          });
        }

        let newState = { ...prev, pinchState };

        // Handle projectile movement
        if (prev.phase === 'SHOOTING' && prev.projectile) {
          const result = updateProjectile(prev.projectile, config, prev.bubbles);

          if (result.collision) {
            // Projectile hit something - add to grid
            let newBubbles = addBubbleToGrid(
              prev.bubbles,
              result.collision.row,
              result.collision.col,
              prev.projectile.color,
              config
            );

            // Check for matches
            const matches = findMatches(
              newBubbles,
              result.collision.row,
              result.collision.col,
              prev.projectile.color
            );

            let scoreGain = 0;

            if (matches.length >= 3) {
              newBubbles = removeMatches(newBubbles, matches);
              scoreGain += matches.length * 10;

              // Find and remove floating bubbles
              const floating = findFloatingBubbles(newBubbles);
              if (floating.length > 0) {
                newBubbles = removeMatches(newBubbles, floating);
                scoreGain += floating.length * 20; // Bonus for floating bubbles
              }
            }

            // Check game over
            const isGameOver = checkGameOver(newBubbles, config);

            newState = {
              ...newState,
              phase: isGameOver ? 'GAME_OVER' : 'IDLE',
              bubbles: newBubbles,
              projectile: null,
              score: prev.score + scoreGain,
              nextBubbleColor: getRandomColor(),
              dangerLevel: calculateDangerLevel(newBubbles, config),
            };
          } else {
            newState = {
              ...newState,
              projectile: result.projectile,
            };
          }

          return newState;
        }

        // Handle aiming state
        const launcherX = config.canvasWidth / 2;
        const launcherY = config.launcherY;

        if (pinchState.isPinching && pinchState.startPosition) {
          // Any pinch in the lower half of screen starts aiming
          const isInLauncherZone = pinchState.startPosition.y > config.canvasHeight * 0.5;

          if (isInLauncherZone || prev.phase === 'AIMING') {
            newState = {
              ...newState,
              phase: 'AIMING',
            };
            wasAimingRef.current = true;
          }
        } else if (!pinchState.isPinching && wasAimingRef.current) {
          // Released while aiming - launch!
          wasAimingRef.current = false;

          if (prev.pinchState.pullVector) {
            const velocity = calculateLaunchVelocity(prev.pinchState.pullVector, config);

            if (velocity.x !== 0 || velocity.y !== 0) {
              const projectile: Projectile = {
                position: { x: launcherX, y: launcherY },
                velocity,
                color: prev.nextBubbleColor,
                radius: config.bubbleRadius,
              };

              newState = {
                ...newState,
                phase: 'SHOOTING',
                projectile,
              };
            } else {
              newState = {
                ...newState,
                phase: 'IDLE',
              };
            }
          } else {
            newState = {
              ...newState,
              phase: 'IDLE',
            };
          }

          setTrajectoryPoints([]);
        }

        // Calculate trajectory preview while aiming
        if (newState.phase === 'AIMING' && pinchState.pullVector) {
          const velocity = calculateLaunchVelocity(pinchState.pullVector, config);
          if (velocity.x !== 0 || velocity.y !== 0) {
            const points = predictTrajectory(
              { x: launcherX, y: launcherY },
              velocity,
              config,
              60
            );
            setTrajectoryPoints(points);
          }
        }

        return newState;
      });
    },
    [config]
  );

  // Add new row periodically
  useEffect(() => {
    if (gameState.phase === 'GAME_OVER') return;

    const interval = setInterval(() => {
      const now = Date.now();
      if (now - lastNewRowTimeRef.current >= config.newRowIntervalMs) {
        lastNewRowTimeRef.current = now;

        setGameState((prev) => {
          if (prev.phase === 'GAME_OVER') return prev;

          const newBubbles = addNewRow(prev.bubbles, config);
          const isGameOver = checkGameOver(newBubbles, config);

          return {
            ...prev,
            phase: isGameOver ? 'GAME_OVER' : prev.phase,
            bubbles: newBubbles,
            dangerLevel: calculateDangerLevel(newBubbles, config),
            rowsAdded: prev.rowsAdded + 1,
          };
        });
      }
    }, 1000);

    return () => clearInterval(interval);
  }, [config, gameState.phase]);

  return {
    gameState,
    trajectoryPoints,
    updateGame,
    resetGame,
  };
}
