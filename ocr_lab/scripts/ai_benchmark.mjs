// Đo độ chính xác trích hóa đơn bằng mô hình thị giác (cùng prompt với web/src/lib/ai.ts extractInvoice) trên 10 hóa đơn mẫu,
// so với đáp án nhập tay trong expected_output/. Cần OLLAMA_API_KEY (đọc từ ../server/.env, không in ra).
//   node scripts/ai_benchmark.mjs [model]   → output/ai_benchmark.json
import { readFileSync, readdirSync, writeFileSync } from 'node:fs'
import { join, dirname } from 'node:path'
import { fileURLToPath } from 'node:url'

const LAB = join(dirname(fileURLToPath(import.meta.url)), '..')
const env = Object.fromEntries(readFileSync(join(LAB, '../server/.env'), 'utf8').split('\n').filter((l) => l.includes('=')).map((l) => [l.slice(0, l.indexOf('=')), l.slice(l.indexOf('=') + 1)]))
const KEY = process.env.OLLAMA_API_KEY ?? env.OLLAMA_API_KEY
const MODEL = process.argv[2] ?? 'gemma4:31b'
const PROMPT = `Đọc ảnh hóa đơn GTGT điện tử Việt Nam. Trả về JSON: series (ký hiệu), number (số hóa đơn), issueDate (YYYY-MM-DD), sellerTaxCode, sellerName, buyerTaxCode, buyerName, total (tổng tiền thanh toán, số nguyên VND), description (tóm tắt hàng hóa), lookupCode (mã của cơ quan thuế nếu có), confidence (0..1). Không bịa; trường không đọc được để trống. Chỉ trả JSON.`
const tag = (xml, t) => (xml.match(new RegExp(`<${t}>([^<]*)</${t}>`))?.[1] ?? '').trim()
const digits = (s) => String(s ?? '').replace(/\D/g, '')
const alnum = (s) => String(s ?? '').toUpperCase().replace(/[^A-Z0-9]/g, '')
const FIELDS = [
  ['KyHieu', 'series', (a, b) => alnum(a) === alnum(b)],
  ['So', 'number', (a, b) => digits(a).replace(/^0+/, '') === digits(b).replace(/^0+/, '')],
  ['NgayLap', 'issueDate', (a, b) => a === b],
  ['NBan_MST', 'sellerTaxCode', (a, b) => digits(a) === digits(b)],
  ['NMua_MST', 'buyerTaxCode', (a, b) => digits(a) === digits(b)],
  ['TgTTTBSo', 'total', (a, b) => Number(digits(a)) === Number(digits(b))],
]

const files = readdirSync(join(LAB, 'invoices')).sort()
const rows = []
for (const f of files) {
  const base = f.replace(/\.[^.]+$/, '')
  const exp = readFileSync(join(LAB, 'expected_output', `${base}.expected.xml`), 'utf8')
  const img = readFileSync(join(LAB, 'invoices', f)).toString('base64')
  const t0 = Date.now()
  let got = {}
  let error
  try {
    const res = await fetch('https://ollama.com/api/chat', { method: 'POST', headers: { 'content-type': 'application/json', authorization: `Bearer ${KEY}` }, body: JSON.stringify({ model: MODEL, messages: [{ role: 'user', content: PROMPT, images: [img] }], stream: false, format: 'json', options: { temperature: 0.1 } }) })
    const j = await res.json()
    if (!res.ok || j.error) throw new Error(j.error ?? `HTTP ${res.status}`)
    got = JSON.parse(j.message.content.match(/\{[\s\S]*\}/)[0])
  } catch (e) {
    error = e.message
  }
  const cells = {}
  for (const [ek, gk, eq] of FIELDS) {
    const want = tag(exp, ek)
    const have = got[gk] === undefined || got[gk] === null ? '' : String(got[gk])
    cells[ek] = want === '' ? (have === '' || /^0*$/.test(digits(have)) ? 'ok-empty' : 'FP') : eq(have, want) ? 'PASS' : have === '' ? 'MISS' : 'FAIL'
  }
  rows.push({ file: f, ms: Date.now() - t0, error, confidence: got.confidence, cells })
  console.log(f.padEnd(34), error ?? Object.values(cells).join(' '))
}
const scored = rows.flatMap((r) => Object.entries(r.cells).filter(([, v]) => v !== 'ok-empty'))
const pass = scored.filter(([, v]) => v === 'PASS').length
const withData = ['inv01_goldengate', 'inv08_ketoanthienung', 'inv09_viettel_068W023', 'inv10_viettel_051W000']
const dataRows = rows.filter((r) => withData.some((w) => r.file.startsWith(w)))
const dataScored = dataRows.flatMap((r) => Object.values(r.cells).filter((v) => v !== 'ok-empty'))
const summary = { model: MODEL, files: rows.length, fieldsScored: scored.length, pass, accuracy: +(pass / scored.length).toFixed(3), onInvoicesWithData: { files: dataRows.length, accuracy: +(dataScored.filter((v) => v === 'PASS').length / dataScored.length).toFixed(3) }, fieldFP: scored.filter(([, v]) => v === 'FP').length }
console.log(summary)
writeFileSync(join(LAB, 'output', `ai_benchmark_${MODEL.replace(/\W/g, '_')}.json`), JSON.stringify({ summary, rows }, null, 2))
