"use client";

import { useEffect } from "react";

/** Đăng ký service worker (chỉ vỏ ứng dụng, không lưu dữ liệu API) khi chạy production. */
export function RegisterSW() {
  useEffect(() => {
    if (process.env.NODE_ENV === "production" && "serviceWorker" in navigator) void navigator.serviceWorker.register("/sw.js").catch(() => undefined);
  }, []);
  return null;
}
