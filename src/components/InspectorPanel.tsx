import { ChangeEvent } from 'react';
import { useRobotStore } from '../state/robotStore';

export function InspectorPanel() {
  const selectedJoint = useRobotStore((state) =>
    state.joints.find((joint) => joint.id === state.selectedJointId)
  );
  const updateJointMetadata = useRobotStore((state) => state.updateJointMetadata);

  if (!selectedJoint) {
    return (
      <aside className="panel inspector-panel" aria-label="Inspector">
        <h2>Inspector</h2>
        <p className="placeholder">Select a link or joint to inspect its properties.</p>
      </aside>
    );
  }

  const handleLimitChange = (event: ChangeEvent<HTMLInputElement>, bound: 'min' | 'max') => {
    const value = Number.parseFloat(event.target.value);
    if (!Number.isNaN(value)) {
      updateJointMetadata(selectedJoint.id, {
        limits: {
          [bound]: value
        }
      });
    }
  };

  return (
    <aside className="panel inspector-panel" aria-label="Inspector">
      <h2>Inspector</h2>
      <section className="inspector-section">
        <label>
          Name
          <input
            type="text"
            value={selectedJoint.name}
            onChange={(event) =>
              updateJointMetadata(selectedJoint.id, { name: event.target.value || selectedJoint.name })
            }
          />
        </label>
        <label>
          Motion Type
          <select
            value={selectedJoint.type}
            onChange={(event) =>
              updateJointMetadata(selectedJoint.id, {
                type: event.target.value === 'linear' ? 'linear' : 'rotational'
              })
            }
          >
            <option value="rotational">Rotational</option>
            <option value="linear">Linear</option>
          </select>
        </label>
        <label>
          Axis
          <select
            value={selectedJoint.axis}
            onChange={(event) =>
              updateJointMetadata(selectedJoint.id, {
                axis: event.target.value === 'x' || event.target.value === 'y' ? event.target.value : 'z'
              })
            }
          >
            <option value="x">X</option>
            <option value="y">Y</option>
            <option value="z">Z</option>
          </select>
        </label>
      </section>

      <section className="inspector-section">
        <h3>Limits</h3>
        <div className="limit-inputs">
          <label>
            Min
            <input
              type="number"
              step="0.1"
              value={selectedJoint.limits.min}
              onChange={(event) => handleLimitChange(event, 'min')}
            />
          </label>
          <label>
            Max
            <input
              type="number"
              step="0.1"
              value={selectedJoint.limits.max}
              onChange={(event) => handleLimitChange(event, 'max')}
            />
          </label>
        </div>
      </section>

      <section className="inspector-section">
        <label className="checkbox">
          <input
            type="checkbox"
            checked={selectedJoint.externalControl}
            onChange={() => updateJointMetadata(selectedJoint.id, { externalControl: !selectedJoint.externalControl })}
          />
          <span>Allow TCP control</span>
        </label>
        <p className="hint">When enabled, incoming TCP messages can drive this joint.</p>
      </section>
    </aside>
  );
}
