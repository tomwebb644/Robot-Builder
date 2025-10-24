import React from 'react';
import { useSceneStore } from '@state/store';
import type {
  JointDefinition,
  MeshGeometry,
  BoxGeometry,
  CylinderGeometry,
  MotionAxis,
  MotionType,
  MeshKind,
  SphereGeometry,
  ConeGeometry,
  CapsuleGeometry
} from '@state/store';
import { createDefaultGeometry } from '@state/store';
import NumericInput from './NumericInput';

const InspectorPanel: React.FC = () => {
  const selectedId = useSceneStore((state) => state.selectedId);
  const nodes = useSceneStore((state) => state.nodes);
  const updateNode = useSceneStore((state) => state.updateNode);
  const updateJoint = useSceneStore((state) => state.updateJoint);
  const removeLink = useSceneStore((state) => state.removeLink);
  const rootId = useSceneStore((state) => state.rootId);

  const node = selectedId ? nodes[selectedId] : undefined;

  const onGeometryChange = (geometry: MeshGeometry) => {
    if (!node) return;
    updateNode(node.id, { geometry });
  };

  const onGeometryKindChange = (kind: MeshKind) => {
    if (!node) return;
    const defaults = createDefaultGeometry(kind);
    const preserved = node.geometry;
    let nextGeometry: MeshGeometry = defaults;
    if (preserved.kind === kind) {
      nextGeometry = preserved;
    }
    updateNode(node.id, { geometry: nextGeometry });
  };

  const onJointTypeChange = (joint: JointDefinition, type: MotionType) => {
    const nextLimits: [number, number] = type === 'linear' ? [0, 150] : [-180, 180];
    updateJoint(node!.id, {
      type,
      limits: nextLimits,
      currentValue: Math.max(Math.min(joint.currentValue, nextLimits[1]), nextLimits[0])
    });
  };

  const onJointAxisChange = (axis: MotionAxis) => {
    if (!node?.joint) return;
    updateJoint(node.id, { axis });
  };

  if (!node) {
    return (
      <div className="panel right">
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

        {node.joint ? (
          <section>
            <div className="section-title">Joint</div>
            <div className="inspector-grid">
              <label className="full-width">
                Joint Name
                <input
                  type="text"
                  value={node.joint.name}
                  onChange={(event) => updateJoint(node.id, { name: event.target.value })}
                />
              </label>
              <label>
                Type
                <select
                  value={node.joint.type}
                  onChange={(event) => onJointTypeChange(node.joint!, event.target.value as MotionType)}
                >
                  <option value="rotational">Rotational</option>
                  <option value="linear">Linear</option>
                </select>
              </label>
              <label>
                Axis
                <select value={node.joint.axis} onChange={(event) => onJointAxisChange(event.target.value as MotionAxis)}>
                  <option value="x">X</option>
                  <option value="y">Y</option>
                  <option value="z">Z</option>
                </select>
              </label>
              <label>
                Min
                <NumericInput
                  step={node.joint.type === 'rotational' ? 1 : 0.5}
                  value={node.joint.limits[0]}
                  onValueCommit={(value) =>
                    updateJoint(node.id, {
                      limits: [value, node.joint!.limits[1]]
                    })
                  }
                />
              </label>
              <label>
                Max
                <NumericInput
                  step={node.joint.type === 'rotational' ? 1 : 0.5}
                  value={node.joint.limits[1]}
                  onValueCommit={(value) =>
                    updateJoint(node.id, {
                      limits: [node.joint!.limits[0], value]
                    })
                  }
                />
              </label>
              <label>
                Current
                <NumericInput
                  step={node.joint.type === 'rotational' ? 1 : 0.5}
                  value={node.joint.currentValue}
                  onValueCommit={(value) => updateJoint(node.id, { currentValue: value })}
                />
              </label>
            </div>
          </section>
        ) : null}

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
