import { useState } from 'react'
import { Link } from 'react-router-dom'
import { Download, PlugZap, Plus, Settings2, Trash2, Upload } from 'lucide-react'
import { useShallow } from 'zustand/react/shallow'
import { useActiveOrg, useStore } from '../store'
import { hasConsent, useForecast, useOrgMap } from '../hooks'
import { Badge, Button, Callout, Card, Empty, Field, inputCls, Modal, Table } from '../components/ui'
import { CashflowChart } from '../components/charts'
import { date, dateTime, daysFromNow, vnd } from '../lib/format'
import type { LedgerItem } from '@fcc/domain/types'

export function Accounting() {
  const org = useActiveOrg()
  return (
    <div className="space-y-4">
      <div>
        <h1 className="text-xl font-bold tracking-tight">Kế toán & dự báo dòng tiền</h1>
        <p className="text-[13px] text-ink-3">FCC không thay phần mềm kế toán. Doanh nghiệp khai số dư tiền và chi phí định kỳ, nhập file công nợ xuất từ phần mềm kế toán (CSV); khoản phải thu trên FCC được tính tự động. Chưa có kết nối API tới phần mềm kế toán.</p>
      </div>
      {org.type === 'lender' ? <LenderView /> : <OrgAccounting orgId={org.id} editable />}
    </div>
  )
}

function OrgAccounting({ orgId, editable }: { orgId: string; editable: boolean }) {
  const conn = useStore((s) => s.connections.find((c) => c.orgId === orgId))
  const ledger = useStore(useShallow((s) => s.ledger.filter((l) => l.orgId === orgId)))
  const [connectOpen, setConnectOpen] = useState(false)
  const [importOpen, setImportOpen] = useState(false)
  const [threshold, setThreshold] = useState(0)
  const fcT = useForecast(orgId, threshold)
  const connected = conn?.status === 'connected'

  return (
    <div className="space-y-4">
      <Card
        title={<span className="flex items-center gap-2"><PlugZap className="size-4 text-ink-3" /> Thiết lập dòng tiền</span>}
        action={editable && (connected ? <>
          <Button size="sm" icon={<Settings2 className="size-4" />} onClick={() => setConnectOpen(true)}>Cập nhật số dư & chi định kỳ</Button>
          <Button size="sm" icon={<Upload className="size-4" />} onClick={() => setImportOpen(true)}>Nhập file công nợ</Button>
        </> : <Button variant="primary" icon={<Settings2 className="size-4" />} onClick={() => setConnectOpen(true)}>Thiết lập</Button>)}
      >
        {conn ? (
          <div className="flex flex-wrap items-center gap-x-6 gap-y-2 text-[13px]">
            <span>Nguồn công nợ: <b>Hóa đơn trên FCC + file CSV</b></span>
            <span>Cập nhật gần nhất: <b>{dateTime(conn.lastSyncedAt)}</b> {daysFromNow(conn.lastSyncedAt.slice(0, 10)) < -7 && <Badge tone="warn">Dữ liệu cũ</Badge>}</span>
            <span>Số dư tiền đầu kỳ (do doanh nghiệp khai): <b>{vnd(conn.openingCash)}</b></span>
            <span>Chi định kỳ: <b>{conn.recurringMonthlyOut.length} khoản</b></span>
          </div>
        ) : (
          <Empty title="Chưa thiết lập">Khai số dư tiền hiện tại và các khoản chi cố định hằng tháng để FCC dự báo dòng tiền 90 ngày. Công nợ lấy từ hóa đơn trên FCC và file CSV theo mẫu.</Empty>
        )}
      </Card>

      {connected && fcT ? (
        <>
          <div className="grid gap-4 xl:grid-cols-3">
            <Card className="xl:col-span-2" title="Dự báo dòng tiền 90 ngày — 3 kịch bản" subtitle="Thu = phải thu mở + độ trễ lịch sử từng bên mua (trung vị/p80); chi = phải trả + chi định kỳ + tất toán tài trợ. Dự báo — không phải cam kết.">
              <div className="mb-3 flex flex-wrap items-end gap-3">
                <Field label="Ngưỡng tiền tối thiểu (VND)"><input className={`${inputCls} w-48`} inputMode="numeric" value={threshold || ''} placeholder="0" onChange={(e) => setThreshold(Number(e.target.value.replace(/\D/g, '')))} /></Field>
              </div>
              {fcT.shortfall && (
                <div className="mb-3">
                  <Callout tone="critical" title={`Cảnh báo: số dư dự kiến dưới ngưỡng ngày ${date(fcT.shortfall.date)} (${fcT.shortfall.scenario === 'base' ? 'kịch bản cơ sở' : 'kịch bản thận trọng'})`}>
                    Số dư {vnd(fcT.shortfall.value)}. Xem khoản phải thu đủ điều kiện tài trợ trên <Link to="/marketplace" className="font-semibold underline">Marketplace</Link>.
                  </Callout>
                </div>
              )}
              <CashflowChart points={fcT.points} threshold={threshold} />
            </Card>
            <Card title="Tổng hợp">
              <dl className="space-y-2 text-[13px]">
                {(['d7', 'd30', 'd90'] as const).map((k) => (
                  <div key={k} className="grid grid-cols-3 gap-2">
                    <dt className="text-ink-3">{{ d7: '7 ngày', d30: '30 ngày', d90: '90 ngày' }[k]}</dt>
                    <dd className="text-right font-semibold text-good-ink">+{vnd(fcT.inflow[k])}</dd>
                    <dd className="text-right font-semibold text-critical-ink">{vnd(-fcT.outflow[k])}</dd>
                  </div>
                ))}
                <div className="flex justify-between border-t border-line pt-2"><dt className="text-ink-3">Số dư thấp nhất (cơ sở)</dt><dd className="font-semibold">{vnd(fcT.minBase.value)} · {date(fcT.minBase.date)}</dd></div>
              </dl>
              <p className="mb-1 mt-4 text-[13px] font-semibold">Khoản đóng góp lớn nhất</p>
              <ul className="space-y-1 text-[12.5px]">
                {fcT.drivers.slice(0, 8).map((d, i) => (
                  <li key={i} className="flex justify-between gap-2">
                    <span className="min-w-0 truncate text-ink-2" title={d.label}>{date(d.date)} · {d.label}</span>
                    <span className={`tabular shrink-0 font-semibold ${d.amount > 0 ? 'text-good-ink' : 'text-critical-ink'}`}>{d.amount > 0 ? '+' : ''}{vnd(d.amount)}</span>
                  </li>
                ))}
              </ul>
              <p className="mt-3 text-[11px] text-ink-3">v1 theo lịch, giải thích được. Mô hình học máy (v2) chỉ dùng khi có ≥ 12 tháng lịch sử và sai số tốt hơn v1.</p>
            </Card>
          </div>
          <div className="grid gap-4 xl:grid-cols-2">
            <LedgerTable title="Công nợ phải thu (TK 131)" items={ledger.filter((l) => l.kind === 'AR')} />
            <LedgerTable title="Công nợ phải trả (TK 331)" items={ledger.filter((l) => l.kind === 'AP')} />
          </div>
          {conn && (
            <Card title="Chi định kỳ & độ trễ thanh toán của bên mua (từ lịch sử)">
              <div className="grid gap-4 md:grid-cols-2">
                <ul className="space-y-1 text-[13px]">{conn.recurringMonthlyOut.map((r) => <li key={r.name} className="flex justify-between"><span>{r.name} <span className="text-ink-3">(ngày {r.day} hằng tháng)</span></span><b className="text-critical-ink">{vnd(-r.amount)}</b></li>)}{(conn.recurringMonthlyIn ?? []).map((r) => <li key={r.name} className="flex justify-between gap-2"><span>{r.name} <span className="text-ink-3">(ngày {r.day}, từ ngày thứ {r.fromDay})</span></span><b className="text-good-ink">+{vnd(r.amount)}</b></li>)}</ul>
                <ul className="space-y-1 text-[13px]">{Object.entries(conn.buyerDelayDays).map(([k, v]) => <li key={k} className="flex justify-between"><span>{k === '*' ? 'Bên mua khác (mặc định)' : `MST ${k}`}</span><b>trễ trung vị {v.median} ngày · p80 {v.p80} ngày</b></li>)}</ul>
              </div>
            </Card>
          )}
        </>
      ) : (
        conn && <Empty title="Đã ngắt kết nối">Dừng đồng bộ; dự báo không hiển thị khi không có dữ liệu.</Empty>
      )}
      {connectOpen && <ConnectModal orgId={orgId} onClose={() => setConnectOpen(false)} />}
      {importOpen && <ImportModal orgId={orgId} onClose={() => setImportOpen(false)} />}
    </div>
  )
}

function LedgerTable({ title, items }: { title: string; items: LedgerItem[] }) {
  const buckets = [
    { label: 'Quá hạn', f: (d: number) => d < 0 },
    { label: '0–30 ngày', f: (d: number) => d >= 0 && d <= 30 },
    { label: '31–60 ngày', f: (d: number) => d > 30 && d <= 60 },
    { label: '> 60 ngày', f: (d: number) => d > 60 },
  ]
  const open = items.filter((i) => i.amount > i.paid)
  return (
    <Card title={title} subtitle={`${open.length} chứng từ mở · ${vnd(open.reduce((a, i) => a + i.amount - i.paid, 0))}`}>
      <div className="mb-3 grid grid-cols-4 gap-2 text-center text-[12px]">
        {buckets.map((b) => <div key={b.label} className="rounded-lg bg-page px-2 py-1.5"><div className="text-ink-3">{b.label}</div><div className="tabular font-bold">{vnd(open.filter((i) => b.f(daysFromNow(i.dueDate))).reduce((a, i) => a + i.amount - i.paid, 0))}</div></div>)}
      </div>
      <Table head={['Chứng từ', 'Đối tác', 'Còn lại', 'Hạn']}>
        {open.sort((x, y) => x.dueDate.localeCompare(y.dueDate)).map((i) => (
          <tr key={i.id}>
            <td className="px-3 py-1.5 font-medium">{i.docNo}</td>
            <td className="max-w-48 truncate px-3 py-1.5 text-ink-2">{i.counterpartyName}</td>
            <td className="px-3 py-1.5 font-semibold">{vnd(i.amount - i.paid)}</td>
            <td className="px-3 py-1.5">{date(i.dueDate)} {daysFromNow(i.dueDate) < 0 && <Badge tone="critical">Quá hạn</Badge>}</td>
          </tr>
        ))}
      </Table>
    </Card>
  )
}

function ConnectModal({ orgId, onClose }: { orgId: string; onClose: () => void }) {
  const save = useStore((s) => s.saveCashProfile)
  const conn = useStore((s) => s.connections.find((c) => c.orgId === orgId))
  const [cash, setCash] = useState(String(conn?.openingCash ?? ''))
  const [rows, setRows] = useState<{ name: string; amount: string; day: string }[]>((conn?.recurringMonthlyOut ?? []).map((r) => ({ name: r.name, amount: String(r.amount), day: String(r.day) })))
  const [err, setErr] = useState('')
  const num = (v: string) => Number(v.replace(/\D/g, ''))
  const submit = async () => {
    if (cash === '') return setErr('Nhập số dư tiền hiện tại (có thể bằng 0)')
    try {
      await save(orgId, { openingCash: num(cash), recurringMonthlyOut: rows.filter((r) => r.name.trim() || r.amount).map((r) => ({ name: r.name, amount: num(r.amount), day: Number(r.day) })) })
      onClose()
    } catch (e) {
      setErr((e as Error).message)
    }
  }
  return (
    <Modal open onClose={onClose} title="Thiết lập dòng tiền" footer={<><Button onClick={onClose}>Hủy</Button><Button variant="primary" onClick={submit}>Lưu</Button></>}>
      <div className="space-y-3">
        {err && <Callout tone="critical">{err}</Callout>}
        <Field label="Số dư tiền hiện tại (TK 111/112, VND)" hint={cash ? vnd(num(cash)) : undefined}><input className={inputCls} inputMode="numeric" value={cash} onChange={(e) => setCash(e.target.value)} /></Field>
        <div>
          <p className="mb-1 text-[13px] font-medium">Chi phí cố định hằng tháng</p>
          {rows.map((r, i) => (
            <div key={i} className="mb-2 grid grid-cols-[1fr_9rem_4.5rem_2.5rem] gap-2">
              <input aria-label="Tên khoản chi" className={inputCls} placeholder="Lương, thuê xưởng…" value={r.name} onChange={(e) => setRows(rows.map((x, j) => (j === i ? { ...x, name: e.target.value } : x)))} />
              <input aria-label="Số tiền" className={inputCls} inputMode="numeric" placeholder="Số tiền" value={r.amount} onChange={(e) => setRows(rows.map((x, j) => (j === i ? { ...x, amount: e.target.value } : x)))} />
              <input aria-label="Ngày trong tháng" className={inputCls} inputMode="numeric" placeholder="Ngày" value={r.day} onChange={(e) => setRows(rows.map((x, j) => (j === i ? { ...x, day: e.target.value } : x)))} />
              <Button size="sm" variant="ghost" aria-label="Xóa" icon={<Trash2 className="size-4" />} onClick={() => setRows(rows.filter((_, j) => j !== i))} />
            </div>
          ))}
          <Button size="sm" icon={<Plus className="size-4" />} onClick={() => setRows([...rows, { name: '', amount: '', day: '5' }])}>Thêm khoản chi</Button>
        </div>
        <Callout tone="brand">Dự báo chỉ dùng các số bạn khai ở đây, công nợ từ file CSV và các hóa đơn trên FCC. Độ trễ thanh toán của từng bên mua được tính từ lịch sử thanh toán thật trên FCC; chưa có lịch sử thì coi như thanh toán đúng hạn.</Callout>
      </div>
    </Modal>
  )
}

const TEMPLATE = 'kind,counterparty,tax_code,doc_no,amount,paid,due_date\nAR,Công ty TNHH Khách hàng A,9900900001,HĐ 0001,250000000,0,2026-11-15\nAP,Công ty TNHH Nhà cung cấp B,,PN 0102,180000000,0,2026-11-05\n'

function ImportModal({ orgId, onClose }: { orgId: string; onClose: () => void }) {
  const importLedger = useStore((s) => s.importLedger)
  const [rows, setRows] = useState<LedgerItem[]>([])
  const [errs, setErrs] = useState<string[]>([])
  const parse = (text: string) => {
    const lines = text.trim().split(/\r?\n/).slice(1)
    const out: LedgerItem[] = []
    const e: string[] = []
    lines.forEach((l, i) => {
      const [kind, cp, tax, doc, amount, paid, due] = l.split(',').map((x) => x.trim())
      if (!['AR', 'AP'].includes(kind)) return e.push(`Dòng ${i + 2}: kind phải là AR hoặc AP`)
      if (!Number(amount)) return e.push(`Dòng ${i + 2}: amount không hợp lệ`)
      if (!/^\d{4}-\d{2}-\d{2}$/.test(due)) return e.push(`Dòng ${i + 2}: due_date phải dạng YYYY-MM-DD`)
      out.push({ id: `imp-${Date.now()}-${i}`, orgId, kind: kind as 'AR' | 'AP', counterpartyName: cp, counterpartyTaxCode: tax || undefined, docNo: doc, amount: Number(amount), paid: Number(paid) || 0, dueDate: due })
    })
    setRows(out)
    setErrs(e)
  }
  return (
    <Modal open onClose={onClose} title="Nhập file công nợ (CSV mẫu FCC)" footer={<><Button onClick={onClose}>Hủy</Button><Button variant="primary" disabled={!rows.length} onClick={async () => { await importLedger(orgId, rows); onClose() }}>Nhập {rows.length} dòng</Button></>}>
      <div className="space-y-3">
        <div className="flex flex-wrap gap-2">
          <label className="cursor-pointer"><span className="inline-flex h-10 items-center rounded-lg border border-dashed border-brand bg-brand-soft px-4 text-sm font-medium text-brand-dark">Chọn file CSV…</span><input type="file" accept=".csv,text/csv" className="sr-only" onChange={async (e) => e.target.files?.[0] && parse(await e.target.files[0].text())} /></label>
          <Button variant="ghost" icon={<Download className="size-4" />} onClick={() => { const a = document.createElement('a'); a.href = URL.createObjectURL(new Blob([TEMPLATE], { type: 'text/csv' })); a.download = 'mau_cong_no_fcc.csv'; a.click() }}>Tải file mẫu</Button>
        </div>
        {errs.length > 0 && <Callout tone="critical" title="Lỗi theo dòng">{errs.map((x) => <div key={x}>{x}</div>)}</Callout>}
        {rows.length > 0 && <Callout tone="good">{rows.length} dòng hợp lệ — chứng từ trùng số sẽ được cập nhật.</Callout>}
      </div>
    </Modal>
  )
}

function LenderView() {
  const org = useActiveOrg()
  const consents = useStore((s) => s.consents)
  const connections = useStore((s) => s.connections)
  const orgMap = useOrgMap()
  const [sel, setSel] = useState<string | null>(null)
  const clients = connections.filter((c) => c.status === 'connected' && hasConsent(consents, c.orgId, org.id, 'accounting'))
  return (
    <div className="space-y-4">
      <Card title="Dữ liệu kế toán khách hàng" subtitle="Chỉ doanh nghiệp đã đồng ý chia sẻ dữ liệu kế toán cho tổ chức của bạn">
        {clients.length ? (
          <div className="flex flex-wrap gap-2">{clients.map((c) => <Button key={c.orgId} variant={sel === c.orgId ? 'primary' : 'secondary'} onClick={() => setSel(c.orgId)}>{orgMap[c.orgId].shortName}</Button>)}</div>
        ) : (
          <Empty title="Chưa có khách hàng chia sẻ dữ liệu kế toán" />
        )}
      </Card>
      {sel && <OrgAccounting orgId={sel} editable={false} />}
    </div>
  )
}
