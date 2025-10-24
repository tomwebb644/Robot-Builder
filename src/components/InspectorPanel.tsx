import React, { ChangeEvent } from 'react';
import { useSceneStore } from '@state/store';
import type {
  JointDefinition,
  MeshGeometry,
  BoxGeometry,
  CylinderGeometry,
  MotionAxis,
  MotionType
} from '@state/store';

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

  const onBaseOffsetChange = (index: number, event: ChangeEvent<HTMLInputElement>) => {
    if (!node) return;
    const value = Number(event.target.value);
    const nextOffset = [...node.baseOffset] as [number, number, number];
    nextOffset[index] = Number.isNaN(value) ? 0 : value;
    updateNode(node.id, { baseOffset: nextOffset });
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
            <input
              type="number"
              step={0.05}
              value={box.width}
              onChange={(event) =>
                onGeometryChange({ kind: 'box', width: Number(event.target.value), height: box.height, depth: box.depth })
              }
            />
          </label>
          <label>
            Height (m)
            <input
              type="number"
              step={0.05}
              value={box.height}
              onChange={(event) =>
                onGeometryChange({ kind: 'box', width: box.width, height: Number(event.target.value), depth: box.depth })
              }
            />
          </label>
          <label>
            Depth (m)
            <input
              type="number"
              step={0.05}
              value={box.depth}
              onChange={(event) =>
                onGeometryChange({ kind: 'box', width: box.width, height: box.height, depth: Number(event.target.value) })
              }
            />
          </label>
        </>
      );
    }

    const cylinder = geometry as CylinderGeometry;
    return (
      <>
        <label>
          Radius (m)
          <input
            type="number"
            step={0.025}
            value={cylinder.radius}
            onChange={(event) =>
              onGeometryChange({ kind: 'cylinder', radius: Number(event.target.value), height: cylinder.height })
            }
          />
        </label>
        <label>
          Height (m)
          <input
            type="number"
            step={0.05}
            value={cylinder.height}
            onChange={(event) =>
              onGeometryChange({ kind: 'cylinder', radius: cylinder.radius, height: Number(event.target.value) })
            }
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
                <input
                  type="number"
                  step={0.05}
                  value={node.baseOffset[index]}
                  onChange={(event) => onBaseOffsetChange(index, event)}
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
                <input
                  type="number"
                  step={1}
                  value={node.joint.limits[0]}
                  onChange={(event) =>
                    updateJoint(node.id, {
                      limits: [Number(event.target.value), node.joint!.limits[1]]
                    })
                  }
                />
              </label>
              <label>
                Max
                <input
                  type="number"
                  step={1}
                  value={node.joint.limits[1]}
                  onChange={(event) =>
                    updateJoint(node.id, {
                      limits: [node.joint!.limits[0], Number(event.target.value)]
                    })
                  }
                />
              </label>
              <label>
                Current
                <input
                  type="number"
                  step={node.joint.type === 'rotational' ? 1 : 0.5}
                  value={node.joint.currentValue}
                  onChange={(event) => updateJoint(node.id, { currentValue: Number(event.target.value) })}
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
