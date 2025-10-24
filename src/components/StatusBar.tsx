import React from 'react';
import { useSceneStore } from '@state/store';

const StatusBar: React.FC = () => {
  const fps = useSceneStore((state) => state.fps);
  const tcpStatus = useSceneStore((state) => state.tcpStatus);
  const selectedId = useSceneStore((state) => state.selectedId);
  const nodes = useSceneStore((state) => state.nodes);
  const selectedNode = selectedId ? nodes[selectedId] : undefined;

  return (
    <div className="status-bar">
      <span>
        <strong>TCP:</strong> {tcpStatus}
      </span>
      <span>
        <strong>FPS:</strong> {fps.toFixed(1)}
      </span>
      <span>
        {selectedNode ? (
          <>
            <strong>Selected:</strong> {selectedNode.name}
            {selectedNode.joint ? (
              <span className="tag dot">
                {selectedNode.joint.name} · {selectedNode.joint.type}
              </span>
            ) : null}
          </>
        ) : (
          'No selection'
        )}
      </span>
    </div>
  );
};

export default StatusBar;
