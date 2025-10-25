import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useSceneStore } from '@state/store';
import type { PoseDefinition } from '@state/store';

const PoseLibrary: React.FC = () => {
  const poses = useSceneStore((state) => state.poses);
  const addPose = useSceneStore((state) => state.addPose);
  const renamePose = useSceneStore((state) => state.renamePose);
  const removePose = useSceneStore((state) => state.removePose);
  const applyPose = useSceneStore((state) => state.applyPose);
  const logNetworkEvent = useSceneStore((state) => state.logNetworkEvent);
  const applyInterpolatedJointValues = useSceneStore((state) => state.applyInterpolatedJointValues);

  const sortedPoses = useMemo(() => [...poses].sort((a, b) => b.createdAt - a.createdAt), [poses]);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [draftName, setDraftName] = useState('');
  const [renameError, setRenameError] = useState<string | null>(null);
  const [isPlaying, setIsPlaying] = useState(false);

  const playingRef = useRef(false);
  const playbackRef = useRef<{
    order: PoseDefinition[];
    index: number;
    startValues: Record<string, number>;
    targetValues: Record<string, number>;
    elapsed: number;
    duration: number;
    lastTimestamp: number | null;
  } | null>(null);

  const stopPlayback = useCallback(() => {
    playingRef.current = false;
    playbackRef.current = null;
    setIsPlaying(false);
  }, []);

  const handleCapture = () => {
    stopPlayback();
    const poseId = addPose();
    const createdPose = useSceneStore.getState().poses.find((pose) => pose.id === poseId);
    setEditingId(poseId);
    setDraftName(createdPose?.name ?? '');
    setRenameError(null);
  };

  const handleApply = (poseId: string) => {
    stopPlayback();
    const changed = applyPose(poseId);
    if (Object.keys(changed).length === 0) {
      return;
    }
    for (const [joint, value] of Object.entries(changed)) {
      window.api.sendJointValue({ joint, value });
    }
    logNetworkEvent('outgoing', changed, 'manual');
  };

  const captureCurrentJointValues = useCallback(() => {
    const { nodes } = useSceneStore.getState();
    const values: Record<string, number> = {};
    for (const node of Object.values(nodes)) {
      for (const joint of node.joints) {
        values[joint.name] = joint.currentValue;
      }
    }
    return values;
  }, []);

  const computeTargetValues = useCallback(
    (pose: PoseDefinition, baseline: Record<string, number>) => {
      const { nodes } = useSceneStore.getState();
      const result: Record<string, number> = { ...baseline };
      for (const node of Object.values(nodes)) {
        for (const joint of node.joints) {
          if (typeof pose.values[joint.name] === 'number') {
            result[joint.name] = pose.values[joint.name];
          }
        }
      }
      return result;
    },
    []
  );

  const startPlayback = useCallback(() => {
    if (sortedPoses.length === 0) {
      return;
    }
    const order = [...sortedPoses];
    const startValues = captureCurrentJointValues();
    const targetValues = computeTargetValues(order[0], startValues);
    playbackRef.current = {
      order,
      index: 0,
      startValues,
      targetValues,
      elapsed: 0,
      duration: 2.5,
      lastTimestamp: null
    };
    playingRef.current = true;
    setIsPlaying(true);
  }, [sortedPoses, captureCurrentJointValues, computeTargetValues]);

  useEffect(() => {
    if (!isPlaying) {
      return undefined;
    }
    let frameId: number;
    const step = (timestamp: number) => {
      const state = playbackRef.current;
      if (!state || !playingRef.current || state.order.length === 0) {
        return;
      }
      if (state.lastTimestamp === null) {
        state.lastTimestamp = timestamp;
      }
      const delta = (timestamp - state.lastTimestamp) / 1000;
      state.lastTimestamp = timestamp;
      state.elapsed += delta;
      const progress = Math.min(state.elapsed / state.duration, 1);
      const eased = progress >= 1 ? 1 : 1 - Math.pow(1 - progress, 3);
      const names = new Set([
        ...Object.keys(state.startValues),
        ...Object.keys(state.targetValues)
      ]);
      const values: Record<string, number> = {};
      names.forEach((name) => {
        const start = state.startValues[name];
        const target = state.targetValues[name];
        if (typeof start !== 'number' || typeof target !== 'number') {
          return;
        }
        const interpolated = start + (target - start) * eased;
        if (Number.isFinite(interpolated)) {
          values[name] = interpolated;
        }
      });
      applyInterpolatedJointValues(values);
      if (progress >= 1) {
        const finalValues = captureCurrentJointValues();
        for (const [joint, value] of Object.entries(finalValues)) {
          window.api.sendJointValue({ joint, value });
        }
        const nextIndex = (state.index + 1) % state.order.length;
        const nextPose = state.order[nextIndex];
        const nextStart = finalValues;
        const nextTarget = computeTargetValues(nextPose, nextStart);
        playbackRef.current = {
          ...state,
          index: nextIndex,
          startValues: nextStart,
          targetValues: nextTarget,
          elapsed: 0,
          lastTimestamp: timestamp
        };
      }
      if (playingRef.current) {
        frameId = requestAnimationFrame(step);
      }
    };
    frameId = requestAnimationFrame(step);
    return () => cancelAnimationFrame(frameId);
  }, [isPlaying, applyInterpolatedJointValues, captureCurrentJointValues, computeTargetValues]);

  useEffect(() => {
    if (sortedPoses.length === 0 && isPlaying) {
      stopPlayback();
    }
  }, [sortedPoses.length, isPlaying, stopPlayback]);

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

  return (
    <div className="pose-library">
      <div className="pose-library-header">
        <h3>Pose Library</h3>
        <div className="pose-library-actions">
          <button
            type="button"
            className="ghost"
            onClick={() => (isPlaying ? stopPlayback() : startPlayback())}
            disabled={sortedPoses.length === 0}
          >
            {isPlaying ? 'Stop Playback' : 'Play Sequence'}
          </button>
          <button type="button" onClick={handleCapture}>
            Capture Pose
          </button>
        </div>
      </div>
      <div className="pose-list-container">
        {sortedPoses.length === 0 ? (
          <p className="empty-state">Store reference poses to reuse joint configurations instantly.</p>
        ) : (
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
        )}
      </div>
    </div>
  );
};

export default PoseLibrary;
