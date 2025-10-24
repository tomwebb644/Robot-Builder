import { useEffect } from 'react';
import { shallow } from 'zustand/shallow';
import { JointControlPanel } from './components/JointControlPanel';
import { InspectorPanel } from './components/InspectorPanel';
import { SceneViewport } from './components/SceneViewport';
import { Toolbar } from './components/Toolbar';
import { TcpStatusIndicator } from './components/TcpStatusIndicator';
import { useRobotStore } from './state/robotStore';
import type { TcpStatus } from './state/robotStore';

export default function App() {
  const { applyRemoteUpdates, setTcpStatus, loadInitialJointState } = useRobotStore(
    (state) => ({
      applyRemoteUpdates: state.applyRemoteUpdates,
      setTcpStatus: state.setTcpStatus,
      loadInitialJointState: state.loadInitialJointState
    }),
    shallow
  );

  useEffect(() => {
    const initialLoad = async () => {
      try {
        await loadInitialJointState();
      } catch (error) {
        console.error('Failed to load initial joint state from main process', error);
      }
    };

    initialLoad();

    const cleanupFns: Array<() => void> = [];

    if (window.robotAPI?.onJointUpdate) {
      cleanupFns.push(
        window.robotAPI.onJointUpdate((updates) => {
          applyRemoteUpdates(updates);
        })
      );
    }

    if (window.robotAPI?.onTcpStatus) {
      cleanupFns.push(
        window.robotAPI.onTcpStatus((status) => {
          if (!status || typeof status.status !== 'string') {
            return;
          }
          const allowed: TcpStatus[] = ['offline', 'listening', 'connected', 'error'];
          const nextStatus = allowed.includes(status.status as TcpStatus)
            ? (status.status as TcpStatus)
            : 'error';
          setTcpStatus(nextStatus, status.message);
        })
      );
    }

    return () => {
      cleanupFns.forEach((cleanup) => cleanup());
    };
  }, [applyRemoteUpdates, loadInitialJointState, setTcpStatus]);

  return (
    <div className="app-shell">
      <Toolbar />
      <div className="status-bar">
        <TcpStatusIndicator />
      </div>
      <div className="main-layout">
        <JointControlPanel />
        <SceneViewport />
        <InspectorPanel />
      </div>
    </div>
  );
}
