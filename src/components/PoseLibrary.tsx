import React, { useMemo, useState } from 'react';
import { useSceneStore } from '@state/store';

const PoseLibrary: React.FC = () => {
  const poses = useSceneStore((state) => state.poses);
  const addPose = useSceneStore((state) => state.addPose);
  const renamePose = useSceneStore((state) => state.renamePose);
  const removePose = useSceneStore((state) => state.removePose);
  const applyPose = useSceneStore((state) => state.applyPose);
  const logNetworkEvent = useSceneStore((state) => state.logNetworkEvent);

  const sortedPoses = useMemo(() => [...poses].sort((a, b) => b.createdAt - a.createdAt), [poses]);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [draftName, setDraftName] = useState('');
  const [renameError, setRenameError] = useState<string | null>(null);

  const handleCapture = () => {
    const poseId = addPose();
    const createdPose = useSceneStore.getState().poses.find((pose) => pose.id === poseId);
    setEditingId(poseId);
    setDraftName(createdPose?.name ?? '');
    setRenameError(null);
  };

  const handleApply = (poseId: string) => {
    const changed = applyPose(poseId);
    if (Object.keys(changed).length === 0) {
      return;
    }
    for (const [joint, value] of Object.entries(changed)) {
      window.api.sendJointValue({ joint, value });
    }
    logNetworkEvent('outgoing', changed, 'manual');
  };

  const beginRename = (poseId: string, name: string) => {
    setEditingId(poseId);
    setDraftName(name);
    setRenameError(null);
  };

  const cancelRename = () => {
    setEditingId(null);
    setDraftName('');
    setRenameError(null);
  };

  const commitRename = (poseId: string) => {
    const trimmed = draftName.trim();
    if (!trimmed) {
      setRenameError('Name cannot be empty');
      return;
    }
    if (poses.some((pose) => pose.id !== poseId && pose.name === trimmed)) {
      setRenameError('Name already in use');
      return;
    }
    renamePose(poseId, trimmed);
    setEditingId(null);
    setDraftName('');
    setRenameError(null);
  };

  if (sortedPoses.length === 0) {
    return (
      <div className="pose-library">
        <div className="pose-library-header">
          <h3>Pose Library</h3>
          <button type="button" onClick={handleCapture}>
            Capture Pose
          </button>
        </div>
        <p className="empty-state">Store reference poses to reuse joint configurations instantly.</p>
      </div>
    );
  }

  return (
    <div className="pose-library">
      <div className="pose-library-header">
        <h3>Pose Library</h3>
        <button type="button" onClick={handleCapture}>
          Capture Pose
        </button>
      </div>
      <ul className="pose-list">
        {sortedPoses.map((pose) => {
          const jointCount = Object.keys(pose.values).length;
          const isEditing = editingId === pose.id;
          return (
            <li key={pose.id} className="pose-item">
              {isEditing ? (
                <div className="pose-edit">
                  <input
                    value={draftName}
                    onChange={(event) => setDraftName(event.target.value)}
                    onKeyDown={(event) => {
                      if (event.key === 'Enter') {
                        event.preventDefault();
                        commitRename(pose.id);
                      }
                      if (event.key === 'Escape') {
                        event.preventDefault();
                        cancelRename();
                      }
                    }}
                    autoFocus
                  />
                  {renameError ? <div className="pose-error">{renameError}</div> : null}
                  <div className="pose-edit-actions">
                    <button type="button" onClick={() => commitRename(pose.id)}>
                      Save
                    </button>
                    <button type="button" className="ghost" onClick={cancelRename}>
                      Cancel
                    </button>
                  </div>
                </div>
              ) : (
                <>
                  <div className="pose-item-header">
                    <button type="button" className="pose-name-button" onClick={() => handleApply(pose.id)}>
                      {pose.name}
                    </button>
                    <div className="pose-actions">
                      <button type="button" className="ghost" onClick={() => beginRename(pose.id, pose.name)}>
                        Rename
                      </button>
                      <button type="button" className="ghost danger" onClick={() => removePose(pose.id)}>
                        Remove
                      </button>
                    </div>
                  </div>
                  <div className="pose-meta">
                    {jointCount} joint{jointCount === 1 ? '' : 's'} · saved{' '}
                    {new Date(pose.createdAt).toLocaleString()}
                  </div>
                </>
              )}
            </li>
          );
        })}
      </ul>
    </div>
  );
};

export default PoseLibrary;
