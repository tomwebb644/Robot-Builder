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

This generates the Vite production bundle in the `dist/` directory.

### Package a Windows executable

Install dependencies (once) and run the dist script to produce both an installer and a portable 64-bit build:

```bash
npm run dist
```

The command chains the renderer production build and `electron-builder` packaging. After it finishes you'll find:

- `Robot Builder Studio Setup <version>.exe` — an NSIS installer suitable for end users.
- `Robot Builder Studio <version>.exe` — a portable executable that runs without installation.

Both artifacts live in the `release/` directory alongside the unpacked app folder.

## Features

- **3D Scene Workspace** – Real-time Three.js viewport with orbit controls, a Z-up world frame, and recursive link rendering. Selected joints render motion arcs/rails for instant visual feedback.
- **Inspector-Driven Offsets** – Adjust geometry, base offsets, joint pivots, and limits numerically with scrollable/typed inputs—no accidental viewport dragging.
- **Static Orientation Controls** – Apply persistent roll/pitch/yaw offsets per link so complex subassemblies start from the correct pose without consuming joint travel.
- **Link Hierarchy & Inspector** – Select any link to tune geometry, offsets, joint configuration, and notes, or remove entire subtrees safely.
- **Custom Geometry Pipeline** – Import STL meshes directly from the toolbar or inspector; meshes are centered, scaled, and stored with origin offsets so they behave like native primitives.
- **Connect Mode** – Toggle connect mode in the toolbar to re-parent links via the outline or the 3D viewport, with cycle protection and automatic snap offsets.
- **Motion Control Panel** – Slider per joint with min/max enforcement, unit display, external control toggles, and live TCP broadcasting of local changes. Quick min/reset/max buttons provide instant snaps.
- **Pose Library** – Capture, rename, recall, or remove project-specific joint poses to validate repeatable setups instantly.
- **Network Console** – Built-in testbench for parsing payloads, injecting local joint updates, broadcasting to TCP clients, and inspecting RX/TX logs.
- **Motion Simulation** – One-click simulated playback drives joints with smooth sinusoidal motion for presentation or sanity checks.
- **TCP Bridge** – Electron main process hosts a TCP server on port 5555 that streams joint updates to the renderer. Incoming JSON/CSV-style payloads (terminated by newlines) update joints that opt into external control.
- **Persistence** – Save the entire scene graph (including poses, custom meshes, and static rotations) to disk or reload a JSON project using native OS dialogs or browser fallbacks.
- **Status Bar** – Displays TCP state, current FPS, selection metadata, and whether the app is in connect or simulation mode.

## Standalone Simulator

A separate Electron + React application lives in the `simulator/` directory. It loads saved Robot Builder scenes, solves inverse kinematics while you drag any link, and streams the resulting joint positions over TCP so it can run alongside the main builder UI.

### Run the simulator during development

```bash
cd simulator
npm install
npm run dev
```

The dev command launches a Vite renderer on port 5183 and attaches an Electron shell. Configure the TCP bridge host/port from the sidebar and drag links in the viewport to stream joint snapshots.

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

## Network Console & Testbench

Open the **Network Console** panel (left sidebar) to craft test payloads:

- Paste JSON or comma/semicolon-delimited `joint=value` pairs.
- Use **Inject Locally** to apply the payload immediately (bypasses the TCP toggle requirement).
- Use **Broadcast TCP** to push the payload to all connected socket clients.
- Prefill the editor with the selected joint's name for quick experiments and monitor the rolling RX/TX log (capped at 200 entries).

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
      "baseOffset": [0, 0, 0],
      "staticRotation": [0, 0, 0]
    },
    "link-2": {
      "id": "link-2",
      "name": "Custom Gripper",
      "geometry": {
        "kind": "custom",
        "sourceName": "gripper.stl",
        "data": "<base64 elided>",
        "scale": 1,
        "bounds": { "width": 0.18, "depth": 0.12, "height": 0.22, "radial": 0.09 },
        "originOffset": [-0.01, 0.0, -0.11]
      },
      "color": "#38bdf8",
      "parentId": "link-1",
      "children": [],
      "baseOffset": [0, 0, 0.32],
      "staticRotation": [0, 0, 0],
      "joints": [
        {
          "id": "joint-3",
          "name": "joint-3",
          "type": "rotational",
          "axis": "z",
          "limits": [-90, 90],
          "currentValue": 0,
          "pivot": [0, 0, -0.11]
        }
      ]
    }
  },
  "poses": [
    {
      "id": "pose-7",
      "name": "Pose 1",
      "values": { "joint-1": 0, "joint-2": 45 },
      "createdAt": 1731542400000
    }
  ]
}
```

Each child link stores its parent reference, mount offset, static rotation, joint definition (if applicable), and optional notes. Custom meshes add base64-encoded STL payloads, unscaled bounds, and origin offsets so they can be reloaded exactly. Mount offsets use `[x, y, z]` meters with the Z axis pointing up. Captured poses record joint values by name and are preserved when exporting/importing projects.

## Roadmap Ideas

- Undo/redo stack for authoring.
- Physics preview and collision helpers.
- Alternative protocol adapters (ROS, WebSocket, gRPC).
- Keyframe animation timelines and IK solvers.

Contributions and feedback are welcome!
