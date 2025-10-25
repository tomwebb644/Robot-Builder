import React, { Suspense, useCallback, useEffect, useMemo, useState } from 'react';
import { Canvas, ThreeEvent } from '@react-three/fiber';
import { OrbitControls, Grid } from '@react-three/drei';
import * as THREE from 'three';
import { STLLoader } from 'three/examples/jsm/loaders/STLLoader';
import { SceneData, axisToVector, getGeometryBounds } from '@lib/scene';
import { computeKinematics } from '@lib/kinematics';
import { base64ToArrayBuffer } from '@lib/binary';
import { useSimulatorStore } from '@state/simulatorStore';

THREE.Object3D.DEFAULT_UP.set(0, 0, 1);

interface LinkGroupProps {
  nodeId: string;
  scene: SceneData;
  draggingId?: string | null;
  onPointerDown: (nodeId: string, event: ThreeEvent<PointerEvent>) => void;
}

const LinkGroup: React.FC<LinkGroupProps> = ({ nodeId, scene, draggingId, onPointerDown }) => {
  const node = scene.nodes[nodeId];
  if (!node) {
    return null;
  }

  const bounds = useMemo(() => getGeometryBounds(node.geometry), [node.geometry]);
  const isRoot = nodeId === scene.rootId;
  const basePosition = useMemo(() => {
    if (isRoot) {
      return [node.baseOffset[0], node.baseOffset[1], node.baseOffset[2] + bounds.height / 2] as [
        number,
        number,
        number
      ];
    }
    return node.baseOffset;
  }, [node.baseOffset, isRoot, bounds.height]);

  const staticRotationRadians = useMemo(() => {
    const rotation = node.staticRotation ?? [0, 0, 0];
    return [
      THREE.MathUtils.degToRad(rotation[0]),
      THREE.MathUtils.degToRad(rotation[1]),
      THREE.MathUtils.degToRad(rotation[2])
    ] as [number, number, number];
  }, [node.staticRotation]);

  const loader = useMemo(() => new STLLoader(), []);
  const customGeometry = useMemo(() => {
    if (node.geometry.kind !== 'custom' || !node.geometry.data) {
      return null;
    }
    try {
      const buffer = base64ToArrayBuffer(node.geometry.data);
      const parsed = loader.parse(buffer);
      parsed.computeVertexNormals();
      const scale = Number.isFinite(node.geometry.scale) ? node.geometry.scale : 1;
      const unitScale = Number.isFinite(node.geometry.unitScale) ? node.geometry.unitScale : 1;
      parsed.scale(unitScale * scale, unitScale * scale, unitScale * scale);
      parsed.translate(
        node.geometry.originOffset[0],
        node.geometry.originOffset[1],
        node.geometry.originOffset[2]
      );
      return parsed;
    } catch (error) {
      console.warn('Unable to parse custom geometry', error);
      return null;
    }
  }, [loader, node.geometry]);

  useEffect(() => {
    return () => {
      customGeometry?.dispose();
    };
  }, [customGeometry]);

  const { geometryElement, meshRotation } = useMemo(() => {
    const geometry = node.geometry;
    switch (geometry.kind) {
      case 'box':
        return {
          geometryElement: <boxGeometry args={[geometry.width, geometry.depth, geometry.height]} />,
          meshRotation: [0, 0, 0] as [number, number, number]
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
          meshRotation: [0, 0, 0] as [number, number, number]
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
          meshRotation: [0, 0, 0] as [number, number, number]
        };
      default:
        return { geometryElement: null, meshRotation: [0, 0, 0] as [number, number, number] };
    }
  }, [node.geometry, customGeometry]);

  const highlight = draggingId === nodeId;
  const materialColor = useMemo(() => {
    if (!highlight) {
      return node.color;
    }
    const base = new THREE.Color(node.color);
    return base.offsetHSL(0, 0, 0.18).getStyle();
  }, [highlight, node.color]);

  const handlePointerDown = useCallback(
    (event: ThreeEvent<PointerEvent>) => {
      event.stopPropagation();
      onPointerDown(nodeId, event);
    },
    [nodeId, onPointerDown]
  );

  const handlePointerOver = useCallback((event: ThreeEvent<PointerEvent>) => {
    event.stopPropagation();
    document.body.style.cursor = 'grab';
  }, []);

  const handlePointerOut = useCallback((event: ThreeEvent<PointerEvent>) => {
    event.stopPropagation();
    document.body.style.cursor = 'default';
  }, []);

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
        <meshStandardMaterial
          color={materialColor}
          emissive={highlight ? '#2563eb' : '#000000'}
          emissiveIntensity={highlight ? 0.45 : 0}
          roughness={0.4}
          metalness={0.2}
        />
      </mesh>
      {node.children.map((child) => (
        <LinkGroup
          key={child}
          nodeId={child}
          scene={scene}
          draggingId={draggingId}
          onPointerDown={onPointerDown}
        />
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
          <group position={[-pivot[0], -pivot[1], -pivot[2]]}>{childContent}</group>
        </group>
      </group>
    );
  }, baseChildren);

  return <group position={basePosition}>{jointWrapped}</group>;
};

export const SceneCanvas: React.FC = () => {
  const scene = useSimulatorStore((state) => state.scene);
  const solveForTarget = useSimulatorStore((state) => state.solveForTarget);
  const [dragState, setDragState] = useState<{ nodeId: string; plane: THREE.Plane } | null>(null);

  const kinematics = useMemo(() => (scene ? computeKinematics(scene) : undefined), [scene]);

  useEffect(() => {
    if (!dragState) {
      document.body.style.cursor = 'default';
    }
  }, [dragState]);

  const handlePointerDown = useCallback(
    (nodeId: string, event: ThreeEvent<PointerEvent>) => {
      if (!scene || !kinematics) {
        return;
      }
      const nodeState = kinematics.nodes[nodeId];
      if (!nodeState) {
        return;
      }
      const camera = (event as any).camera as THREE.Camera | undefined;
      if (!camera) {
        return;
      }
      const cameraDir = new THREE.Vector3();
      camera.getWorldDirection(cameraDir);
      const plane = new THREE.Plane().setFromNormalAndCoplanarPoint(cameraDir, nodeState.position);
      setDragState({ nodeId, plane });
      document.body.style.cursor = 'grabbing';
    },
    [kinematics, scene]
  );

  const handlePointerMove = useCallback(
    (event: ThreeEvent<PointerEvent>) => {
      if (!dragState) {
        return;
      }
      const intersection = new THREE.Vector3();
      if (event.ray.intersectPlane(dragState.plane, intersection)) {
        const result = solveForTarget(dragState.nodeId, intersection.clone());
        if (result && window.simulatorAPI) {
          window.simulatorAPI.sendJointState(result.jointValues);
        }
      }
    },
    [dragState, solveForTarget]
  );

  const handlePointerUp = useCallback(() => {
    setDragState(null);
    document.body.style.cursor = 'default';
  }, []);

  if (!scene || !kinematics) {
    return (
      <div className="scene-placeholder">
        <p>Load a Robot Builder scene to begin simulation.</p>
      </div>
    );
  }

  return (
    <div className="scene-container">
      <Canvas
        shadows
        camera={{ position: [3.5, 2.6, 3.5], fov: 55 }}
        onPointerMove={handlePointerMove}
        onPointerUp={handlePointerUp}
        onPointerLeave={handlePointerUp}
        onCreated={({ camera, scene: threeScene }) => {
          camera.up.set(0, 0, 1);
          threeScene.up.set(0, 0, 1);
        }}
      >
        <color attach="background" args={['#070a12']} />
        <ambientLight intensity={0.45} />
        <directionalLight
          position={[5, 4, 6]}
          intensity={1.1}
          castShadow
          shadow-mapSize-width={2048}
          shadow-mapSize-height={2048}
        />
        <Suspense fallback={null}>
          <LinkGroup
            nodeId={scene.rootId}
            scene={scene}
            draggingId={dragState?.nodeId}
            onPointerDown={handlePointerDown}
          />
        </Suspense>
        <Grid
          infiniteGrid
          sectionSize={1}
          sectionThickness={0.35}
          cellSize={0.25}
          cellThickness={0.1}
          position={[0, 0, 0]}
          rotation={[Math.PI / 2, 0, 0]}
        />
        <OrbitControls
          makeDefault
          enablePan
          enableDamping
          dampingFactor={0.08}
          enabled={!dragState}
        />
      </Canvas>
    </div>
  );
};
