import { defineConfig } from "@playwright/test";

// E2E chạy trên giao diện thật với backend thật (FCC_ENV=dev, CSDL riêng). Dùng Chrome cài sẵn trên máy.
//   server:  cd server && FCC_ENV=dev DATABASE_URL=<csdl-test> npm start
//   web:     cd web && FCC_API_URL=http://127.0.0.1:8787 npm run dev   (hoặc build + start)
//   CSDL phải mới (tạo lại trước mỗi lần chạy): luồng khai hồ sơ cơ bản và hóa đơn giả định tổ chức trống.
//   chạy:    cd web && E2E_BASE_URL=http://localhost:3000 npm run e2e
export default defineConfig({
  testDir: "./e2e",
  timeout: 120_000,
  workers: 1,
  reporter: [["list"]],
  use: { baseURL: process.env.E2E_BASE_URL ?? "http://localhost:3000", channel: "chrome", headless: true, trace: "retain-on-failure" },
});
