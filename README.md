# MediaPipe Hand Detection Demo

Real-time hand tracking demo using MediaPipe and Next.js with a modern UI.

## Features

- Real-time hand detection with 21 landmarks per hand
- Support for up to 2 hands simultaneously
- Color-coded finger visualization
- FPS counter and statistics panel
- Toggle connections and landmarks visibility
- Responsive design (desktop + tablet)

## Tech Stack

| Layer | Technology |
|-------|------------|
| Framework | Next.js 16 (App Router) |
| Language | TypeScript |
| Styling | Tailwind CSS |
| ML | @mediapipe/tasks-vision |

## Getting Started

```bash
# Install dependencies
npm install

# Run development server
npm run dev

# Build for production
npm run build
npm start
```

Open [http://localhost:3000](http://localhost:3000) in your browser.

## Usage

1. Click **Start Detection** to enable camera and hand tracking
2. Show your hands to the camera
3. Toggle **Show Connections** / **Show Landmarks** in Controls panel
4. View real-time statistics in Stats panel

## Project Structure

```
src/
├── app/
│   └── page.tsx          # Main page component
├── components/
│   ├── Controls.tsx      # Control panel UI
│   ├── HandCanvas.tsx    # Canvas overlay for landmarks
│   └── Stats.tsx         # Statistics display
├── hooks/
│   ├── useCamera.ts      # Webcam access hook
│   └── useHandDetection.ts # MediaPipe integration hook
└── types/
    └── hand-detection.ts # TypeScript types
```

## Requirements

- Modern browser with WebGL support
- Camera access permission
- Works best on desktop/laptop with webcam

## License

MIT
