"use client";

import { createContext, useContext, useEffect, ReactNode } from "react";
import { useSocket } from "./SocketContext";
import { useAuth } from "@/hooks/useAuth";
import { Alert } from "@/types/alert";
import { toast } from "sonner";
import { useRouter } from "next/navigation";

type AlertNotificationContextType = {
};

const AlertNotificationContext = createContext<AlertNotificationContextType>({});

export function AlertNotificationProvider({ children }: { children: ReactNode }) {
    const { socket, isConnected } = useSocket();
    const { isAuthenticated } = useAuth();
    const router = useRouter();

    // Lắng nghe socket events
    useEffect(() => {
        if (!socket || !isConnected || !isAuthenticated) {
            return;
        }

        const handleNewAlert = (alert: Alert) => {
            console.log("Nhận cảnh báo mới từ socket:", alert);

            // Hiển thị toast notification
            const severityColors = {
                critical: "error",
                warning: "warning",
                info: "info",
            } as const;

            const severityIcons = {
                critical: "🚨",
                warning: "⚠️",
                info: "ℹ️",
            };

            const toastType = severityColors[alert.severity] || "info";
            const icon = severityIcons[alert.severity] || "ℹ️";

            toast[toastType](`${icon} ${alert.title}`, {
                description: alert.message,
                duration: alert.severity === "critical" ? 10000 : 5000,
                action: {
                    label: "Xem chi tiết",
                    onClick: () => {
                        router.push("/alerts");
                    },
                },
            });
        };

        const handleAlertUpdated = (alert: Alert) => {
            console.log("Cảnh báo được cập nhật:", alert);
        };

        socket.on("new_alert", handleNewAlert);
        socket.on("alert_updated", handleAlertUpdated);

        return () => {
            socket.off("new_alert", handleNewAlert);
            socket.off("alert_updated", handleAlertUpdated);
        };
    }, [socket, isConnected, isAuthenticated, router]);

    return (
        <AlertNotificationContext.Provider value={{}}>
            {children}
        </AlertNotificationContext.Provider>
    );
}

