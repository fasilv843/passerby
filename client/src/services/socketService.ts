import { io, Socket } from "socket.io-client";
import { serverUrl } from "../environment";

class SocketService {
  private static instance: SocketService;
  private socket: Socket | null = null;

  private constructor() {}

  static getInstance(): SocketService {
    if (!SocketService.instance) {
      SocketService.instance = new SocketService();
    }
    return SocketService.instance;
  }

  connect() {
    if (!this.socket) {
      this.socket = io(serverUrl, { transports: ["websocket"] });
      console.log("Socket connected:", serverUrl);
    }
    return this.socket;
  }

  getSocket(): Socket {
    if (!this.socket) {
      throw new Error("Socket not initialized. Call connect() first.");
    }
    return this.socket;
  }

  disconnect() {
    if (this.socket) {
      this.socket.disconnect();
      this.socket = null;
      console.log("Socket disconnected");
    }
  }
}

const socketService = SocketService.getInstance();

export default socketService;
