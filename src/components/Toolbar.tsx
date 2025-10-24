import React, { useState } from 'react';
import { useSceneStore } from '@state/store';
import type { SceneData, MeshKind } from '@state/store';

const Toolbar: React.FC = () => {
  const addLink = useSceneStore((state) => state.addLink);
  const exportScene = useSceneStore((state) => state.exportScene);
  const importScene = useSceneStore((state) => state.importScene);
  const resetScene = useSceneStore((state) => state.resetScene);
  const startConnection = useSceneStore((state) => state.startConnection);
  const cancelConnection = useSceneStore((state) => state.cancelConnection);
  const connectMode = useSceneStore((state) => state.connectMode);
  const selectedId = useSceneStore((state) => state.selectedId);
  const setSimulationPlaying = useSceneStore((state) => state.setSimulationPlaying);
  const simulationPlaying = useSceneStore((state) => state.simulationPlaying);
  const [pendingKind, setPendingKind] = useState<MeshKind>('box');

  const handleSave = async () => {
    const scene = exportScene();
    try {
      const result = await window.api.saveScene(scene as SceneData);
      if (result.success) {
        window.api.log(`Scene saved to ${result.filePath}`);
      }
    } catch (error) {
      console.error('Failed to save scene', error);
    }
  };

  const handleLoad = async () => {
    try {
      const result = await window.api.loadScene();
      if (result.success && result.scene) {
        importScene(result.scene as SceneData);
      }
    } catch (error) {
      console.error('Failed to load scene', error);
    }
  };

  const handleConnectToggle = () => {
    if (connectMode) {
      cancelConnection();
    } else if (selectedId) {
      startConnection();
    }
  };

  const handleSimulationToggle = () => {
    setSimulationPlaying(!simulationPlaying);
  };

  return (
    <div className="toolbar">
      <label className="shape-selector">
        <span>Shape</span>
        <select value={pendingKind} onChange={(event) => setPendingKind(event.target.value as MeshKind)}>
          <option value="box">Cuboid</option>
          <option value="cylinder">Cylinder</option>
          <option value="sphere">Sphere</option>
          <option value="cone">Cone</option>
          <option value="capsule">Capsule</option>
        </select>
      </label>
      <button type="button" onClick={() => addLink(pendingKind)}>
        Add Link
      </button>
      <button
        type="button"
        onClick={handleConnectToggle}
        className={connectMode ? 'active' : ''}
        disabled={!connectMode && !selectedId}
      >
        Connect
      </button>
      <button type="button" onClick={handleSimulationToggle} className={simulationPlaying ? 'active' : ''}>
        {simulationPlaying ? 'Pause Simulation' : 'Simulate'}
      </button>
      <button type="button" onClick={handleSave}>
        Save Scene
      </button>
      <button type="button" onClick={handleLoad}>
        Load Scene
      </button>
      <button type="button" onClick={resetScene}>
        Reset
      </button>
    </div>
  );
};

export default Toolbar;
