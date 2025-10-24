import React from 'react';
import { useSceneStore } from '@state/store';

const SceneOutline: React.FC = () => {
  const nodes = useSceneStore((state) => state.nodes);
  const rootId = useSceneStore((state) => state.rootId);
  const selectedId = useSceneStore((state) => state.selectedId);
  const selectNode = useSceneStore((state) => state.selectNode);

  const renderNode = (id: string, depth: number): React.ReactNode => {
    const node = nodes[id];
    if (!node) return null;
    const isActive = id === selectedId;
    return (
      <React.Fragment key={id}>
        <div
          className={`scene-node${isActive ? ' active' : ''}`}
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
