import { RunRepository, UserRepository } from "@synthetic/database";
import type { Server as HttpServer } from "node:http";
import { Server } from "socket.io";
import { env } from "../config.js";
import { verifySessionToken } from "../auth/token.js";

type SocketUser = {
  id: string;
  organizationId: string;
  role: "OWNER" | "ADMIN" | "TESTER" | "VIEWER";
};

const userRepository = new UserRepository();
const runRepository = new RunRepository();

let io: Server | null = null;

function parseCookie(cookieHeader: string | undefined, name: string): string | null {
  if (!cookieHeader) return null;
  const parts = cookieHeader.split(";").map((part) => part.trim());
  const found = parts.find((part) => part.startsWith(`${name}=`));
  if (!found) return null;
  const value = found.slice(name.length + 1);
  return value.length > 0 ? decodeURIComponent(value) : null;
}

export function initializeRealtime(server: HttpServer) {
  io = new Server(server, {
    cors: {
      origin: env.WEB_ORIGIN,
      credentials: true
    }
  });

  io.use(async (socket, next) => {
    try {
      const cookieHeader = socket.handshake.headers.cookie;
      const token = parseCookie(cookieHeader, env.AUTH_COOKIE_NAME);
      if (!token) return void next(new Error("Unauthorized"));

      const claims = verifySessionToken(token);
      const user = await userRepository.findSafeById(claims.sub);
      if (!user || user.organizationId !== claims.orgId || user.role !== claims.role) {
        return void next(new Error("Unauthorized"));
      }

      socket.data.user = {
        id: user.id,
        organizationId: user.organizationId,
        role: user.role
      } satisfies SocketUser;

      next();
    } catch {
      next(new Error("Unauthorized"));
    }
  });

  io.on("connection", (socket) => {
    socket.on("subscribe", async (payload: { channel?: string }) => {
      const channel = payload?.channel;
      if (!channel || !channel.startsWith("run:")) {
        return void socket.emit("subscription.error", { message: "Invalid channel" });
      }

      const runId = channel.slice(4);
      const user = socket.data.user as SocketUser | undefined;
      if (!user) return void socket.emit("subscription.error", { message: "Unauthorized" });

      const run = await runRepository.getById(runId);
      if (!run || run.organizationId !== user.organizationId) {
        return void socket.emit("subscription.error", { message: "Run not found" });
      }

      void socket.join(channel);
      socket.emit("subscription.ok", { channel });
    });
  });

  return io;
}

export function emitRunEvent(runId: string, event: unknown) {
  if (!io) return;
  io.to(`run:${runId}`).emit("event.created", event);
}
