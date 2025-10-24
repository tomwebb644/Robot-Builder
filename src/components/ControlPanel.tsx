import React, { useMemo } from 'react';
import { useSceneStore } from '@state/store';
import SceneOutline from './SceneOutline';
import NetworkConsole from './NetworkConsole';

const ControlPanel: React.FC = () => {
  const nodes = useSceneStore((state) => state.nodes);
  const updateJoint = useSceneStore((state) => state.updateJoint);
  const toggleExternalControl = useSceneStore((state) => state.toggleExternalControl);
  const logNetworkEvent = useSceneStore((state) => state.logNetworkEvent);
  const connectMode = useSceneStore((state) => state.connectMode);
  const connectSourceId = useSceneStore((state) => state.connectSourceId);
  const selectedId = useSceneStore((state) => state.selectedId);
  const cancelConnection = useSceneStore((state) => state.cancelConnection);

  const joints = useMemo(
    () =>
      Object.values(nodes).flatMap((node) =>
        node.joints.map((joint) => ({
          nodeId: node.id,
          jointId: joint.id,
          label: joint.name,
          nodeName: node.name,
          joint
        }))
      ),
    [nodes]
  );

  return (
    <div className="panel">
      <h2>Control Panel</h2>
      <div className="panel-section">
        {connectMode ? (
          <div className="banner">
            {connectSourceId ? (
              <>
                <strong>Connect Mode:</strong> select a destination link to parent <em>{nodes[connectSourceId]?.name}</em> or
                <button type="button" onClick={cancelConnection} className="link-button">
                  cancel
                </button>
              </>
            ) : (
              'Connect mode enabled — pick a child link to reassign.'
            )}
          </div>
        ) : null}
        {joints.length === 0 ? (
          <p style={{ color: 'rgba(148, 163, 184, 0.8)', fontSize: '0.9rem' }}>
            Add a link to start driving joints in real time.
          </p>
        ) : (
          joints.map(({ nodeId, jointId, label, nodeName, joint }) => {
            const [min, max] = joint.limits;
            const neutral = joint.type === 'rotational' ? 0 : (min + max) / 2;
            const applyJointValue = (value: number, source: 'ui' | 'manual' = 'ui') => {
              const clamped = Math.min(Math.max(value, min), max);
              updateJoint(nodeId, jointId, { currentValue: clamped });
              window.api.sendJointValue({ joint: label, value: clamped });
              logNetworkEvent('outgoing', { [label]: clamped }, source);
            };
            return (
              <div
                key={`${nodeId}-${jointId}`}
                className={`slider-item${joint.externalControl ? ' external' : ''}`}
              >
                <label htmlFor={`joint-${jointId}`}>
                  <span>
                    {nodeName}
                    <span className="joint-label"> · {label}</span>
                  </span>
                  <span className="value">
                    {joint.type === 'rotational' ? `${joint.currentValue.toFixed(1)}°` : `${joint.currentValue.toFixed(1)} mm`}
                  </span>
                </label>
                <input
                  id={`joint-${jointId}`}
                  type="range"
                  min={min}
                  max={max}
                  step={joint.type === 'rotational' ? 1 : 0.5}
                  value={joint.currentValue}
                  disabled={joint.externalControl}
                  onChange={(event) => applyJointValue(Number(event.target.value))}
                />
                <div className="slider-actions">
                  <button type="button" onClick={() => applyJointValue(min, 'manual')} disabled={joint.externalControl}>
                    Min
                  </button>
                  <button type="button" onClick={() => applyJointValue(neutral, 'manual')} disabled={joint.externalControl}>
                    Reset
                  </button>
                  <button type="button" onClick={() => applyJointValue(max, 'manual')} disabled={joint.externalControl}>
                    Max
                  </button>
                </div>
                <div className="checkbox-row">
                  <input
                    type="checkbox"
                    checked={joint.externalControl}
                    onChange={(event) => toggleExternalControl(nodeId, jointId, event.target.checked)}
                    id={`external-${jointId}`}
                  />
                  <label htmlFor={`external-${jointId}`}>Enable TCP control ({label})</label>
                </div>
              </div>
            );
          })
        )}
      </div>
      <div className="panel-section">
        <SceneOutline />
      </div>
      <div className="panel-section">
        <NetworkConsole selectedId={selectedId} />
      </div>
    </div>
  );
};

export default ControlPanel;
