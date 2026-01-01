// Game Types for Bubble Shooter

export type BubbleColor = 'red' | 'blue' | 'green' | 'yellow' | 'purple' | 'cyan';

export const BUBBLE_COLORS: BubbleColor[] = ['red', 'blue', 'green', 'yellow', 'purple', 'cyan'];

export const NEON_COLORS: Record<BubbleColor, { fill: string; glow: string }> = {
  red: { fill: '#ff1744', glow: '#ff4569' },
  blue: { fill: '#2979ff', glow: '#5c9cff' },
  green: { fill: '#00e676', glow: '#33eb91' },
  yellow: { fill: '#ffea00', glow: '#ffee33' },
  purple: { fill: '#d500f9', glow: '#dd33fa' },
  cyan: { fill: '#00e5ff', glow: '#33ebff' },
};

export interface Vector2D {
  x: number;
  y: number;
}

export interface Bubble {
  id: string;
  color: BubbleColor;
  position: Vector2D;
  row: number;
  col: number;
  radius: number;
}

export interface Projectile {
  position: Vector2D;
  velocity: Vector2D;
  color: BubbleColor;
  radius: number;
}

export interface GridCell {
  row: number;
  col: number;
  bubble: Bubble | null;
}

export type GamePhase = 'IDLE' | 'AIMING' | 'SHOOTING' | 'PROCESSING' | 'GAME_OVER';

export interface PinchState {
  isPinching: boolean;
  startPosition: Vector2D | null;
  currentPosition: Vector2D | null;
  pullVector: Vector2D | null;
}

export interface GameState {
  phase: GamePhase;
  score: number;
  bubbles: Bubble[];
  projectile: Projectile | null;
  nextBubbleColor: BubbleColor;
  pinchState: PinchState;
  dangerLevel: number; // 0-100, how close to game over
  rowsAdded: number;
}

export interface GameConfig {
  canvasWidth: number;
  canvasHeight: number;
  gridColumns: number;
  bubbleRadius: number;
  launcherY: number;
  dangerLineY: number;
  newRowIntervalMs: number;
  projectileSpeed: number;
  pinchThreshold: number;
  minPullDistance: number;
}

export const DEFAULT_CONFIG: GameConfig = {
  canvasWidth: 500,
  canvasHeight: 750,
  gridColumns: 9,
  bubbleRadius: 22,
  launcherY: 640,
  dangerLineY: 580,
  newRowIntervalMs: 15000, // New row every 15 seconds
  projectileSpeed: 14,
  pinchThreshold: 0.35, // Normalized distance for pinch detection (extremely permissive for testing)
  minPullDistance: 20, // Minimum pixels to pull before launch
};
