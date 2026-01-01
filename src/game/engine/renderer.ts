import type { Bubble, Projectile, GameState, GameConfig, Vector2D } from '../types';
import type { DetectedHand } from '@/types/hand-detection';
import { NEON_COLORS } from '../types';

export function renderGame(
  ctx: CanvasRenderingContext2D,
  state: GameState,
  config: GameConfig,
  trajectoryPoints: Vector2D[],
  video?: HTMLVideoElement | null,
  hands?: DetectedHand[]
): void {
  // Clear canvas with dark background
  ctx.fillStyle = '#0a0a0f';
  ctx.fillRect(0, 0, config.canvasWidth, config.canvasHeight);

  // Draw video as background (mirrored)
  if (video && video.readyState >= 2) {
    drawVideoBackground(ctx, video, config);
  }

  // Draw grid background glow (semi-transparent if video is present)
  drawBackgroundGlow(ctx, config, !!video);

  // Draw danger line
  drawDangerLine(ctx, state.dangerLevel, config);

  // Draw trajectory prediction
  if (state.phase === 'AIMING' && trajectoryPoints.length > 0) {
    drawTrajectory(ctx, trajectoryPoints);
  }

  // Draw bubbles
  state.bubbles.forEach((bubble) => {
    drawBubble(ctx, bubble);
  });

  // Draw projectile
  if (state.projectile) {
    drawProjectile(ctx, state.projectile);
  }

  // Draw launcher area
  drawLauncher(ctx, state, config);

  // Draw slingshot visualization
  if (state.phase === 'AIMING' && state.pinchState.startPosition && state.pinchState.currentPosition) {
    drawSlingshot(ctx, state.pinchState.startPosition, state.pinchState.currentPosition);
  }

  // Draw HUD
  drawHUD(ctx, state, config);

  // Draw hand detection status (always show)
  ctx.font = 'bold 16px monospace';
  ctx.textAlign = 'right';
  if (hands && hands.length > 0) {
    ctx.fillStyle = '#00ff00';
    ctx.fillText(`✓ ${hands.length} HAND(S) DETECTED`, config.canvasWidth - 10, config.canvasHeight - 60);
    const videoWidth = video?.videoWidth ?? 640;
    const videoHeight = video?.videoHeight ?? 480;
    drawHands(ctx, hands, config, videoWidth, videoHeight);
  } else {
    ctx.fillStyle = '#ff6600';
    ctx.fillText('⚠ NO HANDS - Show hand to camera', config.canvasWidth - 10, config.canvasHeight - 60);
  }
  ctx.textAlign = 'left';

  // Draw game over overlay
  if (state.phase === 'GAME_OVER') {
    drawGameOver(ctx, state, config);
  }
}

function drawVideoBackground(
  ctx: CanvasRenderingContext2D,
  video: HTMLVideoElement,
  config: GameConfig
): void {
  ctx.save();
  // Mirror the video horizontally
  ctx.translate(config.canvasWidth, 0);
  ctx.scale(-1, 1);

  // Calculate scaling to cover canvas while maintaining aspect ratio
  const videoAspect = video.videoWidth / video.videoHeight;
  const canvasAspect = config.canvasWidth / config.canvasHeight;

  let drawWidth: number;
  let drawHeight: number;
  let offsetX = 0;
  let offsetY = 0;

  if (videoAspect > canvasAspect) {
    // Video is wider - fit to height, crop sides
    drawHeight = config.canvasHeight;
    drawWidth = drawHeight * videoAspect;
    offsetX = (config.canvasWidth - drawWidth) / 2;
  } else {
    // Video is taller - fit to width, crop top/bottom
    drawWidth = config.canvasWidth;
    drawHeight = drawWidth / videoAspect;
    offsetY = (config.canvasHeight - drawHeight) / 2;
  }

  // Draw video with darkening overlay
  ctx.globalAlpha = 0.4;
  ctx.drawImage(video, offsetX, offsetY, drawWidth, drawHeight);
  ctx.globalAlpha = 1.0;
  ctx.restore();
}

// Helper function to convert video coords to canvas coords with aspect ratio correction
function videoToCanvasCoords(
  videoX: number,
  videoY: number,
  config: GameConfig,
  videoWidth: number = 640,
  videoHeight: number = 480
): { x: number; y: number } {
  const videoAspect = videoWidth / videoHeight;
  const canvasAspect = config.canvasWidth / config.canvasHeight;

  let x: number;
  let y: number;

  if (videoAspect > canvasAspect) {
    // Video wider than canvas - X is cropped
    const scaledWidth = config.canvasHeight * videoAspect;
    const cropAmount = (scaledWidth - config.canvasWidth) / 2;
    const visibleStart = cropAmount / scaledWidth;
    const visibleRange = config.canvasWidth / scaledWidth;

    const remappedX = (videoX - visibleStart) / visibleRange;
    x = (1 - remappedX) * config.canvasWidth;
    y = videoY * config.canvasHeight;
  } else {
    // Video taller than canvas - Y is cropped
    const scaledHeight = config.canvasWidth / videoAspect;
    const cropAmount = (scaledHeight - config.canvasHeight) / 2;
    const visibleStart = cropAmount / scaledHeight;
    const visibleRange = config.canvasHeight / scaledHeight;

    x = (1 - videoX) * config.canvasWidth;
    const remappedY = (videoY - visibleStart) / visibleRange;
    y = remappedY * config.canvasHeight;
  }

  // Clamp to canvas bounds
  x = Math.max(0, Math.min(config.canvasWidth, x));
  y = Math.max(0, Math.min(config.canvasHeight, y));

  return { x, y };
}

function drawHands(
  ctx: CanvasRenderingContext2D,
  hands: DetectedHand[],
  config: GameConfig,
  videoWidth: number = 640,
  videoHeight: number = 480
): void {
  hands.forEach((hand) => {
    const thumbTip = hand.landmarks[4];
    const indexTip = hand.landmarks[8];

    // Calculate pinch distance
    const dx = thumbTip.x - indexTip.x;
    const dy = thumbTip.y - indexTip.y;
    const distance = Math.sqrt(dx * dx + dy * dy);
    const isPinching = distance < config.pinchThreshold;

    // Convert to canvas coordinates with aspect ratio correction
    const thumb = videoToCanvasCoords(thumbTip.x, thumbTip.y, config, videoWidth, videoHeight);
    const index = videoToCanvasCoords(indexTip.x, indexTip.y, config, videoWidth, videoHeight);
    const thumbX = thumb.x;
    const thumbY = thumb.y;
    const indexX = index.x;
    const indexY = index.y;

    // Draw line between thumb and index
    ctx.strokeStyle = isPinching ? 'rgba(0, 255, 0, 0.8)' : 'rgba(255, 100, 0, 0.6)';
    ctx.lineWidth = isPinching ? 3 : 2;
    ctx.beginPath();
    ctx.moveTo(thumbX, thumbY);
    ctx.lineTo(indexX, indexY);
    ctx.stroke();

    // Draw thumb tip
    ctx.fillStyle = '#ff00ff';
    ctx.shadowColor = '#ff00ff';
    ctx.shadowBlur = 15;
    ctx.beginPath();
    ctx.arc(thumbX, thumbY, 10, 0, Math.PI * 2);
    ctx.fill();

    // Draw index tip
    ctx.fillStyle = '#00ffff';
    ctx.shadowColor = '#00ffff';
    ctx.beginPath();
    ctx.arc(indexX, indexY, 10, 0, Math.PI * 2);
    ctx.fill();

    ctx.shadowBlur = 0;

    // DEBUG: Show pinch distance and position
    ctx.font = '14px monospace';
    ctx.fillStyle = isPinching ? '#00ff00' : '#ff6600';
    ctx.textAlign = 'left';
    ctx.fillText(`Pinch dist: ${distance.toFixed(3)} (th: ${config.pinchThreshold})`, 10, 60);
    ctx.fillText(isPinching ? 'PINCHING!' : 'Not pinching', 10, 78);

    // Show raw normalized positions
    ctx.fillStyle = '#aaaaaa';
    ctx.fillText(`Raw thumb: (${thumbTip.x.toFixed(2)}, ${thumbTip.y.toFixed(2)})`, 250, 60);
    ctx.fillText(`Raw index: (${indexTip.x.toFixed(2)}, ${indexTip.y.toFixed(2)})`, 250, 78);

    // Draw pinch center marker
    const centerX = (thumbX + indexX) / 2;
    const centerY = (thumbY + indexY) / 2;

    // Check if in launcher zone
    const launcherZone = config.canvasHeight * 0.5;
    const isInLauncherZone = centerY > launcherZone;

    ctx.strokeStyle = isInLauncherZone ? '#00ff00' : '#ffff00';
    ctx.lineWidth = isInLauncherZone ? 3 : 2;
    ctx.beginPath();
    ctx.moveTo(centerX - 15, centerY);
    ctx.lineTo(centerX + 15, centerY);
    ctx.moveTo(centerX, centerY - 15);
    ctx.lineTo(centerX, centerY + 15);
    ctx.stroke();

    // Show if ready to aim
    if (isPinching && isInLauncherZone) {
      ctx.fillStyle = '#00ff00';
      ctx.fillText('READY TO AIM!', 10, 190);
    } else if (isPinching && !isInLauncherZone) {
      ctx.fillStyle = '#ff6600';
      ctx.fillText('Move hand lower to aim', 10, 190);
    }
  });
}

function drawBackgroundGlow(ctx: CanvasRenderingContext2D, config: GameConfig, hasVideo: boolean): void {
  const gradient = ctx.createRadialGradient(
    config.canvasWidth / 2,
    config.canvasHeight / 3,
    0,
    config.canvasWidth / 2,
    config.canvasHeight / 3,
    config.canvasWidth
  );
  const alpha = hasVideo ? 0.3 : 0.15;
  gradient.addColorStop(0, `rgba(100, 0, 150, ${alpha})`);
  gradient.addColorStop(1, 'rgba(0, 0, 0, 0)');
  ctx.fillStyle = gradient;
  ctx.fillRect(0, 0, config.canvasWidth, config.canvasHeight);
}

function drawDangerLine(
  ctx: CanvasRenderingContext2D,
  dangerLevel: number,
  config: GameConfig
): void {
  const alpha = 0.3 + (dangerLevel / 100) * 0.5;
  const pulseIntensity = dangerLevel > 50 ? Math.sin(Date.now() / 200) * 0.3 + 0.7 : 1;

  ctx.strokeStyle = `rgba(255, 0, 50, ${alpha * pulseIntensity})`;
  ctx.lineWidth = 2;
  ctx.setLineDash([10, 10]);
  ctx.beginPath();
  ctx.moveTo(0, config.dangerLineY);
  ctx.lineTo(config.canvasWidth, config.dangerLineY);
  ctx.stroke();
  ctx.setLineDash([]);

  // DEBUG: Draw launcher zone line (pinch must start below this line)
  const launcherZone = config.canvasHeight * 0.5;
  ctx.strokeStyle = 'rgba(0, 255, 255, 0.3)';
  ctx.lineWidth = 1;
  ctx.setLineDash([5, 5]);
  ctx.beginPath();
  ctx.moveTo(0, launcherZone);
  ctx.lineTo(config.canvasWidth, launcherZone);
  ctx.stroke();
  ctx.setLineDash([]);

  // Danger zone gradient
  if (dangerLevel > 0) {
    const gradient = ctx.createLinearGradient(0, config.dangerLineY, 0, config.canvasHeight);
    gradient.addColorStop(0, `rgba(255, 0, 50, ${dangerLevel / 300})`);
    gradient.addColorStop(1, 'rgba(255, 0, 50, 0)');
    ctx.fillStyle = gradient;
    ctx.fillRect(0, config.dangerLineY, config.canvasWidth, config.canvasHeight - config.dangerLineY);
  }
}

function drawTrajectory(ctx: CanvasRenderingContext2D, points: Vector2D[]): void {
  ctx.strokeStyle = 'rgba(255, 255, 255, 0.3)';
  ctx.lineWidth = 2;
  ctx.setLineDash([5, 5]);
  ctx.beginPath();
  points.forEach((point, i) => {
    if (i === 0) {
      ctx.moveTo(point.x, point.y);
    } else {
      ctx.lineTo(point.x, point.y);
    }
  });
  ctx.stroke();
  ctx.setLineDash([]);

  // Draw dots at intervals
  points.forEach((point, i) => {
    if (i % 5 === 0) {
      ctx.fillStyle = 'rgba(255, 255, 255, 0.5)';
      ctx.beginPath();
      ctx.arc(point.x, point.y, 3, 0, Math.PI * 2);
      ctx.fill();
    }
  });
}

function drawBubble(ctx: CanvasRenderingContext2D, bubble: Bubble): void {
  const colors = NEON_COLORS[bubble.color];

  // Outer glow
  ctx.shadowColor = colors.glow;
  ctx.shadowBlur = 15;

  // Main bubble
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
  ctx.arc(bubble.position.x, bubble.position.y, bubble.radius - 2, 0, Math.PI * 2);
  ctx.fill();

  // Highlight
  ctx.shadowBlur = 0;
  ctx.fillStyle = 'rgba(255, 255, 255, 0.4)';
  ctx.beginPath();
  ctx.arc(
    bubble.position.x - bubble.radius * 0.3,
    bubble.position.y - bubble.radius * 0.3,
    bubble.radius * 0.3,
    0,
    Math.PI * 2
  );
  ctx.fill();
}

function drawProjectile(ctx: CanvasRenderingContext2D, projectile: Projectile): void {
  const colors = NEON_COLORS[projectile.color];

  // Motion blur effect
  ctx.shadowColor = colors.glow;
  ctx.shadowBlur = 20;

  ctx.fillStyle = colors.fill;
  ctx.beginPath();
  ctx.arc(projectile.position.x, projectile.position.y, projectile.radius, 0, Math.PI * 2);
  ctx.fill();

  ctx.shadowBlur = 0;
}

function drawLauncher(
  ctx: CanvasRenderingContext2D,
  state: GameState,
  config: GameConfig
): void {
  const launcherX = config.canvasWidth / 2;
  const launcherY = config.launcherY;

  // Launcher base
  ctx.strokeStyle = 'rgba(255, 255, 255, 0.3)';
  ctx.lineWidth = 2;
  ctx.beginPath();
  ctx.arc(launcherX, launcherY, 30, 0, Math.PI * 2);
  ctx.stroke();

  // Next bubble preview
  if (state.phase !== 'SHOOTING' && state.phase !== 'GAME_OVER') {
    const colors = NEON_COLORS[state.nextBubbleColor];
    ctx.shadowColor = colors.glow;
    ctx.shadowBlur = 10;
    ctx.fillStyle = colors.fill;
    ctx.beginPath();
    ctx.arc(launcherX, launcherY, config.bubbleRadius, 0, Math.PI * 2);
    ctx.fill();
    ctx.shadowBlur = 0;
  }
}

function drawSlingshot(
  ctx: CanvasRenderingContext2D,
  start: Vector2D,
  current: Vector2D
): void {
  // Elastic band effect
  ctx.strokeStyle = 'rgba(255, 100, 100, 0.8)';
  ctx.lineWidth = 3;
  ctx.beginPath();
  ctx.moveTo(start.x - 15, start.y);
  ctx.lineTo(current.x, current.y);
  ctx.lineTo(start.x + 15, start.y);
  ctx.stroke();

  // Pull indicator circle
  ctx.fillStyle = 'rgba(255, 255, 255, 0.5)';
  ctx.beginPath();
  ctx.arc(current.x, current.y, 10, 0, Math.PI * 2);
  ctx.fill();
}

function drawHUD(
  ctx: CanvasRenderingContext2D,
  state: GameState,
  config: GameConfig
): void {
  // Score
  ctx.font = 'bold 24px "Courier New", monospace';
  ctx.fillStyle = '#00ffff';
  ctx.shadowColor = '#00ffff';
  ctx.shadowBlur = 10;
  ctx.textAlign = 'left';
  ctx.fillText(`SCORE: ${state.score}`, 10, 30);

  // Danger indicator
  if (state.dangerLevel > 0) {
    ctx.fillStyle = state.dangerLevel > 70 ? '#ff0044' : '#ffaa00';
    ctx.shadowColor = ctx.fillStyle;
    ctx.textAlign = 'right';
    ctx.fillText(`DANGER: ${state.dangerLevel}%`, config.canvasWidth - 10, 30);
  }

  ctx.shadowBlur = 0;

  // DEBUG: Game phase and pinch state
  ctx.font = '12px monospace';
  ctx.textAlign = 'left';
  ctx.fillStyle = '#ffffff';
  ctx.fillText(`Phase: ${state.phase}`, 10, 100);
  ctx.fillText(`Pinching: ${state.pinchState.isPinching}`, 10, 115);
  if (state.pinchState.startPosition) {
    ctx.fillText(`Start: (${state.pinchState.startPosition.x.toFixed(0)}, ${state.pinchState.startPosition.y.toFixed(0)})`, 10, 130);
  }
  if (state.pinchState.currentPosition) {
    ctx.fillText(`Current: (${state.pinchState.currentPosition.x.toFixed(0)}, ${state.pinchState.currentPosition.y.toFixed(0)})`, 10, 145);
  }
  if (state.pinchState.pullVector) {
    ctx.fillText(`Pull: (${state.pinchState.pullVector.x.toFixed(0)}, ${state.pinchState.pullVector.y.toFixed(0)})`, 10, 160);
  }
  const launcherZone = config.canvasHeight * 0.5;
  ctx.fillStyle = '#ffff00';
  ctx.fillText(`Launcher zone: y > ${launcherZone}`, 10, 175);

  // Instructions
  if (state.phase === 'IDLE') {
    ctx.font = '14px "Courier New", monospace';
    ctx.fillStyle = 'rgba(255, 255, 255, 0.6)';
    ctx.textAlign = 'center';
    ctx.fillText('PINCH to grab bubble, PULL back, RELEASE to shoot', config.canvasWidth / 2, config.canvasHeight - 20);
  }
}

function drawGameOver(
  ctx: CanvasRenderingContext2D,
  state: GameState,
  config: GameConfig
): void {
  // Dark overlay
  ctx.fillStyle = 'rgba(0, 0, 0, 0.8)';
  ctx.fillRect(0, 0, config.canvasWidth, config.canvasHeight);

  // Game Over text
  ctx.font = 'bold 48px "Courier New", monospace';
  ctx.fillStyle = '#ff0044';
  ctx.shadowColor = '#ff0044';
  ctx.shadowBlur = 20;
  ctx.textAlign = 'center';
  ctx.fillText('GAME OVER', config.canvasWidth / 2, config.canvasHeight / 2 - 40);

  // Final score
  ctx.font = 'bold 32px "Courier New", monospace';
  ctx.fillStyle = '#00ffff';
  ctx.shadowColor = '#00ffff';
  ctx.fillText(`FINAL SCORE: ${state.score}`, config.canvasWidth / 2, config.canvasHeight / 2 + 20);

  // Restart instruction
  ctx.font = '18px "Courier New", monospace';
  ctx.fillStyle = 'rgba(255, 255, 255, 0.7)';
  ctx.shadowBlur = 0;
  ctx.fillText('Click to restart', config.canvasWidth / 2, config.canvasHeight / 2 + 70);
}
