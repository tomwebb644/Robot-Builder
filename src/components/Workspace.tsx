import React, { Suspense, useEffect, useMemo, useRef } from 'react';
import { Canvas, useFrame } from '@react-three/fiber';
import { OrbitControls, Grid, Line } from '@react-three/drei';
import * as THREE from 'three';
import { useSceneStore } from '@state/store';
import type { MotionAxis, MeshGeometry } from '@state/store';
import { getGeometryBounds } from '@state/store';
import { STLLoader } from 'three/examples/jsm/loaders/STLLoader';
import { base64ToArrayBuffer } from '@utils/binary';

THREE.Object3D.DEFAULT_UP.set(0, 0, 1);

const axisToVector = (axis: MotionAxis): [number, number, number] => {
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

const LinkGroup: React.FC<{ nodeId: string }> = ({ nodeId }) => {
  const node = useSceneStore((state) => state.nodes[nodeId]);
  const selectNode = useSceneStore((state) => state.selectNode);
  const selectedId = useSceneStore((state) => state.selectedId);
  const connectMode = useSceneStore((state) => state.connectMode);
  const connectSourceId = useSceneStore((state) => state.connectSourceId);

  if (!node) return null;

  const isSelected = nodeId === selectedId;
  const isConnectTarget = connectMode && connectSourceId && nodeId !== connectSourceId;

  const bounds = useMemo(() => getGeometryBounds(node.geometry), [node.geometry]);

  const basePosition = useMemo(() => {
    if (!node.parentId) {
      return [node.baseOffset[0], node.baseOffset[1], bounds.height / 2 + node.baseOffset[2]] as [
        number,
        number,
        number
      ];
    }
    return node.baseOffset;
  }, [node.baseOffset, node.parentId, bounds.height]);

  const indicatorData = useMemo(() => {
    const rotational: Record<string, THREE.Vector3[]> = {};
    const linear: Record<string, [THREE.Vector3, THREE.Vector3]> = {};
    const radius = bounds.radial > 0 ? bounds.radial * 1.4 : 0.15;
    for (const joint of node.joints) {
      if (joint.type === 'rotational') {
        const [min, max] = joint.limits;
        const steps = 48;
        const start = THREE.MathUtils.degToRad(min);
        const end = THREE.MathUtils.degToRad(max);
        const defaultAxis = new THREE.Vector3(0, 0, 1);
        const axisVector = new THREE.Vector3(...axisToVector(joint.axis)).normalize();
        const quaternion = new THREE.Quaternion().setFromUnitVectors(defaultAxis, axisVector);
        const points: THREE.Vector3[] = [];
        for (let index = 0; index <= steps; index += 1) {
          const t = index / steps;
          const angle = start + (end - start) * t;
          const point = new THREE.Vector3(Math.cos(angle) * radius, Math.sin(angle) * radius, 0);
          points.push(point.applyQuaternion(quaternion));
        }
        rotational[joint.id] = points;
      }
      if (joint.type === 'linear') {
        const [min, max] = joint.limits;
        const axisVector = new THREE.Vector3(...axisToVector(joint.axis)).normalize();
        const start = axisVector.clone().multiplyScalar(min / 1000);
        const end = axisVector.clone().multiplyScalar(max / 1000);
        linear[joint.id] = [start, end];
      }
    }
    return { rotational, linear };
  }, [node.joints, bounds.radial]);

  const handlePointerDown = (event: THREE.Event) => {
    event.stopPropagation();
    selectNode(nodeId);
  };

  const handlePointerOver = (event: THREE.Event) => {
    event.stopPropagation();
    document.body.style.cursor = 'pointer';
  };

  const handlePointerOut = (event: THREE.Event) => {
    event.stopPropagation();
    document.body.style.cursor = 'default';
  };

  const materialColor = isSelected
    ? new THREE.Color(node.color).offsetHSL(0, 0, 0.15).getStyle()
    : node.color;
  const emissive = isSelected ? node.color : isConnectTarget ? '#6366f1' : '#000000';

  const loader = useMemo(() => new STLLoader(), []);
  const customGeometry = useMemo(() => {
    if (node.geometry.kind !== 'custom') {
      return null;
    }
    try {
      const buffer = base64ToArrayBuffer(node.geometry.data);
      const parsed = loader.parse(buffer);
      parsed.computeVertexNormals();
      parsed.translate(
        node.geometry.originOffset[0],
        node.geometry.originOffset[1],
        node.geometry.originOffset[2]
      );
      const scale = Number.isFinite(node.geometry.scale) ? node.geometry.scale : 1;
      parsed.scale(scale, scale, scale);
      return parsed;
    } catch (error) {
      console.error('Failed to parse custom geometry', error);
      return null;
    }
  }, [loader, node.geometry]);

  useEffect(() => {
    return () => {
      customGeometry?.dispose();
    };
  }, [customGeometry]);

  const staticRotationRadians = useMemo(() => {
    const rotation = node.staticRotation ?? [0, 0, 0];
    return [
      THREE.MathUtils.degToRad(rotation[0]),
      THREE.MathUtils.degToRad(rotation[1]),
      THREE.MathUtils.degToRad(rotation[2])
    ] as [number, number, number];
  }, [node.staticRotation]);

  const { geometryElement, meshRotation } = useMemo(() => {
    const geometry: MeshGeometry = node.geometry;
    const baseRotation: [number, number, number] = [0, 0, 0];

    switch (geometry.kind) {
      case 'box':
        return {
          geometryElement: <boxGeometry args={[geometry.width, geometry.depth, geometry.height]} />,
          meshRotation: baseRotation
        };
      case 'cylinder':
        return {
          geometryElement: (
            <cylinderGeometry args={[geometry.radius, geometry.radius, geometry.height, 32]} />
          ),
          meshRotation: [Math.PI / 2, 0, 0] as [number, number, number]
        };
      case 'sphere':
        return {
          geometryElement: <sphereGeometry args={[geometry.radius, 32, 32]} />,
          meshRotation: baseRotation
        };
      case 'cone':
        return {
          geometryElement: <coneGeometry args={[geometry.radius, geometry.height, 32]} />,
          meshRotation: [Math.PI / 2, 0, 0] as [number, number, number]
        };
      case 'capsule':
        return {
          geometryElement: <capsuleGeometry args={[geometry.radius, geometry.length, 8, 16]} />,
          meshRotation: [Math.PI / 2, 0, 0] as [number, number, number]
        };
      case 'custom':
        return {
          geometryElement: customGeometry ? (
            <primitive object={customGeometry} attach="geometry" />
          ) : null,
          meshRotation: baseRotation
        };
      default:
        return {
          geometryElement: null,
          meshRotation: baseRotation
        };
    }
  }, [node.geometry, customGeometry]);

  const baseChildren = (
    <group rotation={staticRotationRadians}>
      <mesh
        castShadow
        receiveShadow
        onPointerDown={handlePointerDown}
        onPointerOver={handlePointerOver}
        onPointerOut={handlePointerOut}
        rotation={meshRotation}
      >
        {geometryElement}
        <meshStandardMaterial color={materialColor} emissive={emissive} roughness={0.4} metalness={0.15} />
      </mesh>
      {node.children.map((child) => (
        <LinkGroup nodeId={child} key={child} />
      ))}
    </group>
  );

  const jointWrapped = node.joints.reduceRight<React.ReactNode>((childContent, joint) => {
    const pivot = joint.pivot ?? [0, 0, 0];
    if (joint.type === 'rotational') {
      const radians = THREE.MathUtils.degToRad(joint.currentValue);
      const [x, y, z] = axisToVector(joint.axis);
      const rotation: [number, number, number] = [radians * x, radians * y, radians * z];
      return (
        <group key={joint.id} position={pivot}>
          <group rotation={rotation}>
            {isSelected && indicatorData.rotational[joint.id] ? (
              <Line
                points={indicatorData.rotational[joint.id]}
                color="#facc15"
                lineWidth={2}
                dashed
                dashScale={2}
                dashSize={0.12}
                gapSize={0.08}
              />
            ) : null}
            <group position={[-pivot[0], -pivot[1], -pivot[2]]}>{childContent}</group>
          </group>
        </group>
      );
    }
    const axis = axisToVector(joint.axis);
    const scale = joint.currentValue / 1000;
    const translation: [number, number, number] = [axis[0] * scale, axis[1] * scale, axis[2] * scale];
    return (
      <group key={joint.id} position={pivot}>
        <group position={translation}>
          {isSelected && indicatorData.linear[joint.id] ? (
            <Line points={indicatorData.linear[joint.id]} color="#34d399" lineWidth={2} />
          ) : null}
          <group position={[-pivot[0], -pivot[1], -pivot[2]]}>{childContent}</group>
        </group>
      </group>
    );
  }, baseChildren);

  return <group position={basePosition}>{jointWrapped}</group>;
};

const RobotScene: React.FC<{ rootId: string }> = ({ rootId }) => {
  const updateFps = useSceneStore((state) => state.updateFps);
  const advanceSimulation = useSceneStore((state) => state.advanceSimulation);
  const simulationPlaying = useSceneStore((state) => state.simulationPlaying);
  const lastUpdate = useRef(performance.now());
  const frames = useRef(0);

  useFrame((_, delta) => {
    frames.current += 1;
    const now = performance.now();
    const elapsed = now - lastUpdate.current;
    if (elapsed > 500) {
      updateFps(Number(((frames.current * 1000) / elapsed).toFixed(1)));
      frames.current = 0;
      lastUpdate.current = now;
    }
    if (simulationPlaying) {
      advanceSimulation(delta);
    }
  });

  return <LinkGroup nodeId={rootId} />;
};

const Workspace: React.FC = () => {
  const rootId = useSceneStore((state) => state.rootId);

  useEffect(() => {
    document.body.style.cursor = 'default';
  }, []);

  return (
    <div className="workspace-container">
      <Canvas
        className="workspace-canvas"
        camera={{ position: [3, 2.2, 3.6], fov: 50 }}
        shadows
        onCreated={({ camera, scene }) => {
          camera.up.set(0, 0, 1);
          scene.up.set(0, 0, 1);
        }}
      >
        <color attach="background" args={['#0f141f']} />
        <ambientLight intensity={0.35} />
        <directionalLight
          position={[5, 3, 6]}
          intensity={1.1}
          castShadow
          shadow-mapSize-width={2048}
          shadow-mapSize-height={2048}
        />
        <Suspense fallback={null}>
          <RobotScene rootId={rootId} />
        </Suspense>
        <Grid
          infiniteGrid
          sectionSize={1}
          sectionThickness={0.4}
          cellSize={0.25}
          cellThickness={0.15}
          position={[0, 0, 0]}
          rotation={[Math.PI / 2, 0, 0]}
        />
        <OrbitControls makeDefault enablePan enableDamping dampingFactor={0.08} />
      </Canvas>
    </div>
  );
};

export default Workspace;
