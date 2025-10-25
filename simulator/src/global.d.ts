import type { TcpStatusPayload } from './lib/tcp';

declare global {
  interface Window {
    simulatorAPI?: {
      connectTcp: (options: { host: string; port: number }) => Promise<{ success: boolean; error?: string }>;
      disconnectTcp: () => Promise<void>;
      getTcpStatus: () => Promise<TcpStatusPayload>;
      sendJointState: (payload: Record<string, number>) => void;
      onTcpStatus: (callback: (payload: TcpStatusPayload) => void) => () => void;
    };
  }
}

export {};
