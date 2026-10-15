// Lớp AI: gọi ollama.com qua backend FCC /api/ollama (khóa API chỉ nằm ở máy chủ).
// AI chỉ trích xuất, đề xuất, giải thích — điểm số luôn do bộ chấm xác định tính (SPEC 1.2, 4.5, 5.3).
import type { EsgIndicatorDef } from '../domain/esg'
import type { ScoreResult } from '../domain/credit'
import type { IndicatorLevel } from '../domain/types'
import { authHeaders } from './api'

export const TEXT_MODEL = 'gpt-oss:120b'
export const VISION_MODEL = 'gemma4:31b'

export interface AiOutcome<T> {
  data: T
  /** true khi AI lỗi và dữ liệu đến từ quy tắc xác định (không phải AI) */
  fallback: boolean
  error?: string
  model?: string
  ms?: number
}

interface ChatMessage {
  role: 'system' | 'user' | 'assistant'
  content: string
  images?: string[]
}

export class AiError extends Error {}

export async function chat(model: string, messages: ChatMessage[], json = true, signal?: AbortSignal): Promise<string> {
  const res = await fetch('/api/ollama/chat', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', ...authHeaders() },
    body: JSON.stringify({ model, messages, stream: false, ...(json ? { format: 'json' } : {}), options: { temperature: 0.1 } }),
    signal,
  })
  const text = await res.text()
  let body: { message?: { content?: string }; error?: string } = {}
  try {
    body = JSON.parse(text)
  } catch {
    throw new AiError(`Phản hồi không hợp lệ từ dịch vụ AI (HTTP ${res.status})`)
  }
  if (!res.ok || body.error) throw new AiError(body.error ? humanizeError(body.error) : `HTTP ${res.status}`)
  const content = body.message?.content ?? ''
  if (!content.trim()) throw new AiError('Mô hình trả về nội dung rỗng')
  return content
}

function humanizeError(e: string) {
  if (/usage limit|upgrade/i.test(e)) return 'Tài khoản ollama.com đã hết hạn mức miễn phí (Free usage limit)'
  if (/unauthorized|401/i.test(e)) return 'Khóa API ollama.com không hợp lệ'
  return e
}

export function parseJson<T>(s: string): T {
  try {
    return JSON.parse(s) as T
  } catch {
    const m = s.match(/\{[\s\S]*\}/)
    if (m) return JSON.parse(m[0]) as T
    throw new AiError('Không đọc được JSON từ mô hình')
  }
}

/** Chạy một tác vụ AI. Không có `fallback` thì lỗi AI được ném ra để giao diện báo và cho nhập tay. */
export async function runAi<T>(model: string, real: () => Promise<T>, fallback?: () => T): Promise<AiOutcome<T>> {
  const t = performance.now()
  try {
    const data = await real()
    return { data, fallback: false, model, ms: Math.round(performance.now() - t) }
  } catch (e) {
    if (!fallback) throw e
    return { data: fallback(), fallback: true, error: e instanceof Error ? e.message : String(e), model }
  }
}

export async function pingAi(): Promise<{ ok: boolean; message: string; ms: number }> {
  const t = performance.now()
  try {
    const c = await chat(TEXT_MODEL, [{ role: 'user', content: 'Trả về JSON {"ok": true}' }])
    return { ok: true, message: c.slice(0, 120), ms: Math.round(performance.now() - t) }
  } catch (e) {
    return { ok: false, message: e instanceof Error ? e.message : String(e), ms: Math.round(performance.now() - t) }
  }
}

// ---------------- Chuẩn bị ảnh ----------------

/** Đọc ảnh/PDF thành base64 JPEG (≤ 1600px) để gửi mô hình thị giác; trả thêm dataUrl xem trước. */
export async function fileToImage(file: File): Promise<{ base64: string; dataUrl: string }> {
  let source: HTMLCanvasElement | HTMLImageElement
  if (file.type === 'application/pdf') {
    const pdfjs = await import('pdfjs-dist')
    const worker = await import('pdfjs-dist/build/pdf.worker.min.mjs?url')
    pdfjs.GlobalWorkerOptions.workerSrc = worker.default
    const pdf = await pdfjs.getDocument({ data: await file.arrayBuffer() }).promise
    const page = await pdf.getPage(1)
    const vp = page.getViewport({ scale: 2 })
    const c = document.createElement('canvas')
    c.width = vp.width
    c.height = vp.height
    await page.render({ canvas: c, canvasContext: c.getContext('2d')!, viewport: vp }).promise
    source = c
  } else {
    const url = URL.createObjectURL(file)
    source = await new Promise<HTMLImageElement>((ok, err) => {
      const img = new Image()
      img.onload = () => ok(img)
      img.onerror = () => err(new Error('Không đọc được ảnh'))
      img.src = url
    })
  }
  const w = source instanceof HTMLImageElement ? source.naturalWidth : source.width
  const h = source instanceof HTMLImageElement ? source.naturalHeight : source.height
  const k = Math.min(1, 1600 / Math.max(w, h))
  const out = document.createElement('canvas')
  out.width = Math.round(w * k)
  out.height = Math.round(h * k)
  out.getContext('2d')!.drawImage(source, 0, 0, out.width, out.height)
  const dataUrl = out.toDataURL('image/jpeg', 0.85)
  return { base64: dataUrl.split(',')[1], dataUrl }
}

// ---------------- Nhiệm vụ AI ----------------

export interface ExtractedFinancials {
  year?: number
  revenue?: number
  netProfit?: number
  ebit?: number
  interestExpense?: number
  depreciation?: number
  totalAssets?: number
  currentAssets?: number
  currentLiabilities?: number
  totalLiabilities?: number
  equity?: number
  operatingCashFlow?: number
  debtService?: number
  cash?: number
  inventory?: number
  receivables?: number
  unit?: string
  confidence?: number
  notes?: string
}

const FIN_PROMPT = `Bạn là chuyên viên phân tích BCTC Việt Nam (TT200/TT133). Đọc ảnh báo cáo tài chính và trích xuất các chỉ tiêu.
Trả về JSON với các khóa (số, đơn vị VND đồng, quy đổi nếu báo cáo ghi nghìn/triệu đồng; bỏ trống nếu không thấy):
year, revenue (doanh thu thuần), netProfit (LNST), ebit (LN trước thuế + chi phí lãi vay), interestExpense (chi phí lãi vay),
depreciation (khấu hao), totalAssets, currentAssets (TS ngắn hạn), currentLiabilities (nợ ngắn hạn), totalLiabilities (nợ phải trả),
equity (VCSH), operatingCashFlow (LCTT thuần từ HĐKD), cash, inventory, receivables, unit (đơn vị gốc trên báo cáo), confidence (0..1), notes (tiếng Việt, ghi chỉ tiêu nào đọc không chắc).
Không bịa số. Chỉ trả JSON.`

export function extractFinancials(base64: string) {
  return runAi(VISION_MODEL, async () => parseJson<ExtractedFinancials>(await chat(VISION_MODEL, [{ role: 'user', content: FIN_PROMPT, images: [base64] }])))
}

export interface ExtractedInvoice {
  series?: string
  number?: string
  issueDate?: string
  sellerTaxCode?: string
  sellerName?: string
  buyerTaxCode?: string
  buyerName?: string
  total?: number
  description?: string
  lookupCode?: string
  confidence?: number
}

export function extractInvoice(base64: string) {
  const prompt = `Đọc ảnh hóa đơn GTGT điện tử Việt Nam. Trả về JSON: series (ký hiệu), number (số hóa đơn), issueDate (YYYY-MM-DD), sellerTaxCode, sellerName, buyerTaxCode, buyerName, total (tổng tiền thanh toán, số nguyên VND), description (tóm tắt hàng hóa), lookupCode (mã của cơ quan thuế nếu có), confidence (0..1). Không bịa; trường không đọc được để trống. Chỉ trả JSON.`
  return runAi(VISION_MODEL, async () => parseJson<ExtractedInvoice>(await chat(VISION_MODEL, [{ role: 'user', content: prompt, images: [base64] }])))
}

export interface EvidenceExtraction {
  docType: string
  period?: string
  indicatorCodes: string[]
  extracted: Record<string, string | number>
  summary: string
}

export function classifyEvidence(base64: string | null, fileName: string, catalog: EsgIndicatorDef[], fallback: () => EvidenceExtraction) {
  const list = catalog.map((d) => `${d.code}: ${d.name} — bằng chứng: ${d.evidence}`).join('\n')
  const prompt = `Bạn là chuyên viên thẩm định ESG cho SME Việt Nam. Tài liệu tên "${fileName}".
Danh mục 18 chỉ tiêu:
${list}
Nhiệm vụ: xác định loại chứng từ, kỳ dữ liệu, các chỉ tiêu liên quan và trích số liệu định lượng (ví dụ kWh theo tháng/tổng, m3 nước, số lao động đóng BHXH, khối lượng chất thải, số vụ tai nạn, giờ đào tạo).
Trả JSON: {"docType": string, "period": string, "indicatorCodes": string[], "extracted": {"tên chỉ số (đơn vị)": số hoặc chuỗi}, "summary": "1-2 câu tiếng Việt"}. Không bịa số; chỉ trả JSON.`
  const msgs: ChatMessage[] = [{ role: 'user', content: prompt, ...(base64 ? { images: [base64] } : {}) }]
  return runAi(base64 ? VISION_MODEL : TEXT_MODEL, async () => {
    const r = parseJson<EvidenceExtraction>(await chat(base64 ? VISION_MODEL : TEXT_MODEL, msgs))
    return { docType: r.docType ?? 'Không xác định', period: r.period, indicatorCodes: (r.indicatorCodes ?? []).filter((c) => catalog.some((d) => d.code === c)), extracted: r.extracted ?? {}, summary: r.summary ?? '' }
  }, fallback)
}

export interface LevelProposal {
  level: IndicatorLevel | null
  rationale: string
  citations: { documentId: string; note: string }[]
  missing: string[]
  confidence: number
}

export function proposeLevel(def: EsgIndicatorDef, evidence: { id: string; name: string; docType: string; summary?: string; extracted?: Record<string, string | number> }[], selfDeclared: string | undefined) {
  const rubric = def.rubric.map((r, i) => `Mức ${i}: ${r}`).join('\n')
  const ev = evidence.length ? evidence.map((e) => `- [${e.id}] ${e.name} (${e.docType}): ${e.summary ?? ''} ${e.extracted ? JSON.stringify(e.extracted) : ''}`).join('\n') : '(không có bằng chứng)'
  const prompt = `Chấm chỉ tiêu ESG ${def.code} "${def.name}" cho SME theo rubric:
${rubric}
Quy tắc bằng chứng: mức 4 cần số liệu kết quả định lượng hoặc đánh giá độc lập; mức 3 cần quy trình và chứng từ thực thi; mức 2 đáp ứng yêu cầu cơ bản; mức 1 chỉ có tuyên bố/hành động rời rạc; mức 0 khi có bằng chứng không tuân thủ rõ ràng.
Nếu không có bằng chứng đủ kiểm chứng thì level = null ("Chưa xác minh"), KHÔNG cho 0. Không được đề xuất mức ≥ 2 nếu không trích dẫn được tài liệu.
Bằng chứng trong 12 tháng:
${ev}
Doanh nghiệp tự khai: ${selfDeclared ?? '(không)'}
Trả JSON: {"level": 0-4 hoặc null, "rationale": "2-3 câu tiếng Việt, nêu vì sao đạt mức này và chưa đạt mức trên", "citations": [{"documentId": "id trong ngoặc vuông", "note": "chi tiết"}], "missing": ["bằng chứng còn thiếu để lên mức cao hơn"], "confidence": 0..1}. Chỉ trả JSON.`
  return runAi(TEXT_MODEL, async () => {
    const r = parseJson<LevelProposal>(await chat(TEXT_MODEL, [{ role: 'user', content: prompt }]))
    let level = r.level === null || r.level === undefined ? null : (Math.max(0, Math.min(4, Math.round(Number(r.level)))) as IndicatorLevel)
    const citations = (r.citations ?? []).filter((c) => evidence.some((e) => e.id === c.documentId))
    if (level !== null && level >= 2 && citations.length === 0) level = null // chặn đề xuất không có trích dẫn
    return { level, rationale: r.rationale ?? '', citations, missing: r.missing ?? [], confidence: r.confidence ?? 0.5 }
  })
}

export function explainScore(orgName: string, s: ScoreResult, fallback: () => string) {
  const facts = {
    điểm: s.score, xếp_hạng: s.rating, độ_bao_phủ: Math.round(s.coverage * 100) + '%', chính_thức: s.official,
    thành_phần: s.components.map((c) => ({ tên: c.label, trọng_số: c.weight, điểm: c.score === null ? 'thiếu' : Math.round(c.score) })),
    yếu_tố_tích_cực: s.positives.map((f) => `${f.name}: ${f.raw} → ${f.reason}`),
    yếu_tố_tiêu_cực: s.negatives.map((f) => `${f.name}: ${f.raw} → ${f.reason}`),
    thiếu_dữ_liệu: s.factors.filter((f) => f.points === null && !f.na).map((f) => f.name),
    cờ: s.flags,
  }
  const prompt = `Viết nhận xét tín dụng ngắn (tối đa 120 từ, tiếng Việt, giọng chuyên viên thẩm định) cho ${orgName} CHỈ dựa trên dữ liệu JSON sau, không thêm số liệu mới, không khuyến nghị cho vay/không cho vay.
Kết thúc bằng 2-3 gợi ý cải thiện cụ thể dạng gạch đầu dòng "- ".
${JSON.stringify(facts)}
Trả JSON {"text": "..."}`
  return runAi(TEXT_MODEL, async () => parseJson<{ text: string }>(await chat(TEXT_MODEL, [{ role: 'user', content: prompt }])).text, fallback)
}

export function templateExplanation(orgName: string, s: ScoreResult) {
  const pos = s.positives.map((f) => f.reason.toLowerCase()).join(', ')
  const neg = s.negatives.map((f) => f.reason.toLowerCase()).join(', ')
  const missing = s.factors.filter((f) => f.points === null && !f.na)
  const lines = [
    `${orgName} đạt ${s.score.toFixed(1)}/100, xếp hạng tham khảo ${s.rating}${s.official ? '' : ' (tạm tính)'}; độ bao phủ dữ liệu ${Math.round(s.coverage * 100)}%.`,
    pos ? `Điểm mạnh: ${pos}.` : '',
    neg ? `Điểm cần lưu ý: ${neg}.` : '',
    s.flags.length ? `Cờ rủi ro: ${s.flags.join('; ')} — cần thẩm định tăng cường.` : '',
    ...missing.slice(0, 2).map((f) => `- Bổ sung dữ liệu "${f.name}" để tăng độ bao phủ.`),
    ...s.negatives.slice(0, 2).map((f) => `- Cải thiện "${f.name}" (hiện ${f.raw}).`),
  ]
  return lines.filter(Boolean).join('\n')
}
