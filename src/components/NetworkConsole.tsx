import React, { useMemo, useState } from 'react';
import { useSceneStore } from '@state/store';

const parsePayload = (input: string): Record<string, number> | null => {
  const trimmed = input.trim();
  if (!trimmed) return null;
  try {
    const parsed = JSON.parse(trimmed);
    if (typeof parsed === 'object' && parsed !== null) {
      const result: Record<string, number> = {};
      for (const [key, value] of Object.entries(parsed)) {
        const numeric = typeof value === 'number' ? value : Number(value);
        if (!Number.isNaN(numeric)) {
          result[key] = numeric;
        }
      }
      return Object.keys(result).length > 0 ? result : null;
    }
  } catch {
    // fall back to delimited parsing
  }

  const segments = trimmed.split(/[,;\n]+/);
  const result: Record<string, number> = {};
  for (const segment of segments) {
    const [rawKey, rawValue] = segment.split(/[:=]/);
    if (!rawKey || rawValue === undefined) continue;
    const key = rawKey.trim();
    const numeric = Number(rawValue.trim());
    if (!Number.isNaN(numeric)) {
      result[key] = numeric;
    }
  }
  return Object.keys(result).length > 0 ? result : null;
};

const formatValues = (values: Record<string, number>) =>
  Object.entries(values)
    .map(([key, value]) => `${key}: ${value.toFixed(2)}`)
    .join(', ');

interface NetworkConsoleProps {
  selectedId?: string;
}

const NetworkConsole: React.FC<NetworkConsoleProps> = ({ selectedId }) => {
  const networkLog = useSceneStore((state) => state.networkLog);
  const clearNetworkLog = useSceneStore((state) => state.clearNetworkLog);
  const applyRemoteJointValues = useSceneStore((state) => state.applyRemoteJointValues);
  const logNetworkEvent = useSceneStore((state) => state.logNetworkEvent);
  const nodes = useSceneStore((state) => state.nodes);
  const [draft, setDraft] = useState('');
  const [error, setError] = useState<string | null>(null);

  const activeJointName = useMemo(() => {
    if (!selectedId) return '';
    const node = nodes[selectedId];
    return node?.joint?.name ?? '';
  }, [nodes, selectedId]);

  const entries = useMemo(() => [...networkLog].reverse(), [networkLog]);

  const parseDraft = () => {
    const payload = parsePayload(draft);
    if (!payload) {
      setError('Unable to parse payload. Use JSON or comma-separated key=value pairs.');
      return null;
    }
    setError(null);
    return payload;
  };

  const handleInject = () => {
    const payload = parseDraft();
    if (!payload) return;
    applyRemoteJointValues(payload, 'manual');
  };

  const handleBroadcast = () => {
    const payload = parseDraft();
    if (!payload) return;
    for (const [joint, value] of Object.entries(payload)) {
      window.api.sendJointValue({ joint, value });
    }
    logNetworkEvent('outgoing', payload, 'manual');
  };

  const preset = () => {
    if (!activeJointName) return;
    setDraft((previous) => {
      if (!previous.trim()) {
        return JSON.stringify({ [activeJointName]: 0 }, null, 2);
      }
      return previous;
    });
  };

  return (
    <div className="network-console">
      <div className="section-title">Network Console</div>
      <textarea
        value={draft}
        onChange={(event) => setDraft(event.target.value)}
        placeholder={
          activeJointName
            ? `Try: { "${activeJointName}": 45 }`
            : 'Enter joint payload as JSON or joint=value pairs'
        }
      />
      {error ? <div className="error-text">{error}</div> : null}
      <div className="console-actions">
        <button type="button" onClick={handleInject}>
          Inject Locally
        </button>
        <button type="button" onClick={handleBroadcast}>
          Broadcast TCP
        </button>
        <button type="button" className="ghost" onClick={clearNetworkLog}>
          Clear Log
        </button>
        <button type="button" className="ghost" onClick={preset} disabled={!activeJointName}>
          Prefill Selected
        </button>
      </div>
      <div className="console-log">
        {entries.length === 0 ? (
          <p className="empty">Network activity will appear here.</p>
        ) : (
          entries.map((entry) => (
            <div key={entry.id} className={`log-entry ${entry.direction}`}>
              <div className="meta">
                <span className="tag">{entry.direction === 'incoming' ? 'RX' : 'TX'}</span>
                <span className="tag subtle">{entry.source}</span>
                <span>{new Date(entry.timestamp).toLocaleTimeString()}</span>
              </div>
              <div className="payload">{formatValues(entry.values)}</div>
            </div>
          ))
        )}
      </div>
    </div>
  );
};

export default NetworkConsole;
