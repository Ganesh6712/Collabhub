import { Server } from "socket.io";

let io: Server | null = null;

/** Save the socket server so HTTP routes can emit events too. */
export function setIo(socketServer: Server) {
  io = socketServer;
}

/** Emit to every open tab in a workspace (live file/chat sync). */
export function emitToWorkspace(
  workspaceId: string,
  event: string,
  payload?: any
) {
  io?.to(`workspace:${workspaceId}`).emit(event, payload);
}