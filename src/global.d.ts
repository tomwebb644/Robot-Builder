export {}; // Ensure this file is treated as a module.

declare global {
  interface Window {
    robotAPI?: {
      setJointValue: (payload: { name: string; value: number }) => void;
      onJointUpdate: (callback: (updates: Record<string, number>) => void) => () => void;
      onTcpStatus: (
        callback: (status: { status: string; message?: string }) => void
      ) => () => void;
      requestInitialJointState: () => Promise<Record<string, number>>;
    };
  }
}
