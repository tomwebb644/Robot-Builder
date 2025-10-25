import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import * as THREE from 'three';
import { STLLoader } from 'three/examples/jsm/loaders/STLLoader';
import { useSceneStore } from '@state/store';
import type {
  JointDefinition,
  MeshGeometry,
  BoxGeometry,
  CylinderGeometry,
  MotionAxis,
  MotionType,
  MeshKind,
  CustomGeometry,
  PrimitiveMeshKind,
  SphereGeometry,
  ConeGeometry,
  CapsuleGeometry
} from '@state/store';
import { createDefaultGeometry, getGeometryBounds } from '@state/store';
import { arrayBufferToBase64 } from '@utils/binary';
import NumericInput from './NumericInput';

const MILLIMETER_TO_METER = 0.001;

const InspectorPanel: React.FC = () => {
  const selectedId = useSceneStore((state) => state.selectedId);
  const nodes = useSceneStore((state) => state.nodes);
  const updateNode = useSceneStore((state) => state.updateNode);
  const updateJoint = useSceneStore((state) => state.updateJoint);
  const addJoint = useSceneStore((state) => state.addJoint);
  const removeJoint = useSceneStore((state) => state.removeJoint);
  const removeLink = useSceneStore((state) => state.removeLink);
  const rootId = useSceneStore((state) => state.rootId);

  const node = selectedId ? nodes[selectedId] : undefined;

  const loader = useMemo(() => new STLLoader(), []);
  const stlInputRef = useRef<HTMLInputElement | null>(null);

  const [jointNameDrafts, setJointNameDrafts] = useState<Record<string, string>>({});

  useEffect(() => {
    if (!node) {
      setJointNameDrafts({});
      return;
    }
    setJointNameDrafts((current) => {
      const next: Record<string, string> = {};
      for (const joint of node.joints) {
        if (current[joint.id] !== undefined) {
          next[joint.id] = current[joint.id];
        }
      }
      return next;
    });
  }, [node]);

  const handleJointNameChange = useCallback((jointId: string, value: string) => {
    setJointNameDrafts((current) => ({ ...current, [jointId]: value }));
  }, []);

  const handleJointNameCommit = useCallback(
    (linkId: string, jointId: string, fallback: string) => {
      const draft = jointNameDrafts[jointId];
      const nameToApply = draft !== undefined ? draft.trim() : fallback;
      if (nameToApply) {
        updateJoint(linkId, jointId, { name: nameToApply });
      }
      setJointNameDrafts((current) => {
        const next = { ...current };
        delete next[jointId];
        return next;
      });
    },
    [jointNameDrafts, updateJoint]
  );

  const handleJointNameCancel = useCallback((jointId: string) => {
    setJointNameDrafts((current) => {
      const next = { ...current };
      delete next[jointId];
      return next;
    });
  }, []);

  const handleCustomMeshRequest = useCallback(() => {
    stlInputRef.current?.click();
  }, []);

  const handleCustomMeshFileChange = useCallback(
    async (event: React.ChangeEvent<HTMLInputElement>) => {
      const file = event.target.files?.[0];
      if (!file || !node) {
        event.target.value = '';
        return;
      }
      try {
        const buffer = await file.arrayBuffer();
        const parsed = loader.parse(buffer);
        parsed.computeBoundingBox();
        parsed.computeVertexNormals();
        const positionAttribute = parsed.getAttribute('position');
        const fallbackBounds = new THREE.Box3();
        if (positionAttribute && 'itemSize' in positionAttribute) {
          fallbackBounds.setFromBufferAttribute(positionAttribute as THREE.BufferAttribute);
        }
        const bounds = parsed.boundingBox ?? fallbackBounds;
        const size = new THREE.Vector3();
        bounds.getSize(size).multiplyScalar(MILLIMETER_TO_METER);
        const center = new THREE.Vector3();
        bounds.getCenter(center).multiplyScalar(MILLIMETER_TO_METER);
        parsed.dispose();
        const baseBounds = {
          width: size.x || 0.3,
          depth: size.y || 0.3,
          height: size.z || 0.3,
          radial: Math.max(size.x, size.y, 0.3) / 2
        };
        const originOffset: [number, number, number] = [-center.x, -center.y, -center.z];
        const customGeometry: CustomGeometry = {
          kind: 'custom',
          sourceName: file.name,
          data: arrayBufferToBase64(buffer),
          scale: 1,
          unitScale: MILLIMETER_TO_METER,
          bounds: baseBounds,
          originOffset
        };
        updateNode(node.id, { geometry: customGeometry });
      } catch (error) {
        console.error('Failed to load custom mesh', error);
      } finally {
        event.target.value = '';
      }
    },
    [loader, node, updateNode]
  );

  const handleStaticRotationChange = useCallback(
    (index: number, value: number) => {
      if (!node) return;
      const rotation = node.staticRotation ?? [0, 0, 0];
      const nextRotation = rotation.map((entry, idx) => (idx === index ? (Number.isFinite(value) ? value : entry) : entry)) as [
        number,
        number,
        number
      ];
      updateNode(node.id, { staticRotation: nextRotation });
    },
    [node, updateNode]
  );

  const handleRotationReset = useCallback(() => {
    if (!node) return;
    updateNode(node.id, { staticRotation: [0, 0, 0] });
  }, [node, updateNode]);

  const onGeometryChange = (geometry: MeshGeometry) => {
    if (!node) return;
    updateNode(node.id, { geometry });
  };

  const onGeometryKindChange = (kind: MeshKind) => {
    if (!node) return;
    if (kind === 'custom') {
      handleCustomMeshRequest();
      return;
    }
    const defaults = createDefaultGeometry(kind as PrimitiveMeshKind);
    const preserved = node.geometry;
    let nextGeometry: MeshGeometry = defaults;
    if (preserved.kind === kind) {
      nextGeometry = preserved;
    }
    updateNode(node.id, { geometry: nextGeometry });
  };

  const onJointTypeChange = (joint: JointDefinition, type: MotionType) => {
    if (!node) return;
    const nextLimits: [number, number] = type === 'linear' ? [0, 150] : [-180, 180];
    const nextValue = Math.max(Math.min(joint.currentValue, nextLimits[1]), nextLimits[0]);
    updateJoint(node.id, joint.id, {
      type,
      limits: nextLimits,
      currentValue: nextValue
    });
  };

  const onJointAxisChange = (joint: JointDefinition, axis: MotionAxis) => {
    if (!node) return;
    updateJoint(node.id, joint.id, { axis });
  };

  const onJointPivotChange = (joint: JointDefinition, index: number, value: number) => {
    if (!node) return;
    const nextPivot = joint.pivot.map((entry, idx) => (idx === index ? value : entry)) as [
      number,
      number,
      number
    ];
    updateJoint(node.id, joint.id, { pivot: nextPivot });
  };

  const meshFileInput = (
    <input
      key="custom-mesh-upload"
      ref={stlInputRef}
      type="file"
      accept=".stl"
      style={{ display: 'none' }}
      onChange={handleCustomMeshFileChange}
    />
  );

  if (!node) {
    return (
      <div className="panel right">
        {meshFileInput}
        <h2>Inspector</h2>
        <div className="panel-section">
          <p style={{ color: 'rgba(148, 163, 184, 0.8)' }}>Select a link to edit its properties.</p>
        </div>
      </div>
    );
  }

  const renderGeometryFields = (geometry: MeshGeometry) => {
    if (geometry.kind === 'box') {
      const box = geometry as BoxGeometry;
      return (
        <>
          <label>
            Width (m)
            <NumericInput
              step={0.01}
              value={box.width}
              precision={2}
              onValueCommit={(value) =>
                onGeometryChange({ kind: 'box', width: value, height: box.height, depth: box.depth })
              }
            />
          </label>
          <label>
            Height (m)
            <NumericInput
              step={0.01}
              value={box.height}
              precision={2}
              onValueCommit={(value) =>
                onGeometryChange({ kind: 'box', width: box.width, height: value, depth: box.depth })
              }
            />
          </label>
          <label>
            Depth (m)
            <NumericInput
              step={0.01}
              value={box.depth}
              precision={2}
              onValueCommit={(value) =>
                onGeometryChange({ kind: 'box', width: box.width, height: box.height, depth: value })
              }
            />
          </label>
        </>
      );
    }

    if (geometry.kind === 'cylinder') {
      const cylinder = geometry as CylinderGeometry;
      return (
        <>
          <label>
            Radius (m)
            <NumericInput
              step={0.005}
              value={cylinder.radius}
              precision={3}
              onValueCommit={(value) =>
                onGeometryChange({ kind: 'cylinder', radius: value, height: cylinder.height })
              }
            />
          </label>
          <label>
            Height (m)
            <NumericInput
              step={0.01}
              value={cylinder.height}
              precision={2}
              onValueCommit={(value) =>
                onGeometryChange({ kind: 'cylinder', radius: cylinder.radius, height: value })
              }
            />
          </label>
        </>
      );
    }

    if (geometry.kind === 'sphere') {
      const sphere = geometry as SphereGeometry;
      return (
        <label className="full-width">
          Radius (m)
          <NumericInput
            step={0.005}
            value={sphere.radius}
            precision={3}
            onValueCommit={(value) => onGeometryChange({ kind: 'sphere', radius: value })}
          />
        </label>
      );
    }

    if (geometry.kind === 'cone') {
      const cone = geometry as ConeGeometry;
      return (
        <>
          <label>
            Base Radius (m)
            <NumericInput
              step={0.005}
              value={cone.radius}
              precision={3}
              onValueCommit={(value) => onGeometryChange({ kind: 'cone', radius: value, height: cone.height })}
            />
          </label>
          <label>
            Height (m)
            <NumericInput
              step={0.01}
              value={cone.height}
              precision={2}
              onValueCommit={(value) => onGeometryChange({ kind: 'cone', radius: cone.radius, height: value })}
            />
          </label>
        </>
      );
    }

    if (geometry.kind === 'custom') {
      const custom = geometry as CustomGeometry;
      const bounds = getGeometryBounds(custom);
      return (
        <>
          <label className="full-width">
            Mesh Source
            <div className="custom-mesh-row">
              <span className="custom-mesh-name" title={custom.sourceName}>
                {custom.sourceName}
              </span>
              <button type="button" className="ghost" onClick={handleCustomMeshRequest}>
                Replace Mesh
              </button>
            </div>
          </label>
          <label>
            Scale
            <NumericInput
              step={0.1}
              value={custom.scale}
              precision={5}
              onValueCommit={(value) => {
                const nextScale = Math.max(value, 0.01);
                onGeometryChange({ ...custom, scale: nextScale });
              }}
            />
          </label>
          <label>
            Reset
            <button
              type="button"
              className="ghost"
              onClick={() => onGeometryChange({ ...custom, scale: 1 })}
            >
              Default Scale
            </button>
          </label>
          <div className="dimension-readout full-width">
            <div>
              <span className="label">Width</span>
              <span>{bounds.width.toFixed(3)} m</span>
            </div>
            <div>
              <span className="label">Depth</span>
              <span>{bounds.depth.toFixed(3)} m</span>
            </div>
            <div>
              <span className="label">Height</span>
              <span>{bounds.height.toFixed(3)} m</span>
            </div>
          </div>
        </>
      );
    }

    const capsule = geometry as CapsuleGeometry;
    return (
      <>
        <label>
          Radius (m)
          <NumericInput
            step={0.005}
            value={capsule.radius}
            precision={3}
            onValueCommit={(value) => onGeometryChange({ kind: 'capsule', radius: value, length: capsule.length })}
          />
        </label>
        <label>
          Body Length (m)
          <NumericInput
            step={0.01}
            value={capsule.length}
            precision={2}
            onValueCommit={(value) => onGeometryChange({ kind: 'capsule', radius: capsule.radius, length: value })}
          />
        </label>
      </>
    );
  };

  return (
    <div className="panel right">
      {meshFileInput}
      <h2>Inspector</h2>
      <div className="panel-section inspector-panel">
        <section>
          <div className="section-title">Link</div>
          <div className="inspector-grid">
            <label className="full-width">
              Name
              <input
                type="text"
                value={node.name}
                onChange={(event) => updateNode(node.id, { name: event.target.value })}
              />
            </label>
            <label>
              Shape
              <select value={node.geometry.kind} onChange={(event) => onGeometryKindChange(event.target.value as MeshKind)}>
                <option value="box">Cuboid</option>
                <option value="cylinder">Cylinder</option>
                <option value="sphere">Sphere</option>
                <option value="cone">Cone</option>
                <option value="capsule">Capsule</option>
                <option value="custom">Custom Mesh...</option>
              </select>
            </label>
            <label>
              Color
              <input
                type="color"
                value={node.color}
                onChange={(event) => updateNode(node.id, { color: event.target.value })}
              />
            </label>
            {renderGeometryFields(node.geometry)}
          </div>
        </section>

        <section>
          <div className="section-title">Mount Offset</div>
          <div className="inspector-grid">
            {['X', 'Y', 'Z'].map((axis, index) => (
              <label key={axis}>
                {axis} (m)
                <NumericInput
                  step={0.01}
                  value={node.baseOffset[index]}
                  precision={2}
                  onValueCommit={(value) =>
                    updateNode(node.id, {
                      baseOffset: node.baseOffset.map((offset, idx) => (idx === index ? value : offset)) as [
                        number,
                        number,
                        number
                      ]
                    })
                  }
                />
              </label>
            ))}
          </div>
        </section>

        <section>
          <div className="section-title rotation-toolbar">
            <span>Static Rotation</span>
            <button type="button" className="ghost" onClick={handleRotationReset}>
              Reset
            </button>
          </div>
          <div className="inspector-grid">
            {[
              { label: 'Roll (X)', axis: 0 },
              { label: 'Pitch (Y)', axis: 1 },
              { label: 'Yaw (Z)', axis: 2 }
            ].map(({ label, axis }) => (
              <label key={label}>
                {label} (°)
                <NumericInput
                  step={1}
                  value={node.staticRotation[axis]}
                  precision={1}
                  onValueCommit={(value) => handleStaticRotationChange(axis, value)}
                />
              </label>
            ))}
          </div>
        </section>

        <section>
          <div className="section-title joint-toolbar">
            <span>Joints</span>
            <button type="button" className="ghost" onClick={() => addJoint(node.id)}>
              Add Joint
            </button>
          </div>
          {node.joints.length === 0 ? (
            <p className="empty-state">This link has no joints yet.</p>
          ) : (
            node.joints.map((joint, index) => (
              <div key={joint.id} className="joint-block">
                <div className="joint-header">
                  <span>
                    Joint {index + 1}
                    <span className="joint-name">{joint.name}</span>
                  </span>
                  <div className="joint-actions">
                    <span className="tag subtle">{joint.type}</span>
                    <button
                      type="button"
                      className="ghost"
                      onClick={() => removeJoint(node.id, joint.id)}
                    >
                      Remove
                    </button>
                  </div>
                </div>
                <div className="inspector-grid">
                  <label className="full-width">
                    Joint Name
                    <input
                      type="text"
                      value={jointNameDrafts[joint.id] ?? joint.name}
                      onChange={(event) => handleJointNameChange(joint.id, event.target.value)}
                      onBlur={() => handleJointNameCommit(node.id, joint.id, joint.name)}
                      onKeyDown={(event) => {
                        if (event.key === 'Enter') {
                          event.preventDefault();
                          handleJointNameCommit(node.id, joint.id, joint.name);
                        }
                        if (event.key === 'Escape') {
                          event.preventDefault();
                          handleJointNameCancel(joint.id);
                        }
                      }}
                    />
                  </label>
                  <label>
                    Type
                    <select
                      value={joint.type}
                      onChange={(event) => onJointTypeChange(joint, event.target.value as MotionType)}
                    >
                      <option value="rotational">Rotational</option>
                      <option value="linear">Linear</option>
                    </select>
                  </label>
                  <label>
                    Axis
                    <select
                      value={joint.axis}
                      onChange={(event) => onJointAxisChange(joint, event.target.value as MotionAxis)}
                    >
                      <option value="x">X</option>
                      <option value="y">Y</option>
                      <option value="z">Z</option>
                    </select>
                  </label>
                  <label>
                    Min
                    <NumericInput
                      step={joint.type === 'rotational' ? 1 : 0.5}
                      value={joint.limits[0]}
                      onValueCommit={(value) =>
                        updateJoint(node.id, joint.id, {
                          limits: [value, joint.limits[1]]
                        })
                      }
                    />
                  </label>
                  <label>
                    Max
                    <NumericInput
                      step={joint.type === 'rotational' ? 1 : 0.5}
                      value={joint.limits[1]}
                      onValueCommit={(value) =>
                        updateJoint(node.id, joint.id, {
                          limits: [joint.limits[0], value]
                        })
                      }
                    />
                  </label>
                  <label>
                    Current
                    <NumericInput
                      step={joint.type === 'rotational' ? 1 : 0.5}
                      value={joint.currentValue}
                      onValueCommit={(value) => updateJoint(node.id, joint.id, { currentValue: value })}
                    />
                  </label>
                </div>
                <div className="inspector-grid pivot-grid">
                  {['X', 'Y', 'Z'].map((axis, pivotIndex) => (
                    <label key={`${joint.id}-pivot-${axis}`}>
                      Pivot {axis} (m)
                      <NumericInput
                        step={0.01}
                        value={joint.pivot[pivotIndex]}
                        precision={2}
                        onValueCommit={(value) => onJointPivotChange(joint, pivotIndex, value)}
                      />
                    </label>
                  ))}
                </div>
              </div>
            ))
          )}
        </section>

        <section>
          <div className="section-title">Notes</div>
          <textarea
            value={node.notes ?? ''}
            placeholder="Document connection details, payload, tooling, etc."
            onChange={(event) => updateNode(node.id, { notes: event.target.value })}
          />
        </section>
        {node.id !== rootId ? (
          <section className="danger-zone">
            <button type="button" className="danger" onClick={() => removeLink(node.id)}>
              Remove Link and Children
            </button>
          </section>
        ) : null}
      </div>
    </div>
  );
};

export default InspectorPanel;
