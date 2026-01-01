'use client';

import { useCallback, useRef, useState, RefObject } from 'react';
import type { DetectedHand } from '@/types/hand-detection';
import type { PinchState, Vector2D, GameConfig } from '../types';
import { DEFAULT_CONFIG } from '../types';

interface VideoDimensions {
  width: number;
  height: number;
}

interface UsePinchGestureReturn {
  pinchState: PinchState;
  pinchStateRef: RefObject<PinchState>;
  updatePinch: (hands: DetectedHand[], canvasRect: DOMRect, videoDimensions?: VideoDimensions) => PinchState;
  resetPinch: () => void;
}

const INITIAL_PINCH_STATE: PinchState = {
  isPinching: false,
  startPosition: null,
  currentPosition: null,
  pullVector: null,
};

export function usePinchGesture(config: GameConfig = DEFAULT_CONFIG): UsePinchGestureReturn {
  const [pinchState, setPinchState] = useState<PinchState>(INITIAL_PINCH_STATE);

  // Ref for synchronous access in game loop
  const pinchStateRef = useRef<PinchState>(INITIAL_PINCH_STATE);
  const wasPinchingRef = useRef(false);

  const updatePinch = useCallback(
    (hands: DetectedHand[], canvasRect: DOMRect, videoDimensions?: VideoDimensions): PinchState => {
      let newState = pinchStateRef.current;

      if (hands.length === 0) {
        if (wasPinchingRef.current) {
          // Released pinch
          wasPinchingRef.current = false;
          newState = {
            ...pinchStateRef.current,
            isPinching: false,
          };
          pinchStateRef.current = newState;
          setPinchState(newState);
        }
        return pinchStateRef.current;
      }

      const hand = hands[0];
      const thumbTip = hand.landmarks[4]; // THUMB_TIP
      const indexTip = hand.landmarks[8]; // INDEX_TIP

      // Calculate distance between thumb and index (normalized)
      const dx = thumbTip.x - indexTip.x;
      const dy = thumbTip.y - indexTip.y;
      const distance = Math.sqrt(dx * dx + dy * dy);

      const isPinching = distance < config.pinchThreshold;

      // Use actual video dimensions if provided, otherwise default to common webcam resolution
      const videoWidth = videoDimensions?.width ?? 640;
      const videoHeight = videoDimensions?.height ?? 480;

      // Video is drawn with "cover" scaling, meaning it may be cropped
      // We need to adjust coordinates to account for the cropping
      const videoAspect = videoWidth / videoHeight;
      const canvasAspect = canvasRect.width / canvasRect.height;

      let pinchX: number;
      let pinchY: number;

      const avgX = (thumbTip.x + indexTip.x) / 2;
      const avgY = (thumbTip.y + indexTip.y) / 2;

      if (videoAspect > canvasAspect) {
        // Video is wider than canvas - X is cropped
        // Calculate visible X range in normalized video coords
        const scaledWidth = canvasRect.height * videoAspect; // Video width when scaled to canvas height
        const cropAmount = (scaledWidth - canvasRect.width) / 2; // Pixels cropped on each side
        const visibleStart = cropAmount / scaledWidth; // ~0.25 for 500x750
        const visibleRange = canvasRect.width / scaledWidth; // ~0.5

        // Remap X from video coords to canvas coords
        const remappedX = (avgX - visibleStart) / visibleRange;
        pinchX = (1 - remappedX) * canvasRect.width; // Mirror X
        pinchY = avgY * canvasRect.height; // Y is not cropped
      } else {
        // Video is taller than canvas - Y is cropped
        const scaledHeight = canvasRect.width / videoAspect;
        const cropAmount = (scaledHeight - canvasRect.height) / 2;
        const visibleStart = cropAmount / scaledHeight;
        const visibleRange = canvasRect.height / scaledHeight;

        pinchX = (1 - avgX) * canvasRect.width;
        const remappedY = (avgY - visibleStart) / visibleRange;
        pinchY = remappedY * canvasRect.height;
      }

      // Clamp to canvas bounds
      pinchX = Math.max(0, Math.min(canvasRect.width, pinchX));
      pinchY = Math.max(0, Math.min(canvasRect.height, pinchY));

      const currentPosition: Vector2D = { x: pinchX, y: pinchY };

      if (isPinching && !wasPinchingRef.current) {
        // Started pinching
        wasPinchingRef.current = true;
        newState = {
          isPinching: true,
          startPosition: currentPosition,
          currentPosition,
          pullVector: { x: 0, y: 0 },
        };
      } else if (isPinching && wasPinchingRef.current) {
        // Continuing pinch - update position
        const prevState = pinchStateRef.current;
        if (prevState.startPosition) {
          const pullVector: Vector2D = {
            x: prevState.startPosition.x - currentPosition.x,
            y: prevState.startPosition.y - currentPosition.y,
          };
          newState = {
            ...prevState,
            currentPosition,
            pullVector,
          };
        }
      } else if (!isPinching && wasPinchingRef.current) {
        // Released pinch
        wasPinchingRef.current = false;
        newState = {
          ...pinchStateRef.current,
          isPinching: false,
        };
      }

      // Update ref synchronously for immediate access
      pinchStateRef.current = newState;
      // Update state for React re-renders
      setPinchState(newState);

      return newState;
    },
    [config.pinchThreshold]
  );

  const resetPinch = useCallback(() => {
    wasPinchingRef.current = false;
    pinchStateRef.current = INITIAL_PINCH_STATE;
    setPinchState(INITIAL_PINCH_STATE);
  }, []);

  return {
    pinchState,
    pinchStateRef,
    updatePinch,
    resetPinch,
  };
}
