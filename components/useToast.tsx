"use client";

import React, { useState, useCallback } from "react";

type ToastType = "success" | "error" | "info";

interface ToastMsg {
  id: number;
  message: string;
  type: ToastType;
}

// Minimal hook – call toast.success() / toast.error() from your component
export function useToast() {
  const [toasts, setToasts] = useState<ToastMsg[]>([]);

  const addToast = useCallback((message: string, type: ToastType) => {
    const id = Date.now();
    setToasts((prev) => [...prev, { id, message, type }]);
    setTimeout(() => setToasts((prev) => prev.filter((t) => t.id !== id)), 4000);
  }, []);

  const toast = {
    success: (msg: string) => addToast(msg, "success"),
    error: (msg: string) => addToast(msg, "error"),
    info: (msg: string) => addToast(msg, "info"),
  };

  return { toast, toasts };
}

// Standalone renderer – place <ToastContainer toasts={toasts} /> in your component
const COLOR: Record<ToastType, string> = {
  success: "bg-green-500",
  error: "bg-red-500",
  info: "bg-indigo-500",
};

export function ToastContainer({ toasts }: { toasts: ToastMsg[] }) {
  return (
    <div className="fixed bottom-6 right-6 z-50 flex flex-col gap-2">
      {toasts.map(({ id, message, type }) => (
        <div
          key={id}
          className={`${COLOR[type]} text-white px-4 py-3 rounded-lg shadow-lg text-sm font-medium animate-fade-in`}
        >
          {message}
        </div>
      ))}
    </div>
  );
}
