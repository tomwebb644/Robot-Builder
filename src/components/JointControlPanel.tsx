import { ChangeEvent } from 'react';
import classNames from 'classnames';
import { useRobotStore } from '../state/robotStore';

export function JointControlPanel() {
  const joints = useRobotStore((state) => state.joints);
  const selectJoint = useRobotStore((state) => state.selectJoint);
  const selectedJointId = useRobotStore((state) => state.selectedJointId);
  const updateJointValue = useRobotStore((state) => state.updateJointValue);
  const toggleExternalControl = useRobotStore((state) => state.toggleExternalControl);

  const handleSliderChange = (event: ChangeEvent<HTMLInputElement>, jointId: string) => {
    const value = Number.parseFloat(event.target.value);
    if (Number.isFinite(value)) {
      updateJointValue(jointId, value, 'local');
    }
  };

  return (
    <aside className="panel joint-panel" aria-label="Joint control panel">
      <h2>Motion Control</h2>
      <div className="joint-list">
        {joints.map((joint) => {
          const isSelected = joint.id === selectedJointId;
          const sliderId = `joint-slider-${joint.id}`;
          return (
            <div
              key={joint.id}
              className={classNames('joint-row', {
                selected: isSelected,
                remote: joint.remoteDriven
              })}
            >
              <button
                type="button"
                className="joint-select"
                onClick={() => selectJoint(joint.id)}
                aria-pressed={isSelected}
              >
                <span className="joint-name">{joint.name}</span>
                <span className="joint-value">{joint.value.toFixed(1)}</span>
              </button>
              <label htmlFor={sliderId} className="joint-slider-label">
                <span>{joint.type === 'rotational' ? '°' : 'mm'}</span>
                <input
                  id={sliderId}
                  type="range"
                  min={joint.limits.min}
                  max={joint.limits.max}
                  step={joint.type === 'rotational' ? 1 : 0.5}
                  value={joint.value}
                  onChange={(event) => handleSliderChange(event, joint.id)}
                  onMouseDown={() => selectJoint(joint.id)}
                  onTouchStart={() => selectJoint(joint.id)}
                  disabled={joint.externalControl}
                />
              </label>
              <label className="joint-checkbox">
                <input
                  type="checkbox"
                  checked={joint.externalControl}
                  onChange={() => toggleExternalControl(joint.id)}
                />
                <span>TCP</span>
              </label>
            </div>
          );
        })}
      </div>
    </aside>
  );
}
