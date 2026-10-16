// Chạy ngân hàng giả lập: đọc config.local.json (do server/scripts/provision-sim-bank.ts hoặc
// POST /v1/operations/sim-banks/provision tạo), đăng sản phẩm còn thiếu, lắng nghe webhook của FCC.
import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { createSimBank, type SimConfig } from './bank'

const path = resolve(process.env.SIM_CONFIG ?? 'config.local.json')
const raw = JSON.parse(readFileSync(path, 'utf8')) as SimConfig & { listen?: string }
const listen = new URL(raw.listen ?? 'http://127.0.0.1:8790')
if (!['127.0.0.1', 'localhost'].includes(listen.hostname) && process.env.SIM_ALLOW_REMOTE !== 'true') {
  throw new Error('Ngân hàng giả lập chỉ chạy trên localhost (đặt SIM_ALLOW_REMOTE=true nếu chủ ý triển khai riêng)')
}
const sim = createSimBank({ ...raw, disburseDelaySec: process.env.SIM_DISBURSE_DELAY_SEC ? Number(process.env.SIM_DISBURSE_DELAY_SEC) : raw.disburseDelaySec })
await sim.app.listen({ port: Number(listen.port || 8790), host: listen.hostname })
try {
  await sim.ensureProducts()
} catch (e) {
  sim.app.log.error(e, 'Không đăng được sản phẩm — FCC đã chạy và đã cấp phát tổ chức giả lập chưa?')
}
sim.app.log.info(`Bảng điều khiển: ${listen.origin}/`)
