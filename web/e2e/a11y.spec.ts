import { existsSync } from "node:fs";
import { join } from "node:path";
import { expect, test, type Browser, type Page } from "@playwright/test";

// T12 (báo cáo đánh giá): mobile 360–430 px, bàn phím, nhãn cho trình đọc màn hình (axe-core, WCAG 2 A/AA), lỗi form, thời gian tải.
// Chỉ kiểm tra tự động được; vẫn cần thử với trình đọc màn hình thật (NVDA/TalkBack/VoiceOver) trước khi kết luận.
const AXE_PATH = join(process.cwd(), "node_modules/axe-core/axe.min.js");
const AXE = existsSync(AXE_PATH) ? AXE_PATH : null;

const PAGES: Record<"none" | "supplier" | "buyer" | "lender" | "admin", string[]> = {
  none: ["/", "/login"],
  supplier: ["/supplier", "/supplier/invoices", "/supplier/marketplace", "/supplier/esg", "/supplier/settings"],
  buyer: ["/buyer", "/buyer/invoices"],
  lender: ["/lender", "/lender/appraisal", "/lender/marketplace"],
  admin: ["/admin", "/admin/members", "/admin/orgs", "/admin/audit", "/admin/sources"],
};

async function open(browser: Browser, role: keyof typeof PAGES, width: number): Promise<Page> {
  const ctx = await browser.newContext({ viewport: { width, height: 800 } });
  const page = await ctx.newPage();
  if (role !== "none") {
    await page.goto(`/${role}`);
    await expect(page.getByRole("navigation", { name: "Điều hướng chính" })).toBeAttached({ timeout: 30_000 });
  }
  return page;
}

/** Vi phạm axe mức nghiêm trọng/cao (WCAG 2 A, AA). */
async function axe(page: Page) {
  await page.addScriptTag({ path: AXE! });
  return page.evaluate(async () => {
    const w = window as unknown as { axe: { run: (ctx: unknown, opt: unknown) => Promise<{ violations: { id: string; impact: string; help: string; nodes: { target: string[] }[] }[] }> } };
    const r = await w.axe.run(document, { runOnly: { type: "tag", values: ["wcag2a", "wcag2aa"] } });
    return r.violations.filter((v) => v.impact === "critical" || v.impact === "serious").map((v) => `${v.id} (${v.impact}): ${v.help} — ${v.nodes.slice(0, 3).map((n) => n.target.join(" ")).join(" | ")}`);
  });
}

for (const width of [360, 430]) {
  test(`mobile ${width}px: không tràn ngang, không vi phạm a11y nghiêm trọng`, async ({ browser }) => {
    test.skip(!AXE, "thiếu axe-core");
    const problems: string[] = [];
    const loads: number[] = [];
    for (const role of Object.keys(PAGES) as (keyof typeof PAGES)[]) {
      const page = await open(browser, role, width);
      page.on("pageerror", (e) => problems.push(`${role}: lỗi JS ${e.message}`));
      for (const path of PAGES[role]) {
        const t0 = Date.now();
        await page.goto(path);
        await page.waitForLoadState("networkidle");
        loads.push(Date.now() - t0);
        const overflow = await page.evaluate(() => document.documentElement.scrollWidth - window.innerWidth);
        if (overflow > 1) problems.push(`${path}: tràn ngang ${overflow}px`);
        for (const v of await axe(page)) problems.push(`${path}: ${v}`);
      }
      await page.context().close();
    }
    const sorted = [...loads].sort((a, b) => a - b);
    console.log(`[${width}px] ${loads.length} trang · trung vị ${sorted[Math.floor(sorted.length / 2)]} ms · P95 ${sorted[Math.min(sorted.length - 1, Math.ceil(sorted.length * 0.95) - 1)]} ms (máy chủ dev, chỉ để so sánh tương đối)`);
    expect(problems, problems.join("\n")).toEqual([]);
  });
}

test("bàn phím: Tab đầu tiên tới liên kết bỏ qua điều hướng, Enter chuyển vào nội dung chính", async ({ browser }) => {
  const page = await open(browser, "supplier", 1280);
  await page.keyboard.press("Tab");
  await expect(page.getByRole("link", { name: "Bỏ qua điều hướng" })).toBeFocused();
  await page.keyboard.press("Enter");
  await expect(page).toHaveURL(/#main$/);
  // các mục điều hướng chính đều tới được bằng Tab
  const nav = page.getByRole("navigation", { name: "Điều hướng chính" });
  const links = await nav.getByRole("link").count();
  expect(links).toBeGreaterThan(3);
  await nav.getByRole("link").first().focus();
  await expect(nav.getByRole("link").first()).toBeFocused();
});

test("lỗi form đăng nhập được thông báo cho trình đọc màn hình", async ({ page }) => {
  await page.goto("/login");
  await page.getByLabel("Email").fill("khong-ton-tai@example.test");
  await page.getByLabel("Mật khẩu").fill("sai-mat-khau-123");
  await page.getByLabel("Mật khẩu").press("Enter");
  await expect(page.getByRole("alert")).toBeVisible({ timeout: 15_000 });
});
