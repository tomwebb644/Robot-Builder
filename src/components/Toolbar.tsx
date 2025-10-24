import React from 'react';
import { useSceneStore } from '@state/store';
import type { JointDefinition, LinkNode, MeshGeometry, SceneData } from '@state/store';

const isNumber = (value: unknown): value is number => typeof value === 'number' && Number.isFinite(value);
const isVector3 = (value: unknown): value is [number, number, number] =>
  Array.isArray(value) && value.length === 3 && value.every((component) => isNumber(component));

const isMeshGeometry = (value: unknown): value is MeshGeometry => {
  if (!value || typeof value !== 'object') return false;
  const geometry = value as MeshGeometry;
  if (geometry.kind === 'box') {
    return ['width', 'height', 'depth'].every((key) => isNumber((geometry as any)[key]));
  }
  if (geometry.kind === 'cylinder') {
    return isNumber((geometry as any).radius) && isNumber((geometry as any).height);
  }
  return false;
};

const isJointDefinition = (value: unknown): value is JointDefinition => {
  if (!value || typeof value !== 'object') return false;
  const joint = value as JointDefinition;
  const motionTypeValid = joint.type === 'rotational' || joint.type === 'linear';
  const axisValid = joint.axis === 'x' || joint.axis === 'y' || joint.axis === 'z';
  const limitsValid =
    Array.isArray(joint.limits) &&
    joint.limits.length === 2 &&
    joint.limits.every((limit) => isNumber(limit));
  return (
    motionTypeValid &&
    axisValid &&
    limitsValid &&
    isNumber(joint.currentValue) &&
    typeof joint.name === 'string' &&
    typeof joint.externalControl === 'boolean'
  );
};

const isLinkNode = (value: unknown): value is LinkNode => {
  if (!value || typeof value !== 'object') return false;
  const node = value as LinkNode;
  const childrenValid = Array.isArray(node.children) && node.children.every((child) => typeof child === 'string');
  const notesValid = node.notes === undefined || typeof node.notes === 'string';
  const parentValid = node.parentId === undefined || typeof node.parentId === 'string';
  return (
    typeof node.id === 'string' &&
    typeof node.name === 'string' &&
    typeof node.color === 'string' &&
    isMeshGeometry(node.geometry) &&
    childrenValid &&
    parentValid &&
    isVector3(node.baseOffset) &&
    (node.joint === undefined || isJointDefinition(node.joint)) &&
    notesValid
  );
};

const isSceneData = (value: unknown): value is SceneData => {
  if (!value || typeof value !== 'object') return false;
  const scene = value as SceneData;
  if (typeof scene.rootId !== 'string' || typeof scene.nodes !== 'object' || scene.nodes === null) {
    return false;
  }
  if (!scene.nodes[scene.rootId]) {
    return false;
  }
  return Object.values(scene.nodes).every((node) => isLinkNode(node));
};

const downloadScene = (scene: SceneData) => {
  const timeStamp = new Date().toISOString().replace(/[:.]/g, '-');
  const link = document.createElement('a');
  link.href = URL.createObjectURL(new Blob([JSON.stringify(scene, null, 2)], { type: 'application/json' }));
  link.download = `robot-scene-${timeStamp}.json`;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(link.href);
};

const pickSceneFile = async (): Promise<SceneData | null> =>
  new Promise((resolve) => {
    const input = document.createElement('input');
    input.type = 'file';
    input.accept = 'application/json';
    input.onchange = () => {
      const file = input.files?.[0];
      if (!file) {
        resolve(null);
        return;
      }
      const reader = new FileReader();
      reader.onload = () => {
        try {
          const parsed = JSON.parse(reader.result as string);
          resolve(isSceneData(parsed) ? parsed : null);
        } catch (error) {
          console.error('Failed to parse scene', error);
          resolve(null);
        }
      };
      reader.onerror = () => resolve(null);
      reader.readAsText(file);
    };
    document.body.appendChild(input);
    input.click();
    document.body.removeChild(input);
  });

const Toolbar: React.FC = () => {
  const addLink = useSceneStore((state) => state.addLink);
  const exportScene = useSceneStore((state) => state.exportScene);
  const importScene = useSceneStore((state) => state.importScene);
  const resetScene = useSceneStore((state) => state.resetScene);

  const handleSave = async () => {
    const scene = exportScene();
    if (window.api?.saveScene) {
      try {
        const result = await window.api.saveScene(scene as SceneData);
        if (result?.success) {
          window.api.log?.(`Scene saved to ${result.filePath}`);
        }
      } catch (error) {
        console.error('Failed to save scene', error);
      }
      return;
    }

    downloadScene(scene as SceneData);
  };

  const handleLoad = async () => {
    if (window.api?.loadScene) {
      try {
        const result = await window.api.loadScene();
        if (result?.success && result.scene && isSceneData(result.scene)) {
          importScene(result.scene);
          return;
        }
        if (result?.success) {
          console.warn('Loaded scene had unexpected structure');
        }
      } catch (error) {
        console.error('Failed to load scene', error);
      }
    }

    const picked = await pickSceneFile();
    if (picked) {
      importScene(picked);
    }
  };

  return (
    <div className="toolbar">
      <button type="button" onClick={() => addLink('box')}>
        Add Cuboid
      </button>
      <button type="button" onClick={() => addLink('cylinder')}>
        Add Cylinder
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
