"use client";

import { useEffect, useRef } from "react";
import { Toaster, toast, type ExternalToast } from "sonner";

export type ToastSeverity = "success" | "error" | "warning" | "info";

export interface ToastProps {
  open: boolean;
  message: string;
  severity?: ToastSeverity;
  duration?: number;
  onClose: () => void;
}

export function Toast({
  open,
  message,
  severity = "success",
  duration = 3000,
  onClose,
}: ToastProps) {
  const prevOpenRef = useRef(false);

  useEffect(() => {
    // Chỉ hiện toast khi open chuyển từ false -> true
    if (open && !prevOpenRef.current) {
      console.log("Toast open");
      type ToastFn = (msg: string, opts?: ExternalToast) => void;
      const map: Record<ToastSeverity, ToastFn> = {
        success: toast.success,
        error: toast.error,
        warning: toast.warning ?? toast,
        info: toast.info ?? toast,
      };
      const fn: ToastFn = map[severity] || toast;
      fn(message, {
        duration,
        onAutoClose: onClose,
        onDismiss: onClose,
      });
    }
    
    prevOpenRef.current = open;
  }, [open, message, severity, duration, onClose]);

  return (
    <Toaster
      position="top-right"
      richColors
      closeButton
      toastOptions={{
        className: "shadow-lg",
      }}
    />
  );
}