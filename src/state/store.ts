import { create } from 'zustand';

export type MotionType = 'rotational' | 'linear';
export type MotionAxis = 'x' | 'y' | 'z';
export type MeshKind = 'box' | 'cylinder' | 'sphere' | 'cone' | 'capsule';
export type NetworkSource = 'tcp' | 'ui' | 'manual' | 'simulation' | 'playback';

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

export interface PoseDefinition {
  id: string;
  name: string;
  values: Record<string, number>;
  createdAt: number;
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
  poses?: PoseDefinition[];
}

const randomColor = () => {
  const palette = ['#38bdf8', '#a855f7', '#f97316', '#facc15', '#34d399', '#60a5fa'];
  return palette[Math.floor(Math.random() * palette.length)];
};

let idCounter = 0;
const createId = (prefix: string) => `${prefix}-${++idCounter}`;

const gatherJointNames = (nodes: Record<string, LinkNode>, ignoreJointId?: string) => {
  const used = new Set<string>();
  for (const node of Object.values(nodes)) {
    for (const joint of node.joints) {
      if (ignoreJointId && joint.id === ignoreJointId) continue;
      if (joint.name) {
        used.add(joint.name);
      }
    }
  }
  return used;
};

const nextJointNameFromUsed = (used: Set<string>) => {
  let index = 1;
  let candidate = `joint-${index}`;
  while (used.has(candidate)) {
    index += 1;
    candidate = `joint-${index}`;
  }
  return candidate;
};

const getNextJointName = (
  nodes: Record<string, LinkNode>,
  additionalNames: Set<string> = new Set()
) => {
  const used = gatherJointNames(nodes);
  for (const name of additionalNames) {
    if (name) used.add(name);
  }
  return nextJointNameFromUsed(used);
};

const getNextJointNameFor = (
  nodes: Record<string, LinkNode>,
  jointId?: string,
  additionalNames: Set<string> = new Set()
) => {
  const used = gatherJointNames(nodes, jointId);
  for (const name of additionalNames) {
    if (name) used.add(name);
  }
  return nextJointNameFromUsed(used);
};

const sanitizeJointName = (
  nodes: Record<string, LinkNode>,
  proposed: string,
  jointId: string,
  currentName: string
) => {
  const trimmed = proposed.trim();
  if (!trimmed) {
    return currentName;
  }
  const used = gatherJointNames(nodes, jointId);
  if (used.has(trimmed)) {
    return null;
  }
  return trimmed;
};

const prunePoseValues = (poses: PoseDefinition[], validNames: Set<string>) =>
  poses.map((pose) => {
    const nextValues: Record<string, number> = {};
    for (const [key, value] of Object.entries(pose.values)) {
      if (validNames.has(key)) {
        nextValues[key] = value;
      }
    }
    return { ...pose, values: nextValues };
  });

const getNextPoseName = (poses: PoseDefinition[]) => {
  const used = new Set<string>();
  const pattern = /^Pose (\d+)$/i;
  for (const pose of poses) {
    used.add(pose.name);
    const match = pose.name.match(pattern);
    if (match) {
      used.add(`Pose ${Number(match[1])}`);
    }
  }
  let index = 1;
  while (used.has(`Pose ${index}`)) {
    index += 1;
  }
  return `Pose ${index}`;
};

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
  for (const pose of scene.poses ?? []) {
    maxValue = Math.max(maxValue, extractNumericSuffix(pose.id));
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
  return [0, 0, -bounds.height / 2];
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
  poses: PoseDefinition[];
  simulationPlaying: boolean;
  simulationTime: number;
  addLink: (kind: MeshKind) => void;
  selectNode: (id?: string) => void;
  updateJoint: (nodeId: string, jointId: string, patch: Partial<JointDefinition>) => void;
  addJoint: (nodeId: string, type?: MotionType) => void;
  removeJoint: (nodeId: string, jointId: string) => void;
  updateNode: (id: string, patch: Partial<Omit<LinkNode, 'id' | 'children' | 'joints'>>) => void;
  toggleExternalControl: (nodeId: string, jointId: string, enabled: boolean) => void;
  applyInterpolatedJointValues: (values: Record<string, number>) => void;
  applyRemoteJointValues: (values: Record<string, number>, source?: NetworkSource) => void;
  exportScene: () => SceneData;
  importScene: (scene: SceneData) => void;
  addPose: (name?: string) => string;
  renamePose: (id: string, name: string) => void;
  removePose: (id: string) => void;
  reorderPoses: (sourceId: string, targetId?: string) => void;
  applyPose: (id: string) => Record<string, number>;
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
    poses: [],
    simulationPlaying: false,
    simulationTime: 0
  };
};

const getGeometryHeight = (geometry: MeshGeometry) => getGeometryBounds(geometry).height;

const computeMountOffset = (parent: LinkNode, child: LinkNode): [number, number, number] => {
  const parentHeight = getGeometryHeight(parent.geometry);
  const childHeight = getGeometryHeight(child.geometry);
  return [0, 0, parentHeight / 2 + childHeight / 2 + 0.05];
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
    const offsetZ = parentHeight / 2 + getGeometryHeight(geometry) / 2 + 0.05;
    const pivot = getDefaultJointPivot(geometry);
    const jointName = getNextJointName(nodes);
    const initialJoint: JointDefinition = {
      id: jointId,
      type: 'rotational',
      axis: 'z',
      limits: [-90, 90],
      currentValue: 0,
      name: jointName,
      externalControl: false,
      pivot
    };

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
      baseOffset: [0, 0, offsetZ],
      joints: [initialJoint]
    };

    set((state) => {
      const parentNode = state.nodes[parentId];
      if (!parentNode) {
        return state;
      }
      const nextNodes: Record<string, LinkNode> = {
        ...state.nodes,
        [newId]: newNode,
        [parentId]: {
          ...parentNode,
          children: [...parentNode.children, newId]
        }
      };
      const poses = state.poses.map((pose) => ({
        ...pose,
        values: {
          ...pose.values,
          [initialJoint.name]: initialJoint.currentValue
        }
      }));
      return {
        nodes: nextNodes,
        selectedId: newId,
        connectMode: false,
        connectSourceId: undefined,
        poses
      };
    });
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
      const { name: proposedName, ...restPatch } = patch;
      let nextName = currentJoint.name;
      if (proposedName !== undefined) {
        const sanitized = sanitizeJointName(state.nodes, proposedName, jointId, currentJoint.name);
        if (sanitized === null) {
          nextName = getNextJointNameFor(state.nodes, jointId);
        } else {
          nextName = sanitized;
        }
      }
      const limits = restPatch.limits ?? currentJoint.limits;
      const normalizedLimits: [number, number] =
        limits[0] <= limits[1] ? [limits[0], limits[1]] : [limits[1], limits[0]];
      const valueToClamp =
        restPatch.currentValue !== undefined ? restPatch.currentValue : currentJoint.currentValue;
      const newValue = Math.min(Math.max(valueToClamp, normalizedLimits[0]), normalizedLimits[1]);
      const nextJoint: JointDefinition = {
        ...currentJoint,
        ...restPatch,
        limits: normalizedLimits,
        currentValue: newValue,
        pivot: restPatch.pivot ?? currentJoint.pivot,
        name: nextName
      };
      const joints = [...node.joints];
      joints[index] = nextJoint;
      let poses = state.poses;
      if (nextName !== currentJoint.name) {
        poses = state.poses.map((pose) => {
          if (!(currentJoint.name in pose.values)) {
            return pose;
          }
          const values = { ...pose.values };
          const stored = values[currentJoint.name];
          delete values[currentJoint.name];
          values[nextName] = stored;
          return { ...pose, values };
        });
      }
      return {
        nodes: {
          ...state.nodes,
          [nodeId]: {
            ...node,
            joints
          }
        },
        poses
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
      const jointName = getNextJointName(state.nodes);
      const currentValue = type === 'linear' ? limits[0] : 0;
      const nextJoint: JointDefinition = {
        id: jointId,
        type,
        axis: 'z',
        limits,
        currentValue,
        name: jointName,
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
        selectedId: nodeId,
        poses: state.poses.map((pose) => ({
          ...pose,
          values: {
            ...pose.values,
            [jointName]: currentValue
          }
        }))
      };
    });
  },
  removeJoint: (nodeId, jointId) => {
    set((state) => {
      const node = state.nodes[nodeId];
      if (!node) return state;
      const removed = node.joints.find((joint) => joint.id === jointId);
      const nextJoints = node.joints.filter((joint) => joint.id !== jointId);
      if (nextJoints.length === node.joints.length) return state;
      const poses = removed
        ? state.poses.map((pose) => {
            if (!(removed.name in pose.values)) {
              return pose;
            }
            const values = { ...pose.values };
            delete values[removed.name];
            return { ...pose, values };
          })
        : state.poses;
      return {
        nodes: {
          ...state.nodes,
          [nodeId]: {
            ...node,
            joints: nextJoints
          }
        },
        poses
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
            baseOffset: [child.baseOffset[0], child.baseOffset[1], nextOffset[2]]
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
  applyInterpolatedJointValues: (values) => {
    set((state) => {
      const updated: Record<string, LinkNode> = { ...state.nodes };
      let changed = false;
      for (const node of Object.values(state.nodes)) {
        if (!node.joints.length) continue;
        let nodeChanged = false;
        const joints = node.joints.map((joint) => {
          const nextValue = values[joint.name];
          if (typeof nextValue !== 'number') {
            return joint;
          }
          const [min, max] = joint.limits;
          const clamped = Math.min(Math.max(nextValue, min), max);
          if (Math.abs(clamped - joint.currentValue) > 0.0001) {
            nodeChanged = true;
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
    const { nodes, rootId, poses } = get();
    return {
      rootId,
      nodes,
      poses
    };
  },
  importScene: (scene) => {
    const normalizedNodes: Record<string, LinkNode> = {};
    const usedJointNames = new Set<string>();
    const nodeEntries = Object.entries(scene?.nodes ?? {});
    for (const [id, rawNode] of nodeEntries) {
      if (!rawNode || typeof rawNode !== 'object') continue;
      const geometry = (rawNode as any).geometry ?? defaultBox();
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
        let name = typeof entry?.name === 'string' && entry.name.trim() ? entry.name.trim() : jointId;
        if (!name || usedJointNames.has(name)) {
          name = nextJointNameFromUsed(usedJointNames);
        }
        usedJointNames.add(name);
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
        id: (rawNode as any).id ?? id,
        name: (rawNode as any).name ?? id,
        geometry,
        color: (rawNode as any).color ?? randomColor(),
        parentId: (rawNode as any).parentId,
        children: Array.isArray((rawNode as any).children) ? (rawNode as any).children : [],
        baseOffset:
          Array.isArray((rawNode as any).baseOffset) && (rawNode as any).baseOffset.length === 3
            ? [
                Number((rawNode as any).baseOffset[0]),
                Number((rawNode as any).baseOffset[1]),
                Number((rawNode as any).baseOffset[2])
              ]
            : [0, 0, 0],
        joints,
        notes: (rawNode as any).notes
      };
    }
    const validJointNames = gatherJointNames(normalizedNodes);
    const normalizedPoses: PoseDefinition[] = [];
    const usedPoseNames = new Set<string>();
    const poseEntries = Array.isArray(scene?.poses) ? scene.poses : [];
    for (const entry of poseEntries) {
      if (!entry || typeof entry !== 'object') continue;
      const poseId = typeof (entry as any).id === 'string' && (entry as any).id.trim() ? (entry as any).id : createId('pose');
      let poseName =
        typeof (entry as any).name === 'string' && (entry as any).name.trim()
          ? (entry as any).name.trim()
          : getNextPoseName(normalizedPoses);
      if (!poseName) {
        poseName = getNextPoseName(normalizedPoses);
      }
      if (usedPoseNames.has(poseName)) {
        const baseName = poseName;
        let suffix = 2;
        let candidate = `${baseName} (${suffix})`;
        while (usedPoseNames.has(candidate)) {
          suffix += 1;
          candidate = `${baseName} (${suffix})`;
        }
        poseName = candidate;
      }
      usedPoseNames.add(poseName);
      const rawValues =
        (entry as any).values && typeof (entry as any).values === 'object' ? (entry as any).values : {};
      const values: Record<string, number> = {};
      for (const [key, value] of Object.entries(rawValues)) {
        if (!validJointNames.has(key)) continue;
        const numeric = Number(value);
        if (Number.isFinite(numeric)) {
          values[key] = numeric;
        }
      }
      normalizedPoses.push({
        id: poseId,
        name: poseName,
        values,
        createdAt:
          typeof (entry as any).createdAt === 'number' && Number.isFinite((entry as any).createdAt)
            ? (entry as any).createdAt
            : Date.now()
      });
    }
    const normalizedScene: SceneData = { ...scene, nodes: normalizedNodes, poses: normalizedPoses };
    syncCountersFromScene(normalizedScene);
    const desiredRootId =
      normalizedScene.rootId && normalizedNodes[normalizedScene.rootId]
        ? normalizedScene.rootId
        : Object.keys(normalizedNodes)[0] ?? get().rootId;
    set(() => ({
      nodes: normalizedNodes,
      poses: normalizedPoses,
      rootId: desiredRootId,
      selectedId: desiredRootId,
      connectMode: false,
      connectSourceId: undefined
    }));
  },
  addPose: (name) => {
    const state = get();
    const poseId = createId('pose');
    const trimmed = typeof name === 'string' ? name.trim() : '';
    const usedNames = new Set(state.poses.map((pose) => pose.name));
    let poseName = trimmed;
    if (!poseName) {
      poseName = getNextPoseName(state.poses);
    } else if (usedNames.has(poseName)) {
      let suffix = 2;
      let candidate = `${poseName} (${suffix})`;
      while (usedNames.has(candidate)) {
        suffix += 1;
        candidate = `${poseName} (${suffix})`;
      }
      poseName = candidate;
    }
    const values: Record<string, number> = {};
    for (const node of Object.values(state.nodes)) {
      for (const joint of node.joints) {
        values[joint.name] = joint.currentValue;
      }
    }
    const pose: PoseDefinition = {
      id: poseId,
      name: poseName,
      values,
      createdAt: Date.now()
    };
    set((current) => ({ poses: [...current.poses, pose] }));
    return poseId;
  },
  renamePose: (id, name) => {
    set((state) => {
      const index = state.poses.findIndex((pose) => pose.id === id);
      if (index === -1) return state;
      const trimmed = name.trim();
      if (!trimmed) return state;
      if (state.poses.some((pose, idx) => idx !== index && pose.name === trimmed)) {
        return state;
      }
      const poses = [...state.poses];
      poses[index] = { ...poses[index], name: trimmed };
      return { poses };
    });
  },
  removePose: (id) => {
    set((state) => {
      const poses = state.poses.filter((pose) => pose.id !== id);
      if (poses.length === state.poses.length) return state;
      return { poses };
    });
  },
  reorderPoses: (sourceId, targetId) => {
    if (!sourceId) return;
    set((state) => {
      if (sourceId === targetId) {
        return state;
      }
      const poses = [...state.poses];
      const fromIndex = poses.findIndex((pose) => pose.id === sourceId);
      if (fromIndex === -1) {
        return state;
      }
      const [moved] = poses.splice(fromIndex, 1);
      if (!moved) {
        return state;
      }
      if (typeof targetId === 'string') {
        const targetIndex = poses.findIndex((pose) => pose.id === targetId);
        if (targetIndex === -1) {
          poses.push(moved);
        } else {
          poses.splice(targetIndex, 0, moved);
        }
      } else {
        poses.push(moved);
      }
      return { poses };
    });
  },
  applyPose: (id) => {
    const state = get();
    const pose = state.poses.find((entry) => entry.id === id);
    if (!pose) {
      return {};
    }
    const nextNodes: Record<string, LinkNode> = { ...state.nodes };
    const changed: Record<string, number> = {};
    let mutated = false;
    for (const node of Object.values(state.nodes)) {
      if (!node.joints.length) continue;
      let nodeChanged = false;
      const joints = node.joints.map((joint) => {
        const target = pose.values[joint.name];
        if (typeof target !== 'number') {
          return joint;
        }
        const [min, max] = joint.limits;
        const clamped = Math.min(Math.max(target, min), max);
        if (clamped !== joint.currentValue) {
          nodeChanged = true;
          changed[joint.name] = clamped;
          return { ...joint, currentValue: clamped };
        }
        return joint;
      });
      if (nodeChanged) {
        nextNodes[node.id] = { ...node, joints };
        mutated = true;
      }
    }
    if (!mutated) {
      return {};
    }
    set({ nodes: nextNodes });
    return changed;
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
      const removedJointNames = new Set<string>();
      while (toRemove.length > 0) {
        const currentId = toRemove.pop();
        if (!currentId) continue;
        const currentNode = nodes[currentId];
        if (!currentNode) continue;
        toRemove.push(...currentNode.children);
        for (const joint of currentNode.joints) {
          removedJointNames.add(joint.name);
        }
        delete nodes[currentId];
      }
      const parentId = state.nodes[id]?.parentId;
      if (parentId && nodes[parentId]) {
        nodes[parentId] = {
          ...nodes[parentId],
          children: nodes[parentId].children.filter((child) => child !== id)
        };
      }
      const poses = removedJointNames.size
        ? prunePoseValues(
            state.poses.map((pose) => {
              let changed = false;
              const values = { ...pose.values };
              for (const name of removedJointNames) {
                if (name in values) {
                  delete values[name];
                  changed = true;
                }
              }
              return changed ? { ...pose, values } : pose;
            }),
            gatherJointNames(nodes)
          )
        : state.poses;
      return {
        nodes,
        selectedId: parentId ?? state.rootId,
        connectMode: false,
        connectSourceId: undefined,
        poses
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
