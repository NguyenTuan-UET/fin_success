// Đọc XML hóa đơn điện tử theo cấu trúc QĐ 1450/QĐ-TCT (TT78/2021): HDon > DLHDon > TTChung / NDHDon.
import { sha256 } from './format'

export interface ParsedInvoice {
  series: string
  number: string
  issueDate: string
  sellerName: string
  sellerTaxCode: string
  buyerName: string
  buyerTaxCode: string
  total: number
  description: string
  lookupCode?: string
}

const t = (root: Element | Document, tag: string) => root.getElementsByTagName(tag)[0]?.textContent?.trim() ?? ''

export function parseEInvoiceXml(xml: string): ParsedInvoice {
  const doc = new DOMParser().parseFromString(xml, 'application/xml')
  if (doc.getElementsByTagName('parsererror').length) throw new Error('XML không hợp lệ')
  const nban = doc.getElementsByTagName('NBan')[0]
  const nmua = doc.getElementsByTagName('NMua')[0]
  if (!nban || !nmua) throw new Error('Không tìm thấy thông tin người bán/người mua (NBan/NMua)')
  const items = [...doc.getElementsByTagName('HHDVu')].map((h) => t(h, 'THHDVu')).filter(Boolean)
  const total = Number(t(doc, 'TgTTTBSo').replace(/[^\d.-]/g, ''))
  if (!total) throw new Error('Thiếu tổng tiền thanh toán (TgTTTBSo)')
  return {
    series: `${t(doc, 'KHMSHDon')}${t(doc, 'KHHDon')}`,
    number: t(doc, 'SHDon'),
    issueDate: t(doc, 'NLap').slice(0, 10),
    sellerName: t(nban, 'Ten'),
    sellerTaxCode: t(nban, 'MST'),
    buyerName: t(nmua, 'Ten'),
    buyerTaxCode: t(nmua, 'MST'),
    total: Math.round(total),
    description: items.join('; ') || 'Hàng hóa/dịch vụ',
    lookupCode: t(doc, 'MCCQT') || undefined,
  }
}

/** Khóa nghiệp vụ chống trùng (SPEC F04): MST bán + ký hiệu + số + ngày + mã CQT. */
export function invoiceFingerprint(p: { sellerTaxCode: string; series: string; number: string; issueDate: string; lookupCode?: string }) {
  return sha256([p.sellerTaxCode, p.series.toUpperCase(), p.number.replace(/^0+/, ''), p.issueDate, p.lookupCode ?? ''].join('|'))
}
