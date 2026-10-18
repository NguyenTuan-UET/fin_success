"use client";

import Link from "next/link";
import { useCallback, useEffect, useRef, useState } from "react";
import { Download, FileInput, Plus, Trash2 } from "lucide-react";
import type { LedgerItem } from "@fcc/domain/types";
import { api } from "@/lib/api";
import { date, daysFromNow, money, vnd } from "@/lib/format";
import { useData } from "@/lib/session";
import { useCashForecast } from "@/lib/cash";
import { CashForecast } from "@/components/charts/CashForecast";
import { Disclaimer, Kpi, PageHeader } from "@/components/ui/basic";
import { Term } from "@/components/ui/Term";
import { useToast } from "@/components/providers/Toast";
import { DateInput, MoneyInput } from "@/components/ui/Fields";
import { detectColumns, LEDGER_FIELDS, parseCsv, readRows, type LedgerField } from "@/lib/ledgerImport";
import type { Role } from "@/lib/roles";

const TEMPLATE = "loai,doi_tac,mst_doi_tac,so_chung_tu,so_tien,da_thanh_toan,han_thanh_toan\nAR,Công ty ABC,0101234567,HD-001,500000000,0,2026-12-01\nAP,Công ty XYZ,0107654321,PO-045,120000000,20000000,2026-11-15\n";

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
  const [cash, setCash] = useState<number | null>(conn?.openingCash ?? null);
  const [outs, setOuts] = useState<{ name: string; amount: number | null; day: string }[]>((conn?.recurringMonthlyOut ?? []).map((o) => ({ name: o.name, amount: o.amount, day: String(o.day) })));
  const [imp, setImp] = useState<{ file: string; header: string[]; body: string[][]; map: Record<LedgerField, number>; kind: "AR" | "AP" | "" } | null>(null);
  const [manual, setManual] = useState<{ kind: "AR" | "AP"; name: string; tax: string; doc: string; amount: number | null; paid: number | null; due: string } | null>(null);
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

  if (role === "lender" || role === "admin") return <LenderSharedAccounting />;

  const run = async (f: () => Promise<unknown>, ok: string) => {
    setBusy(true);
    setErr("");
    try { await f(); toast(ok); } catch (e) { setErr((e as Error).message); }
    setBusy(false);
  };

  // chọn tệp → đoán cột → người dùng xem trước, sửa ghép cột nếu cần → nhập
  const pickCsv = async (list: FileList | null) => {
    const f = list?.[0];
    if (fileRef.current) fileRef.current.value = "";
    if (!f) return;
    setErr("");
    const rows = parseCsv(await f.text());
    if (rows.length < 2) return setErr("Tệp không có dòng dữ liệu (cần dòng tiêu đề và ít nhất một dòng).");
    const [header, ...body] = rows;
    setImp({ file: f.name, header, body, map: detectColumns(header), kind: "" });
  };
  const parsed = imp ? readRows(imp.body, imp.map, imp.kind) : null;
  const missing = imp ? LEDGER_FIELDS.filter((f) => f.required && imp.map[f.key] < 0) : [];
  // dòng còn trống hoàn toàn được bỏ qua khi lưu, không báo lỗi
  const blankOut = (o: { name: string; amount: number | null }) => !o.name.trim() && !o.amount;
  const outErr = (o: { name: string; amount: number | null; day: string }) =>
    blankOut(o) ? null : !o.name.trim() ? "Nhập tên khoản chi" : !o.amount ? "Nhập số tiền mỗi tháng" : !/^\d+$/.test(o.day) || Number(o.day) < 1 || Number(o.day) > 28 ? "Ngày trả trong tháng từ 1 đến 28" : null;
  const outsValid = outs.every((o) => !outErr(o));

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
  const countBucket = (xs: LedgerItem[]) => {
    const n = [0, 0, 0, 0];
    for (const l of xs) {
      if (l.amount - l.paid <= 0) continue;
      const late = -daysFromNow(l.dueDate);
      n[late <= 0 ? 0 : late <= 30 ? 1 : late <= 60 ? 2 : 3]++;
    }
    return n;
  };
  const AGING = ["Chưa đến hạn", "Trễ 1–30 ngày", "Trễ 31–60 ngày", "Trễ trên 60 ngày"];
  const AGING_COLOR = ["var(--brand-fill)", "#E4A157", "#C2620A", "var(--bad)"];

  return (
    <>
      <PageHeader
        eyebrow={`Kế toán · ${role === "supplier" ? "Nhà cung cấp" : "Người mua"}`}
        title="Công nợ & dòng tiền"
        sub="Số dư tiền và chi định kỳ do bạn khai; công nợ nhập từ file (CSV từ phần mềm kế toán) cộng hóa đơn trên FCC. FCC chỉ đọc dữ liệu, không ghi vào sổ kế toán của bạn."
        actions={<><button className="btn bs" onClick={() => setManual({ kind: "AR", name: "", tax: "", doc: "", amount: null, paid: 0, due: "" })}><Plus size={16} aria-hidden="true" /> Thêm từng khoản</button>
          <button className="btn bp" onClick={() => fileRef.current?.click()}><FileInput size={16} aria-hidden="true" /> Nhập từ tệp CSV</button>
          <input ref={fileRef} type="file" accept=".csv,text/csv" hidden onChange={(e) => void pickCsv(e.target.files)} /></>}
      />
      {err && <div className="err" role="alert">{err}</div>}

      {imp && parsed && (
        <section className="card stack" aria-label="Nhập công nợ từ tệp">
          <div className="between"><h2 className="ct">Nhập công nợ · {imp.file}</h2><span className="muted">{imp.body.length} dòng</span></div>
          <div className="muted">Không cần đúng file mẫu: FCC tự nhận cột theo tên thường gặp (MISA, Fast, Excel tự lập). Kiểm tra cách ghép cột dưới đây, sửa nếu cần, xem trước rồi bấm Nhập. Ngày dạng dd/mm/yyyy hoặc yyyy-mm-dd; số tiền có dấu chấm/phẩy phân nhóm đều được.</div>
          <div className="grid-fields">
            {LEDGER_FIELDS.map((f) => (
              <label key={f.key} className="field"><span>{f.label}{f.required ? " *" : ""}</span>
                <select className={`select${f.required && imp.map[f.key] < 0 ? " invalid" : ""}`} value={imp.map[f.key]} onChange={(e) => setImp({ ...imp, map: { ...imp.map, [f.key]: Number(e.target.value) } })}>
                  <option value={-1}>{f.required ? "— Chọn cột —" : "Không có trong tệp"}</option>
                  {imp.header.map((h, i) => <option key={i} value={i}>{h || `Cột ${i + 1}`}</option>)}
                </select>
              </label>
            ))}
            <label className="field"><span>Khi tệp không ghi loại, các dòng là</span>
              <select className="select" value={imp.kind} onChange={(e) => setImp({ ...imp, kind: e.target.value as "AR" | "AP" | "" })}><option value="">— Theo cột Loại —</option><option value="AR">Phải thu (khách hàng nợ bạn)</option><option value="AP">Phải trả (bạn nợ nhà cung cấp)</option></select>
            </label>
          </div>
          {missing.length > 0 && <div className="err">Chưa ghép cột: {missing.map((f) => f.label).join(", ")}.</div>}
          {missing.length === 0 && (
            <>
              <div className="tw" tabIndex={0} role="region" aria-label="Xem trước công nợ"><table>
                <thead><tr><th>Loại</th><th>Đối tác</th><th>Chứng từ</th><th className="r">Số tiền (đ)</th><th className="r">Đã thanh toán (đ)</th><th>Hạn</th></tr></thead>
                <tbody>{parsed.items.slice(0, 5).map((l, i) => <tr key={i}><td>{l.kind === "AR" ? "Phải thu" : "Phải trả"}</td><td className="wrap">{l.counterpartyName}</td><td className="num">{l.docNo}</td><td className="r num">{vnd(l.amount)}</td><td className="r num">{vnd(l.paid)}</td><td className="num">{date(l.dueDate)}</td></tr>)}</tbody>
              </table></div>
              {parsed.errors.length > 0 && <div className="err">{parsed.errors.length} dòng chưa đọc được (sẽ bỏ qua):<ul style={{ margin: "4px 0 0", paddingLeft: 18 }}>{parsed.errors.slice(0, 5).map((e) => <li key={e}>{e}</li>)}</ul>{parsed.errors.length > 5 ? `…và ${parsed.errors.length - 5} dòng khác` : ""}</div>}
            </>
          )}
          <div className="row" style={{ gap: 8, justifyContent: "flex-end", flexWrap: "wrap" }}>
            <button className="btn bs" onClick={() => download("mau-cong-no.csv", TEMPLATE)}><Download size={14} aria-hidden="true" /> Tải file mẫu (tham khảo)</button>
            <button className="btn bs" onClick={() => setImp(null)}>Hủy</button>
            <button className="btn bp" disabled={busy || missing.length > 0 || !parsed.items.length} onClick={() => run(async () => { await act("POST", "/v1/accounting-imports", { orgId: org.id, items: parsed.items.map((x) => ({ ...x, id: "", orgId: org.id })) }); setImp(null); }, `Đã nhập ${parsed.items.length} khoản công nợ (chứng từ trùng số được cập nhật, không nhân đôi)`)}>Nhập {parsed.items.length} dòng</button>
          </div>
        </section>
      )}

      {manual && (
        <section className="card stack" aria-label="Thêm khoản công nợ">
          <h2 className="ct">Thêm khoản công nợ</h2>
          <div className="grid-fields">
            <label className="field"><span>Loại</span><select className="select" value={manual.kind} onChange={(e) => setManual({ ...manual, kind: e.target.value as "AR" | "AP" })}><option value="AR">Phải thu (khách hàng nợ bạn)</option><option value="AP">Phải trả (bạn nợ nhà cung cấp)</option></select></label>
            <label className="field"><span>Đối tác</span><input className="input" value={manual.name} onChange={(e) => setManual({ ...manual, name: e.target.value })} /></label>
            <label className="field"><span>MST đối tác (nếu có)</span><input className="input num" value={manual.tax} onChange={(e) => setManual({ ...manual, tax: e.target.value })} /></label>
            <label className="field"><span>Số chứng từ</span><input className="input num" value={manual.doc} onChange={(e) => setManual({ ...manual, doc: e.target.value })} /></label>
            <MoneyInput label="Số tiền (đ)" value={manual.amount} onChange={(v) => setManual({ ...manual, amount: v })} />
            <MoneyInput label="Đã thanh toán (đ)" value={manual.paid} min={0} onChange={(v) => setManual({ ...manual, paid: v })} />
            <DateInput label="Hạn thanh toán" value={manual.due} onChange={(v) => setManual({ ...manual, due: v })} />
          </div>
          <div className="row" style={{ gap: 8, justifyContent: "flex-end" }}>
            <button className="btn bs" onClick={() => setManual(null)}>Hủy</button>
            <button className="btn bp" disabled={busy || !manual.name.trim() || !manual.doc.trim() || !manual.amount || !manual.due} onClick={() => run(async () => { await act("POST", "/v1/accounting-imports", { orgId: org.id, items: [{ id: "", orgId: org.id, kind: manual.kind, counterpartyName: manual.name.trim(), counterpartyTaxCode: manual.tax.trim() || undefined, docNo: manual.doc.trim(), amount: manual.amount, paid: manual.paid ?? 0, dueDate: manual.due }] }); setManual(null); }, "Đã thêm khoản công nợ")}>Thêm</button>
          </div>
        </section>
      )}


      <section className="grid-kpi">
        <Kpi label="Tiền mặt (khai báo)" value={hasSetup ? `${vnd(openingCash)} đ` : "—"} note={hasSetup ? `≈ ${money(openingCash)} · cập nhật ${date(conn?.lastSyncedAt)}` : "Chưa khai"} />
        <Kpi label="Phải thu còn lại" value={`${vnd(open(ar))} đ`} note={`${ar.length} chứng từ đã nhập`} />
        <Kpi label="Phải trả còn lại" value={`${vnd(open(ap))} đ`} note={`${ap.length} chứng từ đã nhập`} />
        <Kpi label={<Term k="ccc">Chu kỳ tiền mặt</Term>} value="—" note="Cần dữ liệu hàng tồn kho và giá vốn để tính DIO/DPO" />
      </section>

      <section className="row top">
        <div className="card grow-2 stack">
          <h2 className="ct">Thiết lập dòng tiền</h2>
          <MoneyInput label="Số dư tiền hiện có (đ)" value={cash} min={0} onChange={setCash} hint="Số bạn tự khai — chưa đối chiếu với ngân hàng" />
          <strong style={{ fontSize: 13 }}>Chi định kỳ hằng tháng</strong>
          {outs.length === 0 && <div className="muted" style={{ fontSize: 12.5 }}>Chưa khai khoản chi nào — dự báo sẽ thiếu lương, thuê, thuế… và có thể quá lạc quan.</div>}
          {outs.map((o, i) => {
            const e = outErr(o);
            return (
              <fieldset key={i} className="soft stack-sm" style={{ border: 0, margin: 0 }}>
                <legend className="sr-only">Khoản chi {i + 1}</legend>
                <div className="grid-fields">
                  <label className="field"><span>Tên khoản chi</span><input className="input" placeholder="VD: lương, thuê mặt bằng, thuế" value={o.name} onChange={(ev) => setOuts(outs.map((x, k) => (k === i ? { ...x, name: ev.target.value } : x)))} /></label>
                  <MoneyInput label="Số tiền mỗi tháng (đ)" value={o.amount} onChange={(v) => setOuts(outs.map((x, k) => (k === i ? { ...x, amount: v } : x)))} />
                  <label className="field"><span>Ngày thanh toán trong tháng</span><input className="input num" inputMode="numeric" value={o.day} aria-describedby={`out-${i}-n`} onChange={(ev) => setOuts(outs.map((x, k) => (k === i ? { ...x, day: ev.target.value.trim() } : x)))} /><span id={`out-${i}-n`} className="field-note">Từ 1 đến 28 để tháng nào cũng có ngày này</span></label>
                </div>
                <div className="between">{e ? <span className="field-err">{e}</span> : <span />}<button className="btn bs sm" onClick={() => setOuts(outs.filter((_, k) => k !== i))}><Trash2 size={14} aria-hidden="true" /> Xóa khoản chi</button></div>
              </fieldset>
            );
          })}
          <div className="row" style={{ gap: 8 }}>
            <button className="btn bs" onClick={() => setOuts([...outs, { name: "", amount: null, day: "5" }])}>Thêm khoản chi</button>
            <button className="btn bp" disabled={busy || cash === null || !outsValid} onClick={() => run(() => act("POST", `/v1/organizations/${org.id}/cash-profile`, { openingCash: cash, recurringMonthlyOut: outs.filter((o) => !blankOut(o)).map((o) => ({ name: o.name.trim(), amount: o.amount, day: Number(o.day) })) }), "Đã lưu thiết lập dòng tiền")}>Lưu</button>
          </div>
        </div>
        <div className="card grow-3">
          {forecast ? <CashForecast forecast={forecast} openingCash={openingCash} safeBalance={0} orgId={org.id} recurringCount={conn?.recurringMonthlyOut?.length ?? 0} /> : <div className="empty">Khai số dư tiền để xem dự báo 7/30 ngày.</div>}
        </div>
      </section>

      <section className="row top">
      {forecast && (
        <section className="card stack-sm grow-1" style={{ flexBasis: 360 }}>
          <h2 className="ct">Khoản lớn nhất trong 90 ngày tới</h2>
          {forecast.drivers.length === 0 && <span className="muted">Chưa có khoản thu/chi nào trong 90 ngày.</span>}
          {forecast.drivers.map((d, i) => <div key={i} className="between soft"><span>{date(d.date)} · {d.label}</span><strong className={`num ${d.amount < 0 ? "t-warn" : "t-ok"}`}>{d.amount < 0 ? "−" : "+"}{vnd(Math.abs(d.amount))} đ</strong></div>)}
          {forecast.shortfall && <div className="err">Thiếu hụt dự báo {money(-forecast.shortfall.value)} đ ngày {date(forecast.shortfall.date)} (kịch bản {forecast.shortfall.scenario === "base" ? "cơ sở" : "thận trọng"}). Xem gói tài trợ ở Marketplace.</div>}
        </section>
      )}

      <section className="card stack grow-1" style={{ flexBasis: 360 }}>
        <div className="between"><h2 className="ct">Ngân hàng & dự báo đã lưu</h2>
          <span className="row" style={{ gap: 8 }}>
            {!bankLinked && <button className="btn bs sm" disabled={busy || !hasSetup} title={hasSetup ? undefined : "Khai số dư trước"} onClick={() => run(async () => { await act("POST", "/v1/bank/link"); loadAcc(); }, "Đã liên kết tài khoản ngân hàng (giả lập)")}>Liên kết ngân hàng (giả lập)</button>}
            <button className="btn bs sm" disabled={busy || !hasSetup} onClick={() => run(async () => { const r = await api<{ stored: boolean }>("POST", "/v1/cashflow-forecasts", {}); toast(r.stored ? "Đã lưu dự báo hôm nay" : "Dự báo hôm nay đã được lưu với cùng dữ liệu"); loadAcc(); }, "Hoàn tất")}>Lưu dự báo</button>
          </span></div>
        <div className="muted" style={{ fontSize: 12.5 }}>{bankLinked ? "Số dư lấy từ sao kê của ngân hàng GIẢ LẬP (dựng từ sự kiện tiền trên FCC) cộng chi định kỳ bạn khai." : "Chưa liên kết ngân hàng: số dư là số bạn khai. Phase này chưa kết nối ngân hàng thật."}</div>
        {statement && statement.lines.length > 0 && <div className="tw" tabIndex={0} role="region" aria-label="Bảng dữ liệu, cuộn ngang để xem thêm"><table>
          <thead><tr><th>Ngày</th><th>Nội dung</th><th className="r">Biến động (đ)</th><th className="r">Số dư (đ)</th></tr></thead>
          <tbody>{statement.lines.slice(-12).reverse().map((l, i) => <tr key={i}><td className="num">{date(l.date)}</td><td className="wrap">{l.description}</td><td className={`r num ${l.amount < 0 ? "t-warn" : "t-ok"}`}>{l.amount < 0 ? "−" : "+"}{vnd(Math.abs(l.amount))}</td><td className="r num">{vnd(l.balance)}</td></tr>)}</tbody></table>
          <div className="muted" style={{ padding: "6px 0" }}>Nguồn: {statement.source}</div></div>}
        {acc && <div className="soft">Sai số dự báo thu: {acc.evaluated ? `${acc.evaluated} khoản đã đo · lệch trung bình ${acc.meanAbsErrorDays} ngày · ${acc.within5DaysPct}% trong ±5 ngày` : "chưa có khoản nào đủ điều kiện đo (cần dự báo đã lưu và khoản phải thu đã thanh toán)"}.</div>}
      </section>
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
        {([["Phải thu", ar], ["Phải trả", ap]] as const).map(([label, xs]) => {
          const b = bucket([...xs]);
          const count = countBucket([...xs]);
          const sum = b.reduce((a, v) => a + v, 0);
          return (
            <div key={label} className="card grow-1 stack-sm" style={{ flexBasis: 320 }}>
              <div className="between"><h2 className="ct">Tuổi nợ — {label}</h2><span className="num strong">{vnd(sum)} đ</span></div>
              {sum > 0 ? (
                <>
                  <div className="aging-bar" role="img" aria-label={AGING.map((a, i) => `${a}: ${Math.round((b[i] / sum) * 100)}%`).join(", ")}>
                    {b.map((v, i) => v > 0 && <span key={i} style={{ width: `${(v / sum) * 100}%`, background: AGING_COLOR[i] }} title={`${AGING[i]}: ${vnd(v)} đ`} />)}
                  </div>
                  <table style={{ fontSize: 13 }}>
                    <tbody>
                      {AGING.map((a, i) => (
                        <tr key={a} className={b[i] ? undefined : "muted"}>
                          <td><span className="aging-dot" style={{ background: AGING_COLOR[i] }} aria-hidden="true" />{a}</td>
                          <td className="r num">{count[i]} chứng từ</td>
                          <td className="r num strong">{vnd(b[i])} đ</td>
                          <td className="r num">{Math.round((b[i] / sum) * 100)}%</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                  {b[1] + b[2] + b[3] > 0 && <div className={label === "Phải thu" ? "err" : "muted"} style={{ fontSize: 12.5 }}>{vnd(b[1] + b[2] + b[3])} đ đã quá hạn{label === "Phải thu" ? " — nên nhắc đối tác thanh toán" : " — kiểm tra lịch trả"}.</div>}
                </>
              ) : <div className="muted">Không còn khoản {label.toLowerCase()} nào đang mở.</div>}
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

/** Tổ chức tài chính: dữ liệu kế toán doanh nghiệp đã chia sẻ (theo quyền còn hiệu lực), dẫn tới hồ sơ thẩm định liên quan. */
function LenderSharedAccounting() {
  const { data, org } = useData();
  const today = new Date().toISOString().slice(0, 10);
  const owners = [...new Set(data.consents.filter((c) => c.recipientId === org.id && !c.revokedAt && c.expiresAt >= today && c.scopes.includes("accounting")).map((c) => c.ownerId))];
  return (
    <>
      <PageHeader eyebrow="Tổ chức tài chính" title="Dữ liệu kế toán được chia sẻ" sub="Công nợ và dòng tiền doanh nghiệp chia sẻ cho bạn khi gửi hồ sơ tài trợ. Quyền xem kết thúc khi doanh nghiệp thu hồi hoặc hết hạn." />
      <section className="card flush">
        <div className="tw" tabIndex={0} role="region" aria-label="Bảng dữ liệu, cuộn ngang để xem thêm"><table>
          <thead><tr><th>Doanh nghiệp</th><th className="r">Chứng từ công nợ</th><th className="r">Phải thu còn lại (đ)</th><th className="r">Phải trả còn lại (đ)</th><th>Số dư tiền (tự khai)</th><th></th></tr></thead>
          <tbody>
            {owners.map((id) => {
              const l = data.ledger.filter((x) => x.orgId === id);
              const left = (k: "AR" | "AP") => l.filter((x) => x.kind === k).reduce((a, x) => a + x.amount - x.paid, 0);
              const conn = data.connections.find((c) => c.orgId === id);
              return (
                <tr key={id}>
                  <td className="wrap strong">{data.orgs.find((o) => o.id === id)?.name ?? id}</td>
                  <td className="r num">{l.length}</td>
                  <td className="r num">{vnd(left("AR"))}</td>
                  <td className="r num">{vnd(left("AP"))}</td>
                  <td className="num">{conn ? `${vnd(conn.openingCash)} đ` : "—"}</td>
                  <td><Link className="btn bs sm" href="/lender/appraisal">Mở hồ sơ thẩm định</Link></td>
                </tr>
              );
            })}
            {owners.length === 0 && <tr><td colSpan={6} className="empty">Chưa có doanh nghiệp nào chia sẻ dữ liệu kế toán. Dữ liệu xuất hiện khi doanh nghiệp gửi hồ sơ cho sản phẩm của bạn. <Link href="/lender/appraisal">Xem hàng đợi thẩm định</Link></td></tr>}
          </tbody>
        </table></div>
      </section>
    </>
  );
}
