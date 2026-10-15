import Link from "next/link";
import { Download, FileInput } from "lucide-react";
import { PageHeader } from "@/components/ui/basic";
import { Term } from "@/components/ui/Term";
import { ToastButton } from "@/components/ui/ToastButton";
import { JournalQueue, type Entry } from "./JournalQueue";
import type { Role } from "@/lib/roles";

type Dataset = {
  company: string;
  months: [string, number, number, boolean][];
  ccc: { total: number; dso: number; dio: number; dpo: number; note: string };
  aging: [string, string[], number][];
  bctc: [string, string][];
  entries: Entry[];
};

const SUPPLIER: Dataset = {
  company: "Vật liệu Sao Mai",
  months: [
    ["T6", 4.6, 4.1, false],
    ["T7", 4.9, 4.7, false],
    ["T8", 4.2, 4.5, false],
    ["T9", 5.3, 4.8, false],
    ["T10", 4.4, 4.9, false],
    ["T11", 5.8, 4.6, true],
    ["T12", 5.1, 4.7, true],
  ],
  ccc: { total: 67, dso: 64, dio: 41, dpo: 38, note: "Tài trợ hóa đơn có thể rút DSO thực tế xuống còn khoảng 2 ngày cho các hóa đơn được tài trợ." },
  aging: [
    ["Phải thu", ["6.525.000.000", "315.000.000", "0", "0", "0", "6.840.000.000"], 1],
    ["Phải trả", ["2.580.000.000", "540.000.000", "0", "0", "0", "3.120.000.000"], -1],
  ],
  bctc: [
    ["Doanh thu thuần", "41,2 tỷ"],
    ["Biên lợi nhuận gộp", "18,0%"],
    ["ROE · ROA (năm hóa)", "18% · 7,2%"],
    ["Nợ phải trả / VCSH", "1,8"],
    ["DSCR", "1,55"],
  ],
  entries: [
    { id: "HD-0418", desc: "Doanh thu bán thép – Đông Á", acct: "131 / 511, 3331", amount: "2.000.000.000", conf: 99 },
    { id: "PN-7712", desc: "Nhập kho thép cuộn – NCC Phú Mỹ", acct: "152, 1331 / 331", amount: "1.364.000.000", conf: 97 },
    { id: "scan_0921", desc: "Chi phí vận chuyển – Hưng Phát", acct: "6417, 1331 / 331", amount: "38.500.000", conf: 81 },
  ],
};

const BUYER: Dataset = {
  company: "Xây dựng Đông Á",
  months: [
    ["T6", 11.2, 10.4, false],
    ["T7", 12.6, 11.9, false],
    ["T8", 10.8, 11.5, false],
    ["T9", 13.1, 12.2, false],
    ["T10", 12.0, 12.8, false],
    ["T11", 14.2, 12.1, true],
    ["T12", 13.4, 12.6, true],
  ],
  ccc: { total: 31, dso: 52, dio: 18, dpo: 39, note: "Trả sớm có chiết khấu khi lợi suất > 4,5%/năm giúp giảm giá vốn mà không ảnh hưởng nhiều tới DPO." },
  aging: [
    ["Phải thu", ["18.400.000.000", "2.100.000.000", "640.000.000", "0", "0", "21.140.000.000"], 1],
    ["Phải trả", ["10.260.000.000", "2.140.000.000", "0", "0", "0", "12.400.000.000"], -1],
  ],
  bctc: [
    ["Doanh thu thuần", "168,5 tỷ"],
    ["Biên lợi nhuận gộp", "12,4%"],
    ["ROE · ROA (năm hóa)", "14% · 5,1%"],
    ["Nợ phải trả / VCSH", "2,2"],
    ["DSCR", "1,72"],
  ],
  entries: [
    { id: "HD-0421", desc: "Mua thép & vật liệu – Sao Mai", acct: "152, 1331 / 331", amount: "1.120.000.000", conf: 99 },
    { id: "HD-2209", desc: "Thiết bị điện – Nam Việt", acct: "211, 1332 / 331", amount: "860.000.000", conf: 98 },
    { id: "HD-0631", desc: "Vận chuyển công trình – Hưng Phát", acct: "627, 1331 / 331", amount: "145.000.000", conf: 84 },
  ],
};

export function Accounting({ role }: { role: Role }) {
  const d = role === "buyer" ? BUYER : SUPPLIER;
  const lender = role === "lender";
  const max = Math.max(...d.months.flatMap((m) => [m[1], m[2]])) * 1.1;

  return (
    <>
      <PageHeader
        eyebrow={lender ? "Kế toán · dữ liệu được chia sẻ" : "Kế toán"}
        title={lender ? `Vốn lưu động · ${d.company}` : "Vốn lưu động, dòng tiền & chứng từ"}
        sub={
          lender
            ? "Bạn đang xem dữ liệu kế toán doanh nghiệp đã đồng ý chia sẻ cho hồ sơ TT-0418 (chỉ đọc, đến 13/01/2027). Dùng để thẩm định vốn lưu động và rủi ro tín dụng."
            : "Kết nối chỉ đọc với phần mềm kế toán và hóa đơn điện tử. Bút toán được tạo tự động từ OCR/AI và chờ kế toán duyệt."
        }
        actions={
          lender ? (
            <span className="chip c-info lg">Chỉ đọc · có ghi Audit Trail</span>
          ) : (
            <>
              <ToastButton message="Đã xuất BCTC 9 tháng 2026 (bản mock).">
                <Download size={16} aria-hidden="true" />
                Xuất BCTC
              </ToastButton>
              {role === "supplier" && (
                <Link className="btn bp" href="/supplier/invoices/upload">
                  <FileInput size={16} aria-hidden="true" />
                  Nhập chứng từ
                </Link>
              )}
            </>
          )
        }
      />

      <section style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(min(260px, 100%), 1fr))", gap: 16 }}>
        <div className="card stack-sm" style={{ gap: 8 }}>
          <div className="between">
            <span className="ct">Hóa đơn số</span>
            <span className="chip c-ok">Đồng bộ 23:40</span>
          </div>
          <span className="kv num">{role === "buyer" ? "3.902" : "1.248"}</span>
          <span className="muted">chứng từ lưu trữ · 100% có chữ ký số · tra cứu theo MST, mã, ngày</span>
        </div>
        <div className="card stack-sm" style={{ gap: 8 }}>
          <div className="between">
            <span className="ct">
              Tự động nhập liệu <Term k="ocr" />
            </span>
            <span className="chip c-info">Tháng 10</span>
          </div>
          <span className="kv num">
            {role === "buyer" ? "684" : "312"}{" "}
            <span className="muted" style={{ fontSize: 14, fontWeight: 500, fontFamily: "var(--font-sans)" }}>
              chứng từ
            </span>
          </span>
          <span className="muted">Chính xác 96,8% · 11 chứng từ cần duyệt tay</span>
        </div>
        <div className="card stack-sm" style={{ gap: 8 }}>
          <div className="between">
            <span className="ct">Dự báo dòng tiền</span>
            {role === "supplier" && (
              <Link href="/supplier" className="strong" style={{ fontSize: 13 }}>
                Chi tiết
              </Link>
            )}
          </div>
          <span className="kv num">±6%</span>
          <span className="muted">sai số dự báo 30 ngày, trung bình 3 tháng gần nhất</span>
        </div>
      </section>

      <section className="row">
        <div className="card grow-2">
          <div className="ch">
            <div>
              <h2 className="ct">Thu – chi theo tháng</h2>
              <p className="muted">Tỷ đồng · tháng 11–12 là dự báo (sọc)</p>
            </div>
            <div className="legend muted" style={{ marginTop: 0 }}>
              <span>
                <span className="swatch" style={{ background: "var(--info-strong)" }} />
                Tiền thu
              </span>
              <span>
                <span className="swatch" style={{ background: "var(--warn-strong)" }} />
                Tiền chi
              </span>
            </div>
          </div>
          <div
            style={{ display: "flex", gap: 18, alignItems: "flex-end", height: 220, borderBottom: "1px solid var(--line-strong)", padding: "0 8px" }}
            role="img"
            aria-label={`Thu chi theo tháng: ${d.months.map((m) => `${m[0]} thu ${m[1]} chi ${m[2]} tỷ`).join("; ")}`}
          >
            {d.months.map(([m, inn, out, fc]) => (
              <div key={m} style={{ flex: "1 1 0", display: "flex", gap: 3, alignItems: "flex-end", justifyContent: "center", height: "100%", minWidth: 0 }}>
                {(
                  [
                    [inn, "var(--info-strong)", "thu"],
                    [out, "var(--warn-strong)", "chi"],
                  ] as const
                ).map(([v, c, k]) => (
                  <span
                    key={k}
                    title={`${m} · ${k} ${v.toLocaleString("vi-VN")} tỷ`}
                    style={{
                      width: "40%",
                      maxWidth: 26,
                      borderRadius: "4px 4px 0 0",
                      height: Math.round((v / max) * 200),
                      ...(fc
                        ? { background: `repeating-linear-gradient(135deg, ${c} 0 3px, #FFFFFF 3px 6px)`, border: `1.5px solid ${c}` }
                        : { background: c }),
                    }}
                  />
                ))}
              </div>
            ))}
          </div>
          <div style={{ display: "flex", gap: 18, marginTop: 6, padding: "0 8px" }}>
            {d.months.map(([m, , , fc]) => (
              <span key={m} className="num" style={{ flex: "1 1 0", textAlign: "center", fontSize: 11, minWidth: 0, color: fc ? "var(--warn)" : "var(--ink-3)" }}>
                {m}
                {fc ? " (dự báo)" : ""}
              </span>
            ))}
          </div>
        </div>
        <div className="card grow-1 stack-sm">
          <h2 className="ct">
            <Term k="ccc" />
          </h2>
          <div style={{ display: "flex", alignItems: "baseline", gap: 8 }}>
            <span className="num" style={{ fontSize: 40, fontWeight: 600, lineHeight: 1 }}>
              {d.ccc.total}
            </span>
            <span className="muted">ngày</span>
          </div>
          <div className="line-item">
            <span>
              <Term k="dso" /> · số ngày thu tiền
            </span>
            <span className="num">{d.ccc.dso}</span>
          </div>
          <div className="line-item">
            <span>
              <Term k="dio" /> · số ngày tồn kho
            </span>
            <span className="num">{d.ccc.dio}</span>
          </div>
          <div className="line-item">
            <span>
              <Term k="dpo" /> · số ngày trả tiền
            </span>
            <span className="num">{d.ccc.dpo}</span>
          </div>
          <p className="muted divider">{d.ccc.note}</p>
        </div>
      </section>

      <section className="row top">
        <div className="card flush grow-2">
          <div className="ch">
            <h2 className="ct">Tuổi nợ phải thu & phải trả</h2>
            <span className="muted">Đồng</span>
          </div>
          <div className="tw">
            <table>
              <thead>
                <tr>
                  <th>
                    <span className="sr-only">Loại</span>
                  </th>
                  <th className="r">Chưa đến hạn</th>
                  <th className="r">1–30 ngày</th>
                  <th className="r">31–60</th>
                  <th className="r">61–90</th>
                  <th className="r">&gt; 90</th>
                  <th className="r">Tổng</th>
                </tr>
              </thead>
              <tbody>
                {d.aging.map(([label, vals, sign]) => (
                  <tr key={label}>
                    <td className="strong">{label}</td>
                    {vals.map((v, i) => (
                      <td
                        key={i}
                        className={`r num${i === 5 ? " strong" : ""}${sign > 0 && i > 0 && i < 5 && v !== "0" ? " t-bad strong" : ""}`}
                      >
                        {v}
                      </td>
                    ))}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <JournalQueue entries={d.entries} pending={11} readOnly={lender} />
        </div>

        <aside className="card grow-1 stack-sm" style={{ gap: 12 }}>
          <h2 className="ct">Báo cáo tài chính · 9 tháng 2026</h2>
          {d.bctc.map(([k, v]) => (
            <div key={k} className="line-item">
              <span>{k === "DSCR" ? <Term k="dscr" /> : k}</span>
              <span className="num">{v}</span>
            </div>
          ))}
          <span className="muted strong divider">Nguồn dữ liệu</span>
          <div className="between" style={{ fontSize: 13 }}>
            <span>Hóa đơn điện tử</span>
            <span className="chip c-ok">Đã kết nối</span>
          </div>
          <div className="between" style={{ fontSize: 13 }}>
            <span>2 tài khoản ngân hàng</span>
            <span className="chip c-ok">Đã kết nối</span>
          </div>
          <div className="between" style={{ fontSize: 13 }}>
            <span>ERP / phần mềm kế toán</span>
            {lender ? (
              <span className="chip c-neu">Không chia sẻ</span>
            ) : (
              <Link className="chip c-neu" href={`/${role}/settings`}>
                Sẵn sàng kết nối
              </Link>
            )}
          </div>
          <p className="muted">FCC chỉ đọc dữ liệu kế toán, không ghi ngược vào phần mềm của doanh nghiệp.</p>
        </aside>
      </section>
    </>
  );
}
