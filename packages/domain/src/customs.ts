// Chứng từ hải quan: chuẩn hóa số tờ khai, cờ rủi ro, cổng kiểm soát trước RFQ. Hàm thuần, không đọc nguồn ngoài.
import { CUSTOMS_DOC_KINDS, type CustomsDocKind, type InvoiceFlag, type Receivable } from './types'

/** "off" không kiểm tra · "warn" cảnh báo, vẫn cho gửi · "block" chặn khi thiếu tờ khai xuất khẩu đã thông quan */
export type CustomsGate = 'off' | 'warn' | 'block'
export const CUSTOMS_GATE: CustomsGate = 'warn'

export const CUSTOMS_FILE_LIMITS = { perCall: 10, perReceivable: 40 }

export const isCustomsKind = (k: unknown): k is CustomsDocKind => typeof k === 'string' && Object.prototype.hasOwnProperty.call(CUSTOMS_DOC_KINDS, k)

/** Phía được tải loại này: exporter chỉ phía xuất, importer chỉ phía nhập, both cả hai */
export const kindAllowedFor = (kind: CustomsDocKind, side: 'export' | 'import') => {
  const s = CUSTOMS_DOC_KINDS[kind].side
  return s === 'both' || (s === 'exporter' ? side === 'export' : side === 'import')
}

/** Cắt khoảng trắng, chữ hoa; chấp nhận 5–30 ký tự chữ-số-gạch. Trả null nếu không hợp lệ. */
export function normalizeDeclarationNo(v: unknown): string | null {
  if (typeof v !== 'string') return null
  const s = v.replace(/\s+/g, '').toUpperCase()
  return /^[A-Z0-9\-/]{5,30}$/.test(s) ? s : null
}
const normTax = (v?: string) => (v ?? '').replace(/[\s.\-]/g, '').toUpperCase()

/** Có ít nhất một tờ khai (xuất hoặc nhập) trong tệp đính kèm */
export const hasCustomsDeclaration = (files: Receivable['files']) =>
  !!files?.some((f) => f.kind === 'customs_export_declaration' || f.kind === 'customs_import_declaration')

const ACTIVE = (r: Receivable) => !['CANCELLED', 'REJECTED'].includes(r.state)

/** Cờ từ thông tin tờ khai; others = các khoản phải thu khác. Trả cờ cho khoản r và id các khoản khác cũng cần gắn cờ trùng. */
export function customsFlags(r: Receivable, others: Receivable[], sellerTaxCode?: string): { flags: InvoiceFlag[]; reusedWith: Receivable[] } {
  const flags: InvoiceFlag[] = []
  const no = normalizeDeclarationNo(r.customsInfo?.export?.declarationNo)
  const reusedWith = no
    ? others.filter((x) => x.id !== r.id && ACTIVE(x) && normalizeDeclarationNo(x.customsInfo?.export?.declarationNo) === no)
    : []
  if (reusedWith.length) flags.push({ code: 'CUSTOMS_DECL_REUSED', severity: 'medium', detail: `Số tờ khai ${no} cũng được dùng ở ${reusedWith.map((x) => x.code).join(', ')} — có thể là tài trợ hai lần hoặc cùng một lô hàng.` })
  const taxOnDecl = normTax(r.customsInfo?.export?.exporterTaxCode)
  if (taxOnDecl && sellerTaxCode && taxOnDecl !== normTax(sellerTaxCode)) {
    flags.push({ code: 'CUSTOMS_EXPORTER_MISMATCH', severity: 'high', detail: `MST người xuất khẩu trên tờ khai (${taxOnDecl}) khác MST đơn vị xuất khẩu.` })
  }
  return { flags, reusedWith }
}

/** Phần còn thiếu trước khi gửi RFQ/hồ sơ; blocking=true khi gate là "block" và thiếu tờ khai xuất khẩu đã thông quan. */
export function customsGateCheck(r: Pick<Receivable, 'files' | 'customsInfo'>, gate: CustomsGate = CUSTOMS_GATE) {
  const missing: string[] = []
  if (gate !== 'off') {
    if (!r.files?.some((f) => f.kind === 'customs_export_declaration')) missing.push('tờ khai hải quan xuất khẩu')
    else if (r.customsInfo?.export?.clearance !== 'cleared') missing.push('xác nhận tờ khai đã thông quan')
  }
  const warnings = gate !== 'off' && !r.files?.some((f) => f.kind === 'transport_document') ? ['vận đơn'] : []
  return { missing, warnings, blocking: gate === 'block' && missing.length > 0 }
}
