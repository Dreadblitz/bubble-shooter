import type { Bubble, BubbleColor, GameConfig } from '../types';
import { BUBBLE_COLORS } from '../types';
import { gridToPosition } from './physics';

let bubbleIdCounter = 0;

function generateBubbleId(): string {
  return `bubble-${++bubbleIdCounter}`;
}

export function getRandomColor(): BubbleColor {
  return BUBBLE_COLORS[Math.floor(Math.random() * BUBBLE_COLORS.length)];
}

export function createBubble(
  row: number,
  col: number,
  color: BubbleColor,
  config: GameConfig
): Bubble {
  const position = gridToPosition(row, col, config);
  return {
    id: generateBubbleId(),
    color,
    position,
    row,
    col,
    radius: config.bubbleRadius,
  };
}

export function createInitialGrid(
  rows: number,
  config: GameConfig
): Bubble[] {
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

export function addBubbleToGrid(
  bubbles: Bubble[],
  row: number,
  col: number,
  color: BubbleColor,
  config: GameConfig
): Bubble[] {
  // Check if position is already occupied
  const existing = bubbles.find((b) => b.row === row && b.col === col);
  if (existing) {
    return bubbles;
  }

  const newBubble = createBubble(row, col, color, config);
  return [...bubbles, newBubble];
}

export function findMatches(
  bubbles: Bubble[],
  startRow: number,
  startCol: number,
  color: BubbleColor
): Bubble[] {
  const matches: Set<string> = new Set();
  const toCheck: Array<{ row: number; col: number }> = [{ row: startRow, col: startCol }];

  const bubbleMap = new Map<string, Bubble>();
  bubbles.forEach((b) => {
    bubbleMap.set(`${b.row},${b.col}`, b);
  });

  while (toCheck.length > 0) {
    const current = toCheck.pop()!;
    const key = `${current.row},${current.col}`;

    if (matches.has(key)) continue;

    const bubble = bubbleMap.get(key);
    if (!bubble || bubble.color !== color) continue;

    matches.add(key);

    // Get neighbors (hexagonal grid)
    const neighbors = getNeighbors(current.row, current.col);
    neighbors.forEach((n) => {
      const nKey = `${n.row},${n.col}`;
      if (!matches.has(nKey)) {
        toCheck.push(n);
      }
    });
  }

  return Array.from(matches).map((key) => bubbleMap.get(key)!).filter(Boolean);
}

function getNeighbors(row: number, col: number): Array<{ row: number; col: number }> {
  const isOffsetRow = row % 2 === 1;

  if (isOffsetRow) {
    return [
      { row: row - 1, col },
      { row: row - 1, col: col + 1 },
      { row, col: col - 1 },
      { row, col: col + 1 },
      { row: row + 1, col },
      { row: row + 1, col: col + 1 },
    ];
  } else {
    return [
      { row: row - 1, col: col - 1 },
      { row: row - 1, col },
      { row, col: col - 1 },
      { row, col: col + 1 },
      { row: row + 1, col: col - 1 },
      { row: row + 1, col },
    ];
  }
}

export function removeMatches(bubbles: Bubble[], matches: Bubble[]): Bubble[] {
  const matchIds = new Set(matches.map((m) => m.id));
  return bubbles.filter((b) => !matchIds.has(b.id));
}

export function findFloatingBubbles(bubbles: Bubble[]): Bubble[] {
  // Find bubbles not connected to top row
  const connected: Set<string> = new Set();

  const bubbleMap = new Map<string, Bubble>();
  bubbles.forEach((b) => {
    bubbleMap.set(`${b.row},${b.col}`, b);
  });

  // Start from top row
  const toCheck: Array<{ row: number; col: number }> = [];
  bubbles.forEach((b) => {
    if (b.row === 0) {
      toCheck.push({ row: b.row, col: b.col });
    }
  });

  while (toCheck.length > 0) {
    const current = toCheck.pop()!;
    const key = `${current.row},${current.col}`;

    if (connected.has(key)) continue;
    if (!bubbleMap.has(key)) continue;

    connected.add(key);

    const neighbors = getNeighbors(current.row, current.col);
    neighbors.forEach((n) => {
      const nKey = `${n.row},${n.col}`;
      if (!connected.has(nKey) && bubbleMap.has(nKey)) {
        toCheck.push(n);
      }
    });
  }

  // Return bubbles not connected
  return bubbles.filter((b) => !connected.has(`${b.row},${b.col}`));
}

export function addNewRow(
  bubbles: Bubble[],
  config: GameConfig
): Bubble[] {
  // Shift all existing bubbles down by one row
  const shifted = bubbles.map((b) => {
    const newRow = b.row + 1;
    const newPosition = gridToPosition(newRow, b.col, config);
    return {
      ...b,
      row: newRow,
      position: newPosition,
    };
  });

  // Add new row at top (row 0 is never offset)
  const cols = config.gridColumns;

  for (let col = 0; col < cols; col++) {
    if (Math.random() < 0.7) {
      shifted.push(createBubble(0, col, getRandomColor(), config));
    }
  }

  return shifted;
}

export function checkGameOver(
  bubbles: Bubble[],
  config: GameConfig
): boolean {
  return bubbles.some((b) => b.position.y + b.radius > config.dangerLineY);
}

export function calculateDangerLevel(
  bubbles: Bubble[],
  config: GameConfig
): number {
  if (bubbles.length === 0) return 0;

  const lowestBubble = bubbles.reduce((lowest, b) =>
    b.position.y > lowest.position.y ? b : lowest
  );

  const maxSafeY = config.dangerLineY;
  const startDangerY = maxSafeY * 0.5;

  if (lowestBubble.position.y < startDangerY) return 0;
  if (lowestBubble.position.y >= maxSafeY) return 100;

  return Math.round(
    ((lowestBubble.position.y - startDangerY) / (maxSafeY - startDangerY)) * 100
  );
}
