import React, { Suspense, useMemo, useRef } from 'react';
import { Canvas, useFrame } from '@react-three/fiber';
import { OrbitControls, Grid } from '@react-three/drei';
import * as THREE from 'three';
import { useSceneStore } from '@state/store';
import type { MotionAxis } from '@state/store';

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

  const isSelected = nodeId === selectedId;

  const rotation = useMemo(() => {
    if (!node?.joint || node.joint.type !== 'rotational') {
      return [0, 0, 0] as [number, number, number];
    }
    const radians = THREE.MathUtils.degToRad(node.joint.currentValue);
    const [x, y, z] = axisToVector(node.joint.axis);
    return [radians * x, radians * y, radians * z] as [number, number, number];
  }, [node?.joint]);

  const translation = useMemo(() => {
    if (!node?.joint || node.joint.type !== 'linear') {
      return [0, 0, 0] as [number, number, number];
    }
    const vector = axisToVector(node.joint.axis);
    const scale = node.joint.currentValue / 1000; // convert mm to meters
    return [vector[0] * scale, vector[1] * scale, vector[2] * scale] as [number, number, number];
  }, [node?.joint]);

  if (!node) return null;

  const geometryHeight = node.geometry.kind === 'box' ? node.geometry.height : node.geometry.height;
  const basePosition: [number, number, number] = node.parentId
    ? node.baseOffset
    : [node.baseOffset[0], node.baseOffset[1] + geometryHeight / 2, node.baseOffset[2]];

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

  const materialColor = isSelected ? new THREE.Color(node.color).offsetHSL(0, 0, 0.15).getStyle() : node.color;
  const emissive = isSelected ? node.color : '#000000';

  const geometryElement =
    node.geometry.kind === 'box' ? (
      <boxGeometry args={[node.geometry.width, node.geometry.height, node.geometry.depth]} />
    ) : (
      <cylinderGeometry args={[node.geometry.radius, node.geometry.radius, node.geometry.height, 32]} />
    );

  return (
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
        {node.children.map((child) => (
          <LinkGroup nodeId={child} key={child} />
        ))}
      </group>
    </group>
  );
};

const RobotScene: React.FC<{ rootId: string }> = ({ rootId }) => {
  const updateFps = useSceneStore((state) => state.updateFps);
  const lastUpdate = useRef(performance.now());
  const frames = useRef(0);

  useFrame(() => {
    frames.current += 1;
    const now = performance.now();
    const elapsed = now - lastUpdate.current;
    if (elapsed > 500) {
      updateFps(Number(((frames.current * 1000) / elapsed).toFixed(1)));
      frames.current = 0;
      lastUpdate.current = now;
    }
  });

  return <LinkGroup nodeId={rootId} />;
};

const Workspace: React.FC = () => {
  const rootId = useSceneStore((state) => state.rootId);

  return (
    <div className="workspace-container">
      <Canvas className="workspace-canvas" camera={{ position: [3, 2.2, 3.6], fov: 50 }} shadows>
        <color attach="background" args={['#0f141f']} />
        <ambientLight intensity={0.35} />
        <directionalLight position={[5, 6, 3]} intensity={1.1} castShadow shadow-mapSize-width={2048} shadow-mapSize-height={2048} />
        <Suspense fallback={null}>
          <RobotScene rootId={rootId} />
        </Suspense>
        <Grid infiniteGrid sectionSize={1} sectionThickness={0.4} cellSize={0.25} cellThickness={0.15} position={[0, 0, 0]} />
        <OrbitControls makeDefault enablePan enableDamping dampingFactor={0.08} />
      </Canvas>
    </div>
  );
};

export default Workspace;
