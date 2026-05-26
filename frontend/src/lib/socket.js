import { io } from 'socket.io-client';
import { API_BASE_URL } from './api';

let socket;
const realtimeEnabled = import.meta.env.VITE_REALTIME_ENABLED !== 'false';
const disabledSocket = {
  emit: () => disabledSocket,
  on: () => disabledSocket,
  off: () => disabledSocket,
};

export const getSocket = () => {
  if (!realtimeEnabled) {
    return disabledSocket;
  }

  if (!socket) {
    socket = io(API_BASE_URL, {
      autoConnect: true,
      transports: ['websocket', 'polling'],
    });
  }

  return socket;
};
