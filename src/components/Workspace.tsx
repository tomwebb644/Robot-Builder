import React, { Suspense, useEffect, useMemo, useRef } from 'react';
import { Canvas, useFrame } from '@react-three/fiber';
import { OrbitControls, Grid, Line } from '@react-three/drei';
import * as THREE from 'three';
import { useSceneStore } from '@state/store';
import type { MotionAxis, MeshGeometry } from '@state/store';
import { getGeometryBounds } from '@state/store';

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

  const rotation = useMemo(() => {
    if (!node.joint || node.joint.type !== 'rotational') {
      return [0, 0, 0] as [number, number, number];
    }
    const radians = THREE.MathUtils.degToRad(node.joint.currentValue);
    const [x, y, z] = axisToVector(node.joint.axis);
    return [radians * x, radians * y, radians * z] as [number, number, number];
  }, [node.joint]);

  const translation = useMemo(() => {
    if (!node.joint || node.joint.type !== 'linear') {
      return [0, 0, 0] as [number, number, number];
    }
    const vector = axisToVector(node.joint.axis);
    const scale = node.joint.currentValue / 1000;
    return [vector[0] * scale, vector[1] * scale, vector[2] * scale] as [number, number, number];
  }, [node.joint]);

  const bounds = useMemo(() => getGeometryBounds(node.geometry), [node.geometry]);

  const basePosition = useMemo(() => {
    if (!node.parentId) {
      return [node.baseOffset[0], bounds.height / 2 + node.baseOffset[1], node.baseOffset[2]] as [
        number,
        number,
        number
      ];
    }
    return node.baseOffset;
  }, [node.baseOffset, node.parentId, bounds.height]);

  const rotationalIndicator = useMemo(() => {
    if (!node.joint || node.joint.type !== 'rotational') return null;
    const [min, max] = node.joint.limits;
    const steps = 48;
    const radius = bounds.radial * 1.4;
    const start = THREE.MathUtils.degToRad(min);
    const end = THREE.MathUtils.degToRad(max);
    const defaultAxis = new THREE.Vector3(0, 0, 1);
    const axisVector = new THREE.Vector3(...axisToVector(node.joint.axis)).normalize();
    const quaternion = new THREE.Quaternion().setFromUnitVectors(defaultAxis, axisVector);
    const points: THREE.Vector3[] = [];
    for (let index = 0; index <= steps; index += 1) {
      const t = index / steps;
      const angle = start + (end - start) * t;
      const point = new THREE.Vector3(Math.cos(angle) * radius, Math.sin(angle) * radius, 0);
      points.push(point.applyQuaternion(quaternion));
    }
    return points;
  }, [node]);

  const linearIndicator = useMemo(() => {
    if (!node.joint || node.joint.type !== 'linear') return null;
    const [min, max] = node.joint.limits;
    const axisVector = new THREE.Vector3(...axisToVector(node.joint.axis)).normalize();
    const start = axisVector.clone().multiplyScalar(min / 1000);
    const end = axisVector.clone().multiplyScalar(max / 1000);
    return [start, end];
  }, [node]);

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

  const geometryElement = useMemo(() => {
    const geometry: MeshGeometry = node.geometry;
    switch (geometry.kind) {
      case 'box':
        return <boxGeometry args={[geometry.width, geometry.height, geometry.depth]} />;
      case 'cylinder':
        return <cylinderGeometry args={[geometry.radius, geometry.radius, geometry.height, 32]} />;
      case 'sphere':
        return <sphereGeometry args={[geometry.radius, 32, 32]} />;
      case 'cone':
        return <coneGeometry args={[geometry.radius, geometry.height, 32]} />;
      case 'capsule':
        return <capsuleGeometry args={[geometry.radius, geometry.length, 8, 16]} />;
      default:
        return null;
    }
  }, [node.geometry]);

  const content = (
    <group position={basePosition}>
      <group rotation={rotation} position={translation}>
        <mesh
          castShadow
          receiveShadow
          onPointerDown={handlePointerDown}
          onPointerOver={handlePointerOver}
          onPointerOut={handlePointerOut}
        >
          {geometryElement}
          <meshStandardMaterial color={materialColor} emissive={emissive} roughness={0.4} metalness={0.15} />
        </mesh>
        {isSelected && rotationalIndicator ? (
          <Line
            points={rotationalIndicator}
            color="#facc15"
            lineWidth={2}
            dashed
            dashScale={2}
            dashSize={0.12}
            gapSize={0.08}
          />
        ) : null}
        {isSelected && linearIndicator ? (
          <Line points={linearIndicator} color="#34d399" lineWidth={2} />
        ) : null}
        {node.children.map((child) => (
          <LinkGroup nodeId={child} key={child} />
        ))}
      </group>
    </group>
  );
  return content;
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
      <Canvas className="workspace-canvas" camera={{ position: [3, 2.2, 3.6], fov: 50 }} shadows>
        <color attach="background" args={['#0f141f']} />
        <ambientLight intensity={0.35} />
        <directionalLight position={[5, 6, 3]} intensity={1.1} castShadow shadow-mapSize-width={2048} shadow-mapSize-height={2048} />
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
        />
        <OrbitControls makeDefault enablePan enableDamping dampingFactor={0.08} />
      </Canvas>
    </div>
  );
};

export default Workspace;
