// Vai trò theo SPEC_FCC_MVP mục 2 và ma trận quyền theo hành động nghiệp vụ.
// owner (chủ tổ chức) và fcc_admin được mọi quyền trong phạm vi loại tổ chức của mình; các vai trò khác theo bảng dưới.
import type { OrgType } from '@fcc/domain/types'

export type MemberRole =
  | 'owner' | 'approver' | 'operator' // bên bán, bên mua
  | 'analyst' | 'product_manager' // tổ chức tài chính (cùng owner)
  | 'fcc_admin' | 'fcc_reviewer' | 'fcc_operations' | 'fcc_model_owner' | 'fcc_auditor' // FCC

export const ROLES_BY_ORG: Record<OrgType, MemberRole[]> = {
  supplier: ['owner', 'approver', 'operator'],
  buyer: ['owner', 'approver', 'operator'],
  lender: ['owner', 'analyst', 'product_manager'],
  fcc: ['fcc_admin', 'fcc_reviewer', 'fcc_operations', 'fcc_model_owner', 'fcc_auditor'],
}

export const ROLE_LABEL: Record<MemberRole, string> = {
  owner: 'Chủ tổ chức', approver: 'Người phê duyệt', operator: 'Người lập hồ sơ', analyst: 'Chuyên viên thẩm định',
  product_manager: 'Quản lý sản phẩm', fcc_admin: 'Quản trị FCC', fcc_reviewer: 'Thẩm định tín dụng/ESG',
  fcc_operations: 'Vận hành FCC', fcc_model_owner: 'Chủ mô hình chấm điểm', fcc_auditor: 'Kiểm toán (chỉ đọc)',
}

/** Vai trò có toàn quyền trong loại tổ chức của mình. */
export const isAdminRole = (r: MemberRole) => r === 'owner' || r === 'fcc_admin'

/** Vai trò bắt buộc bật MFA trước khi thực hiện hành động nhạy cảm (SPEC mục 14). */
export const MFA_ROLES: MemberRole[] = ['owner', 'approver', 'analyst', 'product_manager', 'fcc_admin', 'fcc_reviewer', 'fcc_operations', 'fcc_model_owner']

const OPERATOR: string[] = [
  'createReceivable', 'sendToBuyer', 'reviseDisputed', 'cancelReceivable', 'ensureEsg', 'addEsgDocument', 'updateEsgMetrics',
  'updateIndicator', 'setEsgIndustry', 'upsertFinancialYear', 'updateProfile', 'saveCashProfile', 'importLedger', 'refreshListed',
  'addCollateral', 'removeCollateral', 'importJournal',
]
const ALWAYS: string[] = ['markNotificationsRead']

/** Hành động → vai trò (ngoài owner/fcc_admin) được phép. */
export const PERMISSIONS: Record<string, MemberRole[]> = {
  ...Object.fromEntries(OPERATOR.map((a) => [a, ['approver', 'operator'] as MemberRole[]])),
  // phê duyệt, cam kết, chia sẻ dữ liệu: không cho operator (SPEC mục 2)
  buyerDecision: ['approver'], markBuyerPaid: ['approver'], createRfq: ['approver'], selectQuote: ['approver'], cancelRfq: ['approver'],
  submitDirect: ['approver'], acceptOffer: ['approver'], revokeConsent: ['approver'], createEarlyOffer: ['approver'],
  acceptEarlyOffer: ['approver'], payEarlyOffer: ['approver'], grantConsent: ['approver'],
  // tổ chức tài chính
  respondRfq: ['analyst'], startReview: ['analyst'], makeOffer: ['analyst'], rejectApp: ['analyst'], fundApp: ['analyst'],
  upsertProduct: ['product_manager'], setProductStatus: ['product_manager'],
  // FCC
  approveProduct: ['fcc_operations'], verifyOrg: ['fcc_operations'], decideKyc: ['fcc_operations'],
  issueEsg: ['fcc_reviewer'],
  // chỉ owner/fcc_admin: updateOrg, submitKyc (không liệt kê)
  ...Object.fromEntries(ALWAYS.map((a) => [a, ['approver', 'operator', 'analyst', 'product_manager', 'fcc_reviewer', 'fcc_operations', 'fcc_model_owner', 'fcc_auditor'] as MemberRole[]])),
}

/** FCC reviewer cập nhật mức chỉ tiêu ESG khi thẩm định (cùng hành động doanh nghiệp tự khai). */
PERMISSIONS.updateIndicator = [...PERMISSIONS.updateIndicator, 'fcc_reviewer']
PERMISSIONS.setEsgIndustry = [...PERMISSIONS.setEsgIndustry, 'fcc_reviewer']

/** Hành động nhạy cảm: cần MFA trong STEP_UP_MS gần nhất (SPEC mục 2: chia sẻ dữ liệu, chọn báo giá, phát hành điểm…). */
export const STEP_UP_ACTIONS = new Set([
  'buyerDecision', 'acceptOffer', 'selectQuote', 'createRfq', 'submitDirect', 'grantConsent', 'issueEsg', 'fundApp', 'markBuyerPaid',
  'payEarlyOffer', 'decideKyc',
])
export const STEP_UP_MS = 10 * 60_000

export function canDo(role: MemberRole, action: string): boolean {
  // loại tổ chức được phép (bên bán, FCC…) do từng hành động tự kiểm tra trong service
  if (isAdminRole(role)) return true
  return (PERMISSIONS[action] ?? []).includes(role)
}
