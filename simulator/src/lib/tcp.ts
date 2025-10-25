export type TcpStatus = 'disconnected' | 'connecting' | 'connected' | 'error';

export interface TcpStatusPayload {
  status: TcpStatus;
  message?: string;
}
