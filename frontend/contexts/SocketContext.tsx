"use client";

import { createContext, useContext, useEffect, useRef, useState, ReactNode } from "react";
import { useAuth } from "@/hooks/useAuth";
import type { Socket } from "socket.io-client";

const SOCKET_URL = process.env.NEXT_PUBLIC_API_URL || "http://localhost:5000";

type SocketContextType = {
    socket: Socket | null;
    isConnected: boolean;
};

const SocketContext = createContext<SocketContextType>({
    socket: null,
    isConnected: false,
});

export function SocketProvider({ children }: { children: ReactNode }) {
    const { isAuthenticated, isAdmin } = useAuth();
    const socketRef = useRef<Socket | null>(null);
    const [socket, setSocket] = useState<Socket | null>(null);
    const [isConnected, setIsConnected] = useState(false);

    useEffect(() => {
        // Chỉ tạo socket nếu user đã authenticated
        if (!isAuthenticated) {
            // Disconnect nếu không authenticated
            if (socketRef.current) {
                socketRef.current.disconnect();
                socketRef.current.removeAllListeners();
                socketRef.current = null;
                setSocket(null);
                setIsConnected(false);
            }
            return;
        }

        // Nếu đã có socket và đang connected thì không tạo mới
        if (socketRef.current?.connected) {
            return;
        }

        // Dynamic import socket.io-client
        import("socket.io-client").then(({ io }) => {
            // Disconnect socket cũ nếu có
            if (socketRef.current) {
                socketRef.current.disconnect();
                socketRef.current.removeAllListeners();
            }

            // Tạo socket mới
            const newSocket = io(SOCKET_URL, {
                transports: ["websocket"],
                reconnection: true,
                reconnectionDelay: 1000,
                reconnectionAttempts: 5,
            });

            socketRef.current = newSocket;
            setSocket(newSocket);

            newSocket.on("connect", () => {
                console.log("Socket connected:", newSocket.id);
                setIsConnected(true);
            });

            newSocket.on("disconnect", () => {
                console.log("Socket disconnected");
                setIsConnected(false);
            });

            newSocket.on("connect_error", (error) => {
                console.error("Socket connection error:", error);
                setIsConnected(false);
            });
        });

        // Cleanup function
        return () => {
            if (socketRef.current) {
                console.log("Cleaning up socket connection");
                socketRef.current.removeAllListeners();
                socketRef.current.disconnect();
                socketRef.current = null;
                setSocket(null);
                setIsConnected(false);
            }
        };
    }, [isAuthenticated]);

    return (
        <SocketContext.Provider
            value={{
                socket,
                isConnected,
            }}
        >
            {children}
        </SocketContext.Provider>
    );
}

export function useSocket() {
    const context = useContext(SocketContext);
    if (!context) {
        throw new Error("useSocket must be used within SocketProvider");
    }
    return context;
}

