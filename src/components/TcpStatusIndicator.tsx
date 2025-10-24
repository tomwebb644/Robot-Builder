import { useRobotStore } from '../state/robotStore';

const STATUS_LABELS: Record<string, string> = {
  offline: 'Offline',
  listening: 'Listening',
  connected: 'Connected',
  error: 'Error'
};

export function TcpStatusIndicator() {
  const { tcpStatus, tcpMessage, lastTcpEventTimestamp } = useRobotStore((state) => ({
    tcpStatus: state.tcpStatus,
    tcpMessage: state.tcpMessage,
    lastTcpEventTimestamp: state.lastTcpEventTimestamp
  }));

  const label = STATUS_LABELS[tcpStatus] ?? tcpStatus;
  const formattedTimestamp = lastTcpEventTimestamp
    ? new Date(lastTcpEventTimestamp).toLocaleTimeString()
    : null;

  return (
    <div className={`tcp-status tcp-status-${tcpStatus}`} role="status" aria-live="polite">
      <span className="indicator" />
      <span className="label">TCP: {label}</span>
      {tcpMessage ? <span className="message">{tcpMessage}</span> : null}
      {formattedTimestamp ? <span className="timestamp">{formattedTimestamp}</span> : null}
    </div>
  );
}
