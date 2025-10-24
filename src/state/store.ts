import { create } from 'zustand';

export type MotionType = 'rotational' | 'linear';
export type MotionAxis = 'x' | 'y' | 'z';
export type MeshKind = 'box' | 'cylinder';

export interface JointDefinition {
  type: MotionType;
  axis: MotionAxis;
  limits: [number, number];
  currentValue: number;
  name: string;
  externalControl: boolean;
}

export interface BoxGeometry {
  kind: 'box';
  width: number;
  height: number;
  depth: number;
}

export interface CylinderGeometry {
  kind: 'cylinder';
  radius: number;
  height: number;
}

export type MeshGeometry = BoxGeometry | CylinderGeometry;

export interface LinkNode {
  id: string;
  name: string;
  geometry: MeshGeometry;
  color: string;
  parentId?: string;
  children: string[];
  baseOffset: [number, number, number];
  joint?: JointDefinition;
  notes?: string;
}

export interface SceneData {
  rootId: string;
  nodes: Record<string, LinkNode>;
}

const randomColor = () => {
  const palette = ['#38bdf8', '#a855f7', '#f97316', '#facc15', '#34d399', '#60a5fa'];
  return palette[Math.floor(Math.random() * palette.length)];
};

let idCounter = 0;
const createId = (prefix: string) => `${prefix}-${++idCounter}`;

const extractNumericSuffix = (value: string) => {
  const match = value.match(/-(\d+)$/);
  return match ? Number(match[1]) : 0;
};

const syncCountersFromScene = (scene: SceneData) => {
  let maxValue = idCounter;
  for (const node of Object.values(scene.nodes)) {
    maxValue = Math.max(maxValue, extractNumericSuffix(node.id));
    if (node.joint) {
      maxValue = Math.max(maxValue, extractNumericSuffix(node.joint.name));
    }
  }
  idCounter = Math.max(idCounter, maxValue);
};

const defaultBox = (): BoxGeometry => ({ kind: 'box', width: 0.3, height: 0.4, depth: 0.3 });
const defaultCylinder = (): CylinderGeometry => ({ kind: 'cylinder', radius: 0.15, height: 0.4 });

export interface SceneState {
  nodes: Record<string, LinkNode>;
  rootId: string;
  selectedId?: string;
  tcpStatus: string;
  fps: number;
  addLink: (kind: MeshKind) => void;
  selectNode: (id?: string) => void;
  updateJoint: (id: string, patch: Partial<JointDefinition>) => void;
  updateNode: (id: string, patch: Partial<Omit<LinkNode, 'id' | 'children' | 'joint'>> & { joint?: Partial<JointDefinition> }) => void;
  toggleExternalControl: (id: string, enabled: boolean) => void;
  removeNode: (id: string) => void;
  applyRemoteJointValues: (values: Record<string, number>) => void;
  exportScene: () => SceneData;
  importScene: (scene: SceneData) => void;
  updateFps: (fps: number) => void;
  setTcpStatus: (status: string) => void;
  resetScene: () => void;
}

const createDefaultState = (): Pick<SceneState, 'nodes' | 'rootId' | 'selectedId'> => {
  const rootId = createId('link');
  const rootNode: LinkNode = {
    id: rootId,
    name: 'Base',
    geometry: { kind: 'box', width: 0.5, height: 0.2, depth: 0.5 },
    color: '#64748b',
    children: [],
    baseOffset: [0, 0, 0]
  };

  return {
    nodes: { [rootId]: rootNode },
    rootId,
    selectedId: rootId
  };
};

const getGeometryHeight = (geometry: MeshGeometry) => geometry.height;

export const useSceneStore = create<SceneState>((set, get) => ({
  ...createDefaultState(),
  tcpStatus: 'listening on :5555',
  fps: 0,
  addLink: (kind) => {
    const { selectedId, rootId, nodes } = get();
    const parentId = selectedId ?? rootId;
    const parent = nodes[parentId];
    if (!parent) return;

    const geometry: MeshGeometry =
      kind === 'box' ? defaultBox() : defaultCylinder();

    const jointName = createId('joint');
    const newId = createId('link');
    const parentHeight = parent.geometry ? getGeometryHeight(parent.geometry) : 0.2;
    const offsetY = parentHeight / 2 + getGeometryHeight(geometry) / 2 + 0.05;

    const newNode: LinkNode = {
      id: newId,
      name: kind === 'box' ? 'Link Box' : 'Link Cylinder',
      geometry,
      color: randomColor(),
      parentId,
      children: [],
      baseOffset: [0, offsetY, 0],
      joint: {
        type: 'rotational',
        axis: 'z',
        limits: [-90, 90],
        currentValue: 0,
        name: jointName,
        externalControl: false
      }
    };

    set((state) => ({
      nodes: {
        ...state.nodes,
        [newId]: newNode,
        [parentId]: {
          ...state.nodes[parentId],
          children: [...state.nodes[parentId].children, newId]
        }
      },
      selectedId: newId
    }));
  },
  selectNode: (id) => set({ selectedId: id }),
  updateJoint: (id, patch) => {
    set((state) => {
      const node = state.nodes[id];
      if (!node || !node.joint) return state;
      const limits = patch.limits ?? node.joint.limits;
      const normalizedLimits: [number, number] = limits[0] <= limits[1] ? [limits[0], limits[1]] : [limits[1], limits[0]];
      const valueToClamp = patch.currentValue !== undefined ? patch.currentValue : node.joint.currentValue;
      const newValue = Math.min(Math.max(valueToClamp, normalizedLimits[0]), normalizedLimits[1]);
      return {
        nodes: {
          ...state.nodes,
          [id]: {
            ...node,
            joint: {
              ...node.joint,
              ...patch,
              limits: normalizedLimits,
              currentValue: newValue
            }
          }
        }
      };
    });
  },
  updateNode: (id, patch) => {
    set((state) => {
      const node = state.nodes[id];
      if (!node) return state;
      const nextNode: LinkNode = {
        ...node,
        ...patch,
        baseOffset: patch.baseOffset ?? node.baseOffset
      };
      if (patch.geometry) {
        nextNode.geometry = {
          ...node.geometry,
          ...patch.geometry
        } as MeshGeometry;
      }
      if (patch.joint && node.joint) {
        nextNode.joint = {
          ...node.joint,
          ...patch.joint
        };
      }
      return {
        nodes: {
          ...state.nodes,
          [id]: nextNode
        }
      };
    });
  },
  toggleExternalControl: (id, enabled) => {
    set((state) => {
      const node = state.nodes[id];
      if (!node?.joint) return state;
      return {
        nodes: {
          ...state.nodes,
          [id]: {
            ...node,
            joint: {
              ...node.joint,
              externalControl: enabled
            }
          }
        }
      };
    });
  },
  removeNode: (id) => {
    set((state) => {
      if (id === state.rootId) return state;
      const target = state.nodes[id];
      if (!target) return state;

      const idsToRemove = new Set<string>();
      const collect = (nodeId: string) => {
        if (idsToRemove.has(nodeId)) return;
        idsToRemove.add(nodeId);
        const node = state.nodes[nodeId];
        if (!node) return;
        for (const childId of node.children) {
          collect(childId);
        }
      };

      collect(id);

      const updatedNodes: Record<string, LinkNode> = { ...state.nodes };
      for (const nodeId of idsToRemove) {
        delete updatedNodes[nodeId];
      }

      if (target.parentId && updatedNodes[target.parentId]) {
        const parent = updatedNodes[target.parentId];
        updatedNodes[target.parentId] = {
          ...parent,
          children: parent.children.filter((childId) => !idsToRemove.has(childId))
        };
      }

      const nextSelected =
        state.selectedId && idsToRemove.has(state.selectedId)
          ? target.parentId ?? state.rootId
          : state.selectedId;

      return {
        nodes: updatedNodes,
        selectedId: nextSelected
      };
    });
  },
  applyRemoteJointValues: (values) => {
    set((state) => {
      const updated: Record<string, LinkNode> = { ...state.nodes };
      let changed = false;
      for (const node of Object.values(state.nodes)) {
        if (!node.joint) continue;
        const key = node.joint.name;
        if (!node.joint.externalControl) continue;
        const nextValue = values[key];
        if (typeof nextValue !== 'number') continue;
        const [min, max] = node.joint.limits;
        const clamped = Math.min(Math.max(nextValue, min), max);
        if (clamped !== node.joint.currentValue) {
          updated[node.id] = {
            ...node,
            joint: {
              ...node.joint,
              currentValue: clamped
            }
          };
          changed = true;
        }
      }
      return changed ? { nodes: updated } : state;
    });
  },
  exportScene: () => {
    const { nodes, rootId } = get();
    return {
      rootId,
      nodes
    };
  },
  importScene: (scene) => {
    syncCountersFromScene(scene);
    set(() => ({
      nodes: scene.nodes,
      rootId: scene.rootId,
      selectedId: scene.rootId
    }));
  },
  updateFps: (fps) => set({ fps }),
  setTcpStatus: (status) => set({ tcpStatus: status }),
  resetScene: () => {
    idCounter = 0;
    set(() => ({
      ...createDefaultState(),
      fps: 0
    }));
  }
}));
