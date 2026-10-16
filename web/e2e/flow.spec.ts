import { expect, test, type Browser, type Page } from "@playwright/test";

// Trọn luồng tài trợ chỉ bằng giao diện web/: bốn vai trò, mỗi vai trò một ngữ cảnh trình duyệt (một phiên riêng).
// Chế độ dev: mỗi vai trò tự vào phiên; sản phẩm tự công bố; không MFA.
const ts = Date.now().toString(36);
const INVOICE_NO = `E2E${ts}`.toUpperCase();

async function as(browser: Browser, role: "supplier" | "buyer" | "lender" | "admin"): Promise<Page> {
  const ctx = await browser.newContext();
  const page = await ctx.newPage();
  await page.goto(`/${role}`);
  await expect(page.getByRole("link", { name: "Tổng quan" }).first()).toBeVisible({ timeout: 30_000 });
  return page;
}

test("hóa đơn → xác nhận → RFQ → báo giá → thẩm định → đề nghị → chấp thuận → giải ngân (webhook giả lập qua nút)", async ({ browser }) => {
  const errors: string[] = [];
  const supplier = await as(browser, "supplier");
  const buyer = await as(browser, "buyer");
  const lender = await as(browser, "lender");
  for (const p of [supplier, buyer, lender]) p.on("pageerror", (e) => errors.push(e.message));

  // Doanh nghiệp khai hồ sơ cơ bản để có điểm tham khảo
  await supplier.goto("/supplier/settings");
  await supplier.getByLabel("Năm thành lập").fill("2015");
  await supplier.getByLabel("Số lao động").fill(String(30 + (Date.now() % 50))); // đổi mỗi lần chạy để nút Lưu luôn bật
  await supplier.getByRole("button", { name: "Lưu hồ sơ" }).click();
  await expect(supplier.getByText("Đã cập nhật hồ sơ")).toBeVisible();

  // Tổ chức tài chính đăng sản phẩm (dev: tự công bố)
  await lender.goto("/lender/marketplace");
  await lender.getByRole("button", { name: "Tạo gói tài trợ" }).click();
  await lender.getByLabel("Tên gói").fill(`Gói e2e ${ts}`);
  await lender.getByRole("button", { name: "Gửi FCC duyệt" }).click();
  await expect(lender.getByText("Đã gửi FCC duyệt")).toBeVisible();
  await expect(lender.getByText("Đang công bố").first()).toBeVisible();

  // Nhà cung cấp tạo hóa đơn nhập tay cho bên mua (MST dev của bên mua: 1000000002) và gửi xác nhận
  await supplier.goto("/supplier/invoices/upload");
  await supplier.getByRole("button", { name: "nhập tay" }).click();
  await supplier.getByLabel("Ký hiệu").fill("1C26TE2E");
  await supplier.getByLabel("Số hóa đơn").fill(INVOICE_NO);
  await supplier.getByLabel("MST người mua").fill("1000000002");
  await supplier.getByLabel("Tổng thanh toán (đ)").fill("900000000");
  const due = new Date(Date.now() + 60 * 86_400_000).toISOString().slice(0, 10);
  await supplier.getByLabel("Hạn thanh toán").fill(due);
  await expect(supplier.getByText("Người mua trên FCC")).toBeVisible();
  await supplier.getByRole("button", { name: "Lưu khoản phải thu" }).click();
  await expect(supplier).toHaveURL(/\/supplier\/invoices$/);
  await expect(supplier.getByRole("cell", { name: new RegExp(INVOICE_NO) })).toBeVisible();

  // Bên mua xác nhận
  await buyer.goto("/buyer/invoices");
  await expect(buyer.getByRole("row", { name: new RegExp(INVOICE_NO) }).first()).toBeVisible({ timeout: 15_000 });
  await buyer.getByRole("button", { name: "Xác nhận", exact: true }).first().click();
  await expect(buyer.getByText(/Đã xác nhận/).first()).toBeVisible();

  // Nhà cung cấp so sánh gói, gửi RFQ
  await supplier.goto("/supplier/marketplace");
  await expect(supplier.getByText(`Gói e2e ${ts}`)).toBeVisible({ timeout: 15_000 });
  await supplier.getByLabel(`Chọn Gói e2e ${ts}`).check();
  await supplier.getByRole("button", { name: /Gửi yêu cầu báo giá/ }).click();
  await expect(supplier.getByText("Đã gửi yêu cầu báo giá")).toBeVisible();

  // Tổ chức tài chính báo giá — cập nhật tức thời (SSE), không tải lại trang
  await lender.goto("/lender/appraisal");
  await expect(lender.getByText("RFQ chờ báo giá")).toBeVisible({ timeout: 15_000 });
  await lender.getByRole("button", { name: "Gửi báo giá" }).first().click();
  await expect(lender.getByText("Đã gửi báo giá")).toBeVisible();

  // Nhà cung cấp thấy báo giá ngay (SSE) và chọn
  await supplier.goto("/supplier/marketplace");
  await expect(supplier.getByRole("button", { name: /Chọn & gửi hồ sơ/ })).toBeVisible({ timeout: 15_000 });
  await supplier.getByRole("button", { name: /Chọn & gửi hồ sơ/ }).click();
  await expect(supplier.getByText("Đã chọn báo giá và gửi hồ sơ")).toBeVisible();

  // Tổ chức tài chính thẩm định, ra đề nghị
  await lender.goto("/lender/appraisal");
  await lender.getByRole("button", { name: "Bắt đầu thẩm định" }).click();
  await expect(lender.getByText("Đã bắt đầu thẩm định")).toBeVisible();
  await lender.getByRole("button", { name: "Gửi đề nghị tài trợ" }).click();
  await expect(lender.getByText("Đã gửi đề nghị tài trợ chính thức")).toBeVisible();

  // Doanh nghiệp chấp thuận
  await supplier.goto("/supplier/disbursement");
  await supplier.getByRole("button", { name: /Chấp thuận đề nghị/ }).click();
  await expect(supplier.getByText("Đã chấp thuận đề nghị")).toBeVisible();

  // Tổ chức tài chính ghi nhận giải ngân
  await lender.goto("/lender/appraisal");
  await lender.getByRole("button", { name: "Ghi nhận giải ngân" }).click();
  await expect(lender.getByText("Đã ghi nhận giải ngân")).toBeVisible();

  // Bên mua ghi nhận thanh toán → tất toán
  await buyer.goto("/buyer/invoices");
  await buyer.getByRole("button", { name: "Ghi nhận đã thanh toán" }).first().click();
  await expect(buyer.getByText(/Đã ghi nhận thanh toán/)).toBeVisible();
  await supplier.goto("/supplier/disbursement");
  await expect(supplier.getByText("Đã tất toán").first()).toBeVisible({ timeout: 15_000 });

  expect(errors).toEqual([]);
});

test("trang chưa đăng nhập ở chế độ production chặn truy cập; /login hiển thị biểu mẫu", async ({ page }) => {
  await page.goto("/login");
  // ở dev, trang /login vẫn hiện biểu mẫu đăng nhập thủ công (không tự vào phiên)
  await expect(page.getByRole("tab", { name: "Đăng nhập" })).toBeVisible({ timeout: 15_000 });
  await expect(page.getByRole("tab", { name: "Đăng ký tổ chức" })).toBeVisible();
});
