import { create } from 'zustand';
import type * as THREE from 'three';
import { SceneData } from '@lib/scene';
import { collectJointValues, solveIkForNode } from '@lib/kinematics';

interface SimulatorState {
  scene?: SceneData;
  loadScene: (scene: SceneData) => void;
  clearScene: () => void;
  solveForTarget: (
    nodeId: string,
    target: THREE.Vector3
  ) => { jointValues: Record<string, number>; success: boolean } | null;
  collectJointSnapshot: () => Record<string, number>;
}

export const useSimulatorStore = create<SimulatorState>((set, get) => ({
  scene: undefined,
  loadScene: (scene) => set({ scene }),
  clearScene: () => set({ scene: undefined }),
  solveForTarget: (nodeId, target) => {
    const state = get();
    if (!state.scene) {
      return null;
    }
    const result = solveIkForNode(state.scene, nodeId, target);
    set({ scene: result.scene });
    return { jointValues: result.jointValues, success: result.success };
  },
  collectJointSnapshot: () => {
    const scene = get().scene;
    return scene ? collectJointValues(scene) : {};
  }
}));
