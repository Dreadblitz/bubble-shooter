import type { Projectile, Vector2D, GameConfig, Bubble } from '../types';

export function updateProjectile(
  projectile: Projectile,
  config: GameConfig,
  bubbles: Bubble[]
): { projectile: Projectile | null; collision: { row: number; col: number } | null } {
  // Update position
  const newPosition: Vector2D = {
    x: projectile.position.x + projectile.velocity.x,
    y: projectile.position.y + projectile.velocity.y,
  };

  const newVelocity = { ...projectile.velocity };

  // Wall collisions (left/right bounce)
  if (newPosition.x - projectile.radius < 0) {
    newPosition.x = projectile.radius;
    newVelocity.x = -projectile.velocity.x;
  } else if (newPosition.x + projectile.radius > config.canvasWidth) {
    newPosition.x = config.canvasWidth - projectile.radius;
    newVelocity.x = -projectile.velocity.x;
  }

  // Top wall collision - snap to grid
  if (newPosition.y - projectile.radius < 0) {
    const gridPos = getGridPosition(newPosition, config);
    return {
      projectile: null,
      collision: gridPos,
    };
  }

  // Check collision with existing bubbles
  for (const bubble of bubbles) {
    const dx = newPosition.x - bubble.position.x;
    const dy = newPosition.y - bubble.position.y;
    const distance = Math.sqrt(dx * dx + dy * dy);

    if (distance < projectile.radius + bubble.radius - 2) {
      // Collision detected - snap to nearest grid position
      const gridPos = getGridPosition(newPosition, config);
      return {
        projectile: null,
        collision: gridPos,
      };
    }
  }

  return {
    projectile: {
      ...projectile,
      position: newPosition,
      velocity: newVelocity,
    },
    collision: null,
  };
}

export function getGridPosition(
  position: Vector2D,
  config: GameConfig
): { row: number; col: number } {
  const bubbleDiameter = config.bubbleRadius * 2;
  const rowHeight = bubbleDiameter * 0.866; // sqrt(3)/2 for hexagonal

  // Calculate grid width and center offset (same as gridToPosition)
  const gridWidth = config.gridColumns * bubbleDiameter;
  const centerOffset = (config.canvasWidth - gridWidth) / 2;

  const row = Math.max(0, Math.floor(position.y / rowHeight));
  const isOffsetRow = row % 2 === 1;
  const rowOffset = isOffsetRow ? config.bubbleRadius : 0;

  // Adjust for center offset when calculating column
  let col = Math.floor((position.x - centerOffset - rowOffset) / bubbleDiameter);
  col = Math.max(0, Math.min(col, config.gridColumns - 1 - (isOffsetRow ? 1 : 0)));

  return { row, col };
}

export function gridToPosition(
  row: number,
  col: number,
  config: GameConfig
): Vector2D {
  const bubbleDiameter = config.bubbleRadius * 2;
  const rowHeight = bubbleDiameter * 0.866;
  const isOffsetRow = row % 2 === 1;
  const rowOffset = isOffsetRow ? config.bubbleRadius : 0;

  // Calculate grid width and center it
  const gridWidth = config.gridColumns * bubbleDiameter;
  const centerOffset = (config.canvasWidth - gridWidth) / 2;

  return {
    x: col * bubbleDiameter + config.bubbleRadius + rowOffset + centerOffset,
    y: row * rowHeight + config.bubbleRadius,
  };
}

export function calculateLaunchVelocity(
  pullVector: Vector2D,
  config: GameConfig
): Vector2D {
  const magnitude = Math.sqrt(pullVector.x * pullVector.x + pullVector.y * pullVector.y);

  if (magnitude < config.minPullDistance) {
    return { x: 0, y: 0 };
  }

  // Normalize and scale
  const normalizedX = pullVector.x / magnitude;
  const normalizedY = pullVector.y / magnitude;

  // Clamp the magnitude multiplier
  const speedMultiplier = Math.min(magnitude / 100, 1.5);

  return {
    x: normalizedX * config.projectileSpeed * speedMultiplier,
    y: normalizedY * config.projectileSpeed * speedMultiplier,
  };
}

export function predictTrajectory(
  startPosition: Vector2D,
  velocity: Vector2D,
  config: GameConfig,
  steps: number = 50
): Vector2D[] {
  const points: Vector2D[] = [];
  let pos = { ...startPosition };
  const vel = { ...velocity };

  for (let i = 0; i < steps; i++) {
    pos = {
      x: pos.x + vel.x,
      y: pos.y + vel.y,
    };

    // Wall bounces
    if (pos.x < config.bubbleRadius || pos.x > config.canvasWidth - config.bubbleRadius) {
      vel.x = -vel.x;
    }

    // Stop at top
    if (pos.y < config.bubbleRadius) {
      points.push({ ...pos });
      break;
    }

    points.push({ ...pos });
  }

  return points;
}
