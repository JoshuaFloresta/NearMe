import { io } from 'socket.io-client';
import { API_BASE_URL } from './api';

let socket;
const isProd = import.meta.env.PROD;
const realtimeEnabled = isProd
  ? import.meta.env.VITE_REALTIME_ENABLED === 'true'
  : import.meta.env.VITE_REALTIME_ENABLED !== 'false';
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
      withCredentials: false,
    });
  }

  return socket;
};
