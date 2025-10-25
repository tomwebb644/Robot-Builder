import * as THREE from 'three';
import {
  SceneData,
  LinkNode,
  JointDefinition,
  axisToVector,
  getGeometryBounds
} from './scene';

export interface JointWorldState {
  nodeId: string;
  jointIndex: number;
  joint: JointDefinition;
  pivot: THREE.Vector3;
  axis: THREE.Vector3;
}

export interface NodeWorldState {
  id: string;
  worldMatrix: THREE.Matrix4;
  position: THREE.Vector3;
  joints: JointWorldState[];
}

export interface SceneWorldState {
  nodes: Record<string, NodeWorldState>;
}

const DEG_TO_RAD = Math.PI / 180;
const MM_TO_M = 1 / 1000;
const M_TO_MM = 1000;

const computeBaseTranslation = (node: LinkNode, isRoot: boolean) => {
  if (isRoot) {
    const bounds = getGeometryBounds(node.geometry);
    return new THREE.Vector3(node.baseOffset[0], node.baseOffset[1], node.baseOffset[2] + bounds.height / 2);
  }
  return new THREE.Vector3(node.baseOffset[0], node.baseOffset[1], node.baseOffset[2]);
};

const applyJointTransform = (matrix: THREE.Matrix4, joint: JointDefinition) => {
  const pivot = new THREE.Vector3(...joint.pivot);
  matrix.multiply(new THREE.Matrix4().makeTranslation(pivot.x, pivot.y, pivot.z));
  if (joint.type === 'rotational') {
    const radians = joint.currentValue * DEG_TO_RAD;
    if (joint.axis === 'x') {
      matrix.multiply(new THREE.Matrix4().makeRotationX(radians));
    } else if (joint.axis === 'y') {
      matrix.multiply(new THREE.Matrix4().makeRotationY(radians));
    } else {
      matrix.multiply(new THREE.Matrix4().makeRotationZ(radians));
    }
  } else {
    const axis = axisToVector(joint.axis);
    const translation = new THREE.Vector3(axis[0], axis[1], axis[2]).multiplyScalar(joint.currentValue * MM_TO_M);
    matrix.multiply(new THREE.Matrix4().makeTranslation(translation.x, translation.y, translation.z));
  }
  matrix.multiply(new THREE.Matrix4().makeTranslation(-pivot.x, -pivot.y, -pivot.z));
};

const cloneJoint = (joint: JointDefinition): JointDefinition => ({
  id: joint.id,
  type: joint.type,
  axis: joint.axis,
  limits: [joint.limits[0], joint.limits[1]],
  currentValue: joint.currentValue,
  name: joint.name,
  externalControl: joint.externalControl,
  pivot: [joint.pivot[0], joint.pivot[1], joint.pivot[2]]
});

export const computeKinematics = (scene: SceneData): SceneWorldState => {
  const result: SceneWorldState = { nodes: {} };
  const traverse = (nodeId: string, parentMatrix: THREE.Matrix4) => {
    const node = scene.nodes[nodeId];
    if (!node) {
      return;
    }
    const matrix = parentMatrix.clone();
    const baseTranslation = computeBaseTranslation(node, nodeId === scene.rootId);
    matrix.multiply(new THREE.Matrix4().makeTranslation(baseTranslation.x, baseTranslation.y, baseTranslation.z));
    const staticRotation = node.staticRotation ?? [0, 0, 0];
    if (staticRotation.some((value) => Math.abs(value) > 1e-6)) {
      const euler = new THREE.Euler(
        staticRotation[0] * DEG_TO_RAD,
        staticRotation[1] * DEG_TO_RAD,
        staticRotation[2] * DEG_TO_RAD,
        'XYZ'
      );
      matrix.multiply(new THREE.Matrix4().makeRotationFromEuler(euler));
    }

    const jointStates: JointWorldState[] = [];

    node.joints.forEach((joint, index) => {
      const rotationOnly = new THREE.Matrix3().setFromMatrix4(matrix);
      const axisVector = new THREE.Vector3(...axisToVector(joint.axis)).applyMatrix3(rotationOnly).normalize();
      const pivot = new THREE.Vector3(joint.pivot[0], joint.pivot[1], joint.pivot[2]).applyMatrix4(matrix);
      jointStates.push({
        nodeId,
        jointIndex: index,
        joint,
        pivot,
        axis: axisVector
      });
      applyJointTransform(matrix, joint);
    });

    const position = new THREE.Vector3(0, 0, 0).applyMatrix4(matrix);
    result.nodes[nodeId] = {
      id: nodeId,
      worldMatrix: matrix.clone(),
      position,
      joints: jointStates
    };

    for (const childId of node.children) {
      traverse(childId, matrix);
    }
  };

  traverse(scene.rootId, new THREE.Matrix4());
  return result;
};

const gatherPath = (scene: SceneData, targetId: string): string[] => {
  const path: string[] = [];
  let current: string | undefined = targetId;
  while (current) {
    path.push(current);
    current = scene.nodes[current]?.parentId;
  }
  return path.reverse();
};

export const collectJointValues = (scene: SceneData): Record<string, number> => {
  const values: Record<string, number> = {};
  for (const node of Object.values(scene.nodes)) {
    for (const joint of node.joints) {
      if (joint.name) {
        values[joint.name] = joint.currentValue;
      }
    }
  }
  return values;
};

interface IkOptions {
  maxIterations?: number;
  tolerance?: number;
}

interface IkResult {
  scene: SceneData;
  jointValues: Record<string, number>;
  success: boolean;
}

const clamp = (value: number, min: number, max: number) => Math.min(Math.max(value, min), max);

const projectOntoPlane = (vector: THREE.Vector3, normal: THREE.Vector3) => {
  const projection = normal.clone().multiplyScalar(vector.dot(normal));
  return vector.clone().sub(projection);
};

const cloneSceneAlongPath = (scene: SceneData, path: string[]): SceneData => {
  const nodes: Record<string, LinkNode> = { ...scene.nodes };
  for (const id of path) {
    const node = scene.nodes[id];
    if (!node) continue;
    nodes[id] = {
      ...node,
      joints: node.joints.map((joint) => cloneJoint(joint))
    };
  }
  return {
    ...scene,
    nodes
  };
};

export const solveIkForNode = (
  scene: SceneData,
  targetNodeId: string,
  target: THREE.Vector3,
  options: IkOptions = {}
): IkResult => {
  const path = gatherPath(scene, targetNodeId);
  if (path.length === 0) {
    return { scene, jointValues: collectJointValues(scene), success: false };
  }
  const jointChain = path.flatMap((nodeId) => {
    const node = scene.nodes[nodeId];
    if (!node) return [];
    return node.joints.map((joint, index) => ({ nodeId, index, joint }));
  });
  if (jointChain.length === 0) {
    return { scene, jointValues: collectJointValues(scene), success: false };
  }

  const workingScene = cloneSceneAlongPath(scene, path);
  const maxIterations = options.maxIterations ?? 12;
  const tolerance = options.tolerance ?? 0.005; // meters

  let success = false;

  for (let iteration = 0; iteration < maxIterations; iteration += 1) {
    let updated = false;
    for (let jointIndex = jointChain.length - 1; jointIndex >= 0; jointIndex -= 1) {
      const ref = jointChain[jointIndex];
      const node = workingScene.nodes[ref.nodeId];
      const joint = node?.joints[ref.index];
      if (!node || !joint) {
        continue;
      }
      const worldState = computeKinematics(workingScene);
      const nodeState = worldState.nodes[ref.nodeId];
      const jointState = nodeState?.joints[ref.index];
      const effectorState = worldState.nodes[targetNodeId];
      if (!jointState || !effectorState) {
        continue;
      }
      const effector = effectorState.position.clone();
      const pivot = jointState.pivot.clone();
      const toEffector = effector.clone().sub(pivot);
      const toTarget = target.clone().sub(pivot);

      if (joint.type === 'rotational') {
        const axis = jointState.axis.clone().normalize();
        const currentProjection = projectOntoPlane(toEffector, axis);
        const targetProjection = projectOntoPlane(toTarget, axis);
        const currentLength = currentProjection.length();
        const targetLength = targetProjection.length();
        if (currentLength < 1e-5 || targetLength < 1e-5) {
          continue;
        }
        currentProjection.normalize();
        targetProjection.normalize();
        const dot = THREE.MathUtils.clamp(currentProjection.dot(targetProjection), -1, 1);
        let angle = Math.acos(dot);
        const cross = new THREE.Vector3().crossVectors(currentProjection, targetProjection);
        const direction = cross.dot(axis) < 0 ? -1 : 1;
        angle *= direction;
        if (!Number.isFinite(angle) || Math.abs(angle) < 1e-4) {
          continue;
        }
        const nextValue = clamp(joint.currentValue + THREE.MathUtils.radToDeg(angle), joint.limits[0], joint.limits[1]);
        if (Math.abs(nextValue - joint.currentValue) < 1e-3) {
          continue;
        }
        joint.currentValue = nextValue;
        updated = true;
      } else {
        const axis = jointState.axis.clone().normalize();
        const currentDistance = toEffector.dot(axis);
        const targetDistance = toTarget.dot(axis);
        const delta = targetDistance - currentDistance;
        if (!Number.isFinite(delta) || Math.abs(delta) < 1e-5) {
          continue;
        }
        const nextValue = clamp(joint.currentValue + delta * M_TO_MM, joint.limits[0], joint.limits[1]);
        if (Math.abs(nextValue - joint.currentValue) < 1e-3) {
          continue;
        }
        joint.currentValue = nextValue;
        updated = true;
      }
    }

    const finalState = computeKinematics(workingScene);
    const effector = finalState.nodes[targetNodeId]?.position;
    if (effector && effector.distanceTo(target) <= tolerance) {
      success = true;
      break;
    }
    if (!updated) {
      break;
    }
  }

  return {
    scene: workingScene,
    jointValues: collectJointValues(workingScene),
    success
  };
};
