# Robot Builder Studio

Robot Builder Studio is a desktop-focused kinematic visualization and control environment built with Electron, React, and Three.js. It provides an interactive scene editor for robot manipulators, live joint controls, and a TCP socket bridge for external motion inputs.

## Getting Started

### Prerequisites

- Node.js 18+
- npm 9+

### Install dependencies

```bash
npm install
```

### Development

Run the renderer dev server and launch the Electron shell:

```bash
npm run dev
```

The command runs Vite and automatically opens the Electron window once the dev server is ready.

### Build static assets

```bash
npm run build
```

This generates the Vite production bundle in the `dist/` directory. Packaging for distribution can be added later (e.g., with `electron-builder`).

## Features

- **3D Scene Workspace** – Real-time Three.js viewport with orbit controls, grid, and recursive link rendering.
- **Link Hierarchy & Inspector** – Select any link to tune geometry, offsets, joint configuration, and notes.
- **Motion Control Panel** – Slider per joint with min/max enforcement, unit display, and external control toggles.
- **TCP Bridge** – Electron main process hosts a TCP server on port 5555 that streams joint updates to the renderer. Incoming JSON/CSV-style payloads (terminated by newlines) update joints that opt into external control.
- **Persistence** – Save the entire scene graph to disk or reload a JSON project using native OS dialogs.
- **Status Bar** – Displays TCP state, current FPS, and highlighted selection metadata.

## TCP Message Format

Send newline-terminated payloads to port `5555`.

- **JSON:**
  ```json
  { "joint-1": 45, "joint-2": 12.5 }
  ```
- **Delimited:**
  ```text
  joint-1=45,joint-2=12.5
  ```

If a joint has its "Enable TCP control" checkbox enabled, the incoming value is clamped to the configured limits and applied instantly. Remote updates also refresh the TCP status indicator.

## Scene Export Format

Scenes serialize to JSON with the following shape:

```json
{
  "rootId": "link-1",
  "nodes": {
    "link-1": {
      "id": "link-1",
      "name": "Base",
      "geometry": { "kind": "box", "width": 0.5, "height": 0.2, "depth": 0.5 },
      "color": "#64748b",
      "children": ["link-2"],
      "baseOffset": [0, 0, 0]
    }
  }
}
```

Each child link stores its parent reference, mount offset, joint definition (if applicable), and optional notes.

## Roadmap Ideas

- Undo/redo stack for authoring.
- Physics preview and collision helpers.
- Alternative protocol adapters (ROS, WebSocket, gRPC).
- Keyframe animation timelines and IK solvers.

Contributions and feedback are welcome!
