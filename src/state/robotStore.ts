import { create } from 'zustand';

export type JointType = 'rotational' | 'linear';
export type JointAxis = 'x' | 'y' | 'z';
export type JointUpdateSource = 'local' | 'remote';
export type TcpStatus = 'offline' | 'listening' | 'connected' | 'error';

export interface JointLimits {
  min: number;
  max: number;
}

export interface Joint {
  id: string;
  name: string;
  type: JointType;
  axis: JointAxis;
  limits: JointLimits;
  value: number;
  externalControl: boolean;
  remoteDriven: boolean;
}

interface RobotState {
  joints: Joint[];
  selectedJointId: string | null;
  tcpStatus: TcpStatus;
  tcpMessage?: string;
  lastTcpEventTimestamp?: number;
  selectJoint: (id: string) => void;
  updateJointValue: (id: string, value: number, source?: JointUpdateSource) => void;
  toggleExternalControl: (id: string) => void;
  updateJointMetadata: (
    id: string,
    updates: Partial<Omit<Joint, 'id' | 'value' | 'limits'>> & { limits?: Partial<JointLimits> }
  ) => void;
  applyRemoteUpdates: (updates: Record<string, number>) => void;
  setTcpStatus: (status: TcpStatus, message?: string) => void;
  loadInitialJointState: () => Promise<void>;
}

const clamp = (value: number, min: number, max: number) => Math.min(Math.max(value, min), max);

const INITIAL_JOINTS: Joint[] = [
  {
    id: 'joint-shoulder',
    name: 'shoulder',
    type: 'rotational',
    axis: 'z',
    limits: { min: -135, max: 135 },
    value: 0,
    externalControl: false,
    remoteDriven: false
  },
  {
    id: 'joint-elbow',
    name: 'elbow',
    type: 'rotational',
    axis: 'y',
    limits: { min: -90, max: 120 },
    value: 15,
    externalControl: false,
    remoteDriven: false
  },
  {
    id: 'joint-slider',
    name: 'wrist_extension',
    type: 'linear',
    axis: 'z',
    limits: { min: -120, max: 120 },
    value: 0,
    externalControl: true,
    remoteDriven: false
  }
];

export const useRobotStore = create<RobotState>((set) => ({
  joints: INITIAL_JOINTS,
  selectedJointId: INITIAL_JOINTS[0]?.id ?? null,
  tcpStatus: 'offline',
  tcpMessage: undefined,
  lastTcpEventTimestamp: undefined,
  selectJoint: (id) => set({ selectedJointId: id }),
  updateJointValue: (id, value, source = 'local') => {
    set((state) => {
      const joints = state.joints.map((joint) => {
        if (joint.id !== id) {
          return joint;
        }
        const nextValue = clamp(value, joint.limits.min, joint.limits.max);
        if (source === 'local') {
          window.robotAPI?.setJointValue({ name: joint.name, value: nextValue });
        }
        return {
          ...joint,
          value: nextValue,
          remoteDriven: source === 'remote'
        };
      });
      return { joints };
    });
  },
  toggleExternalControl: (id) =>
    set((state) => ({
      joints: state.joints.map((joint) =>
        joint.id === id
          ? {
              ...joint,
              externalControl: !joint.externalControl
            }
          : joint
      )
    })),
  updateJointMetadata: (id, updates) =>
    set((state) => ({
      joints: state.joints.map((joint) => {
        if (joint.id !== id) {
          return joint;
        }
        const nextLimits: JointLimits = {
          ...joint.limits,
          ...updates.limits
        };
        const normalizedLimits = {
          min: Math.min(nextLimits.min, nextLimits.max),
          max: Math.max(nextLimits.min, nextLimits.max)
        };
        const nextValue = clamp(joint.value, normalizedLimits.min, normalizedLimits.max);
        const nextJoint: Joint = {
          ...joint,
          ...updates,
          limits: normalizedLimits,
          value: nextValue
        };
        return nextJoint;
      })
    })),
  applyRemoteUpdates: (updates) =>
    set((state) => ({
      joints: state.joints.map((joint) => {
        if (!(joint.name in updates)) {
          return joint.remoteDriven ? { ...joint, remoteDriven: false } : joint;
        }
        if (!joint.externalControl) {
          return joint.remoteDriven ? { ...joint, remoteDriven: false } : joint;
        }
        const value = clamp(updates[joint.name], joint.limits.min, joint.limits.max);
        return {
          ...joint,
          value,
          remoteDriven: true
        };
      })
    })),
  setTcpStatus: (status, message) =>
    set({
      tcpStatus: status,
      tcpMessage: message,
      lastTcpEventTimestamp: Date.now()
    }),
  loadInitialJointState: async () => {
    if (!window.robotAPI?.requestInitialJointState) {
      set({ tcpStatus: 'offline' });
      return;
    }
    try {
      const snapshot = await window.robotAPI.requestInitialJointState();
      if (!snapshot) {
        return;
      }
      set((state) => ({
        joints: state.joints.map((joint) => {
          if (!(joint.name in snapshot)) {
            return joint;
          }
          const value = clamp(snapshot[joint.name], joint.limits.min, joint.limits.max);
          return {
            ...joint,
            value
          };
        }),
        tcpStatus: 'listening',
        lastTcpEventTimestamp: Date.now()
      }));
    } catch (error) {
      console.error('Failed to request initial joint state', error);
      set({ tcpStatus: 'error', tcpMessage: 'Unable to fetch joint snapshot' });
    }
  }
}));
