"use client";

import type { CSSProperties, ReactNode } from "react";
import { useToast } from "@/components/providers/Toast";

/** Nút cho hành động chưa có backend trong bản mock: hiện thông báo xác nhận. */
export function ToastButton({
  message,
  className = "btn bs",
  style,
  children,
}: {
  message: string;
  className?: string;
  style?: CSSProperties;
  children: ReactNode;
}) {
  const toast = useToast();
  return (
    <button type="button" className={className} style={style} onClick={() => toast(message)}>
      {children}
    </button>
  );
}
