import React, { useEffect } from 'react';
import Toolbar from '@components/Toolbar';
import ControlPanel from '@components/ControlPanel';
import Workspace from '@components/Workspace';
import InspectorPanel from '@components/InspectorPanel';
import StatusBar from '@components/StatusBar';
import { useSceneStore } from '@state/store';

const App: React.FC = () => {
  const applyRemoteJointValues = useSceneStore((state) => state.applyRemoteJointValues);
  const setTcpStatus = useSceneStore((state) => state.setTcpStatus);

  useEffect(() => {
    if (!window.api?.onJointUpdate) return;
    const unsubscribe = window.api.onJointUpdate((payload) => {
      applyRemoteJointValues(payload);
      const keys = Object.keys(payload);
      if (keys.length > 0) {
        setTcpStatus(`last update ${new Date().toLocaleTimeString()} (${keys.join(', ')})`);
      }
    });
    return () => {
      unsubscribe?.();
    };
  }, [applyRemoteJointValues, setTcpStatus]);

  return (
    <div className="app-shell">
      <Toolbar />
      <div className="main-content">
        <ControlPanel />
        <Workspace />
        <InspectorPanel />
      </div>
      <StatusBar />
    </div>
  );
};

export default App;
