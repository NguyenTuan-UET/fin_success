"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { Download, FileInput, Trash2 } from "lucide-react";
import type { LedgerItem } from "@fcc/domain/types";
import { api } from "@/lib/api";
import { date, daysFromNow, money, vnd } from "@/lib/format";
import { useData } from "@/lib/session";
import { useCashForecast } from "@/lib/cash";
import { CashForecast } from "@/components/charts/CashForecast";
import { Disclaimer, Kpi, PageHeader } from "@/components/ui/basic";
import { Term } from "@/components/ui/Term";
import { useToast } from "@/components/providers/Toast";
import type { Role } from "@/lib/roles";

const TEMPLATE = "loai,doi_tac,mst_doi_tac,so_chung_tu,so_tien,da_thanh_toan,han_thanh_toan\nAR,Công ty ABC,0101234567,HD-001,500000000,0,2026-12-01\nAP,Công ty XYZ,0107654321,PO-045,120000000,20000000,2026-11-15\n";

/** CSV đơn giản (có hỗ trợ dấu ngoặc kép). */
function parseCsv(text: string): string[][] {
  const rows: string[][] = [];
  let row: string[] = [];
  let cur = "";
  let q = false;
  for (let i = 0; i < text.length; i++) {
    const ch = text[i];
    if (q) {
      if (ch === '"' && text[i + 1] === '"') { cur += '"'; i++; } else if (ch === '"') q = false; else cur += ch;
    } else if (ch === '"') q = true;
    else if (ch === "," || ch === ";") { row.push(cur); cur = ""; }
    else if (ch === "\n" || ch === "\r") { if (ch === "\r" && text[i + 1] === "\n") i++; row.push(cur); if (row.some((x) => x.trim())) rows.push(row); row = []; cur = ""; }
    else cur += ch;
  }
  row.push(cur);
  if (row.some((x) => x.trim())) rows.push(row);
  return rows;
}

function download(name: string, content: string) {
  const url = URL.createObjectURL(new Blob(["﻿" + content], { type: "text/csv;charset=utf-8" }));
  const a = document.createElement("a");
  a.href = url;
  a.download = name;
  a.click();
  URL.revokeObjectURL(url);
}

export function Accounting({ role }: { role: Role }) {
  const { data, org, act } = useData();
  const toast = useToast();
  const fileRef = useRef<HTMLInputElement>(null);
  const { forecast, hasSetup, openingCash, bankLinked } = useCashForecast(data, org);
  const conn = data.connections.find((c) => c.orgId === org.id);
  const ledger = data.ledger.filter((l) => l.orgId === org.id);
  const [cash, setCash] = useState(String(conn?.openingCash ?? ""));
  const [outs, setOuts] = useState<{ name: string; amount: string; day: string }[]>((conn?.recurringMonthlyOut ?? []).map((o) => ({ name: o.name, amount: String(o.amount), day: String(o.day) })));
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState("");
  type JEntry = { ref: string; date: string; title: string; confidence: number; note?: string; status: string; lines: { account: string; accountName: string; debit: number; credit: number }[] };
  const [regime, setRegime] = useState<"TT133" | "TT200">("TT133");
  const [journal, setJournal] = useState<JEntry[]>([]);
  const [statement, setStatement] = useState<{ lines: { date: string; description: string; amount: number; balance: number }[]; closing: number; source: string } | null>(null);
  const [acc, setAcc] = useState<{ evaluated: number; meanAbsErrorDays: number | null; within5DaysPct: number | null } | null>(null);
  const loadAcc = useCallback(() => {
    if (role === "lender" || role === "admin") return;
    api<JEntry[] | { entries: JEntry[] }>("GET", `/v1/journal-entries?regime=${regime}`).then((r) => setJournal((r as { entries: JEntry[] }).entries), () => setJournal([]));
    api<typeof statement>("GET", "/v1/bank/statement").then(setStatement, () => setStatement(null));
    api<typeof acc>("GET", "/v1/cashflow-forecasts/accuracy").then(setAcc, () => setAcc(null));
  }, [regime, role]);
  // tải dữ liệu phụ từ máy chủ khi mở màn hình và khi dữ liệu đổi
   
  useEffect(() => { loadAcc(); }, [loadAcc, data.applications.length, data.receivables.length]);

  if (role === "lender" || role === "admin") {
    return <section className="card empty">Kế toán và dòng tiền dành cho doanh nghiệp bán/mua. Tổ chức tài chính xem dữ liệu kế toán của doanh nghiệp khi doanh nghiệp chia sẻ trong hồ sơ.</section>;
  }

  const run = async (f: () => Promise<unknown>, ok: string) => {
    setBusy(true);
    setErr("");
    try { await f(); toast(ok); } catch (e) { setErr((e as Error).message); }
    setBusy(false);
  };

  const importCsv = async (list: FileList | null) => {
    const f = list?.[0];
    if (!f) return;
    await run(async () => {
      const rows = parseCsv(await f.text());
      const [head, ...body] = rows;
      const col = (n: string) => head.findIndex((h) => h.trim().toLowerCase() === n);
      const idx = { kind: col("loai"), name: col("doi_tac"), tax: col("mst_doi_tac"), doc: col("so_chung_tu"), amount: col("so_tien"), paid: col("da_thanh_toan"), due: col("han_thanh_toan") };
      if (Object.values(idx).some((i) => i < 0)) throw new Error("Thiếu cột. Cần: loai, doi_tac, mst_doi_tac, so_chung_tu, so_tien, da_thanh_toan, han_thanh_toan (tải file mẫu).");
      const items: LedgerItem[] = body.map((r, n) => {
        const kind = r[idx.kind].trim().toUpperCase();
        if (kind !== "AR" && kind !== "AP") throw new Error(`Dòng ${n + 2}: loại phải là AR (phải thu) hoặc AP (phải trả)`);
        return { id: "", orgId: org.id, kind, counterpartyName: r[idx.name].trim(), counterpartyTaxCode: r[idx.tax].trim() || undefined, docNo: r[idx.doc].trim(), amount: Number(r[idx.amount].replace(/[.\s]/g, "")), paid: Number((r[idx.paid] || "0").replace(/[.\s]/g, "")), dueDate: r[idx.due].trim() };
      });
      await act("POST", "/v1/accounting-imports", { orgId: org.id, items });
    }, "Đã nhập công nợ (chứng từ trùng số được cập nhật, không nhân đôi)");
    if (fileRef.current) fileRef.current.value = "";
  };

  const ar = ledger.filter((l) => l.kind === "AR");
  const ap = ledger.filter((l) => l.kind === "AP");
  const open = (xs: LedgerItem[]) => xs.reduce((a, l) => a + l.amount - l.paid, 0);
  const bucket = (xs: LedgerItem[]) => {
    const b = [0, 0, 0, 0];
    for (const l of xs) {
      const o = l.amount - l.paid;
      if (o <= 0) continue;
      const late = -daysFromNow(l.dueDate);
      b[late <= 0 ? 0 : late <= 30 ? 1 : late <= 60 ? 2 : 3] += o;
    }
    return b;
  };
  const AGING = ["Chưa đến hạn", "Trễ 1–30 ngày", "Trễ 31–60 ngày", "Trễ trên 60 ngày"];

  return (
    <>
      <PageHeader
        eyebrow={`Kế toán · ${role === "supplier" ? "Nhà cung cấp" : "Người mua"}`}
        title="Công nợ & dòng tiền"
        sub="Số dư tiền và chi định kỳ do bạn khai; công nợ nhập từ file (CSV từ phần mềm kế toán) cộng hóa đơn trên FCC. FCC chỉ đọc dữ liệu, không ghi vào sổ kế toán của bạn."
        actions={<><button className="btn bs" onClick={() => download("mau-cong-no.csv", TEMPLATE)}><Download size={16} aria-hidden="true" /> Tải file mẫu</button>
          <button className="btn bp" onClick={() => fileRef.current?.click()}><FileInput size={16} aria-hidden="true" /> Nhập công nợ CSV</button>
          <input ref={fileRef} type="file" accept=".csv,text/csv" hidden onChange={(e) => void importCsv(e.target.files)} /></>}
      />
      {err && <div className="err" role="alert">{err}</div>}

      <section className="grid-kpi">
        <Kpi label="Tiền mặt (khai báo)" value={hasSetup ? money(openingCash) : "—"} note={hasSetup ? `cập nhật ${date(conn?.lastSyncedAt)}` : "Chưa khai"} />
        <Kpi label="Phải thu (công nợ nhập)" value={money(open(ar))} note={`${ar.length} chứng từ`} />
        <Kpi label="Phải trả (công nợ nhập)" value={money(open(ap))} note={`${ap.length} chứng từ`} />
        <Kpi label={<Term k="ccc">Chu kỳ tiền mặt</Term>} value="—" note="Cần dữ liệu hàng tồn kho và giá vốn để tính DIO/DPO" />
      </section>

      <section className="row top">
        <div className="card grow-2 stack">
          <h2 className="ct">Thiết lập dòng tiền</h2>
          <label className="field"><span>Số dư tiền hiện có (đ)</span><input className="input num" inputMode="numeric" value={cash} onChange={(e) => setCash(e.target.value.replace(/\D/g, ""))} /></label>
          <strong style={{ fontSize: 13 }}>Chi định kỳ hằng tháng</strong>
          {outs.map((o, i) => (
            <div key={i} className="row" style={{ gap: 8 }}>
              <input className="input" placeholder="Tên (lương, thuê, thuế…)" value={o.name} onChange={(e) => setOuts(outs.map((x, k) => (k === i ? { ...x, name: e.target.value } : x)))} />
              <input className="input num" placeholder="Số tiền" inputMode="numeric" value={o.amount} onChange={(e) => setOuts(outs.map((x, k) => (k === i ? { ...x, amount: e.target.value.replace(/\D/g, "") } : x)))} />
              <input className="input num" style={{ maxWidth: 80 }} placeholder="Ngày" inputMode="numeric" value={o.day} onChange={(e) => setOuts(outs.map((x, k) => (k === i ? { ...x, day: e.target.value.replace(/\D/g, "") } : x)))} />
              <button className="ibtn" aria-label="Xóa khoản chi" onClick={() => setOuts(outs.filter((_, k) => k !== i))}><Trash2 size={15} aria-hidden="true" /></button>
            </div>
          ))}
          <div className="row" style={{ gap: 8 }}>
            <button className="btn bs" onClick={() => setOuts([...outs, { name: "", amount: "", day: "5" }])}>Thêm khoản chi</button>
            <button className="btn bp" disabled={busy || !cash} onClick={() => run(() => act("POST", `/v1/organizations/${org.id}/cash-profile`, { openingCash: Number(cash), recurringMonthlyOut: outs.filter((o) => o.name.trim()).map((o) => ({ name: o.name, amount: Number(o.amount), day: Number(o.day) })) }), "Đã lưu thiết lập dòng tiền")}>Lưu</button>
          </div>
        </div>
        <div className="card grow-3">
          {forecast ? <CashForecast forecast={forecast} openingCash={openingCash} safeBalance={0} /> : <div className="empty">Khai số dư tiền để xem dự báo 7/30 ngày.</div>}
        </div>
      </section>

      {forecast && (
        <section className="card stack-sm">
          <h2 className="ct">Khoản lớn nhất trong 90 ngày tới</h2>
          {forecast.drivers.length === 0 && <span className="muted">Chưa có khoản thu/chi nào trong 90 ngày.</span>}
          {forecast.drivers.map((d, i) => <div key={i} className="between soft"><span>{date(d.date)} · {d.label}</span><strong className={`num ${d.amount < 0 ? "t-warn" : "t-ok"}`}>{d.amount < 0 ? "−" : "+"}{vnd(Math.abs(d.amount))} đ</strong></div>)}
          {forecast.shortfall && <div className="err">Thiếu hụt dự báo {money(-forecast.shortfall.value)} đ ngày {date(forecast.shortfall.date)} (kịch bản {forecast.shortfall.scenario === "base" ? "cơ sở" : "thận trọng"}). Xem gói tài trợ ở Marketplace.</div>}
        </section>
      )}

      <section className="card stack">
        <div className="between"><h2 className="ct">Ngân hàng & dự báo đã lưu</h2>
          <span className="row" style={{ gap: 8 }}>
            {!bankLinked && <button className="btn bs sm" disabled={busy || !hasSetup} title={hasSetup ? undefined : "Khai số dư trước"} onClick={() => run(async () => { await act("POST", "/v1/bank/link"); loadAcc(); }, "Đã liên kết tài khoản ngân hàng (giả lập)")}>Liên kết ngân hàng (giả lập)</button>}
            <button className="btn bs sm" disabled={busy || !hasSetup} onClick={() => run(async () => { const r = await api<{ stored: boolean }>("POST", "/v1/cashflow-forecasts", {}); toast(r.stored ? "Đã lưu dự báo hôm nay" : "Dự báo hôm nay đã được lưu với cùng dữ liệu"); loadAcc(); }, "Hoàn tất")}>Lưu dự báo</button>
          </span></div>
        <div className="muted">{bankLinked ? "Số dư lấy từ sao kê của ngân hàng GIẢ LẬP (dựng từ sự kiện tiền trên FCC) cộng chi định kỳ bạn khai." : "Chưa liên kết ngân hàng: số dư là số bạn khai. Phase này chưa kết nối ngân hàng thật."}</div>
        {statement && <div className="tw" tabIndex={0} role="region" aria-label="Bảng dữ liệu, cuộn ngang để xem thêm"><table>
          <thead><tr><th>Ngày</th><th>Nội dung</th><th className="r">Biến động (đ)</th><th className="r">Số dư (đ)</th></tr></thead>
          <tbody>{statement.lines.slice(-12).reverse().map((l, i) => <tr key={i}><td className="num">{date(l.date)}</td><td className="wrap">{l.description}</td><td className={`r num ${l.amount < 0 ? "t-warn" : "t-ok"}`}>{l.amount < 0 ? "−" : "+"}{vnd(Math.abs(l.amount))}</td><td className="r num">{vnd(l.balance)}</td></tr>)}</tbody></table>
          <div className="muted" style={{ padding: "6px 0" }}>Nguồn: {statement.source}</div></div>}
        {acc && <div className="soft">Sai số dự báo thu: {acc.evaluated ? `${acc.evaluated} khoản đã đo · lệch trung bình ${acc.meanAbsErrorDays} ngày · ${acc.within5DaysPct}% trong ±5 ngày` : "chưa có khoản nào đủ điều kiện đo (cần dự báo đã lưu và khoản phải thu đã thanh toán)"}.</div>}
      </section>

      <section className="card flush">
        <div className="ch"><div><h2 className="ct">Bút toán đề xuất</h2><p className="muted">Gợi ý từ sự kiện tiền trên FCC kèm độ tin cậy; kế toán duyệt hoặc từ chối từng bút toán rồi xuất file nhập vào phần mềm kế toán.</p></div>
          <span className="row" style={{ gap: 8 }}>
            <select className="select" value={regime} onChange={(e) => setRegime(e.target.value as "TT133" | "TT200")} aria-label="Chế độ kế toán"><option value="TT133">TT133</option><option value="TT200">TT200</option></select>
            <button className="btn bs sm" disabled={!journal.some((j) => j.status === "approved")} onClick={async () => { const r = await fetch(`/v1/journal-entries/export.csv?regime=${regime}`, { headers: { authorization: `Bearer ${sessionStorage.getItem("fcc-token")}` } }); const t = await r.text(); download("but-toan.csv", t); }}><Download size={14} aria-hidden="true" /> Xuất bút toán đã duyệt</button>
          </span></div>
        {journal.length === 0 && <div className="empty">Chưa có bút toán đề xuất (cần giải ngân, thanh toán hoặc phí phát sinh).</div>}
        {journal.map((j) => (
          <div key={j.ref} className="stack-sm" style={{ padding: "12px 16px", borderTop: "1px solid var(--line-2)" }}>
            <div className="between"><span><strong>{j.title}</strong> · <span className="num">{date(j.date)}</span> <span className="muted">· tin cậy {Math.round(j.confidence * 100)}%</span></span>
              <span className="row" style={{ gap: 6 }}>
                {j.status === "suggested" ? <><button className="btn bp sm" disabled={busy} onClick={() => run(async () => { await api("POST", "/v1/journal-entries/decision", { ref: j.ref, status: "approved", regime }); loadAcc(); }, "Đã duyệt bút toán")}>Duyệt</button>
                  <button className="btn bs sm" disabled={busy} onClick={() => run(async () => { await api("POST", "/v1/journal-entries/decision", { ref: j.ref, status: "rejected", regime }); loadAcc(); }, "Đã từ chối")}>Từ chối</button></> : <span className={`chip ${j.status === "approved" ? "c-ok" : "c-neu"}`}>{j.status === "approved" ? "Đã duyệt" : "Đã từ chối"}</span>}
              </span></div>
            <table style={{ fontSize: 12.5 }}><tbody>{j.lines.map((l, i) => <tr key={i}><td className="num" style={{ width: 60 }}>{l.account}</td><td>{l.accountName}</td><td className="r num">{l.debit ? vnd(l.debit) : ""}</td><td className="r num">{l.credit ? vnd(l.credit) : ""}</td></tr>)}</tbody></table>
            {j.note && <div className="muted" style={{ fontSize: 12.5 }}>{j.note}</div>}
          </div>
        ))}
      </section>

      <section className="row top">
        {[["Phải thu", ar], ["Phải trả", ap]].map(([label, xs]) => {
          const b = bucket(xs as LedgerItem[]);
          const total = b.reduce((a, v) => a + v, 0) || 1;
          return (
            <div key={label as string} className="card grow-1 stack-sm">
              <h2 className="ct">Tuổi nợ — {label as string}</h2>
              {AGING.map((a, i) => <div key={a}><div className="between"><span>{a}</span><span className="num">{money(b[i])} đ</span></div><div className="bar"><span className="fill" style={{ width: `${(b[i] / total) * 100}%`, background: i ? "var(--warn-strong)" : undefined }} /></div></div>)}
            </div>
          );
        })}
      </section>

      <section className="card flush">
        <div className="ch"><h2 className="ct">Sổ công nợ đã nhập</h2>
          <button className="btn bs sm" disabled={!ledger.length} onClick={() => download("cong-no.csv", "loai,doi_tac,mst_doi_tac,so_chung_tu,so_tien,da_thanh_toan,han_thanh_toan\n" + ledger.map((l) => [l.kind, `"${l.counterpartyName}"`, l.counterpartyTaxCode ?? "", l.docNo, l.amount, l.paid, l.dueDate].join(",")).join("\n") + "\n")}><Download size={14} aria-hidden="true" /> Xuất CSV</button></div>
        <div className="tw" tabIndex={0} role="region" aria-label="Bảng dữ liệu, cuộn ngang để xem thêm"><table>
          <thead><tr><th>Loại</th><th>Đối tác</th><th>Chứng từ</th><th className="r">Số tiền (đ)</th><th className="r">Đã thanh toán (đ)</th><th>Hạn</th></tr></thead>
          <tbody>
            {ledger.map((l) => <tr key={l.id}><td><span className={`chip ${l.kind === "AR" ? "c-ok" : "c-warn"}`}>{l.kind === "AR" ? "Phải thu" : "Phải trả"}</span></td><td className="wrap">{l.counterpartyName}</td><td className="num">{l.docNo}</td><td className="r num">{vnd(l.amount)}</td><td className="r num">{vnd(l.paid)}</td><td className="num">{date(l.dueDate)}</td></tr>)}
            {ledger.length === 0 && <tr><td colSpan={6} className="empty">Chưa nhập công nợ. Tải file mẫu, điền từ phần mềm kế toán rồi nhập CSV.</td></tr>}
          </tbody></table></div>
      </section>
      <Disclaimer>Kết nối trực tiếp phần mềm kế toán (MISA, Fast, Bravo, SAP) làm khi có tài khoản đối tác; hiện nhập qua file. Dự báo – không phải cam kết.</Disclaimer>
    </>
  );
}
