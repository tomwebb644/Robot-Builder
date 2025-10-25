declare global {
  interface Window {
    api: {
      onJointUpdate: (
        callback: (payload: Record<string, number>) => void
      ) => () => void;
      sendJointValue: (payload: { joint: string; value: number }) => void;
      saveScene: (scene: unknown) => Promise<{ success: boolean; filePath?: string }>;
      loadScene: () => Promise<{ success: boolean; scene?: unknown }>;
      writeAutosave: (scene: unknown) => Promise<{ success: boolean; filePath?: string; error?: string }>;
      loadAutosave: () => Promise<{ success: boolean; scene?: unknown; filePath?: string }>;
      log: (message: string) => void;
    };
  }
}

export {};
