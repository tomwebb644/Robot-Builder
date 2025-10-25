import React, { useCallback, useEffect, useRef, useState } from 'react';
import { useSceneStore } from '@state/store';
import type { NetworkSource, PoseDefinition } from '@state/store';

const TRANSITION_DURATION = 2.5;
const HOLD_DURATION = 0.6;

const PoseLibrary: React.FC = () => {
  const poses = useSceneStore((state) => state.poses);
  const addPose = useSceneStore((state) => state.addPose);
  const renamePose = useSceneStore((state) => state.renamePose);
  const removePose = useSceneStore((state) => state.removePose);
  const reorderPoses = useSceneStore((state) => state.reorderPoses);
  const applyPose = useSceneStore((state) => state.applyPose);
  const logNetworkEvent = useSceneStore((state) => state.logNetworkEvent);
  const applyInterpolatedJointValues = useSceneStore((state) => state.applyInterpolatedJointValues);

  const [editingId, setEditingId] = useState<string | null>(null);
  const [draftName, setDraftName] = useState('');
  const [renameError, setRenameError] = useState<string | null>(null);
  const [isPlaying, setIsPlaying] = useState(false);
  const [pendingPoseId, setPendingPoseId] = useState<string | null>(null);
  const [draggingId, setDraggingId] = useState<string | null>(null);
  const [dragOverId, setDragOverId] = useState<string | null>(null);
  const [currentPoseId, setCurrentPoseId] = useState<string | null>(null);

  const playingRef = useRef(false);
  const playbackRef = useRef<{
    order: string[];
    index: number;
    startValues: Record<string, number>;
    targetValues: Record<string, number>;
    targetPoseId: string | null;
    elapsed: number;
    duration: number;
    holdDuration: number;
    lastTimestamp: number | null;
    phase: 'transition' | 'hold';
  } | null>(null);
  const draggingIdRef = useRef<string | null>(null);

  const stopPlayback = useCallback(() => {
    playingRef.current = false;
    playbackRef.current = null;
    setIsPlaying(false);
    setCurrentPoseId(null);
  }, []);

  const emitJointValues = useCallback(
    (values: Record<string, number>, source: NetworkSource) => {
      if (!values || Object.keys(values).length === 0) {
        return;
      }
      const api = (window as any).api;
      if (api && typeof api.sendJointValue === 'function') {
        for (const [joint, value] of Object.entries(values)) {
          api.sendJointValue({ joint, value });
        }
      }
      logNetworkEvent('outgoing', values, source);
    },
    [logNetworkEvent]
  );

  const handleCapture = () => {
    stopPlayback();
    const poseId = addPose();
    const createdPose = useSceneStore.getState().poses.find((pose) => pose.id === poseId);
    setPendingPoseId(poseId);
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
    emitJointValues(changed, 'manual');
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
    if (poses.length === 0) {
      return;
    }
    const order = poses.map((pose) => pose.id);
    const latestPoses = useSceneStore.getState().poses;
    const firstPose = latestPoses.find((pose) => pose.id === order[0]);
    if (!firstPose) {
      return;
    }
    const startValues = captureCurrentJointValues();
    const targetValues = computeTargetValues(firstPose, startValues);
    playbackRef.current = {
      order,
      index: 0,
      startValues,
      targetValues,
      targetPoseId: firstPose.id,
      elapsed: 0,
      duration: TRANSITION_DURATION,
      holdDuration: HOLD_DURATION,
      lastTimestamp: null,
      phase: 'transition'
    };
    playingRef.current = true;
    setIsPlaying(true);
    setCurrentPoseId(firstPose.id);
  }, [poses, captureCurrentJointValues, computeTargetValues]);

  useEffect(() => {
    if (!isPlaying) {
      return undefined;
    }
    let frameId: number;
    const step = (timestamp: number) => {
      const state = playbackRef.current;
      if (!state || !playingRef.current) {
        stopPlayback();
        return;
      }

      const posesSnapshot = useSceneStore.getState().poses;
      if (!posesSnapshot.length) {
        stopPlayback();
        return;
      }

      state.order = posesSnapshot.map((pose) => pose.id);
      if (!state.order.length) {
        stopPlayback();
        return;
      }

      if (!state.targetPoseId || !state.order.includes(state.targetPoseId)) {
        state.index = 0;
        const fallbackId = state.order[0];
        const fallbackPose = posesSnapshot.find((pose) => pose.id === fallbackId);
        const baseline = captureCurrentJointValues();
        if (fallbackPose) {
          state.startValues = baseline;
          state.targetValues = computeTargetValues(fallbackPose, baseline);
          state.targetPoseId = fallbackPose.id;
          state.phase = 'transition';
          state.elapsed = 0;
          state.lastTimestamp = timestamp;
          setCurrentPoseId(fallbackPose.id);
        }
      } else {
        state.index = state.order.indexOf(state.targetPoseId);
      }

      if (state.lastTimestamp === null) {
        state.lastTimestamp = timestamp;
        if (playingRef.current) {
          frameId = requestAnimationFrame(step);
        }
        return;
      }

      const delta = (timestamp - state.lastTimestamp) / 1000;
      state.lastTimestamp = timestamp;

      if (state.phase === 'hold') {
        state.elapsed += delta;
        if (state.elapsed >= state.holdDuration) {
          const nextOrder = state.order.length ? state.order : posesSnapshot.map((pose) => pose.id);
          if (!nextOrder.length) {
            stopPlayback();
            return;
          }
          const nextIndex = (state.index + 1) % nextOrder.length;
          const nextPoseId = nextOrder[nextIndex];
          const nextPose = posesSnapshot.find((pose) => pose.id === nextPoseId);
          if (!nextPose) {
            stopPlayback();
            return;
          }
          const baseline = captureCurrentJointValues();
          state.index = nextIndex;
          state.startValues = baseline;
          state.targetValues = computeTargetValues(nextPose, baseline);
          state.targetPoseId = nextPose.id;
          state.phase = 'transition';
          state.elapsed = 0;
          state.lastTimestamp = timestamp;
          setCurrentPoseId(nextPose.id);
        }
      } else {
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
        if (Object.keys(values).length > 0) {
          applyInterpolatedJointValues(values);
        }
        if (progress >= 1) {
          const finalValues = captureCurrentJointValues();
          emitJointValues(finalValues, 'playback');
          state.phase = 'hold';
          state.elapsed = 0;
          state.lastTimestamp = timestamp;
        }
      }

      if (playingRef.current) {
        frameId = requestAnimationFrame(step);
      }
    };

    frameId = requestAnimationFrame(step);
    return () => cancelAnimationFrame(frameId);
  }, [
    isPlaying,
    applyInterpolatedJointValues,
    emitJointValues,
    captureCurrentJointValues,
    computeTargetValues,
    stopPlayback
  ]);

  useEffect(() => {
    if (poses.length === 0 && isPlaying) {
      stopPlayback();
    }
  }, [poses, isPlaying, stopPlayback]);

  useEffect(() => {
    if (pendingPoseId && !poses.some((pose) => pose.id === pendingPoseId)) {
      setPendingPoseId(null);
    }
  }, [poses, pendingPoseId]);

  const beginRename = (poseId: string, name: string) => {
    setEditingId(poseId);
    setDraftName(name);
    setRenameError(null);
  };

  const cancelRename = useCallback(() => {
    if (editingId && editingId === pendingPoseId) {
      removePose(editingId);
      setPendingPoseId(null);
    }
    setEditingId(null);
    setDraftName('');
    setRenameError(null);
  }, [editingId, pendingPoseId, removePose]);

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
    if (pendingPoseId === poseId) {
      setPendingPoseId(null);
    }
  };

  const resetDragState = useCallback(() => {
    draggingIdRef.current = null;
    setDraggingId(null);
    setDragOverId(null);
  }, []);

  const handleDragStart = useCallback(
    (event: React.DragEvent<HTMLLIElement>, poseId: string) => {
      draggingIdRef.current = poseId;
      setDraggingId(poseId);
      setDragOverId(poseId);
      event.dataTransfer.effectAllowed = 'move';
      event.dataTransfer.setData('text/plain', poseId);
    },
    []
  );

  const handleDragOverItem = useCallback(
    (event: React.DragEvent<HTMLLIElement>, poseId: string) => {
      event.preventDefault();
      event.stopPropagation();
      event.dataTransfer.dropEffect = 'move';
      if (dragOverId !== poseId) {
        setDragOverId(poseId);
      }
    },
    [dragOverId]
  );

  const handleDragLeave = useCallback(
    (event: React.DragEvent<HTMLLIElement>, poseId: string) => {
      event.stopPropagation();
      if (event.currentTarget.contains(event.relatedTarget as Node)) {
        return;
      }
      if (dragOverId === poseId) {
        setDragOverId(null);
      }
    },
    [dragOverId]
  );

  const handleDropOnItem = useCallback(
    (event: React.DragEvent<HTMLLIElement>, poseId: string) => {
      event.preventDefault();
      event.stopPropagation();
      event.dataTransfer.dropEffect = 'move';
      const sourceId = draggingIdRef.current ?? event.dataTransfer.getData('text/plain');
      if (sourceId) {
        reorderPoses(sourceId, poseId);
      }
      resetDragState();
    },
    [reorderPoses, resetDragState]
  );

  const handleDropOnListEnd = useCallback(
    (event: React.DragEvent<HTMLUListElement>) => {
      event.preventDefault();
      event.dataTransfer.dropEffect = 'move';
      const sourceId = draggingIdRef.current ?? event.dataTransfer.getData('text/plain');
      if (sourceId) {
        reorderPoses(sourceId);
      }
      resetDragState();
    },
    [reorderPoses, resetDragState]
  );

  const handleDragEnd = useCallback(() => {
    resetDragState();
  }, [resetDragState]);

  return (
    <div className="pose-library">
      <div className="pose-library-header">
        <h3>Pose Library</h3>
        <div className="pose-library-actions">
          <button
            type="button"
            className="ghost"
            onClick={() => (isPlaying ? stopPlayback() : startPlayback())}
            disabled={poses.length === 0}
          >
            {isPlaying ? 'Stop Playback' : 'Play Sequence'}
          </button>
          <button type="button" onClick={handleCapture}>
            Capture Pose
          </button>
        </div>
      </div>
      <div className="pose-list-container">
        {poses.length === 0 ? (
          <p className="empty-state">Store reference poses to reuse joint configurations instantly.</p>
        ) : (
          <ul
            className="pose-list"
            onDragOver={(event) => {
              event.preventDefault();
              event.dataTransfer.dropEffect = 'move';
              if (dragOverId !== null) {
                setDragOverId(null);
              }
            }}
            onDrop={handleDropOnListEnd}
          >
            {poses.map((pose) => {
              const jointCount = Object.keys(pose.values).length;
              const isEditing = editingId === pose.id;
              const isDraggingItem = draggingId === pose.id;
              const isDragOverItem = dragOverId === pose.id && draggingId !== pose.id;
              const isCurrent = currentPoseId === pose.id && isPlaying;
              const itemClass = [
                'pose-item',
                isDraggingItem ? 'dragging' : '',
                isDragOverItem ? 'drag-over' : '',
                isCurrent ? 'current' : ''
              ]
                .filter(Boolean)
                .join(' ');
              return (
                <li
                  key={pose.id}
                  className={itemClass}
                  draggable={!isEditing}
                  onDragStart={(event) => handleDragStart(event, pose.id)}
                  onDragOver={(event) => handleDragOverItem(event, pose.id)}
                  onDragEnter={(event) => handleDragOverItem(event, pose.id)}
                  onDragLeave={(event) => handleDragLeave(event, pose.id)}
                  onDrop={(event) => handleDropOnItem(event, pose.id)}
                  onDragEnd={handleDragEnd}
                >
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
                          <button
                            type="button"
                            className="ghost danger"
                            onClick={() => {
                              removePose(pose.id);
                              if (pendingPoseId === pose.id) {
                                setPendingPoseId(null);
                              }
                            }}
                          >
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
