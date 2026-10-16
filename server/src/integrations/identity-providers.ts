// Điểm nối nhà cung cấp chữ ký số từ xa (remote signing) và eKYC. Mỗi nhà cung cấp là một adapter cài theo interface dưới,
// đăng ký bằng biến môi trường SIGNING_PROVIDER / EKYC_PROVIDER. Chưa có hợp đồng/tài liệu API của nhà cung cấp nào nên
// chưa có adapter; khi chưa cấu hình, hệ thống dùng đường thay thế thật:
//   - chữ ký: xác thực MFA + băm SHA-256 nội dung đã đồng ý (SignatureEvidence.method = 'mfa_snapshot')
//   - eKYC: FCC vận hành đối chiếu giấy tờ người đại diện đã tải lên (OrgKyc.method = 'manual_documents')

export interface RemoteSigner {
  readonly name: string
  /** Gửi yêu cầu ký băm nội dung cho người ký; trả về khi người ký xác nhận trên thiết bị của nhà cung cấp. */
  signHash(input: { contentSha256: string; signerId: string; signerName: string; reason: string }): Promise<{ signatureBase64: string; certificateSerial: string; signedAt: string }>
  /** Kiểm tra chữ ký và trạng thái chứng thư (OCSP/CRL) tại thời điểm ký. */
  verify(input: { contentSha256: string; signatureBase64: string; certificateSerial: string }): Promise<{ valid: boolean; reason?: string }>
}

export interface EkycProvider {
  readonly name: string
  /** Đối chiếu giấy tờ tùy thân + ảnh khuôn mặt; trả kết quả và mã giao dịch để lưu bằng chứng. */
  verifyPerson(input: { fullName: string; idDocumentKey: string; selfieKey?: string }): Promise<{ match: boolean; score: number; transactionId: string; reason?: string }>
}

const signers = new Map<string, () => RemoteSigner>()
const ekycs = new Map<string, () => EkycProvider>()

export const registerSigner = (name: string, make: () => RemoteSigner) => signers.set(name, make)
export const registerEkyc = (name: string, make: () => EkycProvider) => ekycs.set(name, make)

/** Adapter đang cấu hình, hoặc null (dùng đường thay thế). */
export function configuredSigner(): RemoteSigner | null {
  const n = process.env.SIGNING_PROVIDER
  if (!n) return null
  const make = signers.get(n)
  if (!make) throw new Error(`SIGNING_PROVIDER=${n} chưa có adapter`)
  return make()
}
export function configuredEkyc(): EkycProvider | null {
  const n = process.env.EKYC_PROVIDER
  if (!n) return null
  const make = ekycs.get(n)
  if (!make) throw new Error(`EKYC_PROVIDER=${n} chưa có adapter`)
  return make()
}

export function identityProviderStatus() {
  return {
    signing: process.env.SIGNING_PROVIDER ? { provider: process.env.SIGNING_PROVIDER } : { provider: null, fallback: 'MFA + băm nội dung (mfa_snapshot)' },
    ekyc: process.env.EKYC_PROVIDER ? { provider: process.env.EKYC_PROVIDER } : { provider: null, fallback: 'FCC đối chiếu giấy tờ (manual_documents)' },
  }
}
