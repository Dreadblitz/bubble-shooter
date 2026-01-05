'use client';

import { useRef, useEffect, useCallback, RefObject } from 'react';
import type { DetectedHand } from '@/types/hand-detection';

// Bubble Shooter imports
import type { Bubble, BubbleColor, GameConfig } from '../types';
import { NEON_COLORS } from '../types';
import {
  findMatches,
  removeMatches,
  findFloatingBubbles,
  createBubble,
} from '../engine/grid';
import { updateProjectile } from '../engine/physics';

// =============================================================================
// TYPES
// =============================================================================

interface Vector2D {
  x: number;
  y: number;
}

interface Ball {
  position: Vector2D;
  velocity: Vector2D;
  radius: number;
  isGrabbed: boolean;
}

interface GrabDemoProps {
  handsRef: RefObject<DetectedHand[]>;
  isRunning: boolean;
  videoRef?: RefObject<HTMLVideoElement | null>;
}

// =============================================================================
// CONSTANTS
// =============================================================================

const CANVAS_WIDTH = 500;
const CANVAS_HEIGHT = 750;
const FLOOR_Y = CANVAS_HEIGHT * 0.78; // Floor at 22% from bottom
const GRAB_THRESHOLD = 0.08; // Strict threshold to START grabbing
const RELEASE_THRESHOLD = 0.18; // Permissive threshold to RELEASE (hysteresis)
const GRAB_DISTANCE = 80; // Pixels - how close pinch must be to ball to grab it
const RELEASE_FRAMES = 3; // Frames without pinch required to release

// UX Enhancement constants
const POSITION_SMOOTHING = 0.4; // 0 = no smoothing, 1 = instant (0.3-0.5 feels natural)
const POSITION_HISTORY_SIZE = 5; // Frames of position history for velocity calculation
const PROXIMITY_GLOW_DISTANCE = 150; // Distance for proximity visual feedback

// Slingshot constants (Angry Birds style)
const SLINGSHOT_ANCHOR_X = CANVAS_WIDTH / 2; // Center anchor point X
const SLINGSHOT_ANCHOR_Y = FLOOR_Y - 22; // Anchor point on floor line (adjusted for bubble radius)
const SLINGSHOT_FORCE = 0.20; // Force multiplier for catapult effect
const SLINGSHOT_MAX_VELOCITY = 45; // Cap maximum slingshot velocity
const SLINGSHOT_RELEASE_THRESHOLD = 0.10; // More sensitive release when in slingshot zone
const SLINGSHOT_RELEASE_FRAMES = 2; // Requires 2 consistent frames to release
const OPENING_VELOCITY_THRESHOLD = 0.035; // Velocity-based release (higher = less false positives)
const VELOCITY_HISTORY_SIZE = 3; // Frames to average for velocity smoothing
const SLINGSHOT_MAX_PULL = 200; // Maximum pull distance from anchor

// Launch angle restriction (Angry Birds style - only upward shots)
// 30 degrees = allows shooting in a 120 degree cone upward
const MIN_LAUNCH_ANGLE = 30 * (Math.PI / 180); // 30 degrees in radians
const TRAJECTORY_LENGTH_MULTIPLIER = 1.5; // Multiplier for trajectory preview line

// One Euro Filter parameters (for finger indicator smoothing)
const FILTER_MIN_CUTOFF = 1.0; // Stability when still (lower = smoother)
const FILTER_BETA = 0.5; // Responsiveness to movement (higher = more responsive)
const FILTER_D_CUTOFF = 1.0; // Derivative cutoff

// Finger indicator visual smoothing
const FINGER_OPACITY_LERP = 0.12; // Speed of fade in/out (lower = smoother)
const FINGER_POSITION_LERP = 0.35; // Additional visual position smoothing
const FINGER_PERSISTENCE_FRAMES = 8; // Frames to keep showing after losing tracking

// Bubble Shooter constants
const BUBBLE_RADIUS = 22;
const GRID_COLUMNS = 9;
const DANGER_LINE_Y = FLOOR_Y - 100;
const BALL_RADIUS = BUBBLE_RADIUS;

// Limited colors (only 4)
const LIMITED_COLORS: BubbleColor[] = ['red', 'blue', 'green', 'yellow'];

// Get random color from limited set
function getRandomColor(): BubbleColor {
  return LIMITED_COLORS[Math.floor(Math.random() * LIMITED_COLORS.length)];
}

// Clamp launch angle to prevent downward or too-lateral shots
// Returns the clamped launch direction vector (in launch direction, not pull direction)
function clampLaunchAngle(pullX: number, pullY: number): { x: number; y: number } {
  // The shot is in the OPPOSITE direction to the pull
  const launchX = -pullX;
  const launchY = -pullY;

  // If the shot goes downward (launchY > 0), restrict it
  if (launchY >= 0) {
    // Force upward with minimum angle
    const magnitude = Math.sqrt(launchX * launchX + launchY * launchY);
    const sign = launchX >= 0 ? 1 : -1;
    return {
      x: sign * Math.cos(MIN_LAUNCH_ANGLE) * magnitude,
      y: -Math.sin(MIN_LAUNCH_ANGLE) * magnitude,
    };
  }

  // Calculate current angle (from horizontal upward)
  const angle = Math.atan2(-launchY, Math.abs(launchX));

  // If angle is less than minimum, adjust
  if (angle < MIN_LAUNCH_ANGLE) {
    const magnitude = Math.sqrt(launchX * launchX + launchY * launchY);
    const sign = launchX >= 0 ? 1 : -1;
    return {
      x: sign * Math.cos(MIN_LAUNCH_ANGLE) * magnitude,
      y: -Math.sin(MIN_LAUNCH_ANGLE) * magnitude,
    };
  }

  return { x: launchX, y: launchY };
}

// Game config adapted to existing canvas
const GAME_CONFIG: GameConfig = {
  canvasWidth: CANVAS_WIDTH,
  canvasHeight: CANVAS_HEIGHT,
  gridColumns: GRID_COLUMNS,
  bubbleRadius: BUBBLE_RADIUS,
  launcherY: SLINGSHOT_ANCHOR_Y,
  dangerLineY: DANGER_LINE_Y,
  newRowIntervalMs: 15000,
  projectileSpeed: 14,
  pinchThreshold: 0.08,
  minPullDistance: 20,
};

// Create initial grid with limited colors
function createInitialGridLimited(rows: number, config: GameConfig): Bubble[] {
  const bubbles: Bubble[] = [];

  for (let row = 0; row < rows; row++) {
    const isOffsetRow = row % 2 === 1;
    const cols = config.gridColumns - (isOffsetRow ? 1 : 0);

    for (let col = 0; col < cols; col++) {
      // Random chance to have a bubble (80%)
      if (Math.random() < 0.8) {
        bubbles.push(createBubble(row, col, getRandomColor(), config));
      }
    }
  }

  return bubbles;
}

// =============================================================================
// ONE EURO FILTER (reduces jitter while maintaining responsiveness)
// =============================================================================

class OneEuroFilter {
  private minCutoff: number;
  private beta: number;
  private dCutoff: number;
  private xPrev: number | null = null;
  private dxPrev: number = 0;
  private tPrev: number | null = null;

  constructor(minCutoff = FILTER_MIN_CUTOFF, beta = FILTER_BETA, dCutoff = FILTER_D_CUTOFF) {
    this.minCutoff = minCutoff;
    this.beta = beta;
    this.dCutoff = dCutoff;
  }

  private smoothingFactor(te: number, cutoff: number): number {
    const tau = 1.0 / (2 * Math.PI * cutoff);
    return 1.0 / (1.0 + tau / te);
  }

  private exponentialSmoothing(a: number, x: number, xPrev: number): number {
    return a * x + (1 - a) * xPrev;
  }

  filter(x: number, t: number): number {
    if (this.xPrev === null || this.tPrev === null) {
      this.xPrev = x;
      this.tPrev = t;
      return x;
    }

    const te = t - this.tPrev;
    if (te <= 0) return this.xPrev;

    // Estimate velocity
    const aD = this.smoothingFactor(te, this.dCutoff);
    const dx = (x - this.xPrev) / te;
    const dxSmoothed = this.exponentialSmoothing(aD, dx, this.dxPrev);

    // Adaptive cutoff based on velocity
    const cutoff = this.minCutoff + this.beta * Math.abs(dxSmoothed);
    const a = this.smoothingFactor(te, cutoff);

    // Filter position
    const xFiltered = this.exponentialSmoothing(a, x, this.xPrev);

    this.xPrev = xFiltered;
    this.dxPrev = dxSmoothed;
    this.tPrev = t;

    return xFiltered;
  }

  reset(): void {
    this.xPrev = null;
    this.tPrev = null;
    this.dxPrev = 0;
  }
}

// =============================================================================
// COORDINATE HELPERS
// =============================================================================

function videoToCanvasCoords(
  videoX: number,
  videoY: number,
  videoWidth: number,
  videoHeight: number
): Vector2D {
  const videoAspect = videoWidth / videoHeight;
  const canvasAspect = CANVAS_WIDTH / CANVAS_HEIGHT;

  let x: number;
  let y: number;

  if (videoAspect > canvasAspect) {
    // Video wider than canvas - X is cropped
    const scaledWidth = CANVAS_HEIGHT * videoAspect;
    const cropAmount = (scaledWidth - CANVAS_WIDTH) / 2;
    const visibleStart = cropAmount / scaledWidth;
    const visibleRange = CANVAS_WIDTH / scaledWidth;

    const remappedX = (videoX - visibleStart) / visibleRange;
    x = (1 - remappedX) * CANVAS_WIDTH; // Mirror X
    y = videoY * CANVAS_HEIGHT;
  } else {
    // Video taller than canvas - Y is cropped
    const scaledHeight = CANVAS_WIDTH / videoAspect;
    const cropAmount = (scaledHeight - CANVAS_HEIGHT) / 2;
    const visibleStart = cropAmount / scaledHeight;
    const visibleRange = CANVAS_HEIGHT / scaledHeight;

    x = (1 - videoX) * CANVAS_WIDTH;
    const remappedY = (videoY - visibleStart) / visibleRange;
    y = remappedY * CANVAS_HEIGHT;
  }

  // Clamp to canvas bounds
  x = Math.max(0, Math.min(CANVAS_WIDTH, x));
  y = Math.max(0, Math.min(CANVAS_HEIGHT, y));

  return { x, y };
}

// =============================================================================
// COMPONENT
// =============================================================================

export function GrabDemo({ handsRef, isRunning, videoRef }: GrabDemoProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);

  // Ball state (using ref for game loop performance)
  // Starts at slingshot anchor position (center of floor line)
  const ballRef = useRef<Ball>({
    position: { x: SLINGSHOT_ANCHOR_X, y: SLINGSHOT_ANCHOR_Y },
    velocity: { x: 0, y: 0 },
    radius: BALL_RADIUS,
    isGrabbed: false,
  });

  // Track if ball has been launched (for reset button visibility)
  const hasLaunchedRef = useRef(false);

  // Track previous frame states for transition detection
  const wasPinchingRef = useRef(false);
  // Counter for release stability (requires multiple frames without pinch to release)
  const releaseCounterRef = useRef(0);
  // Position history for throw velocity calculation
  const positionHistoryRef = useRef<Vector2D[]>([]);
  // Previous pinch distance for velocity-based release detection
  const prevPinchDistanceRef = useRef(0);
  // Velocity history for smoothed velocity calculation (reduces false positives)
  const velocityHistoryRef = useRef<number[]>([]);

  // One Euro Filters for finger indicators (reduces jitter)
  const thumbFilterX = useRef(new OneEuroFilter());
  const thumbFilterY = useRef(new OneEuroFilter());
  const indexFilterX = useRef(new OneEuroFilter());
  const indexFilterY = useRef(new OneEuroFilter());

  // Visual smoothing state for finger indicators
  const fingerVisualState = useRef({
    opacity: 0,
    thumbX: 0, thumbY: 0,
    indexX: 0, indexY: 0,
    lastSeenFrame: 0,
    frameCount: 0,
  });

  // Bubble grid state
  const bubblesRef = useRef<Bubble[]>([]);
  const nextBubbleColorRef = useRef<BubbleColor>(getRandomColor());
  const scoreRef = useRef(0);
  const isProjectileActiveRef = useRef(false);

  // Handle projectile collision with grid
  const handleProjectileCollision = useCallback((gridPos: { row: number; col: number }) => {
    const color = nextBubbleColorRef.current;
    const newBubble = createBubble(gridPos.row, gridPos.col, color, GAME_CONFIG);
    bubblesRef.current = [...bubblesRef.current, newBubble];

    // Find matches
    const matches = findMatches(bubblesRef.current, gridPos.row, gridPos.col, color);
    let scoreGain = 0;

    if (matches.length >= 3) {
      bubblesRef.current = removeMatches(bubblesRef.current, matches);
      scoreGain += matches.length * 10;

      // Remove orphan bubbles
      const floating = findFloatingBubbles(bubblesRef.current);
      if (floating.length > 0) {
        bubblesRef.current = removeMatches(bubblesRef.current, floating);
        scoreGain += floating.length * 20;
      }
    }

    scoreRef.current += scoreGain;

    // Reset for next shot
    isProjectileActiveRef.current = false;
    nextBubbleColorRef.current = getRandomColor();
    ballRef.current.position = { x: SLINGSHOT_ANCHOR_X, y: SLINGSHOT_ANCHOR_Y };
    ballRef.current.velocity = { x: 0, y: 0 };
    hasLaunchedRef.current = false;
  }, []);

  // Reset game and initialize grid
  const resetGame = useCallback(() => {
    ballRef.current = {
      position: { x: SLINGSHOT_ANCHOR_X, y: SLINGSHOT_ANCHOR_Y },
      velocity: { x: 0, y: 0 },
      radius: BALL_RADIUS,
      isGrabbed: false,
    };
    hasLaunchedRef.current = false;
    wasPinchingRef.current = false;
    releaseCounterRef.current = 0;
    positionHistoryRef.current = [];
    prevPinchDistanceRef.current = 0;
    velocityHistoryRef.current = [];
    // Reset finger filters
    thumbFilterX.current.reset();
    thumbFilterY.current.reset();
    indexFilterX.current.reset();
    indexFilterY.current.reset();
    // Initialize bubble grid
    bubblesRef.current = createInitialGridLimited(5, GAME_CONFIG);
    nextBubbleColorRef.current = getRandomColor();
    scoreRef.current = 0;
    isProjectileActiveRef.current = false;
  }, []);

  // Main game loop
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas || !isRunning) return;

    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    let animationId: number;

    const gameLoop = () => {
      const hands = handsRef.current ?? [];
      const video = videoRef?.current;
      const ball = ballRef.current;

      // Get video dimensions
      const videoWidth = video?.videoWidth ?? 640;
      const videoHeight = video?.videoHeight ?? 480;

      // ===========================================
      // DETECT PINCH AND POSITION (with hysteresis)
      // ===========================================
      let pinchPosition: Vector2D | null = null;
      let pinchDistance = 1;

      if (hands.length > 0) {
        const hand = hands[0];
        const thumbTip = hand.landmarks[4];
        const indexTip = hand.landmarks[8];

        // Calculate pinch distance (normalized)
        const dx = thumbTip.x - indexTip.x;
        const dy = thumbTip.y - indexTip.y;
        pinchDistance = Math.sqrt(dx * dx + dy * dy);

        // Get pinch center position in canvas coords
        const avgX = (thumbTip.x + indexTip.x) / 2;
        const avgY = (thumbTip.y + indexTip.y) / 2;
        pinchPosition = videoToCanvasCoords(avgX, avgY, videoWidth, videoHeight);
      }

      // Calculate pinch velocity with smoothing (reduces false positives from tracking noise)
      const rawVelocity = pinchDistance - prevPinchDistanceRef.current;
      prevPinchDistanceRef.current = pinchDistance;

      // Add to velocity history and compute average
      velocityHistoryRef.current.push(rawVelocity);
      if (velocityHistoryRef.current.length > VELOCITY_HISTORY_SIZE) {
        velocityHistoryRef.current.shift();
      }
      const pinchVelocity = velocityHistoryRef.current.reduce((a, b) => a + b, 0)
                           / velocityHistoryRef.current.length;

      // Apply hysteresis: different thresholds for grab vs release
      // Slingshot zone: when ball is pulled away from anchor (any direction)
      const distFromAnchor = Math.sqrt(
        Math.pow(ball.position.x - SLINGSHOT_ANCHOR_X, 2) +
        Math.pow(ball.position.y - SLINGSHOT_ANCHOR_Y, 2)
      );
      const isInSlingshotZone = ball.isGrabbed && distFromAnchor > 20;
      const releaseThreshold = isInSlingshotZone ? SLINGSHOT_RELEASE_THRESHOLD : RELEASE_THRESHOLD;
      const threshold = ball.isGrabbed ? releaseThreshold : GRAB_THRESHOLD;

      // Velocity-based release: if fingers are opening rapidly in slingshot zone, release immediately
      const isRapidOpening = isInSlingshotZone && pinchVelocity > OPENING_VELOCITY_THRESHOLD;
      const isPinching = pinchDistance < threshold && !isRapidOpening;

      // Dynamic release frames based on zone
      const requiredReleaseFrames = isInSlingshotZone ? SLINGSHOT_RELEASE_FRAMES : RELEASE_FRAMES;

      // ===========================================
      // GRAB LOGIC (with smoothing + throw physics)
      // ===========================================
      const wasPinching = wasPinchingRef.current;
      const history = positionHistoryRef.current;

      if (ball.isGrabbed) {
        // Already grabbed - keep following while pinching (with smoothing)
        if (isPinching && pinchPosition) {
          // Position smoothing (lerp) - eliminates jitter
          ball.position.x += (pinchPosition.x - ball.position.x) * POSITION_SMOOTHING;
          ball.position.y += (pinchPosition.y - ball.position.y) * POSITION_SMOOTHING;
          ball.velocity.x = 0;
          ball.velocity.y = 0;
          releaseCounterRef.current = 0;

          // Track position history for throw velocity
          history.push({ x: ball.position.x, y: ball.position.y });
          if (history.length > POSITION_HISTORY_SIZE) {
            history.shift();
          }
        } else {
          // Not pinching - increment release counter
          releaseCounterRef.current++;

          // Only release after sustained non-pinch frames
          if (releaseCounterRef.current >= requiredReleaseFrames) {
            ball.isGrabbed = false;
            releaseCounterRef.current = 0;

            // ANGRY BIRDS STYLE SLINGSHOT
            // Calculate pull vector (from anchor to ball position)
            const pullX = ball.position.x - SLINGSHOT_ANCHOR_X;
            const pullY = ball.position.y - SLINGSHOT_ANCHOR_Y;
            const pullDistance = Math.sqrt(pullX * pullX + pullY * pullY);

            if (pullDistance > 10) { // Minimum pull distance to launch
              // Apply angle clamping to restrict to upward shots only
              const clampedLaunch = clampLaunchAngle(pullX, pullY);
              const clampedMagnitude = Math.sqrt(clampedLaunch.x ** 2 + clampedLaunch.y ** 2);

              // Velocity magnitude proportional to pull distance
              const launchForce = Math.min(pullDistance, SLINGSHOT_MAX_PULL) * SLINGSHOT_FORCE;

              // Apply force using clamped direction
              if (clampedMagnitude > 0) {
                ball.velocity.x = (clampedLaunch.x / clampedMagnitude) * launchForce;
                ball.velocity.y = (clampedLaunch.y / clampedMagnitude) * launchForce;
              } else {
                // Fallback: straight up
                ball.velocity.x = 0;
                ball.velocity.y = -launchForce;
              }

              // Cap velocity
              const speed = Math.sqrt(ball.velocity.x ** 2 + ball.velocity.y ** 2);
              if (speed > SLINGSHOT_MAX_VELOCITY) {
                ball.velocity.x = (ball.velocity.x / speed) * SLINGSHOT_MAX_VELOCITY;
                ball.velocity.y = (ball.velocity.y / speed) * SLINGSHOT_MAX_VELOCITY;
              }

              // Snap ball to anchor position before launch
              ball.position.x = SLINGSHOT_ANCHOR_X;
              ball.position.y = SLINGSHOT_ANCHOR_Y;

              // Mark as launched and activate projectile mode
              hasLaunchedRef.current = true;
              isProjectileActiveRef.current = true;
            } else {
              // Not enough pull - just snap back to anchor
              ball.position.x = SLINGSHOT_ANCHOR_X;
              ball.position.y = SLINGSHOT_ANCHOR_Y;
              ball.velocity.x = 0;
              ball.velocity.y = 0;
            }
            history.length = 0; // Clear history
          } else if (pinchPosition) {
            // Still follow during grace period (with smoothing)
            ball.position.x += (pinchPosition.x - ball.position.x) * POSITION_SMOOTHING;
            ball.position.y += (pinchPosition.y - ball.position.y) * POSITION_SMOOTHING;
          }
        }
      } else {
        // Not grabbed - check for grab TRANSITION (was open, now pinched, near ball)
        releaseCounterRef.current = 0;
        history.length = 0; // Clear history when not grabbed
        if (!wasPinching && isPinching && pinchPosition) {
          const distToBall = Math.sqrt(
            Math.pow(pinchPosition.x - ball.position.x, 2) +
            Math.pow(pinchPosition.y - ball.position.y, 2)
          );

          if (distToBall < GRAB_DISTANCE) {
            ball.isGrabbed = true;
            ball.position.x = pinchPosition.x;
            ball.position.y = pinchPosition.y;
            ball.velocity.x = 0;
            ball.velocity.y = 0;
          }
        }
      }

      // Update previous pinch state for next frame
      wasPinchingRef.current = isPinching;

      // ===========================================
      // PHYSICS (when not grabbed)
      // ===========================================
      if (!ball.isGrabbed) {
        if (isProjectileActiveRef.current) {
          // BUBBLE SHOOTER MODE: no gravity, lateral bounces
          const result = updateProjectile(
            {
              position: ball.position,
              velocity: ball.velocity,
              color: nextBubbleColorRef.current,
              radius: BUBBLE_RADIUS,
            },
            GAME_CONFIG,
            bubblesRef.current
          );

          if (result.collision) {
            // Collision detected - add bubble to grid
            handleProjectileCollision(result.collision);
          } else if (result.projectile) {
            ball.position = result.projectile.position;
            ball.velocity = result.projectile.velocity;
          }
        }
        // When not active projectile, ball stays at anchor (no gravity applied)
      }

      // ===========================================
      // RENDER
      // ===========================================
      // Clear canvas
      ctx.fillStyle = '#0a0a0f';
      ctx.fillRect(0, 0, CANVAS_WIDTH, CANVAS_HEIGHT);

      // Draw bubble grid FIRST (before everything else)
      bubblesRef.current.forEach(bubble => {
        const colors = NEON_COLORS[bubble.color];

        // Glow
        ctx.shadowColor = colors.glow;
        ctx.shadowBlur = 12;

        // Gradient
        const gradient = ctx.createRadialGradient(
          bubble.position.x - bubble.radius * 0.3,
          bubble.position.y - bubble.radius * 0.3,
          0,
          bubble.position.x,
          bubble.position.y,
          bubble.radius
        );
        gradient.addColorStop(0, colors.glow);
        gradient.addColorStop(0.7, colors.fill);
        gradient.addColorStop(1, 'rgba(0, 0, 0, 0.3)');

        ctx.fillStyle = gradient;
        ctx.beginPath();
        ctx.arc(bubble.position.x, bubble.position.y, bubble.radius - 1, 0, Math.PI * 2);
        ctx.fill();

        // Highlight
        ctx.shadowBlur = 0;
        ctx.fillStyle = 'rgba(255, 255, 255, 0.4)';
        ctx.beginPath();
        ctx.arc(
          bubble.position.x - bubble.radius * 0.3,
          bubble.position.y - bubble.radius * 0.3,
          bubble.radius * 0.25,
          0,
          Math.PI * 2
        );
        ctx.fill();
      });
      ctx.shadowBlur = 0;

      // Draw danger line
      ctx.strokeStyle = 'rgba(255, 50, 50, 0.4)';
      ctx.lineWidth = 2;
      ctx.setLineDash([10, 10]);
      ctx.beginPath();
      ctx.moveTo(0, DANGER_LINE_Y);
      ctx.lineTo(CANVAS_WIDTH, DANGER_LINE_Y);
      ctx.stroke();
      ctx.setLineDash([]);

      // Draw floor line (at 1/3 from bottom)
      ctx.strokeStyle = '#444466';
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.moveTo(0, FLOOR_Y);
      ctx.lineTo(CANVAS_WIDTH, FLOOR_Y);
      ctx.stroke();

      // Draw floor surface gradient (subtle)
      const floorGradient = ctx.createLinearGradient(0, FLOOR_Y, 0, CANVAS_HEIGHT);
      floorGradient.addColorStop(0, 'rgba(50, 50, 80, 0.3)');
      floorGradient.addColorStop(1, 'rgba(20, 20, 40, 0.5)');
      ctx.fillStyle = floorGradient;
      ctx.fillRect(0, FLOOR_Y, CANVAS_WIDTH, CANVAS_HEIGHT - FLOOR_Y);

      // Draw slingshot anchor and elastic bands (Angry Birds style)
      const pullDistRender = Math.sqrt(
        Math.pow(ball.position.x - SLINGSHOT_ANCHOR_X, 2) +
        Math.pow(ball.position.y - SLINGSHOT_ANCHOR_Y, 2)
      );

      // Draw Y-shaped slingshot frame
      const forkWidth = 40;
      const forkHeight = 30;
      const leftFork = { x: SLINGSHOT_ANCHOR_X - forkWidth, y: SLINGSHOT_ANCHOR_Y - forkHeight };
      const rightFork = { x: SLINGSHOT_ANCHOR_X + forkWidth, y: SLINGSHOT_ANCHOR_Y - forkHeight };
      const baseY = SLINGSHOT_ANCHOR_Y + 60;

      // Draw slingshot frame (brown/wood color)
      ctx.strokeStyle = '#8B4513';
      ctx.lineWidth = 8;
      ctx.lineCap = 'round';
      ctx.lineJoin = 'round';

      // Left arm
      ctx.beginPath();
      ctx.moveTo(SLINGSHOT_ANCHOR_X, baseY);
      ctx.lineTo(SLINGSHOT_ANCHOR_X, SLINGSHOT_ANCHOR_Y);
      ctx.lineTo(leftFork.x, leftFork.y);
      ctx.stroke();

      // Right arm
      ctx.beginPath();
      ctx.moveTo(SLINGSHOT_ANCHOR_X, SLINGSHOT_ANCHOR_Y);
      ctx.lineTo(rightFork.x, rightFork.y);
      ctx.stroke();

      // Draw elastic bands when ball is grabbed and pulled
      if (ball.isGrabbed && pullDistRender > 5) {
        const tension = Math.min(pullDistRender / SLINGSHOT_MAX_PULL, 1);

        // Elastic band color: green -> yellow -> red based on tension
        const r = Math.floor(255 * tension);
        const g = Math.floor(255 * (1 - tension * 0.5));
        const elasticColor = `rgb(${r}, ${g}, 50)`;

        ctx.strokeStyle = elasticColor;
        ctx.lineWidth = 4 + tension * 4;
        ctx.lineCap = 'round';

        // Left band (from left fork to ball)
        ctx.beginPath();
        ctx.moveTo(leftFork.x, leftFork.y);
        ctx.lineTo(ball.position.x, ball.position.y);
        ctx.stroke();

        // Right band (from right fork to ball)
        ctx.beginPath();
        ctx.moveTo(rightFork.x, rightFork.y);
        ctx.lineTo(ball.position.x, ball.position.y);
        ctx.stroke();

        // Glow effect
        ctx.shadowColor = elasticColor;
        ctx.shadowBlur = 10 + tension * 15;
        ctx.strokeStyle = elasticColor;
        ctx.lineWidth = 2;
        ctx.beginPath();
        ctx.moveTo(leftFork.x, leftFork.y);
        ctx.lineTo(ball.position.x, ball.position.y);
        ctx.lineTo(rightFork.x, rightFork.y);
        ctx.stroke();
        ctx.shadowBlur = 0;

        // Draw trajectory preview (dotted line showing launch direction with angle clamping)
        const pullX = ball.position.x - SLINGSHOT_ANCHOR_X;
        const pullY = ball.position.y - SLINGSHOT_ANCHOR_Y;

        // Apply angle clamping to get the corrected launch direction
        const clampedLaunch = clampLaunchAngle(pullX, pullY);
        const clampedMagnitude = Math.sqrt(clampedLaunch.x ** 2 + clampedLaunch.y ** 2);
        const launchDirX = clampedMagnitude > 0 ? clampedLaunch.x / clampedMagnitude : 0;
        const launchDirY = clampedMagnitude > 0 ? clampedLaunch.y / clampedMagnitude : -1;

        // Longer preview line, proportional to pull distance
        const previewLength = pullDistRender * TRAJECTORY_LENGTH_MULTIPLIER;

        ctx.strokeStyle = `rgba(255, 255, 255, ${0.3 + tension * 0.4})`;
        ctx.lineWidth = 2;
        ctx.setLineDash([8, 8]);
        ctx.beginPath();
        ctx.moveTo(SLINGSHOT_ANCHOR_X, SLINGSHOT_ANCHOR_Y);
        ctx.lineTo(
          SLINGSHOT_ANCHOR_X + launchDirX * previewLength,
          SLINGSHOT_ANCHOR_Y + launchDirY * previewLength
        );
        ctx.stroke();
        ctx.setLineDash([]);
      } else if (!ball.isGrabbed && !hasLaunchedRef.current) {
        // Draw resting elastic (straight line between forks when ball at anchor)
        ctx.strokeStyle = '#44aa44';
        ctx.lineWidth = 3;
        ctx.beginPath();
        ctx.moveTo(leftFork.x, leftFork.y);
        ctx.lineTo(SLINGSHOT_ANCHOR_X, SLINGSHOT_ANCHOR_Y);
        ctx.lineTo(rightFork.x, rightFork.y);
        ctx.stroke();
      }

      // Fork tips (small circles)
      ctx.fillStyle = '#A0522D';
      ctx.beginPath();
      ctx.arc(leftFork.x, leftFork.y, 6, 0, Math.PI * 2);
      ctx.fill();
      ctx.beginPath();
      ctx.arc(rightFork.x, rightFork.y, 6, 0, Math.PI * 2);
      ctx.fill();

      // Draw video background (mirrored)
      if (video && video.readyState >= 2) {
        ctx.save();
        ctx.translate(CANVAS_WIDTH, 0);
        ctx.scale(-1, 1);

        const videoAspect = video.videoWidth / video.videoHeight;
        const canvasAspect = CANVAS_WIDTH / CANVAS_HEIGHT;

        let drawWidth: number;
        let drawHeight: number;
        let offsetX = 0;
        let offsetY = 0;

        if (videoAspect > canvasAspect) {
          drawHeight = CANVAS_HEIGHT;
          drawWidth = drawHeight * videoAspect;
          offsetX = (CANVAS_WIDTH - drawWidth) / 2;
        } else {
          drawWidth = CANVAS_WIDTH;
          drawHeight = drawWidth / videoAspect;
          offsetY = (CANVAS_HEIGHT - drawHeight) / 2;
        }

        ctx.globalAlpha = 0.4;
        ctx.drawImage(video, offsetX, offsetY, drawWidth, drawHeight);
        ctx.globalAlpha = 1.0;
        ctx.restore();
      }

      // Calculate proximity for visual feedback
      let proximityFactor = 0;
      if (!ball.isGrabbed && pinchPosition) {
        const distToBall = Math.sqrt(
          Math.pow(pinchPosition.x - ball.position.x, 2) +
          Math.pow(pinchPosition.y - ball.position.y, 2)
        );
        if (distToBall < PROXIMITY_GLOW_DISTANCE) {
          proximityFactor = 1 - (distToBall / PROXIMITY_GLOW_DISTANCE);
        }
      }

      // Draw proximity glow (pulsing effect when hand is near)
      if (proximityFactor > 0 && !ball.isGrabbed) {
        const pulseTime = Date.now() / 200;
        const pulse = 0.5 + 0.5 * Math.sin(pulseTime);
        const glowIntensity = proximityFactor * pulse;
        const glowRadius = ball.radius + 20 + glowIntensity * 30;

        ctx.beginPath();
        ctx.arc(ball.position.x, ball.position.y, glowRadius, 0, Math.PI * 2);
        ctx.fillStyle = `rgba(0, 255, 255, ${glowIntensity * 0.3})`;
        ctx.fill();

        // Inner proximity ring
        ctx.beginPath();
        ctx.arc(ball.position.x, ball.position.y, ball.radius + 5 + glowIntensity * 10, 0, Math.PI * 2);
        ctx.strokeStyle = `rgba(0, 255, 255, ${glowIntensity * 0.8})`;
        ctx.lineWidth = 2 + glowIntensity * 2;
        ctx.stroke();
      }

      // Draw ball with next bubble color
      const currentBubbleColors = NEON_COLORS[nextBubbleColorRef.current];
      const ballColor = ball.isGrabbed ? '#00ff00' : currentBubbleColors.fill;
      const glowColor = ball.isGrabbed ? '#00ff00' : currentBubbleColors.glow;

      // Glow effect (enhanced when grabbed or near)
      ctx.shadowColor = glowColor;
      ctx.shadowBlur = ball.isGrabbed ? 50 : (30 + proximityFactor * 20);

      // Ball scale effect (slight grow when proximity)
      const scaleBonus = ball.isGrabbed ? 1.05 : (1 + proximityFactor * 0.08);
      const displayRadius = ball.radius * scaleBonus;

      // Ball gradient
      const ballGradient = ctx.createRadialGradient(
        ball.position.x - displayRadius * 0.3,
        ball.position.y - displayRadius * 0.3,
        0,
        ball.position.x,
        ball.position.y,
        displayRadius
      );
      ballGradient.addColorStop(0, ball.isGrabbed ? '#66ff66' : currentBubbleColors.glow);
      ballGradient.addColorStop(1, ballColor);

      ctx.beginPath();
      ctx.arc(ball.position.x, ball.position.y, displayRadius, 0, Math.PI * 2);
      ctx.fillStyle = ballGradient;
      ctx.fill();

      ctx.shadowBlur = 0;

      // Draw "ready to grab" indicator when pinching near ball
      if (isPinching && pinchPosition && !ball.isGrabbed) {
        const distToBall = Math.sqrt(
          Math.pow(pinchPosition.x - ball.position.x, 2) +
          Math.pow(pinchPosition.y - ball.position.y, 2)
        );

        if (distToBall < GRAB_DISTANCE * 1.5) {
          // Draw animated dashed circle around ball
          ctx.strokeStyle = '#00ff00';
          ctx.lineWidth = 2;
          ctx.setLineDash([5, 5]);
          ctx.beginPath();
          ctx.arc(ball.position.x, ball.position.y, ball.radius + 10, 0, Math.PI * 2);
          ctx.stroke();
          ctx.setLineDash([]);
        }
      }

      // Draw score
      ctx.font = 'bold 24px monospace';
      ctx.fillStyle = '#00ffff';
      ctx.shadowColor = '#00ffff';
      ctx.shadowBlur = 10;
      ctx.textAlign = 'left';
      ctx.fillText(`SCORE: ${scoreRef.current}`, 15, 35);
      ctx.shadowBlur = 0;

      // Draw hand indicators with visual smoothing (fade in/out, persistence, lerp)
      const fvs = fingerVisualState.current;
      fvs.frameCount++;

      if (hands.length > 0 && pinchPosition) {
        const hand = hands[0];
        const thumbTip = hand.landmarks[4];
        const indexTip = hand.landmarks[8];

        const thumbRaw = videoToCanvasCoords(thumbTip.x, thumbTip.y, videoWidth, videoHeight);
        const indexRaw = videoToCanvasCoords(indexTip.x, indexTip.y, videoWidth, videoHeight);

        // Apply One Euro Filter to smooth finger positions
        const now = performance.now() / 1000;
        const thumbFiltered = {
          x: thumbFilterX.current.filter(thumbRaw.x, now),
          y: thumbFilterY.current.filter(thumbRaw.y, now),
        };
        const indexFiltered = {
          x: indexFilterX.current.filter(indexRaw.x, now),
          y: indexFilterY.current.filter(indexRaw.y, now),
        };

        // Additional visual lerp for extra smoothness
        fvs.thumbX += (thumbFiltered.x - fvs.thumbX) * FINGER_POSITION_LERP;
        fvs.thumbY += (thumbFiltered.y - fvs.thumbY) * FINGER_POSITION_LERP;
        fvs.indexX += (indexFiltered.x - fvs.indexX) * FINGER_POSITION_LERP;
        fvs.indexY += (indexFiltered.y - fvs.indexY) * FINGER_POSITION_LERP;

        // Fade in opacity
        fvs.opacity += (1 - fvs.opacity) * FINGER_OPACITY_LERP;
        fvs.lastSeenFrame = fvs.frameCount;
      } else {
        // Fade out with persistence
        const framesSinceLastSeen = fvs.frameCount - fvs.lastSeenFrame;
        if (framesSinceLastSeen > FINGER_PERSISTENCE_FRAMES) {
          fvs.opacity += (0 - fvs.opacity) * FINGER_OPACITY_LERP;
        }
      }

      // Only draw if opacity is visible
      if (fvs.opacity > 0.05) {
        const alpha = fvs.opacity;

        // Draw line between thumb and index (single color)
        ctx.strokeStyle = `rgba(255, 255, 255, ${alpha * 0.6})`;
        ctx.lineWidth = 2;
        ctx.beginPath();
        ctx.moveTo(fvs.thumbX, fvs.thumbY);
        ctx.lineTo(fvs.indexX, fvs.indexY);
        ctx.stroke();

        // Draw thumb (magenta) with fade
        ctx.fillStyle = `rgba(255, 0, 255, ${alpha})`;
        ctx.shadowColor = `rgba(255, 0, 255, ${alpha})`;
        ctx.shadowBlur = 15 * alpha;
        ctx.beginPath();
        ctx.arc(fvs.thumbX, fvs.thumbY, 10, 0, Math.PI * 2);
        ctx.fill();

        // Draw index (cyan) with fade
        ctx.fillStyle = `rgba(0, 255, 255, ${alpha})`;
        ctx.shadowColor = `rgba(0, 255, 255, ${alpha})`;
        ctx.beginPath();
        ctx.arc(fvs.indexX, fvs.indexY, 10, 0, Math.PI * 2);
        ctx.fill();

        ctx.shadowBlur = 0;
      }

      animationId = requestAnimationFrame(gameLoop);
    };

    animationId = requestAnimationFrame(gameLoop);

    return () => cancelAnimationFrame(animationId);
  }, [isRunning, handsRef, videoRef, handleProjectileCollision]);

  // Reset on start
  useEffect(() => {
    if (isRunning) {
      resetGame();
    }
  }, [isRunning, resetGame]);

  return (
    <div className="relative" style={{ width: CANVAS_WIDTH, height: CANVAS_HEIGHT }}>
      <canvas
        ref={canvasRef}
        width={CANVAS_WIDTH}
        height={CANVAS_HEIGHT}
        className="rounded-xl shadow-2xl"
        style={{
          boxShadow: '0 0 40px rgba(255, 100, 0, 0.3), 0 0 80px rgba(0, 255, 255, 0.1)',
        }}
      />

      {/* Reset button */}
      {isRunning && (
        <button
          onClick={resetGame}
          className="absolute top-3 right-3 px-3 py-1.5 bg-orange-600 hover:bg-orange-500 text-white text-sm font-medium rounded-lg transition-colors shadow-lg"
        >
          Reset
        </button>
      )}

      {/* Not running overlay */}
      {!isRunning && (
        <div className="absolute inset-0 flex items-center justify-center bg-black/80 rounded-xl">
          <div className="text-center">
            <h2 className="text-2xl font-bold text-orange-400 mb-2">BUBBLE SHOOTER</h2>
            <p className="text-gray-400">Start detection to play</p>
          </div>
        </div>
      )}
    </div>
  );
}
