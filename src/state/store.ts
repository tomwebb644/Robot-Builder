import { create } from 'zustand';

export type MotionType = 'rotational' | 'linear';
export type MotionAxis = 'x' | 'y' | 'z';
export type MeshKind = 'box' | 'cylinder' | 'sphere' | 'cone' | 'capsule';
export type NetworkSource = 'tcp' | 'ui' | 'manual' | 'simulation';

export interface NetworkEvent {
  id: number;
  timestamp: number;
  direction: 'incoming' | 'outgoing';
  values: Record<string, number>;
  source: NetworkSource;
}

export interface JointDefinition {
  id: string;
  type: MotionType;
  axis: MotionAxis;
  limits: [number, number];
  currentValue: number;
  name: string;
  externalControl: boolean;
  pivot: [number, number, number];
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

export interface SphereGeometry {
  kind: 'sphere';
  radius: number;
}

export interface ConeGeometry {
  kind: 'cone';
  radius: number;
  height: number;
}

export interface CapsuleGeometry {
  kind: 'capsule';
  radius: number;
  length: number;
}

export type MeshGeometry = BoxGeometry | CylinderGeometry | SphereGeometry | ConeGeometry | CapsuleGeometry;

export interface GeometryBounds {
  width: number;
  depth: number;
  height: number;
  radial: number;
}

export interface LinkNode {
  id: string;
  name: string;
  geometry: MeshGeometry;
  color: string;
  parentId?: string;
  children: string[];
  baseOffset: [number, number, number];
  joints: JointDefinition[];
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
    for (const joint of node.joints ?? []) {
      maxValue = Math.max(maxValue, extractNumericSuffix(joint.name));
      maxValue = Math.max(maxValue, extractNumericSuffix(joint.id));
    }
  }
  idCounter = Math.max(idCounter, maxValue);
};

const defaultBox = (): BoxGeometry => ({ kind: 'box', width: 0.3, height: 0.4, depth: 0.3 });
const defaultCylinder = (): CylinderGeometry => ({ kind: 'cylinder', radius: 0.15, height: 0.4 });
const defaultSphere = (): SphereGeometry => ({ kind: 'sphere', radius: 0.18 });
const defaultCone = (): ConeGeometry => ({ kind: 'cone', radius: 0.16, height: 0.38 });
const defaultCapsule = (): CapsuleGeometry => ({ kind: 'capsule', radius: 0.12, length: 0.28 });

const geometryFactory: Record<MeshKind, () => MeshGeometry> = {
  box: defaultBox,
  cylinder: defaultCylinder,
  sphere: defaultSphere,
  cone: defaultCone,
  capsule: defaultCapsule
};

export const createDefaultGeometry = (kind: MeshKind): MeshGeometry => geometryFactory[kind]();

export const getGeometryBounds = (geometry: MeshGeometry): GeometryBounds => {
  switch (geometry.kind) {
    case 'box':
      return {
        width: geometry.width,
        depth: geometry.depth,
        height: geometry.height,
        radial: Math.max(geometry.width, geometry.depth) / 2
      };
    case 'cylinder':
      return {
        width: geometry.radius * 2,
        depth: geometry.radius * 2,
        height: geometry.height,
        radial: geometry.radius
      };
    case 'sphere':
      return {
        width: geometry.radius * 2,
        depth: geometry.radius * 2,
        height: geometry.radius * 2,
        radial: geometry.radius
      };
    case 'cone':
      return {
        width: geometry.radius * 2,
        depth: geometry.radius * 2,
        height: geometry.height,
        radial: geometry.radius
      };
    case 'capsule':
      return {
        width: geometry.radius * 2,
        depth: geometry.radius * 2,
        height: geometry.length + geometry.radius * 2,
        radial: geometry.radius
      };
    default:
      return { width: 0.3, depth: 0.3, height: 0.3, radial: 0.15 };
  }
};

export const getDefaultJointPivot = (geometry: MeshGeometry): [number, number, number] => {
  const bounds = getGeometryBounds(geometry);
  return [0, -bounds.height / 2, 0];
};

export interface SceneState {
  nodes: Record<string, LinkNode>;
  rootId: string;
  selectedId?: string;
  connectMode: boolean;
  connectSourceId?: string;
  tcpStatus: string;
  fps: number;
  networkLog: NetworkEvent[];
  simulationPlaying: boolean;
  simulationTime: number;
  addLink: (kind: MeshKind) => void;
  selectNode: (id?: string) => void;
  updateJoint: (nodeId: string, jointId: string, patch: Partial<JointDefinition>) => void;
  addJoint: (nodeId: string, type?: MotionType) => void;
  removeJoint: (nodeId: string, jointId: string) => void;
  updateNode: (id: string, patch: Partial<Omit<LinkNode, 'id' | 'children' | 'joints'>>) => void;
  toggleExternalControl: (nodeId: string, jointId: string, enabled: boolean) => void;
  applyRemoteJointValues: (values: Record<string, number>, source?: NetworkSource) => void;
  exportScene: () => SceneData;
  importScene: (scene: SceneData) => void;
  updateFps: (fps: number) => void;
  setTcpStatus: (status: string) => void;
  removeLink: (id: string) => void;
  startConnection: () => void;
  cancelConnection: () => void;
  completeConnection: (targetId: string) => void;
  logNetworkEvent: (direction: 'incoming' | 'outgoing', values: Record<string, number>, source: NetworkSource) => void;
  clearNetworkLog: () => void;
  setSimulationPlaying: (playing: boolean) => void;
  advanceSimulation: (delta: number) => void;
  resetScene: () => void;
}

const createDefaultState = (): Pick<
  SceneState,
  'nodes' | 'rootId' | 'selectedId' | 'connectMode' | 'connectSourceId' | 'networkLog' | 'simulationPlaying' | 'simulationTime'
> => {
  const rootId = createId('link');
  const rootNode: LinkNode = {
    id: rootId,
    name: 'Base',
    geometry: { kind: 'box', width: 0.5, height: 0.2, depth: 0.5 },
    color: '#64748b',
    children: [],
    baseOffset: [0, 0, 0],
    joints: []
  };

  return {
    nodes: { [rootId]: rootNode },
    rootId,
    selectedId: rootId,
    connectMode: false,
    connectSourceId: undefined,
    networkLog: [],
    simulationPlaying: false,
    simulationTime: 0
  };
};

const getGeometryHeight = (geometry: MeshGeometry) => getGeometryBounds(geometry).height;

const computeMountOffset = (parent: LinkNode, child: LinkNode): [number, number, number] => {
  const parentHeight = getGeometryHeight(parent.geometry);
  const childHeight = getGeometryHeight(child.geometry);
  return [0, parentHeight / 2 + childHeight / 2 + 0.05, 0];
};

const isAncestor = (nodes: Record<string, LinkNode>, ancestorId: string, childId: string): boolean => {
  let current: string | undefined = nodes[childId]?.parentId;
  while (current) {
    if (current === ancestorId) return true;
    current = nodes[current]?.parentId;
  }
  return false;
};

let networkEventCounter = 0;

export const useSceneStore = create<SceneState>((set, get) => ({
  ...createDefaultState(),
  tcpStatus: 'listening on :5555',
  fps: 0,
  addLink: (kind) => {
    const { selectedId, rootId, nodes } = get();
    const parentId = selectedId ?? rootId;
    const parent = nodes[parentId];
    if (!parent) return;

    const geometry: MeshGeometry = createDefaultGeometry(kind);

    const jointId = createId('joint');
    const newId = createId('link');
    const parentHeight = parent.geometry ? getGeometryHeight(parent.geometry) : 0.2;
    const offsetY = parentHeight / 2 + getGeometryHeight(geometry) / 2 + 0.05;
    const pivot = getDefaultJointPivot(geometry);

    const newNode: LinkNode = {
      id: newId,
      name:
        kind === 'box'
          ? 'Link Box'
          : kind === 'cylinder'
          ? 'Link Cylinder'
          : kind === 'sphere'
          ? 'Link Sphere'
          : kind === 'cone'
          ? 'Link Cone'
          : 'Link Capsule',
      geometry,
      color: randomColor(),
      parentId,
      children: [],
      baseOffset: [0, offsetY, 0],
      joints: [
        {
          id: jointId,
          type: 'rotational',
          axis: 'z',
          limits: [-90, 90],
          currentValue: 0,
          name: jointId,
          externalControl: false,
          pivot
        }
      ]
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
      selectedId: newId,
      connectMode: false,
      connectSourceId: undefined
    }));
  },
  selectNode: (id) => {
    const { connectMode, connectSourceId, completeConnection } = get();
    if (connectMode) {
      if (!id) {
        set({ selectedId: undefined, connectMode: false, connectSourceId: undefined });
        return;
      }
      if (!connectSourceId) {
        set({ selectedId: id, connectSourceId: id });
        return;
      }
      if (id === connectSourceId) {
        set({ selectedId: id });
        return;
      }
      completeConnection(id);
      return;
    }
    set({ selectedId: id });
  },
  updateJoint: (nodeId, jointId, patch) => {
    set((state) => {
      const node = state.nodes[nodeId];
      if (!node) return state;
      const index = node.joints.findIndex((joint) => joint.id === jointId);
      if (index === -1) return state;
      const currentJoint = node.joints[index];
      const limits = patch.limits ?? currentJoint.limits;
      const normalizedLimits: [number, number] =
        limits[0] <= limits[1] ? [limits[0], limits[1]] : [limits[1], limits[0]];
      const valueToClamp =
        patch.currentValue !== undefined ? patch.currentValue : currentJoint.currentValue;
      const newValue = Math.min(Math.max(valueToClamp, normalizedLimits[0]), normalizedLimits[1]);
      const nextJoint: JointDefinition = {
        ...currentJoint,
        ...patch,
        limits: normalizedLimits,
        currentValue: newValue,
        pivot: patch.pivot ?? currentJoint.pivot
      };
      const joints = [...node.joints];
      joints[index] = nextJoint;
      return {
        nodes: {
          ...state.nodes,
          [nodeId]: {
            ...node,
            joints
          }
        }
      };
    });
  },
  addJoint: (nodeId, type = 'rotational') => {
    set((state) => {
      const node = state.nodes[nodeId];
      if (!node) return state;
      const jointId = createId('joint');
      const pivot = getDefaultJointPivot(node.geometry);
      const limits: [number, number] = type === 'linear' ? [0, 150] : [-90, 90];
      const nextJoint: JointDefinition = {
        id: jointId,
        type,
        axis: 'z',
        limits,
        currentValue: type === 'linear' ? limits[0] : 0,
        name: jointId,
        externalControl: false,
        pivot
      };
      return {
        nodes: {
          ...state.nodes,
          [nodeId]: {
            ...node,
            joints: [...node.joints, nextJoint]
          }
        },
        selectedId: nodeId
      };
    });
  },
  removeJoint: (nodeId, jointId) => {
    set((state) => {
      const node = state.nodes[nodeId];
      if (!node) return state;
      const nextJoints = node.joints.filter((joint) => joint.id !== jointId);
      if (nextJoints.length === node.joints.length) return state;
      return {
        nodes: {
          ...state.nodes,
          [nodeId]: {
            ...node,
            joints: nextJoints
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
        const previousDefaultPivot = getDefaultJointPivot(node.geometry);
        const nextDefaultPivot = getDefaultJointPivot(nextNode.geometry);
        nextNode.joints = node.joints.map((joint) => {
          const matchesDefaultPivot =
            Math.abs(joint.pivot[0] - previousDefaultPivot[0]) < 1e-6 &&
            Math.abs(joint.pivot[1] - previousDefaultPivot[1]) < 1e-6 &&
            Math.abs(joint.pivot[2] - previousDefaultPivot[2]) < 1e-6;
          return matchesDefaultPivot
            ? { ...joint, pivot: nextDefaultPivot }
            : joint;
        });
      }
      const updatedNodes: Record<string, LinkNode> = {
        ...state.nodes,
        [id]: nextNode
      };
      if (patch.geometry) {
        for (const childId of node.children) {
          const child = state.nodes[childId];
          if (!child) continue;
          const nextOffset = computeMountOffset(nextNode, child);
          updatedNodes[childId] = {
            ...child,
            baseOffset: [child.baseOffset[0], nextOffset[1], child.baseOffset[2]]
          };
        }
      }
      return {
        nodes: updatedNodes
      };
    });
  },
  toggleExternalControl: (nodeId, jointId, enabled) => {
    set((state) => {
      const node = state.nodes[nodeId];
      if (!node) return state;
      const index = node.joints.findIndex((joint) => joint.id === jointId);
      if (index === -1) return state;
      const joints = [...node.joints];
      joints[index] = {
        ...joints[index],
        externalControl: enabled
      };
      return {
        nodes: {
          ...state.nodes,
          [nodeId]: {
            ...node,
            joints
          }
        }
      };
    });
  },
  applyRemoteJointValues: (values, source = 'tcp') => {
    const changedValues: Record<string, number> = {};
    set((state) => {
      const updated: Record<string, LinkNode> = { ...state.nodes };
      let changed = false;
      for (const node of Object.values(state.nodes)) {
        if (!node.joints || node.joints.length === 0) continue;
        let nodeChanged = false;
        const joints = node.joints.map((joint) => {
          const key = joint.name;
          if (source === 'tcp' && !joint.externalControl) {
            return joint;
          }
          const nextValue = values[key];
          if (typeof nextValue !== 'number') {
            return joint;
          }
          const [min, max] = joint.limits;
          const clamped = Math.min(Math.max(nextValue, min), max);
          if (clamped !== joint.currentValue) {
            nodeChanged = true;
            changedValues[key] = clamped;
            return {
              ...joint,
              currentValue: clamped
            };
          }
          return joint;
        });
        if (nodeChanged) {
          updated[node.id] = {
            ...node,
            joints
          };
          changed = true;
        }
      }
      return changed ? { nodes: updated } : state;
    });
    if (Object.keys(changedValues).length > 0) {
      get().logNetworkEvent('incoming', changedValues, source);
    }
  },
  exportScene: () => {
    const { nodes, rootId } = get();
    return {
      rootId,
      nodes
    };
  },
  importScene: (scene) => {
    const normalizedNodes: Record<string, LinkNode> = {};
    for (const [id, rawNode] of Object.entries(scene.nodes)) {
      const geometry = rawNode.geometry;
      const defaultPivot = getDefaultJointPivot(geometry);
      const rawJoints: any[] = Array.isArray((rawNode as any).joints)
        ? ((rawNode as any).joints as any[])
        : (rawNode as any).joint
        ? [((rawNode as any).joint as any)]
        : [];
      const joints: JointDefinition[] = rawJoints.map((entry: any) => {
        const type: MotionType = entry?.type === 'linear' ? 'linear' : 'rotational';
        const axis: MotionAxis = entry?.axis === 'x' || entry?.axis === 'y' || entry?.axis === 'z' ? entry.axis : 'z';
        const limitsInput = Array.isArray(entry?.limits) && entry.limits.length >= 2 ? entry.limits : type === 'linear' ? [0, 150] : [-90, 90];
        const limits = [Number(limitsInput[0]), Number(limitsInput[1])] as [number, number];
        const normalizedLimits: [number, number] =
          limits[0] <= limits[1] ? [limits[0], limits[1]] : [limits[1], limits[0]];
        const rawValue = Number(entry?.currentValue ?? (type === 'linear' ? normalizedLimits[0] : 0));
        const currentValue = Math.min(Math.max(rawValue, normalizedLimits[0]), normalizedLimits[1]);
        const pivotSource = Array.isArray(entry?.pivot) && entry.pivot.length === 3 ? entry.pivot : defaultPivot;
        const pivot = [Number(pivotSource[0]), Number(pivotSource[1]), Number(pivotSource[2])] as [
          number,
          number,
          number
        ];
        const jointId = typeof entry?.id === 'string' && entry.id.trim() ? entry.id : createId('joint');
        const name = typeof entry?.name === 'string' && entry.name.trim() ? entry.name : jointId;
        return {
          id: jointId,
          name,
          type,
          axis,
          limits: normalizedLimits,
          currentValue,
          externalControl: Boolean(entry?.externalControl),
          pivot
        };
      });
      normalizedNodes[id] = {
        id: rawNode.id ?? id,
        name: rawNode.name ?? id,
        geometry,
        color: rawNode.color ?? randomColor(),
        parentId: rawNode.parentId,
        children: Array.isArray(rawNode.children) ? rawNode.children : [],
        baseOffset:
          Array.isArray(rawNode.baseOffset) && rawNode.baseOffset.length === 3
            ? [
                Number(rawNode.baseOffset[0]),
                Number(rawNode.baseOffset[1]),
                Number(rawNode.baseOffset[2])
              ]
            : [0, 0, 0],
        joints,
        notes: rawNode.notes
      };
    }
    const normalizedScene: SceneData = { ...scene, nodes: normalizedNodes };
    syncCountersFromScene(normalizedScene);
    set(() => ({
      nodes: normalizedNodes,
      rootId: normalizedScene.rootId,
      selectedId: normalizedScene.rootId
    }));
  },
  updateFps: (fps) => set({ fps }),
  setTcpStatus: (status) => set({ tcpStatus: status }),
  removeLink: (id) => {
    set((state) => {
      if (id === state.rootId) {
        return { connectMode: false, connectSourceId: undefined };
      }
      const nodes = { ...state.nodes };
      const toRemove = [id];
      while (toRemove.length > 0) {
        const currentId = toRemove.pop();
        if (!currentId) continue;
        const currentNode = nodes[currentId];
        if (!currentNode) continue;
        toRemove.push(...currentNode.children);
        delete nodes[currentId];
      }
      const parentId = state.nodes[id]?.parentId;
      if (parentId && nodes[parentId]) {
        nodes[parentId] = {
          ...nodes[parentId],
          children: nodes[parentId].children.filter((child) => child !== id)
        };
      }
      return {
        nodes,
        selectedId: parentId ?? state.rootId,
        connectMode: false,
        connectSourceId: undefined
      };
    });
  },
  startConnection: () => {
    const { selectedId } = get();
    if (!selectedId) return;
    set({ connectMode: true, connectSourceId: selectedId });
  },
  cancelConnection: () => set({ connectMode: false, connectSourceId: undefined }),
  completeConnection: (targetId) => {
    set((state) => {
      if (!state.connectSourceId) return state;
      const childId = state.connectSourceId;
      if (childId === targetId) {
        return { connectMode: false, connectSourceId: undefined };
      }
      const childNode = state.nodes[childId];
      const targetNode = state.nodes[targetId];
      if (!childNode || !targetNode) {
        return { connectMode: false, connectSourceId: undefined };
      }
      if (childId === state.rootId || targetId === childNode.parentId) {
        return { connectMode: false, connectSourceId: undefined, selectedId: childId };
      }
      if (isAncestor(state.nodes, childId, targetId)) {
        return { connectMode: false, connectSourceId: undefined, selectedId: childId };
      }
      const updatedNodes: Record<string, LinkNode> = { ...state.nodes };
      if (childNode.parentId) {
        const previousParent = updatedNodes[childNode.parentId];
        if (previousParent) {
          updatedNodes[childNode.parentId] = {
            ...previousParent,
            children: previousParent.children.filter((entry) => entry !== childId)
          };
        }
      }
      const nextOffset = computeMountOffset(targetNode, childNode);
      updatedNodes[childId] = {
        ...childNode,
        parentId: targetId,
        baseOffset: nextOffset
      };
      updatedNodes[targetId] = {
        ...targetNode,
        children: [...targetNode.children, childId]
      };
      return {
        nodes: updatedNodes,
        connectMode: false,
        connectSourceId: undefined,
        selectedId: childId
      };
    });
  },
  logNetworkEvent: (direction, values, source) => {
    const entry: NetworkEvent = {
      id: ++networkEventCounter,
      timestamp: Date.now(),
      direction,
      values,
      source
    };
    set((state) => ({
      networkLog: [...state.networkLog, entry].slice(-200)
    }));
  },
  clearNetworkLog: () => set({ networkLog: [] }),
  setSimulationPlaying: (playing) => set({ simulationPlaying: playing }),
  advanceSimulation: (delta) => {
    const changes: Record<string, number> = {};
    let shouldLog = false;
    set((state) => {
      if (!state.simulationPlaying) return state;
      const updatedNodes: Record<string, LinkNode> = { ...state.nodes };
      let changed = false;
      let jointIndex = 0;
      const nextTime = state.simulationTime + delta;
      const logThresholdCrossed = Math.floor(nextTime * 2) !== Math.floor(state.simulationTime * 2);
      for (const node of Object.values(state.nodes)) {
        if (!node.joints || node.joints.length === 0) continue;
        const joints = [...node.joints];
        let nodeChanged = false;
        for (let idx = 0; idx < joints.length; idx += 1) {
          const joint = joints[idx];
          if (joint.externalControl) continue;
          const [min, max] = joint.limits;
          const amplitude = (max - min) / 2;
          if (amplitude <= 0) {
            jointIndex += 1;
            continue;
          }
          const center = (max + min) / 2;
          const frequency = 0.6 + jointIndex * 0.15;
          const phase = state.simulationTime * frequency;
          const value = center + amplitude * Math.sin(phase + jointIndex);
          const rounded = Number(value.toFixed(3));
          if (Math.abs(rounded - joint.currentValue) > 0.001) {
            joints[idx] = {
              ...joint,
              currentValue: Math.min(Math.max(rounded, min), max)
            };
            changes[joint.name] = Math.min(Math.max(rounded, min), max);
            nodeChanged = true;
            changed = true;
          }
          jointIndex += 1;
        }
        if (nodeChanged) {
          updatedNodes[node.id] = {
            ...node,
            joints
          };
        }
      }
      if (!changed) {
        return {
          simulationTime: nextTime
        };
      }
      shouldLog = logThresholdCrossed;
      return {
        nodes: updatedNodes,
        simulationTime: nextTime
      };
    });
    if (shouldLog && Object.keys(changes).length > 0) {
      get().logNetworkEvent('incoming', changes, 'simulation');
    }
  },
  resetScene: () => {
    set(() => ({
      ...createDefaultState(),
      tcpStatus: 'listening on :5555',
      fps: 0
    }));
  }
}));
