import React, { useEffect } from 'react';
import Toolbar from '@components/Toolbar';
import ControlPanel from '@components/ControlPanel';
import Workspace from '@components/Workspace';
import InspectorPanel from '@components/InspectorPanel';
import StatusBar from '@components/StatusBar';
import { useSceneStore } from '@state/store';
import type { SceneData } from '@state/store';

const AUTOSAVE_STORAGE_KEY = 'robot-builder-autosave';

const App: React.FC = () => {
  const applyRemoteJointValues = useSceneStore((state) => state.applyRemoteJointValues);
  const setTcpStatus = useSceneStore((state) => state.setTcpStatus);
  const importScene = useSceneStore((state) => state.importScene);

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

  useEffect(() => {
    let cancelled = false;
    const loadPersistedScene = async () => {
      try {
        if (window.api?.loadAutosave) {
          const result = await window.api.loadAutosave();
          if (!cancelled && result?.success && result.scene) {
            importScene(result.scene as SceneData);
            return;
          }
        }
      } catch (error) {
        console.error('Failed to load autosaved scene from filesystem', error);
      }

      if (cancelled) {
        return;
      }

      try {
        const stored = typeof localStorage !== 'undefined' ? localStorage.getItem(AUTOSAVE_STORAGE_KEY) : null;
        if (stored) {
          importScene(JSON.parse(stored) as SceneData);
        }
      } catch (error) {
        console.error('Failed to load autosaved scene from storage', error);
      }
    };

    loadPersistedScene();

    return () => {
      cancelled = true;
    };
  }, [importScene]);

  useEffect(() => {
    let saveTimer: ReturnType<typeof setTimeout> | undefined;
    let lastSerializedScene = '';

    const persistScene = async () => {
      const scene = useSceneStore.getState().exportScene();
      const serialized = JSON.stringify(scene);
      if (serialized === lastSerializedScene) {
        return;
      }
      lastSerializedScene = serialized;
      try {
        if (window.api?.writeAutosave) {
          await window.api.writeAutosave(scene);
        } else if (typeof localStorage !== 'undefined') {
          localStorage.setItem(AUTOSAVE_STORAGE_KEY, serialized);
        }
      } catch (error) {
        console.error('Failed to persist autosaved scene', error);
      }
    };

    const scheduleSave = () => {
      if (saveTimer) {
        clearTimeout(saveTimer);
      }
      saveTimer = setTimeout(() => {
        void persistScene();
      }, 2000);
    };

    const flushSave = () => {
      if (saveTimer) {
        clearTimeout(saveTimer);
        saveTimer = undefined;
      }
      void persistScene();
    };

    const unsubscribe = useSceneStore.subscribe(() => {
      scheduleSave();
    });

    const handleBeforeUnload = () => {
      flushSave();
    };

    window.addEventListener('beforeunload', handleBeforeUnload);

    return () => {
      window.removeEventListener('beforeunload', handleBeforeUnload);
      unsubscribe();
      flushSave();
    };
  }, []);

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
