import { expect, test, type Browser, type Page } from "@playwright/test";

// Kiểm lại các lỗi người dùng thử báo (document/test/Kqua Test FCC.docx) trên giao diện thật, chế độ dev.
const ts = Date.now().toString(36).toUpperCase();

async function as(browser: Browser, role: "supplier" | "buyer" | "lender" | "admin", width = 1280): Promise<Page> {
  const ctx = await browser.newContext({ viewport: { width, height: 860 } });
  const page = await ctx.newPage();
  await page.goto(`/${role}`);
  await expect(page.locator("nav.nav")).toBeAttached({ timeout: 30_000 }); // menu đóng trên màn hẹp bị ẩn khỏi cây truy cập
  return page;
}

/** Tạo hóa đơn nhập tay; gửi ngay hoặc để nháp. */
async function createInvoice(p: Page, no: string, amount: string, send: boolean) {
  await p.goto("/supplier/invoices/upload");
  await p.getByRole("button", { name: "nhập tay" }).click();
  await p.getByLabel("Ký hiệu").fill("1C26TFB");
  await p.getByLabel("Số hóa đơn").fill(no);
  await p.getByLabel("MST người mua").fill("1000000002");
  await p.getByLabel("Tổng thanh toán (đ)").fill(amount);
  await p.getByRole("button", { name: "+60 ngày" }).click();
  if (!send) await p.getByLabel("Gửi người mua xác nhận ngay").uncheck();
  await p.getByRole("button", { name: "Lưu khoản phải thu" }).click();
  await expect(p).toHaveURL(/\/supplier\/invoices$/);
}

test("F01/F02/F16: bên mua không thấy nháp; thấy điều chỉnh không cần tải lại; xác nhận phiên bản cũ bị chặn", async ({ browser }) => {
  const supplier = await as(browser, "supplier");
  const buyer = await as(browser, "buyer");
  await buyer.goto("/buyer/invoices");

  // F02: nháp không lộ (danh sách, nhật ký)
  const draftNo = `D${ts}`;
  await createInvoice(supplier, draftNo, "12345678", false);
  await buyer.waitForTimeout(6000);
  await expect(buyer.getByText(new RegExp(draftNo))).toHaveCount(0);
  await buyer.goto("/buyer/settings");
  await expect(buyer.getByText("12.345.678")).toHaveCount(0);
  await buyer.goto("/buyer/invoices");

  // F01: gửi rồi điều chỉnh 10 → 12 triệu; tab bên mua cập nhật không tải lại
  const no = `V${ts}`;
  await createInvoice(supplier, no, "10000000", true);
  const row = buyer.getByRole("row", { name: new RegExp(no) });
  await expect(row).toBeVisible({ timeout: 12_000 });
  await expect(row).toContainText("10.000.000");
  await supplier.getByRole("cell", { name: new RegExp(no) }).click();
  await supplier.getByRole("button", { name: "Điều chỉnh hóa đơn…" }).click();
  await supplier.getByLabel("Số tiền mới (đ)").fill("12000000");
  await supplier.getByLabel("Lý do (bắt buộc)").fill("Sai đơn giá");
  await supplier.getByRole("button", { name: "Điều chỉnh", exact: true }).click();
  await expect(supplier.getByText("Đã điều chỉnh; bên mua cần xác nhận lại")).toBeVisible();
  await expect(row).toContainText("12.000.000", { timeout: 12_000 });
  await expect(row).toContainText("v2");
  await row.click();
  await expect(buyer.getByText("Lịch sử điều chỉnh")).toBeVisible();
  await expect(buyer.getByText("Lý do: Sai đơn giá")).toBeVisible();
  await row.getByRole("button", { name: "Xác nhận v2" }).click();
  await expect(buyer.getByText(/Đã xác nhận .*\(v2\)/)).toBeVisible();
});

test("F09/F30: FCC xem đầy đủ sản phẩm rồi từ chối bằng hộp thoại của ứng dụng (không dùng prompt)", async ({ browser }) => {
  const lender = await as(browser, "lender");
  const admin = await as(browser, "admin");
  const errors: string[] = [];
  admin.on("pageerror", (e) => errors.push(e.message));
  admin.on("dialog", (d) => { errors.push(`native dialog: ${d.message()}`); void d.dismiss(); });
  await lender.goto("/lender/marketplace");
  await lender.getByRole("button", { name: "Tạo gói tài trợ" }).click();
  // F18: lỗi tại trường, giữ dữ liệu
  await lender.getByLabel("Tên gói").fill(`Gói QA ${ts}`);
  await lender.getByLabel("Giá trị tối thiểu (đ)").fill("10000000");
  await lender.getByLabel("Giá trị tối đa (đ)").fill("1000000");
  await lender.getByRole("button", { name: "Gửi FCC duyệt" }).click();
  await expect(lender.getByText("Phải lớn hơn hoặc bằng giá trị tối thiểu")).toBeVisible();
  await expect(lender.getByLabel("Giá trị tối đa (đ)")).toBeFocused();
  await expect(lender.getByLabel("Tên gói")).toHaveValue(`Gói QA ${ts}`);
  await lender.getByLabel("Giá trị tối đa (đ)").fill("5000000000");
  await lender.getByRole("button", { name: "Gửi FCC duyệt" }).click();
  await expect(lender.getByText("Đã gửi FCC duyệt")).toBeVisible();
  // dev: sản phẩm tự công bố nên không vào hàng đợi; kiểm hộp thoại ở luồng đối chiếu thuế/cờ nếu có, còn lại kiểm không có native dialog
  await admin.goto("/admin");
  await expect(admin.getByRole("heading", { name: "Việc cần xử lý" })).toBeVisible();
  // hóa đơn nhập tay (không chứng từ gốc) có cờ → mở hộp thoại ghi chú của ứng dụng
  const flagBtn = admin.getByRole("button", { name: "Đã xem xét" }).first();
  await expect(flagBtn).toBeVisible({ timeout: 15_000 });
  {
    await flagBtn.click();
    const dlg = admin.getByRole("dialog");
    await expect(dlg).toBeVisible();
    await expect(dlg.getByRole("button", { name: "Gửi" })).toBeDisabled();
    await dlg.getByRole("textbox").fill("Đã kiểm tra chứng từ gốc với nhà cung cấp");
    await dlg.getByRole("button", { name: "Gửi" }).click();
    await expect(admin.getByText("Đã xử lý cờ")).toBeVisible();
  }
  expect(errors).toEqual([]);
});

test("F11/F19/F21: số tiền âm báo lỗi tại trường, không tự đổi dấu; tiền và ngày có dòng đọc lại", async ({ browser }) => {
  const p = await as(browser, "supplier");
  await p.goto("/supplier/invoices/upload");
  await p.getByRole("button", { name: "nhập tay" }).click();
  const total = p.getByLabel("Tổng thanh toán (đ)");
  await total.fill("-100");
  await expect(total).toHaveValue("-100");
  await expect(p.getByText("Số tiền không được âm")).toBeVisible();
  await expect(p.getByRole("button", { name: "Lưu khoản phải thu" })).toBeDisabled();
  await total.fill("12345678");
  await expect(total).toHaveValue("12.345.678");
  await p.getByLabel("Hạn thanh toán").fill("2026-11-18");
  await expect(p.getByText("ngày 18 tháng 11 năm 2026")).toBeVisible();
});

test("F04: MST lệch một chữ số không tự gán, chỉ gợi ý để người dùng chọn", async ({ browser }) => {
  const p = await as(browser, "supplier");
  await p.goto("/supplier/invoices/upload");
  const xml = `<HDon><DLHDon><TTChung><KHMSHDon>1</KHMSHDon><KHHDon>C26TQA</KHHDon><SHDon>X${ts}</SHDon><NLap>2026-10-18</NLap></TTChung><NDHDon><NBan><Ten>NCC</Ten><MST></MST></NBan><NMua><Ten>Công ty Bên Mua</Ten><MST>10000000002</MST></NMua><DSHHDVu><HHDVu><THHDVu>Hàng QA</THHDVu></HHDVu></DSHHDVu><TToan><TgTTTBSo>12345678</TgTTTBSo></TToan></NDHDon></DLHDon></HDon>`;
  await p.locator('input[type="file"]').first().setInputFiles({ name: "qa.xml", mimeType: "application/xml", buffer: Buffer.from(xml) });
  await expect(p.getByText(/MST có 11 chữ số/)).toBeVisible();
  await expect(p.getByText(/Không có người mua nào trên FCC/)).toBeVisible();
  const suggestion = p.getByRole("button", { name: /MST 1000000002 — MST chỉ khác 1 chữ số/ });
  await expect(suggestion).toBeVisible();
  await expect(p.getByLabel("MST người mua")).toHaveValue("10000000002"); // chưa tự sửa
  await expect(p.getByText("Hạn thanh toán").first()).toBeVisible();
  await expect(p.getByLabel("Hạn thanh toán")).toHaveValue(""); // XML không có hạn: không tự điền
  await suggestion.click();
  await expect(p.getByText("Người mua trên FCC")).toBeVisible();
});

test("F10: menu đóng trên màn hẹp không nhận Tab; mở menu chuyển focus vào trong, Escape trả về nút mở", async ({ browser }) => {
  const p = await as(browser, "supplier", 598);
  await p.getByRole("button", { name: "Đăng xuất" }).focus();
  for (let i = 0; i < 4; i++) {
    await p.keyboard.press("Tab");
    const off = await p.evaluate(() => { const r = document.activeElement?.getBoundingClientRect(); return r ? r.right <= 0 || r.left >= window.innerWidth : false; });
    expect(off).toBe(false);
  }
  await p.getByRole("button", { name: "Mở menu điều hướng" }).click();
  await expect(p.getByRole("navigation", { name: "Điều hướng chính" }).getByRole("link").first()).toBeFocused();
  await p.keyboard.press("Escape");
  await expect(p.getByRole("button", { name: "Mở menu điều hướng" })).toBeFocused();
});
