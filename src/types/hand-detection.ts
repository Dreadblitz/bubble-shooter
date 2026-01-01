export interface HandLandmark {
  x: number;
  y: number;
  z: number;
}

export interface DetectedHand {
  landmarks: HandLandmark[];
  worldLandmarks: HandLandmark[];
  handedness: 'Left' | 'Right';
  score: number;
}

export interface DetectionResult {
  hands: DetectedHand[];
  timestamp: number;
}

export interface DetectionConfig {
  maxHands: number;
  minDetectionConfidence: number;
  minTrackingConfidence: number;
}

export interface CameraConfig {
  width: number;
  height: number;
  facingMode: 'user' | 'environment';
}

export const HAND_CONNECTIONS: [number, number][] = [
  // Thumb
  [0, 1], [1, 2], [2, 3], [3, 4],
  // Index
  [0, 5], [5, 6], [6, 7], [7, 8],
  // Middle
  [0, 9], [9, 10], [10, 11], [11, 12],
  // Ring
  [0, 13], [13, 14], [14, 15], [15, 16],
  // Pinky
  [0, 17], [17, 18], [18, 19], [19, 20],
  // Palm
  [5, 9], [9, 13], [13, 17],
];

export const LANDMARK_NAMES: Record<number, string> = {
  0: 'WRIST',
  1: 'THUMB_CMC',
  2: 'THUMB_MCP',
  3: 'THUMB_IP',
  4: 'THUMB_TIP',
  5: 'INDEX_MCP',
  6: 'INDEX_PIP',
  7: 'INDEX_DIP',
  8: 'INDEX_TIP',
  9: 'MIDDLE_MCP',
  10: 'MIDDLE_PIP',
  11: 'MIDDLE_DIP',
  12: 'MIDDLE_TIP',
  13: 'RING_MCP',
  14: 'RING_PIP',
  15: 'RING_DIP',
  16: 'RING_TIP',
  17: 'PINKY_MCP',
  18: 'PINKY_PIP',
  19: 'PINKY_DIP',
  20: 'PINKY_TIP',
};
