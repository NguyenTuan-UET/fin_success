import { describe, expect, it } from 'vitest'
import { customsFlags, customsGateCheck, hasCustomsDeclaration, kindAllowedFor, normalizeDeclarationNo } from '../src/customs'
import { scoreApplication } from '../src/credit'
import { CUSTOMS_DOC_KINDS, type Receivable } from '../src/types'

const mk = (id: string, extra: Partial<Receivable> = {}): Receivable => ({
  id, code: `INV-${id}`, sellerId: 's', buyerId: 'b', amount: 1, issueDate: '2026-10-01', dueDate: '2026-12-01', state: 'BUYER_CONFIRMED', version: 1,
  invoiceSeries: 'A', invoiceNumber: id, fingerprint: id, description: '', createdAt: '2026-10-01T00:00:00Z', source: 'xml',
  docs: { xml: true, contract: false, delivery: false }, ...extra,
}) as Receivable
const withDecl = (id: string, no: string, extra: Partial<Receivable> = {}) => mk(id, { customsInfo: { export: { declarationNo: no } }, ...extra })

describe('chứng từ hải quan', () => {
  it('chuẩn hóa số tờ khai', () => {
    expect(normalizeDeclarationNo(' abc 123 456 ')).toBe('ABC123456')
    expect(normalizeDeclarationNo('ab')).toBeNull()
    expect(normalizeDeclarationNo(5)).toBeNull()
  })

  it('phân phía theo loại chứng từ', () => {
    expect(kindAllowedFor('customs_export_declaration', 'export')).toBe(true)
    expect(kindAllowedFor('customs_export_declaration', 'import')).toBe(false)
    expect(kindAllowedFor('customs_import_declaration', 'import')).toBe(true)
    expect(kindAllowedFor('customs_other', 'export') && kindAllowedFor('customs_other', 'import')).toBe(true)
    expect(Object.keys(CUSTOMS_DOC_KINDS)).toHaveLength(9)
  })

  it('docs.customs: có tờ khai xuất hoặc nhập', () => {
    expect(hasCustomsDeclaration([{ key: 'k', name: 'a', kind: 'transport_document' }])).toBe(false)
    expect(hasCustomsDeclaration([{ key: 'k', name: 'a', kind: 'customs_import_declaration' }])).toBe(true)
  })

  it('CUSTOMS_DECL_REUSED sinh khi trùng, không sinh khi khác hoặc khoản đã hủy', () => {
    const r = withDecl('1', 'abc 12345')
    expect(customsFlags(r, [withDecl('2', 'ABC12345')], undefined).flags.map((f) => f.code)).toEqual(['CUSTOMS_DECL_REUSED'])
    expect(customsFlags(r, [withDecl('2', 'XYZ99999')], undefined).flags).toEqual([])
    expect(customsFlags(r, [withDecl('2', 'ABC12345', { state: 'CANCELLED' })], undefined).flags).toEqual([])
  })

  it('CUSTOMS_EXPORTER_MISMATCH khi MST khác sau chuẩn hóa', () => {
    const r = mk('1', { customsInfo: { export: { exporterTaxCode: '0101234567-001' } } })
    expect(customsFlags(r, [], '0101234567001').flags).toEqual([])
    expect(customsFlags(r, [], '0309999999').flags).toMatchObject([{ code: 'CUSTOMS_EXPORTER_MISMATCH', severity: 'high' }])
  })

  it('cổng RFQ: block/warn/off', () => {
    const none = mk('1')
    expect(customsGateCheck(none, 'block')).toMatchObject({ blocking: true, missing: ['tờ khai hải quan xuất khẩu'] })
    const pending = mk('1', { files: [{ key: 'k', name: 'a', kind: 'customs_export_declaration' }], customsInfo: { export: { clearance: 'pending' } } })
    expect(customsGateCheck(pending, 'block').missing).toEqual(['xác nhận tờ khai đã thông quan'])
    expect(customsGateCheck(none, 'warn').blocking).toBe(false)
    expect(customsGateCheck(none, 'off')).toEqual({ missing: [], warnings: [], blocking: false })
    const ok = mk('1', { files: [{ key: 'k', name: 'a', kind: 'customs_export_declaration' }], customsInfo: { export: { clearance: 'cleared' } } })
    expect(customsGateCheck(ok, 'block')).toMatchObject({ blocking: false, missing: [], warnings: ['vận đơn'] })
  })
})

describe('T1 theo 4 mục chứng từ', () => {
  it.each([[0, 20], [1, 40], [2, 60], [3, 80], [4, 100]])('%i mục → %i điểm', (n, pts) => {
    const on = [0, 1, 2, 3].map((k) => k < n)
    const docs = { xml: on[0], contract: on[1], delivery: on[2], customs: on[3] }
    const sc = { official: true, coverage: 1, score: 70, min: 60, max: 80, factors: [], flags: [] } as never
    const res = scoreApplication({ receivable: mk('1', { docs }), buyerScore: sc, supplierScore: sc })
    expect(res.factors.find((f) => f.code === 'T1')?.points).toBe(pts)
  })
})
