"use client";

import { useState } from "react";
import { KeyRound, Plus } from "lucide-react";
import { PageHeader } from "@/components/ui/basic";
import { useToast } from "@/components/providers/Toast";
import { ROLES, type Role } from "@/lib/roles";

const NOTIFS: [string, string][] = [
  ["due", "Hóa đơn sắp đến hạn / quá hạn"],
  ["liq", "Cảnh báo thiếu hụt thanh khoản"],
  ["offer", "Đề xuất tài trợ từ AI"],
  ["week", "Báo cáo dòng tiền hằng tuần"],
];

const SHARES_OUT: [string, string, string][] = [
  ["xanh", "Quỹ Đầu tư Xanh", "Hồ sơ TT-0418 · hóa đơn, BCTC, ESG · đến 13/01/2027"],
  ["ta", "Ngân hàng TMCP Thịnh An", "Khoản TT-0401 · dòng tiền, hóa đơn · đến 14/12/2026"],
  ["hd", "Ngân hàng Hải Đăng", "Khoản TT-0405 · dòng tiền, hóa đơn · đến 20/11/2026"],
  ["vl", "Công ty Tài chính Vạn Lộc", "Chào giá 09/2026 · không chọn"],
];

const SHARES_IN: [string, string][] = [
  ["Vật liệu Sao Mai", "TT-0418 · hóa đơn, BCTC, ESG, kế toán (chỉ đọc) · đến 13/01/2027"],
  ["Điện cơ Nam Việt", "TT-0533 · hóa đơn, BCTC, ESG · đến 05/12/2026"],
  ["Bao bì Hòa Khánh", "TT-0529 · gói tóm tắt RFQ · đến 22/10/2026"],
];

const POLICIES: [string, string][] = [
  ["mfa", "Bắt buộc MFA khi phê duyệt tài trợ"],
  ["dup", "Tự động khóa hóa đơn nghi trùng lặp"],
  ["geo", "Cảnh báo đăng nhập từ vị trí lạ"],
  ["two", "Phê duyệt hai người khi đổi phiên bản bộ chấm điểm"],
];

const AUDIT = [
  ["16/10 09:02", "Phạm Minh · Quỹ Đầu tư Xanh", "Xem hồ sơ tín dụng", "TT-0418", "203.0.113.24"],
  ["15/10 23:55", "Nguyễn Lan", "Gửi hồ sơ & cấp quyền chia sẻ", "Quỹ Đầu tư Xanh", "198.51.100.7"],
  ["15/10 23:41", "Nguyễn Lan", "Đăng nhập (MFA)", "—", "198.51.100.7"],
  ["15/10 18:20", "Hệ thống", "Tái chấm ESG", "74 · Khá", "—"],
];

function Switch({ on, label, onClick }: { on: boolean; label: string; onClick: () => void }) {
  return (
    <div className="between">
      <span style={{ fontSize: 13.5 }}>{label}</span>
      <button className="switch" role="switch" aria-checked={on} aria-label={label} onClick={onClick} />
    </div>
  );
}

export function SettingsPanel({ role }: { role: Role }) {
  const toast = useToast();
  const meta = ROLES[role];
  const [n, setN] = useState<Record<string, boolean>>({ due: true, liq: true, offer: true, week: false });
  const [s, setS] = useState<Record<string, boolean>>({ xanh: true, ta: true, hd: true, vl: false });
  const [p, setP] = useState<Record<string, boolean>>({ mfa: true, dup: true, geo: true, two: true });
  const isBusiness = role === "supplier" || role === "buyer";
  const orgFull =
    role === "supplier" ? "Công ty TNHH Vật liệu Sao Mai" : role === "buyer" ? "CTCP Xây dựng Đông Á" : role === "lender" ? "Quỹ Đầu tư Xanh" : "FCC Operations";

  return (
    <>
      <PageHeader
        eyebrow={role === "admin" ? "Cài đặt hệ thống" : "Cài đặt"}
        title={role === "admin" ? "Chính sách nền tảng & bảo mật" : "Tài khoản, tích hợp & bảo mật"}
        sub={
          isBusiness
            ? `${orgFull} · Bạn chủ động cấp và thu hồi quyền chia sẻ dữ liệu với từng tổ chức tài chính.`
            : `${orgFull} · Quản lý người dùng, bảo mật và quyền truy cập dữ liệu.`
        }
      />
      <section className="row top">
        <div className="stack grow-1" style={{ flexBasis: 420 }}>
          <div className="card stack-sm" style={{ gap: 14 }}>
            <h2 className="ct">Chung</h2>
            <div className="grid-fields" style={{ gridTemplateColumns: "repeat(auto-fit, minmax(min(180px, 100%), 1fr))" }}>
              <label className="field">
                <span className="field-label">Ngôn ngữ</span>
                <select className="select" defaultValue="vi">
                  <option value="vi">Tiếng Việt</option>
                  <option value="en">English</option>
                </select>
              </label>
              <label className="field">
                <span className="field-label">Đơn vị hiển thị</span>
                <select className="select" defaultValue="short">
                  <option value="short">Triệu / tỷ đồng</option>
                  <option value="full">Đồng đầy đủ</option>
                </select>
              </label>
            </div>
            <span className="field-label">Thông báo email</span>
            {NOTIFS.map(([k, label]) => (
              <Switch key={k} on={!!n[k]} label={label} onClick={() => setN((x) => ({ ...x, [k]: !x[k] }))} />
            ))}
          </div>

          {role !== "admin" && (
            <div className="card stack-sm" style={{ gap: 12 }}>
              <div className="between">
                <h2 className="ct">Kết nối ngân hàng</h2>
                <span className="chip c-ok">2 tài khoản</span>
              </div>
              {[
                ["TA", "Ngân hàng TMCP Thịnh An", "•••• 4821 · tài khoản thanh toán"],
                ["HĐ", "Ngân hàng Hải Đăng", "•••• 0937 · tài khoản chuyên thu"],
              ].map(([ini, name, acc]) => (
                <div key={name} style={{ display: "flex", gap: 12, alignItems: "center", padding: 12, border: "1px solid var(--line-2)", borderRadius: 12 }}>
                  <span className="todo-ic" style={{ background: "var(--info-bg)", color: "var(--info)", fontWeight: 700, fontSize: 13 }}>
                    {ini}
                  </span>
                  <div style={{ flex: "1 1 auto" }}>
                    <strong style={{ fontSize: 13.5 }}>{name}</strong>
                    <div className="muted num">{acc}</div>
                  </div>
                  <span className="chip c-ok">Đồng bộ</span>
                </div>
              ))}
              <button className="btn bs" style={{ alignSelf: "flex-start" }} onClick={() => toast("Mở luồng liên kết tài khoản ngân hàng (bản mock).")}>
                <Plus size={16} aria-hidden="true" />
                Thêm tài khoản
              </button>
              <p className="muted">FCC chỉ lưu thông tin tài khoản nhận tiền, không giữ tiền và không chuyển tiền thay doanh nghiệp.</p>
            </div>
          )}

          {role !== "admin" && (
            <div className="card stack-sm" style={{ gap: 4 }}>
              <h2 className="ct" style={{ marginBottom: 6 }}>
                Tích hợp phần mềm kế toán & hóa đơn điện tử
              </h2>
              {[
                ["Nhà cung cấp hóa đơn điện tử", "API · đồng bộ mỗi 15 phút", true],
                ["MISA AMIS Kế toán", "Công nợ 131/331, số dư 111/112, BCTC · chỉ đọc", false],
                ["SAP Business One", "Hóa đơn, công nợ, tồn kho · chỉ đọc", false],
                ["Odoo", "Kế toán & bán hàng · chỉ đọc", false],
              ].map(([name, note, on]) => (
                <div key={name as string} className="between" style={{ padding: "10px 0", borderBottom: "1px solid var(--line-2)" }}>
                  <div>
                    <strong style={{ fontSize: 13.5 }}>{name}</strong>
                    <div className="muted">{note}</div>
                  </div>
                  {on ? (
                    <span className="chip c-ok">Đã kết nối</span>
                  ) : (
                    <button className="btn bs sm" onClick={() => toast(`Đang chuyển tới trang ủy quyền ${name} (bản mock).`)}>
                      Kết nối
                    </button>
                  )}
                </div>
              ))}
              <div className="between" style={{ padding: "10px 0" }}>
                <div>
                  <strong style={{ fontSize: 13.5 }}>Nhập file định kỳ</strong>
                  <div className="muted">Excel/CSV/XML theo mẫu FCC · có kiểm tra lỗi theo dòng</div>
                </div>
                <button className="btn bs sm" onClick={() => toast("Đã tải mẫu file nhập liệu FCC (bản mock).")}>
                  Tải mẫu
                </button>
              </div>
            </div>
          )}
        </div>

        <div className="stack grow-1" style={{ flexBasis: 420 }}>
          <div className="card stack-sm" style={{ gap: 12 }}>
            <h2 className="ct">Bảo mật</h2>
            {[
              ["Xác thực 2 lớp (MFA)", "Ứng dụng xác thực · bắt buộc khi phê duyệt tài trợ", "Đang bật"],
              ["eKYC người đại diện", "Xác minh khuôn mặt & giấy tờ", "Đã xác minh"],
              ["Chữ ký số", "Ký hợp đồng tài trợ & xác nhận hóa đơn", "Hiệu lực đến 08/2027"],
            ].map(([t, d, c]) => (
              <div key={t} className="between">
                <div>
                  <strong style={{ fontSize: 13.5 }}>{t}</strong>
                  <div className="muted">{d}</div>
                </div>
                <span className="chip c-ok">{c}</span>
              </div>
            ))}
            <div className="divider" style={{ display: "flex", flexWrap: "wrap", gap: 6 }}>
              {["AES-256", "TLS", "Tokenization", "RBAC", "Hướng tới ISO/IEC 27001 · PCI DSS"].map((x) => (
                <span key={x} className="chip c-neu">
                  {x}
                </span>
              ))}
            </div>
          </div>

          {isBusiness && (
            <div className="card stack-sm" style={{ gap: 4 }}>
              <div className="between" style={{ marginBottom: 6 }}>
                <h2 className="ct">Quyền chia sẻ dữ liệu</h2>
                <span className="muted">{Object.values(s).filter(Boolean).length} tổ chức đang có quyền</span>
              </div>
              {SHARES_OUT.map(([k, name, scope]) => {
                const on = !!s[k];
                return (
                  <div key={k} className="between" style={{ flexWrap: "wrap", padding: "10px 0", borderTop: "1px solid var(--line-2)" }}>
                    <div style={{ minWidth: 0 }}>
                      <strong style={{ fontSize: 13.5 }}>{name}</strong>
                      <div className="muted">{scope}</div>
                    </div>
                    <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
                      <span className={`chip ${on ? "c-ok" : "c-neu"}`}>{on ? "Đang chia sẻ" : "Đã thu hồi"}</span>
                      <button
                        className={on ? "btn bd sm" : "btn bs sm"}
                        onClick={() => {
                          setS((x) => ({ ...x, [k]: !on }));
                          toast(on ? `Đã thu hồi quyền xem dữ liệu của ${name}.` : `Đã cấp lại quyền cho ${name}.`);
                        }}
                      >
                        {on ? "Thu hồi" : "Cấp lại"}
                      </button>
                    </div>
                  </div>
                );
              })}
            </div>
          )}

          {role === "lender" && (
            <div className="card stack-sm" style={{ gap: 4 }}>
              <div className="between" style={{ marginBottom: 6 }}>
                <h2 className="ct">Dữ liệu doanh nghiệp chia sẻ với bạn</h2>
                <span className="muted">{SHARES_IN.length} doanh nghiệp</span>
              </div>
              {SHARES_IN.map(([name, scope]) => (
                <div key={name} className="between" style={{ flexWrap: "wrap", padding: "10px 0", borderTop: "1px solid var(--line-2)" }}>
                  <div>
                    <strong style={{ fontSize: 13.5 }}>{name}</strong>
                    <div className="muted">{scope}</div>
                  </div>
                  <span className="chip c-ok">Đang hiệu lực</span>
                </div>
              ))}
              <p className="muted" style={{ marginTop: 6 }}>
                Doanh nghiệp có thể thu hồi quyền bất kỳ lúc nào; mọi lượt xem của bạn đều được ghi vào Audit Trail.
              </p>
            </div>
          )}

          {role === "admin" && (
            <div className="card stack-sm" style={{ gap: 12 }}>
              <h2 className="ct">Chính sách bảo mật hệ thống</h2>
              {POLICIES.map(([k, label]) => (
                <Switch
                  key={k}
                  on={!!p[k]}
                  label={label}
                  onClick={() => {
                    setP((x) => ({ ...x, [k]: !x[k] }));
                    toast("Thay đổi chính sách cần người thứ hai phê duyệt trước khi có hiệu lực.");
                  }}
                />
              ))}
              <button className="btn bs" style={{ alignSelf: "flex-start" }} onClick={() => toast("Đã tạo API key mới cho đối tác (bản mock).")}>
                <KeyRound size={16} aria-hidden="true" />
                Quản lý API key đối tác
              </button>
            </div>
          )}

          <div className="card stack-sm" style={{ gap: 10 }}>
            <h2 className="ct">Người dùng {role === "admin" ? "vận hành" : role === "lender" ? "tổ chức" : "doanh nghiệp"}</h2>
            {(role === "supplier"
              ? [
                  ["Nguyễn Lan", "Kế toán trưởng", "Quản trị", "c-info"],
                  ["Đỗ Quang", "Giám đốc", "Phê duyệt tài trợ", "c-info"],
                  ["Lê Hòa", "Kế toán viên", "Tải & sửa hóa đơn", "c-neu"],
                ]
              : role === "buyer"
                ? [
                    ["Trần Hùng", "Giám đốc tài chính", "Xác nhận & phê duyệt", "c-info"],
                    ["Mai Anh", "Kế toán công nợ", "Đối chiếu 3 chiều", "c-neu"],
                  ]
                : role === "lender"
                  ? [
                      ["Phạm Minh", "Chuyên viên thẩm định", "Thẩm định, đề xuất", "c-info"],
                      ["Hồ Ngọc", "Quản lý sản phẩm", "Đăng & sửa gói tài trợ", "c-info"],
                    ]
                  : [
                      ["Đặng Vy", "Vận hành", "Toàn quyền hệ thống", "c-info"],
                      ["Kiểm toán viên", "Chỉ đọc", "Xem nhật ký có lý do", "c-neu"],
                    ]
            ).map(([name, title, perm, chip]) => (
              <div key={name} className="between" style={{ fontSize: 13 }}>
                <span>
                  <strong>{name}</strong> · {title}
                </span>
                <span className={`chip ${chip}`}>{perm}</span>
              </div>
            ))}
            <button className="btn bs" style={{ alignSelf: "flex-start" }} onClick={() => toast("Đã gửi lời mời qua email (bản mock).")}>
              Mời người dùng
            </button>
          </div>
        </div>
      </section>

      <section className="card flush">
        <div className="ch">
          <h2 className="ct">Nhật ký truy cập (Audit Trail)</h2>
          <button className="btn bs sm" onClick={() => toast("Đã xuất nhật ký truy cập (bản mock).")}>
            Xuất nhật ký
          </button>
        </div>
        <div className="tw">
          <table>
            <thead>
              <tr>
                <th>Thời gian</th>
                <th>Chủ thể</th>
                <th>Hành động</th>
                <th>Đối tượng</th>
                <th>Địa chỉ IP</th>
              </tr>
            </thead>
            <tbody>
              {AUDIT.map(([t, who, act, obj, ip]) => (
                <tr key={t + act}>
                  <td className="num">{t}</td>
                  <td>{who}</td>
                  <td>{act}</td>
                  <td>{obj}</td>
                  <td className="num">{ip}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <p className="muted" style={{ padding: "10px 16px 14px" }}>
          Đang đăng nhập: {meta.user.name} · {meta.user.title}. Địa chỉ IP trong bản mock là địa chỉ mẫu dành cho tài liệu.
        </p>
      </section>
    </>
  );
}
