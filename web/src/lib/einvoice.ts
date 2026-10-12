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

export function sampleInvoiceXml(o: { sellerName: string; sellerTaxCode: string; buyerName: string; buyerTaxCode: string; number: string; date: string; total: number; item: string }) {
  const pre = Math.round(o.total / 1.08)
  return `<?xml version="1.0" encoding="UTF-8"?>
<HDon>
  <DLHDon Id="data">
    <TTChung>
      <PBan>2.0.1</PBan>
      <THDon>HÓA ĐƠN GIÁ TRỊ GIA TĂNG</THDon>
      <KHMSHDon>1</KHMSHDon>
      <KHHDon>C26TMT</KHHDon>
      <SHDon>${o.number}</SHDon>
      <NLap>${o.date}</NLap>
      <DVTTe>VND</DVTTe>
      <HTTToan>Chuyển khoản</HTTToan>
    </TTChung>
    <NDHDon>
      <NBan><Ten>${o.sellerName}</Ten><MST>${o.sellerTaxCode}</MST><DChi>Mẫu demo</DChi></NBan>
      <NMua><Ten>${o.buyerName}</Ten><MST>${o.buyerTaxCode}</MST><DChi>Mẫu demo</DChi></NMua>
      <DSHHDVu>
        <HHDVu><TChat>1</TChat><STT>1</STT><THHDVu>${o.item}</THHDVu><DVTinh>Lô</DVTinh><SLuong>1</SLuong><DGia>${pre}</DGia><ThTien>${pre}</ThTien><TSuat>8%</TSuat></HHDVu>
      </DSHHDVu>
      <TToan><TgTCThue>${pre}</TgTCThue><TgTThue>${o.total - pre}</TgTThue><TgTTTBSo>${o.total}</TgTTTBSo></TToan>
    </NDHDon>
  </DLHDon>
  <MCCQT>00${o.sellerTaxCode.slice(-6)}${o.number}DEMO</MCCQT>
</HDon>`
}
