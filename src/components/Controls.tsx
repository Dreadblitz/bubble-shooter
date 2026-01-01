'use client';

interface ControlsProps {
  isRunning: boolean;
  onToggle: () => void;
  showConnections: boolean;
  onShowConnectionsChange: (show: boolean) => void;
  showLandmarks: boolean;
  onShowLandmarksChange: (show: boolean) => void;
  isLoading?: boolean;
  disabled?: boolean;
}

export function Controls({
  isRunning,
  onToggle,
  showConnections,
  onShowConnectionsChange,
  showLandmarks,
  onShowLandmarksChange,
  isLoading = false,
  disabled = false,
}: ControlsProps) {
  return (
    <div className="bg-gray-900/80 backdrop-blur-sm rounded-xl p-4 space-y-4">
      <h2 className="text-lg font-semibold text-white border-b border-gray-700 pb-2">
        Controls
      </h2>

      {/* Start/Stop Button */}
      <button
        onClick={onToggle}
        disabled={disabled || isLoading}
        className={`w-full py-3 px-4 rounded-lg font-semibold text-white transition-all duration-200 ${
          isRunning
            ? 'bg-red-600 hover:bg-red-700 active:bg-red-800'
            : 'bg-green-600 hover:bg-green-700 active:bg-green-800'
        } disabled:opacity-50 disabled:cursor-not-allowed`}
      >
        {isLoading ? (
          <span className="flex items-center justify-center gap-2">
            <svg className="animate-spin h-5 w-5" viewBox="0 0 24 24">
              <circle
                className="opacity-25"
                cx="12"
                cy="12"
                r="10"
                stroke="currentColor"
                strokeWidth="4"
                fill="none"
              />
              <path
                className="opacity-75"
                fill="currentColor"
                d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z"
              />
            </svg>
            Loading MediaPipe...
          </span>
        ) : isRunning ? (
          'Stop Detection'
        ) : (
          'Start Detection'
        )}
      </button>

      {/* Toggle Options */}
      <div className="space-y-3">
        <label className="flex items-center justify-between cursor-pointer">
          <span className="text-gray-300">Show Connections</span>
          <div
            onClick={() => onShowConnectionsChange(!showConnections)}
            className={`relative w-12 h-6 rounded-full transition-colors duration-200 ${
              showConnections ? 'bg-green-600' : 'bg-gray-600'
            }`}
          >
            <div
              className={`absolute top-1 w-4 h-4 rounded-full bg-white transition-transform duration-200 ${
                showConnections ? 'translate-x-7' : 'translate-x-1'
              }`}
            />
          </div>
        </label>

        <label className="flex items-center justify-between cursor-pointer">
          <span className="text-gray-300">Show Landmarks</span>
          <div
            onClick={() => onShowLandmarksChange(!showLandmarks)}
            className={`relative w-12 h-6 rounded-full transition-colors duration-200 ${
              showLandmarks ? 'bg-green-600' : 'bg-gray-600'
            }`}
          >
            <div
              className={`absolute top-1 w-4 h-4 rounded-full bg-white transition-transform duration-200 ${
                showLandmarks ? 'translate-x-7' : 'translate-x-1'
              }`}
            />
          </div>
        </label>
      </div>

      {/* Legend */}
      <div className="border-t border-gray-700 pt-3">
        <h3 className="text-sm font-medium text-gray-400 mb-2">Finger Colors</h3>
        <div className="grid grid-cols-2 gap-1 text-xs">
          <div className="flex items-center gap-2">
            <div className="w-3 h-3 rounded-full bg-[#FF6B6B]" />
            <span className="text-gray-400">Thumb</span>
          </div>
          <div className="flex items-center gap-2">
            <div className="w-3 h-3 rounded-full bg-[#4ECDC4]" />
            <span className="text-gray-400">Index</span>
          </div>
          <div className="flex items-center gap-2">
            <div className="w-3 h-3 rounded-full bg-[#45B7D1]" />
            <span className="text-gray-400">Middle</span>
          </div>
          <div className="flex items-center gap-2">
            <div className="w-3 h-3 rounded-full bg-[#96CEB4]" />
            <span className="text-gray-400">Ring</span>
          </div>
          <div className="flex items-center gap-2">
            <div className="w-3 h-3 rounded-full bg-[#FFEAA7]" />
            <span className="text-gray-400">Pinky</span>
          </div>
        </div>
      </div>
    </div>
  );
}
