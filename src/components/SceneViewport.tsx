import { Canvas } from '@react-three/fiber';
import { OrbitControls, GizmoHelper, GizmoViewport } from '@react-three/drei';
import { useMemo } from 'react';
import { useRobotStore } from '../state/robotStore';

const DEG_TO_RAD = Math.PI / 180;

function RobotRig() {
  const joints = useRobotStore((state) => state.joints);
  const shoulder = joints.find((joint) => joint.id === 'joint-shoulder');
  const elbow = joints.find((joint) => joint.id === 'joint-elbow');
  const slider = joints.find((joint) => joint.id === 'joint-slider');

  const shoulderRotation = (shoulder?.value ?? 0) * DEG_TO_RAD;
  const elbowRotation = (elbow?.value ?? 0) * DEG_TO_RAD;
  const sliderOffset = useMemo(() => {
    if (!slider) {
      return 0;
    }
    const clampedValue = Math.min(Math.max(slider.value, slider.limits.min), slider.limits.max);
    const range = slider.limits.max - slider.limits.min || 1;
    return ((clampedValue - slider.limits.min) / range - 0.5) * 0.6;
  }, [slider]);

  return (
    <group>
      <mesh receiveShadow position={[0, -0.01, 0]} rotation={[-Math.PI / 2, 0, 0]}>
        <planeGeometry args={[6, 6]} />
        <meshStandardMaterial color="#1b1f2a" />
      </mesh>

      <group position={[0, 0.15, 0]}>
        <mesh castShadow receiveShadow>
          <cylinderGeometry args={[0.3, 0.3, 0.3, 32]} />
          <meshStandardMaterial color="#2c6ff9" />
        </mesh>
        <group position={[0, 0.25, 0]} rotation={[0, 0, shoulderRotation]}>
          <mesh castShadow receiveShadow position={[0, 0.6, 0]}>
            <boxGeometry args={[0.18, 1.2, 0.18]} />
            <meshStandardMaterial color="#38d0d8" />
          </mesh>
          <group position={[0, 1.2, 0]} rotation={[0, elbowRotation, 0]}>
            <mesh castShadow receiveShadow position={[0, 0.5, 0]}>
              <boxGeometry args={[0.14, 1.0, 0.14]} />
              <meshStandardMaterial color="#f6c344" />
            </mesh>
            <group position={[0, 1.0, 0]}>
              <mesh castShadow receiveShadow position={[0, 0.25 + sliderOffset, 0]}>
                <boxGeometry args={[0.1, 0.6, 0.1]} />
                <meshStandardMaterial color="#f25f5c" />
              </mesh>
              <mesh castShadow receiveShadow position={[0, 0.7 + sliderOffset * 2, 0]}>
                <sphereGeometry args={[0.12, 32, 32]} />
                <meshStandardMaterial color="#ffffff" emissive="#5f9cf7" emissiveIntensity={0.4} />
              </mesh>
            </group>
          </group>
        </group>
      </group>
    </group>
  );
}

export function SceneViewport() {
  return (
    <section className="scene-viewport" aria-label="3D workspace">
      <Canvas shadows camera={{ position: [4, 3, 4], fov: 45 }}>
        <color attach="background" args={['#0b0e16']} />
        <ambientLight intensity={0.4} />
        <directionalLight
          position={[5, 8, 3]}
          intensity={1.1}
          castShadow
          shadow-mapSize={[1024, 1024]}
        />
        <pointLight position={[-4, 5, -3]} intensity={0.4} />
        <RobotRig />
        <OrbitControls enableDamping dampingFactor={0.1} />
        <gridHelper args={[10, 20, '#1f2a3a', '#1f2a3a']} position={[0, 0, 0]} />
        <axesHelper args={[1.5]} />
        <GizmoHelper alignment="bottom-right" margin={[80, 80]}> 
          <GizmoViewport axisColors={["#ff6b6b", "#6bffb0", "#5fa8ff"]} labelColor="#fff" />
        </GizmoHelper>
      </Canvas>
    </section>
  );
}
