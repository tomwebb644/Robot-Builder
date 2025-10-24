import React, { useMemo } from 'react';
import { useSceneStore } from '@state/store';

const SceneOutline: React.FC = () => {
  const nodes = useSceneStore((state) => state.nodes);
  const rootId = useSceneStore((state) => state.rootId);
  const selectedId = useSceneStore((state) => state.selectedId);
  const selectNode = useSceneStore((state) => state.selectNode);
  const connectMode = useSceneStore((state) => state.connectMode);
  const connectSourceId = useSceneStore((state) => state.connectSourceId);

  const blockedTargets = useMemo(() => {
    if (!connectMode || !connectSourceId) return new Set<string>();
    const blocked = new Set<string>();
    const queue = [connectSourceId];
    while (queue.length > 0) {
      const id = queue.pop();
      if (!id) continue;
      blocked.add(id);
      const node = nodes[id];
      if (!node) continue;
      queue.push(...node.children);
    }
    return blocked;
  }, [connectMode, connectSourceId, nodes]);

  const renderNode = (id: string, depth: number): React.ReactNode => {
    const node = nodes[id];
    if (!node) return null;
    const isActive = id === selectedId;
    const isSource = connectSourceId === id;
    const isEligibleTarget =
      Boolean(connectMode && connectSourceId && id !== connectSourceId && !blockedTargets.has(id));
    return (
      <React.Fragment key={id}>
        <div
          className={`scene-node${isActive ? ' active' : ''}${isSource ? ' source' : ''}${
            isEligibleTarget ? ' target' : ''
          }`}
          style={{ paddingLeft: `${depth * 12}px` }}
          onClick={() => selectNode(id)}
        >
          <span>{node.name}</span>
          {node.joint ? <span className="meta">{node.joint.type}</span> : <span className="meta">base</span>}
        </div>
        {node.children.map((child) => renderNode(child, depth + 1))}
      </React.Fragment>
    );
  };

  return (
    <div className="scene-outline">
      <div className="section-title">Hierarchy</div>
      {renderNode(rootId, 0)}
    </div>
  );
};

export default SceneOutline;
