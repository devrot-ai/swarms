import { Server as HttpServer } from "node:http";
import { Server as SocketIOServer } from "socket.io";

export type RealtimeEvent = {
  type: string;
  sessionId: string;
  payload: Record<string, unknown>;
};

let io: SocketIOServer | null = null;

export function initWebSocket(httpServer: HttpServer, corsOrigin: string): SocketIOServer {
  io = new SocketIOServer(httpServer, {
    cors: {
      origin: corsOrigin,
      credentials: true,
    },
  });

  io.on("connection", (socket) => {
    socket.on("session:subscribe", (sessionId: string) => {
      socket.join(sessionId);
    });

    socket.on("session:unsubscribe", (sessionId: string) => {
      socket.leave(sessionId);
    });
  });

  return io;
}

export function publishRealtime(event: RealtimeEvent): void {
  io?.to(event.sessionId).emit("agent:event", event);
}
