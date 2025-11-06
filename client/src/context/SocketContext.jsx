// src/context/SocketContext.jsx
import React, { createContext, useContext, useEffect, useState } from "react";
import io from "socket.io-client";

const SocketContext = createContext(null);

export const useSocket = () => {
  const context = useContext(SocketContext);
  if (!context) {
    throw new Error("useSocket must be used within a SocketProvider");
  }
  return context;
};

export const SocketProvider = ({ children }) => {
  const [socket, setSocket] = useState(null);
  const [connected, setConnected] = useState(false);

  useEffect(() => {
    // Get token from localStorage
    const token = localStorage.getItem("jwt_token");
    
    if (!token) {
      // No token, don't connect
      return;
    }

    // In development, connect to localhost:4000
    // In production, use same origin
    const isDev = process.env.NODE_ENV !== 'production';
    const socketBase = process.env.REACT_APP_BACKEND_URL || (isDev ? "http://localhost:4000" : window.location.origin);
    const socketPath = process.env.REACT_APP_SOCKET_PATH || "/dday/api/socket.io";

    console.log("[Socket.IO] Client Config:");
    console.log("  Environment:", process.env.NODE_ENV);
    console.log("  Base URL:", socketBase);
    console.log("  Path:", socketPath);
    console.log("  Full URL:", `${socketBase}${socketPath}`);

    const newSocket = io(socketBase, {
      path: socketPath,
      auth: { token },
      transports: ["polling", "websocket"], // Match server: try polling first, then upgrade
      reconnection: true,
      reconnectionDelay: 1000,
      reconnectionAttempts: 5,
      timeout: 20000,
      forceNew: true
    });

    newSocket.on("connect", () => {
      console.log(" Socket connected:", newSocket.id);
      console.log("   Transport:", newSocket.io.engine.transport.name);
      setConnected(true);
    });

    newSocket.on("disconnect", (reason) => {
      console.log(" Socket disconnected:", reason);
      setConnected(false);
    });

    newSocket.on("connect_error", (error) => {
      console.error(" Socket connection error:", error.message);
      console.error("   Error details:", error);
      setConnected(false);
    });

    newSocket.io.on("reconnect_attempt", () => {
      console.log("[Reconnect] Attempting to reconnect...");
    });

    newSocket.io.on("reconnect", (attemptNumber) => {
      console.log(" Reconnected after", attemptNumber, "attempts");
    });

    setSocket(newSocket);

    // Cleanup on unmount
    return () => {
      if (newSocket) {
        newSocket.disconnect();
      }
    };
  }, []);

  const value = {
    socket,
    connected
  };

  return (
    <SocketContext.Provider value={value}>
      {children}
    </SocketContext.Provider>
  );
};
