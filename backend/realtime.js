let io;

export const attachRealtime = (socketServer) => {
  io = socketServer;
};

export const emitAlert = (event, payload) => {
  if (!io) return;
  io.emit(event, payload);
};

export const emitAlertToUser = (userId, event, payload) => {
  if (!io || !userId) return;
  io.to(`user:${String(userId)}`).emit(event, payload);
};

export const emitAlertToUsers = (userIds = [], event, payload) => {
  if (!io) return;
  const unique = [...new Set((Array.isArray(userIds) ? userIds : []).map((id) => String(id)).filter(Boolean))];
  unique.forEach((id) => io.to(`user:${id}`).emit(event, payload));
};

export const emitAlertToRole = (role, event, payload) => {
  if (!io || !role) return;
  io.to(`role:${String(role).toLowerCase()}`).emit(event, payload);
};
