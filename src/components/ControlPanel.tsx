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
      Object.values(nodes)
        .filter((node) => node.joint)
        .map((node) => ({
          id: node.id,
          label: node.joint!.name,
          nodeName: node.name,
          joint: node.joint!
        })),
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
                    window.api.sendJointValue({ joint: label, value });
                    logNetworkEvent('outgoing', { [label]: value }, 'ui');
                  }}
                />
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
      <div className="panel-section">
        <NetworkConsole selectedId={selectedId} />
      </div>
    </div>
  );
};

export default ControlPanel;
