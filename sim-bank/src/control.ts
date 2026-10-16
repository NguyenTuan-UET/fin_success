// Trang điều khiển kịch bản của ngân hàng giả lập (HTML tĩnh, không thư viện).
import type { LogEntry } from './bank'

const esc = (s: string) => s.replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]!)

export function controlPage(insts: { slug: string; name: string; auto: boolean }[], overrides: [string, string][], log: LogEntry[]) {
  const rows = log.slice(0, 100).map((l) => `<tr class="${l.ok ? '' : 'bad'}"><td>${esc(l.at.slice(11, 19))}</td><td>${esc(l.slug)}</td><td>${esc(l.kind)}</td><td>${esc(l.detail)}</td></tr>`).join('')
  return `<!doctype html><html lang="vi"><head><meta charset="utf-8"><title>Ngân hàng giả lập — FCC</title>
<style>body{font:14px system-ui;margin:24px;color:#10201b}h1{font-size:20px}table{border-collapse:collapse;width:100%}td,th{border-bottom:1px solid #ddd;padding:6px;text-align:left;vertical-align:top}
tr.bad td{color:#9a1c13}.card{border:1px solid #ccd;border-radius:10px;padding:12px;margin:12px 0}button{margin:2px;padding:6px 10px;border-radius:8px;border:1px solid #0b6b53;background:#fff;cursor:pointer}
input,select{padding:6px;border-radius:8px;border:1px solid #bbb}.note{color:#5e6e67}</style></head><body>
<h1>Ngân hàng giả lập cho FCC</h1>
<p class="note">Các tổ chức dưới đây là hư cấu; mọi báo giá, quyết định và giải ngân là mô phỏng, đi qua đúng API đối tác và webhook của FCC.</p>
<div class="card"><b>Tổ chức</b><br>${insts.map((i) => `${esc(i.name)} — tự động: <b>${i.auto ? 'bật' : 'tắt'}</b> <button onclick="post('/control/auto',{slug:'${i.slug}',auto:${!i.auto}})">${i.auto ? 'Tắt' : 'Bật'} tự động</button>
 <button onclick="post('/control/replay',{slug:'${i.slug}',kind:'duplicate'})">Gửi lại giải ngân (trùng)</button>
 <button onclick="post('/control/replay',{slug:'${i.slug}',kind:'bad_signature'})">Gửi giải ngân sai chữ ký</button>`).join('<br>')}</div>
<div class="card"><b>Kịch bản cho một hồ sơ/RFQ</b><br>
<input id="id" placeholder="Mã hồ sơ hoặc RFQ"> <select id="b"><option value="approve">Duyệt</option><option value="reject">Từ chối</option><option value="decline_quote">Từ chối báo giá</option>
<option value="delay_disbursement">Trễ giải ngân ×10</option><option value="hold">Giữ lại</option><option value="partial_payment">Bên mua trả một phần (60%)</option><option value="no_payment">Không có tiền về</option><option value="auto">Theo khẩu vị (mặc định)</option></select>
<button onclick="post('/control/scenario',{id:document.getElementById('id').value,behavior:document.getElementById('b').value})">Áp dụng</button>
<div class="note">Đang ép: ${overrides.length ? overrides.map(([k, v]) => `${esc(k)} → ${esc(v)}`).join(', ') : 'không'}</div></div>
<table><thead><tr><th>Giờ (UTC)</th><th>Tổ chức</th><th>Loại</th><th>Chi tiết</th></tr></thead><tbody>${rows}</tbody></table>
<script>async function post(u,b){const r=await fetch(u,{method:'POST',headers:{'content-type':'application/json'},body:JSON.stringify(b)});alert(JSON.stringify(await r.json()));location.reload()}</script>
</body></html>`
}
