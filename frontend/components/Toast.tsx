"use client";

import { useEffect } from "react";
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
  useEffect(() => {
    if (!open) return;
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