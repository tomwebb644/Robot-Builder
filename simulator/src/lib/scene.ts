export type MotionType = 'rotational' | 'linear';
export type MotionAxis = 'x' | 'y' | 'z';
export type MeshKind = 'box' | 'cylinder' | 'sphere' | 'cone' | 'capsule' | 'custom';
export type PrimitiveMeshKind = Exclude<MeshKind, 'custom'>;

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

export interface CustomGeometry {
  kind: 'custom';
  sourceName: string;
  data: string;
  scale: number;
  unitScale: number;
  bounds: GeometryBounds;
  originOffset: [number, number, number];
}

export type MeshGeometry =
  | BoxGeometry
  | CylinderGeometry
  | SphereGeometry
  | ConeGeometry
  | CapsuleGeometry
  | CustomGeometry;

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
  staticRotation: [number, number, number];
  joints: JointDefinition[];
  notes?: string;
}

export interface SceneData {
  rootId: string;
  nodes: Record<string, LinkNode>;
  poses?: PoseDefinition[];
}

const clamp = (value: number, min: number, max: number) => Math.min(Math.max(value, min), max);

const randomId = () => {
  const globalCrypto = typeof crypto !== 'undefined' ? crypto : undefined;
  if (globalCrypto && 'randomUUID' in globalCrypto) {
    return globalCrypto.randomUUID();
  }
  return `node-${Math.random().toString(36).slice(2, 10)}`;
};

const coerceNumber = (value: unknown, fallback: number) => {
  const next = Number(value);
  return Number.isFinite(next) ? next : fallback;
};

const normalizeBounds = (source: Partial<GeometryBounds> | undefined, fallback: GeometryBounds): GeometryBounds => ({
  width: Math.max(coerceNumber(source?.width, fallback.width), 1e-3),
  depth: Math.max(coerceNumber(source?.depth, fallback.depth), 1e-3),
  height: Math.max(coerceNumber(source?.height, fallback.height), 1e-3),
  radial: Math.max(coerceNumber(source?.radial, fallback.radial), 1e-3)
});

const defaultBox = (): BoxGeometry => ({ kind: 'box', width: 0.3, depth: 0.3, height: 0.3 });

const normalizeGeometry = (geometry: any): MeshGeometry => {
  if (!geometry || typeof geometry !== 'object') {
    return defaultBox();
  }
  switch (geometry.kind) {
    case 'box':
      return {
        kind: 'box',
        width: Math.max(coerceNumber(geometry.width, 0.3), 1e-3),
        depth: Math.max(coerceNumber(geometry.depth, 0.3), 1e-3),
        height: Math.max(coerceNumber(geometry.height, 0.3), 1e-3)
      };
    case 'cylinder':
      return {
        kind: 'cylinder',
        radius: Math.max(coerceNumber(geometry.radius, 0.18), 1e-3),
        height: Math.max(coerceNumber(geometry.height, 0.5), 1e-3)
      };
    case 'sphere':
      return {
        kind: 'sphere',
        radius: Math.max(coerceNumber(geometry.radius, 0.24), 1e-3)
      };
    case 'cone':
      return {
        kind: 'cone',
        radius: Math.max(coerceNumber(geometry.radius, 0.16), 1e-3),
        height: Math.max(coerceNumber(geometry.height, 0.38), 1e-3)
      };
    case 'capsule':
      return {
        kind: 'capsule',
        radius: Math.max(coerceNumber(geometry.radius, 0.12), 1e-3),
        length: Math.max(coerceNumber(geometry.length, 0.28), 1e-3)
      };
    case 'custom': {
      const bounds = normalizeBounds(geometry.bounds, {
        width: 0.3,
        depth: 0.3,
        height: 0.3,
        radial: 0.15
      });
      const origin = Array.isArray(geometry.originOffset) ? geometry.originOffset : [0, 0, 0];
      const originOffset: [number, number, number] = [
        coerceNumber(origin[0], 0),
        coerceNumber(origin[1], 0),
        coerceNumber(origin[2], 0)
      ];
      return {
        kind: 'custom',
        sourceName: typeof geometry.sourceName === 'string' ? geometry.sourceName : 'Custom Mesh',
        data: typeof geometry.data === 'string' ? geometry.data : '',
        scale: Math.max(coerceNumber(geometry.scale, 1), 1e-3),
        unitScale: Math.max(coerceNumber(geometry.unitScale, 1), 1e-3),
        bounds,
        originOffset
      };
    }
    default:
      return defaultBox();
  }
};

const normalizeJoint = (joint: any, fallbackName: string): JointDefinition => {
  const type: MotionType = joint?.type === 'linear' ? 'linear' : 'rotational';
  const axis: MotionAxis = joint?.axis === 'x' || joint?.axis === 'y' ? joint.axis : 'z';
  const rawLimits = Array.isArray(joint?.limits) ? joint.limits : undefined;
  const lower = rawLimits ? coerceNumber(rawLimits[0], type === 'linear' ? 0 : -90) : type === 'linear' ? 0 : -90;
  const upper = rawLimits ? coerceNumber(rawLimits[1], type === 'linear' ? 150 : 90) : type === 'linear' ? 150 : 90;
  const limits: [number, number] = [Math.min(lower, upper), Math.max(lower, upper)];
  const rawValue = coerceNumber(joint?.currentValue, type === 'linear' ? limits[0] : 0);
  const pivotSource = Array.isArray(joint?.pivot) ? joint.pivot : [0, 0, 0];
  const pivot: [number, number, number] = [
    coerceNumber(pivotSource[0], 0),
    coerceNumber(pivotSource[1], 0),
    coerceNumber(pivotSource[2], 0)
  ];
  const id = typeof joint?.id === 'string' && joint.id.trim() ? joint.id : fallbackName;
  const name = typeof joint?.name === 'string' && joint.name.trim() ? joint.name : fallbackName;
  return {
    id,
    type,
    axis,
    limits,
    currentValue: clamp(rawValue, limits[0], limits[1]),
    name,
    externalControl: Boolean(joint?.externalControl),
    pivot
  };
};

const normalizeNode = (rawNode: any): LinkNode => {
  const id = typeof rawNode?.id === 'string' && rawNode.id.trim() ? rawNode.id : randomId();
  const geometry = normalizeGeometry(rawNode?.geometry);
  const rawBaseOffset = Array.isArray(rawNode?.baseOffset) ? rawNode.baseOffset : [0, 0, 0];
  const rawStaticRotation = Array.isArray(rawNode?.staticRotation) ? rawNode.staticRotation : [0, 0, 0];
  const joints = Array.isArray(rawNode?.joints) ? rawNode.joints : [];
  const children = Array.isArray(rawNode?.children)
    ? rawNode.children.filter((child: any) => typeof child === 'string')
    : [];
  return {
    id,
    name: typeof rawNode?.name === 'string' ? rawNode.name : 'Link',
    geometry,
    color: typeof rawNode?.color === 'string' ? rawNode.color : '#94a3b8',
    parentId: typeof rawNode?.parentId === 'string' ? rawNode.parentId : undefined,
    children,
    baseOffset: [
      coerceNumber(rawBaseOffset[0], 0),
      coerceNumber(rawBaseOffset[1], 0),
      coerceNumber(rawBaseOffset[2], 0)
    ],
    staticRotation: [
      coerceNumber(rawStaticRotation[0], 0),
      coerceNumber(rawStaticRotation[1], 0),
      coerceNumber(rawStaticRotation[2], 0)
    ],
    joints: joints.map((joint: any, index: number) => normalizeJoint(joint, `${id}-joint-${index + 1}`)),
    notes: typeof rawNode?.notes === 'string' ? rawNode.notes : undefined
  };
};

export const parseSceneData = (raw: unknown): SceneData => {
  if (!raw || typeof raw !== 'object') {
    throw new Error('Scene payload must be an object.');
  }
  const scene = raw as any;
  if (!scene.nodes || typeof scene.nodes !== 'object') {
    throw new Error('Scene payload is missing nodes.');
  }
  const normalizedNodes: Record<string, LinkNode> = {};
  for (const [id, rawNode] of Object.entries(scene.nodes as Record<string, unknown>)) {
    const node = normalizeNode({ id, ...(rawNode as object) });
    normalizedNodes[node.id] = node;
  }
  // fix children references to ensure they exist
  for (const node of Object.values(normalizedNodes)) {
    node.children = node.children.filter((childId) => normalizedNodes[childId]);
  }
  const rootId = typeof scene.rootId === 'string' && normalizedNodes[scene.rootId]
    ? scene.rootId
    : Object.keys(normalizedNodes)[0];
  if (!rootId) {
    throw new Error('Scene payload does not contain any nodes.');
  }
  return {
    rootId,
    nodes: normalizedNodes,
    poses: Array.isArray(scene.poses) ? (scene.poses as PoseDefinition[]) : []
  };
};

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
    case 'custom': {
      const scale = Number.isFinite(geometry.scale) ? geometry.scale : 1;
      return {
        width: geometry.bounds.width * scale,
        depth: geometry.bounds.depth * scale,
        height: geometry.bounds.height * scale,
        radial: geometry.bounds.radial * scale
      };
    }
    default:
      return { width: 0.3, depth: 0.3, height: 0.3, radial: 0.15 };
  }
};

export const axisToVector = (axis: MotionAxis): [number, number, number] => {
  switch (axis) {
    case 'x':
      return [1, 0, 0];
    case 'y':
      return [0, 1, 0];
    case 'z':
    default:
      return [0, 0, 1];
  }
};
