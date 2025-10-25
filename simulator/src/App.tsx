import React, { useCallback, useEffect, useRef, useState } from 'react';
import { SceneCanvas } from '@components/SceneCanvas';
import { parseSceneData } from '@lib/scene';
import { useSimulatorStore } from '@state/simulatorStore';
import type { TcpStatusPayload } from '@lib/tcp';

const DEFAULT_STATUS: TcpStatusPayload = { status: 'disconnected' };

const formatStatusLabel = (payload: TcpStatusPayload) => {
  switch (payload.status) {
    case 'connected':
      return 'Connected';
    case 'connecting':
      return 'Connecting…';
    case 'error':
      return `Error${payload.message ? `: ${payload.message}` : ''}`;
    default:
      return 'Disconnected';
  }
};

const App: React.FC = () => {
  const fileInputRef = useRef<HTMLInputElement | null>(null);
  const scene = useSimulatorStore((state) => state.scene);
  const loadScene = useSimulatorStore((state) => state.loadScene);
  const clearScene = useSimulatorStore((state) => state.clearScene);
  const [status, setStatus] = useState<TcpStatusPayload>(DEFAULT_STATUS);
  const [host, setHost] = useState('127.0.0.1');
  const [port, setPort] = useState(5555);
  const [error, setError] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const [bridgeAvailable, setBridgeAvailable] = useState(
    () => typeof window !== 'undefined' && Boolean(window.simulatorAPI)
  );

  useEffect(() => {
    if (typeof window === 'undefined') {
      return;
    }

    let dispose: (() => void) | undefined;
    let pollTimer: ReturnType<typeof window.setInterval> | undefined;

    const attachBridge = async () => {
      if (!window.simulatorAPI) {
        setBridgeAvailable(false);
        return false;
      }

      setBridgeAvailable(true);
      dispose?.();
      dispose = window.simulatorAPI.onTcpStatus((payload) => {
        setStatus(payload);
      });

      try {
        const initial = await window.simulatorAPI.getTcpStatus();
        if (initial?.status) {
          setStatus(initial);
        }
      } catch (err) {
        console.error('Failed to read TCP status from Electron bridge', err);
      }

      return true;
    };

    const ensureBridge = () => {
      if (window.simulatorAPI) {
        attachBridge();
        return;
      }
      setBridgeAvailable(false);
      if (!pollTimer) {
        pollTimer = window.setInterval(() => {
          if (window.simulatorAPI) {
            attachBridge();
            if (pollTimer) {
              window.clearInterval(pollTimer);
              pollTimer = undefined;
            }
          }
        }, 250);
      }
    };

    ensureBridge();

    const readyListener = () => {
      if (pollTimer) {
        window.clearInterval(pollTimer);
        pollTimer = undefined;
      }
      attachBridge();
    };

    window.addEventListener('simulator-api-ready', readyListener);

    return () => {
      window.removeEventListener('simulator-api-ready', readyListener);
      if (pollTimer) {
        window.clearInterval(pollTimer);
      }
      dispose?.();
    };
  }, []);

  const handleFileSelected = useCallback(
    async (event: React.ChangeEvent<HTMLInputElement>) => {
      const file = event.target.files?.[0];
      if (!file) {
        return;
      }
      setError(null);
      setMessage(null);
      try {
        const text = await file.text();
        const parsed = JSON.parse(text);
        const sceneData = parseSceneData(parsed);
        loadScene(sceneData);
        setMessage(`Loaded scene "${sceneData.nodes[sceneData.rootId]?.name ?? sceneData.rootId}"`);
      } catch (err) {
        console.error('Failed to load scene', err);
        setError(err instanceof Error ? err.message : 'Unable to parse scene file');
      }
    },
    [loadScene]
  );

  const handleLoadClick = useCallback(() => {
    fileInputRef.current?.click();
  }, []);

  const handleConnect = useCallback(async () => {
    if (!bridgeAvailable || !window.simulatorAPI) {
      setError(
        'The TCP bridge requires the Electron shell. Launch the simulator with "npm run dev" inside simulator/ or use "npm run dev:both" from the repository root.'
      );
      return;
    }
    setError(null);
    const result = await window.simulatorAPI.connectTcp({ host, port });
    if (!result.success && result.error) {
      setError(result.error);
    }
  }, [bridgeAvailable, host, port]);

  const handleDisconnect = useCallback(async () => {
    if (!window.simulatorAPI) {
      return;
    }
    await window.simulatorAPI.disconnectTcp();
  }, []);

  const connectDisabled = status.status === 'connecting' || !bridgeAvailable;
  const disconnectDisabled = status.status === 'disconnected' || !bridgeAvailable;

  return (
    <div className="app-shell">
      <aside className="sidebar">
        <header className="sidebar__header">
          <h1>Robot Builder Simulator</h1>
          <p className="sidebar__subtitle">Replay and animate saved rigs with live TCP streaming.</p>
        </header>

        <section className="sidebar__section">
          <h2>Scene</h2>
          <p className="sidebar__description">Load a scene JSON generated by Robot Builder.</p>
          <div className="sidebar__actions">
            <button type="button" onClick={handleLoadClick} className="button button--primary">
              Load Scene JSON
            </button>
            <button
              type="button"
              onClick={() => {
                clearScene();
                setMessage(null);
                setError(null);
              }}
              className="button"
              disabled={!scene}
            >
              Clear Scene
            </button>
            <input
              ref={fileInputRef}
              type="file"
              accept="application/json"
              className="hidden-input"
              onChange={handleFileSelected}
            />
          </div>
          {scene ? (
            <div className="scene-summary">
              <h3>{scene.nodes[scene.rootId]?.name ?? 'Root Link'}</h3>
              <p>{Object.keys(scene.nodes).length} links • {Object.values(scene.nodes).reduce((acc, node) => acc + node.joints.length, 0)} joints</p>
            </div>
          ) : (
            <div className="scene-summary scene-summary--empty">
              <p>No scene loaded.</p>
            </div>
          )}
        </section>

        <section className="sidebar__section">
          <h2>TCP Bridge</h2>
          <p className="sidebar__description">
            While dragging, joint positions are streamed to your main application via TCP.
          </p>
          <div className="form-grid">
            <label>
              Host
              <input value={host} onChange={(event) => setHost(event.target.value)} placeholder="127.0.0.1" />
            </label>
            <label>
              Port
              <input
                value={port}
                onChange={(event) => setPort(Number(event.target.value) || 0)}
                type="number"
                min={1}
                max={65535}
              />
            </label>
          </div>
          <div className="sidebar__actions">
            <button
              type="button"
              onClick={handleConnect}
              className="button button--primary"
              disabled={connectDisabled}
            >
              Connect
            </button>
            <button type="button" onClick={handleDisconnect} className="button" disabled={disconnectDisabled}>
              Disconnect
            </button>
          </div>
          {!bridgeAvailable ? (
            <div className="feedback feedback--info">
              TCP streaming is only available when the simulator runs inside its Electron shell.{' '}
              Start it with <code>npm run dev</code> in <code>simulator/</code> or run <code>npm run dev:both</code> from the
              repository root to launch both apps together.
            </div>
          ) : null}
          <div className={`status-chip status-chip--${status.status}`}>
            <span className="status-indicator" />
            <span>{formatStatusLabel(status)}</span>
          </div>
        </section>

        <section className="sidebar__section sidebar__section--info">
          <h2>Usage Tips</h2>
          <ul>
            <li>Drag any link in the viewport to solve inverse kinematics.</li>
            <li>Joints respect the axes and limits defined in the original builder scene.</li>
            <li>Use the mouse wheel to zoom and right-click to orbit.</li>
          </ul>
        </section>

        {error ? <div className="feedback feedback--error">{error}</div> : null}
        {message ? <div className="feedback feedback--success">{message}</div> : null}
      </aside>
      <main className="main-area">
        <SceneCanvas />
      </main>
    </div>
  );
};

export default App;
