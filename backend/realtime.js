let io;

export const attachRealtime = (socketServer) => {
  io = socketServer;
};

export const emitAlert = (event, payload) => {
  if (!io) return;
  io.emit(event, payload);
};
