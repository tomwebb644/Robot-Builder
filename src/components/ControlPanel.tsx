import React, { useMemo } from 'react';
import { useSceneStore } from '@state/store';
import type { LinkNode } from '@state/store';
import SceneOutline from './SceneOutline';

const ControlPanel: React.FC = () => {
  const nodes = useSceneStore((state) => state.nodes);
  const rootId = useSceneStore((state) => state.rootId);
  const updateJoint = useSceneStore((state) => state.updateJoint);
  const toggleExternalControl = useSceneStore((state) => state.toggleExternalControl);
  const setTcpStatus = useSceneStore((state) => state.setTcpStatus);

  const joints = useMemo(
    () => {
      const ordered: {
        id: string;
        label: string;
        nodeName: string;
        joint: NonNullable<LinkNode['joint']>;
      }[] = [];
      const traverse = (id: string) => {
        const node = nodes[id];
        if (!node) return;
        if (node.joint) {
          ordered.push({
            id: node.id,
            label: node.joint.name,
            nodeName: node.name,
            joint: node.joint
          });
        }
        node.children.forEach((childId) => traverse(childId));
      };
      traverse(rootId);
      return ordered;
    },
    [nodes, rootId]
  );

  return (
    <div className="panel">
      <h2>Control Panel</h2>
      <div className="panel-section">
        {joints.length === 0 ? (
          <p style={{ color: 'rgba(148, 163, 184, 0.8)', fontSize: '0.9rem' }}>
            Add a link to start driving joints in real time.
          </p>
        ) : (
          joints.map(({ id, label, nodeName, joint }) => {
            const [min, max] = joint.limits;
            return (
              <div key={id} className={`slider-item${joint.externalControl ? ' external' : ''}`}>
                <label htmlFor={`joint-${id}`}>
                  <span>{nodeName}</span>
                  <span className="value">
                    {joint.type === 'rotational' ? `${joint.currentValue.toFixed(1)}°` : `${joint.currentValue.toFixed(1)} mm`}
                  </span>
                </label>
                <input
                  id={`joint-${id}`}
                  type="range"
                  min={min}
                  max={max}
                  step={joint.type === 'rotational' ? 1 : 0.5}
                  value={joint.currentValue}
                  disabled={joint.externalControl}
                  onChange={(event) => {
                    const value = Number(event.target.value);
                    updateJoint(id, { currentValue: value });
                    window.api?.sendJointValue?.({ joint: label, value });
                    setTcpStatus(`local update ${label} → ${value.toFixed(1)}`);
                  }}
                />
                <div className="joint-meta-row">
                  <span className="joint-key">TCP key: {label}</span>
                  <span className="joint-range">
                    Range: {min} – {max} {joint.type === 'rotational' ? '°' : 'mm'}
                  </span>
                </div>
                <div className="checkbox-row">
                  <input
                    type="checkbox"
                    checked={joint.externalControl}
                    onChange={(event) => toggleExternalControl(id, event.target.checked)}
                    id={`external-${id}`}
                  />
                  <label htmlFor={`external-${id}`}>Enable TCP control ({label})</label>
                </div>
              </div>
            );
          })
        )}
      </div>
      <div className="panel-section">
        <SceneOutline />
      </div>
    </div>
  );
};

export default ControlPanel;
