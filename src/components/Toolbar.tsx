import React, { useRef, useState } from 'react';
import * as THREE from 'three';
import { STLLoader } from 'three/examples/jsm/loaders/STLLoader';
import { useSceneStore } from '@state/store';
import type { SceneData, PrimitiveMeshKind, CustomGeometry } from '@state/store';
import { arrayBufferToBase64 } from '@utils/binary';

const MILLIMETER_TO_METER = 0.001;

const Toolbar: React.FC = () => {
  const addLink = useSceneStore((state) => state.addLink);
  const addCustomLink = useSceneStore((state) => state.addCustomLink);
  const exportScene = useSceneStore((state) => state.exportScene);
  const importScene = useSceneStore((state) => state.importScene);
  const resetScene = useSceneStore((state) => state.resetScene);
  const startConnection = useSceneStore((state) => state.startConnection);
  const cancelConnection = useSceneStore((state) => state.cancelConnection);
  const connectMode = useSceneStore((state) => state.connectMode);
  const selectedId = useSceneStore((state) => state.selectedId);
  const setSimulationPlaying = useSceneStore((state) => state.setSimulationPlaying);
  const simulationPlaying = useSceneStore((state) => state.simulationPlaying);
  const [pendingKind, setPendingKind] = useState<PrimitiveMeshKind>('box');
  const fileInputRef = useRef<HTMLInputElement | null>(null);
  const stlInputRef = useRef<HTMLInputElement | null>(null);

  const handleSave = async () => {
    const scene = exportScene();
    const api = (window as any).api;
    if (api && typeof api.saveScene === 'function') {
      try {
        const result = await api.saveScene(scene as SceneData);
        if (result.success) {
          api.log?.(`Scene saved to ${result.filePath}`);
        }
      } catch (error) {
        console.error('Failed to save scene', error);
      }
      return;
    }
    try {
      const blob = new Blob([JSON.stringify(scene, null, 2)], { type: 'application/json' });
      const url = URL.createObjectURL(blob);
      const anchor = document.createElement('a');
      anchor.href = url;
      anchor.download = 'robot-scene.json';
      document.body.appendChild(anchor);
      anchor.click();
      document.body.removeChild(anchor);
      URL.revokeObjectURL(url);
      console.info('Scene downloaded as robot-scene.json');
    } catch (error) {
      console.error('Failed to export scene', error);
    }
  };

  const handleLoad = async () => {
    const api = (window as any).api;
    if (api && typeof api.loadScene === 'function') {
      try {
        const result = await api.loadScene();
        if (result.success && result.scene) {
          importScene(result.scene as SceneData);
        }
      } catch (error) {
        console.error('Failed to load scene', error);
      }
      return;
    }
    fileInputRef.current?.click();
  };

  const handleCustomShapeImport = () => {
    stlInputRef.current?.click();
  };

  const handleStlChange = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) {
      return;
    }
    try {
      const buffer = await file.arrayBuffer();
      const loader = new STLLoader();
      const geometry = loader.parse(buffer);
      geometry.computeBoundingBox();
      geometry.computeVertexNormals();
      const positionAttribute = geometry.getAttribute('position');
      const fallbackBounds = new THREE.Box3();
      if (positionAttribute && 'itemSize' in positionAttribute) {
        fallbackBounds.setFromBufferAttribute(positionAttribute as THREE.BufferAttribute);
      }
      const bounds = geometry.boundingBox ?? fallbackBounds;
      const size = new THREE.Vector3();
      bounds.getSize(size).multiplyScalar(MILLIMETER_TO_METER);
      const center = new THREE.Vector3();
      bounds.getCenter(center).multiplyScalar(MILLIMETER_TO_METER);
      geometry.dispose();
      const baseBounds = {
        width: size.x || 0.3,
        depth: size.y || 0.3,
        height: size.z || 0.3,
        radial: Math.max(size.x, size.y, 0.3) / 2
      };
      const originOffset: [number, number, number] = [-center.x, -center.y, -center.z];
      const customGeometry: CustomGeometry = {
        kind: 'custom',
        sourceName: file.name,
        data: arrayBufferToBase64(buffer),
        scale: 1,
        unitScale: MILLIMETER_TO_METER,
        bounds: baseBounds,
        originOffset
      };
      addCustomLink(customGeometry);
    } catch (error) {
      console.error('Failed to import STL mesh', error);
    } finally {
      event.target.value = '';
    }
  };

  const handleFileChange = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) {
      return;
    }
    try {
      const content = await file.text();
      const parsed = JSON.parse(content);
      importScene(parsed as SceneData);
    } catch (error) {
      console.error('Failed to import scene from file', error);
    } finally {
      event.target.value = '';
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
      <input
        ref={fileInputRef}
        type="file"
        accept="application/json"
        style={{ display: 'none' }}
        onChange={handleFileChange}
      />
      <input
        ref={stlInputRef}
        type="file"
        accept=".stl"
        style={{ display: 'none' }}
        onChange={handleStlChange}
      />
      <label className="shape-selector">
        <span>Shape</span>
        <select value={pendingKind} onChange={(event) => setPendingKind(event.target.value as PrimitiveMeshKind)}>
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
      <button type="button" onClick={handleCustomShapeImport}>
        Import STL Mesh
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
        Clear Scene
      </button>
    </div>
  );
};

export default Toolbar;
