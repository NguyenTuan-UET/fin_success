import Link from "next/link";
import {
  ArrowRight,
  Building2,
  Factory,
  FileCheck2,
  Fingerprint,
  Landmark,
  Leaf,
  Lock,
  ScrollText,
  Settings2,
  ShieldCheck,
  Sparkles,
} from "lucide-react";
import { Logo } from "@/components/ui/basic";

const ROLE_CARDS = [
  {
    href: "/supplier",
    icon: Factory,
    bg: "var(--ok-bg)",
    fg: "var(--ok)",
    who: "Tôi là nhà cung cấp",
    sub: "SME bán chịu, chờ tiền 30–90 ngày",
    points: ["Biết trước ngày nào thiếu tiền", "Rút ngắn thời gian nhận tiền (mục tiêu T+1, tùy bên tài trợ)", "So sánh chi phí giữa các tổ chức tài trợ tham gia"],
  },
  {
    href: "/buyer",
    icon: Building2,
    bg: "var(--info-bg)",
    fg: "var(--info)",
    who: "Tôi là người mua",
    sub: "Doanh nghiệp đầu chuỗi, CFO",
    points: ["Xác nhận hóa đơn ngay trên nền tảng", "Trả sớm khi có lợi hơn gửi tiết kiệm", "Theo dõi ESG nhà cung cấp"],
  },
  {
    href: "/lender",
    icon: Landmark,
    bg: "var(--gold-bg)",
    fg: "var(--gold)",
    who: "Tôi là tổ chức tài chính",
    sub: "Ngân hàng, quỹ, công ty tài chính",
    points: ["Hồ sơ số kèm điểm tham khảo 5C & ESG", "Mục tiêu thẩm định 1–2 ngày (tùy hồ sơ)", "Cảnh báo sớm sau giải ngân"],
  },
  {
    href: "/admin",
    icon: Settings2,
    bg: "var(--violet-bg)",
    fg: "var(--violet)",
    who: "Tôi vận hành nền tảng",
    sub: "Quản trị FCC",
    points: ["Người dùng & phân quyền RBAC", "Chống trùng lặp hóa đơn", "Theo dõi phí dịch vụ minh bạch"],
  },
];

const FLOW = [
  ["01", "Tải hóa đơn", "OCR/AI đọc và kiểm tra trùng lặp"],
  ["02", "Người mua xác nhận", "Đối chiếu hóa đơn, hợp đồng và giao nhận"],
  ["03", "Chấm điểm 5C + ESG", "Điểm tham khảo có lý do; bên tài trợ quyết định"],
  ["04", "So sánh & chọn gói", "Nhiều tổ chức, chi phí minh bạch"],
  ["05", "Giải ngân theo bên tài trợ", "Mục tiêu T+1/T+2; tổ chức tài chính quyết định và chuyển trực tiếp"],
  ["06", "Thu hồi & tất toán", "Người mua trả, phần dư hoàn lại"],
];

export default function Landing() {
  return (
    <div className="landing">
      <div className="landing-inner">
        <header className="between">
          <Link href="/" className="brand">
            <Logo size={38} />
            <span className="brand-name">
              <strong>FCC</strong>
              <span>Fast Cash Connect</span>
            </span>
          </Link>
          <span className="chip c-neu lg">Fin Success · HVNH 2026</span>
        </header>

        <section className="hero">
          <div className="stack" style={{ gap: 20 }}>
            <span className="chip c-lime lg" style={{ alignSelf: "flex-start" }}>
              <Sparkles size={15} aria-hidden="true" />
              Tối ưu dòng tiền · Đẩy nhanh thanh toán · Vươn tầm chuỗi cung ứng
            </span>
            <h1>
              Hóa đơn đã giao hàng, <em>tiền không cần chờ</em> 60 ngày.
            </h1>
            <p className="hero-lead">
              FCC giúp doanh nghiệp vừa và nhỏ biến khoản phải thu đã được người mua xác nhận thành tiền mặt sớm, với chi phí so sánh
              minh bạch giữa các tổ chức tài trợ tham gia. Điểm tín dụng và ESG là điểm tham khảo, đi kèm lời giải thích; quyết định cấp vốn thuộc về tổ chức tài chính.
            </p>
            <div style={{ display: "flex", flexWrap: "wrap", gap: 10 }}>
              <Link href="/supplier" className="btn bp" style={{ minHeight: 48, padding: "0 22px", fontSize: 15 }}>
                Trải nghiệm ngay
                <ArrowRight size={18} aria-hidden="true" />
              </Link>
              <a href="#roles" className="btn bs" style={{ minHeight: 48, padding: "0 22px", fontSize: 15 }}>
                Chọn vai trò khác
              </a>
            </div>
            <div style={{ display: "flex", flexWrap: "wrap", gap: "8px 20px" }} className="muted">
              <span>
                <strong className="num" style={{ color: "var(--ink)" }}>
                  77,1%
                </strong>{" "}
                SME quan tâm nhận tiền sớm (khảo sát 180 phiếu của nhóm)
              </span>
              <span>
                <strong className="num" style={{ color: "var(--ink)" }}>
                  9,8%
                </strong>{" "}
                từng được tiếp cận
              </span>
              <span>
                <strong className="num" style={{ color: "var(--ink)" }}>
                  1–2 ngày
                </strong>{" "}
                thẩm định (mục tiêu, chưa phải cam kết)
              </span>
            </div>
          </div>

          <div className="hero-visual" aria-label="Ví dụ hóa đơn được tài trợ">
            <div className="between">
              <span className="d-title" style={{ display: "flex", gap: 8, alignItems: "center", color: "#fff", fontWeight: 600 }}>
                <FileCheck2 size={18} color="#DDF1C4" aria-hidden="true" />
                HD-0418 · Xây dựng Đông Á
              </span>
              <span className="chip c-lime">Người mua đã xác nhận</span>
            </div>
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
              <div style={{ background: "var(--forest-2)", borderRadius: 12, padding: 14 }}>
                <div style={{ fontSize: 12.5, color: "var(--on-forest-2)" }}>Giá trị hóa đơn</div>
                <div className="num" style={{ fontSize: 22, fontWeight: 600, color: "#fff" }}>
                  2,00 tỷ
                </div>
                <div style={{ fontSize: 12, color: "var(--on-forest-2)" }}>đến hạn sau 90 ngày</div>
              </div>
              <div style={{ background: "var(--lime)", color: "var(--forest)", borderRadius: 12, padding: 14 }}>
                <div style={{ fontSize: 12.5 }}>Dự kiến nhận (mục tiêu T+1)</div>
                <div className="num" style={{ fontSize: 22, fontWeight: 700 }}>
                  1,60 tỷ
                </div>
                <div style={{ fontSize: 12 }}>minh họa: ứng 80% · 5,9%/năm</div>
              </div>
            </div>
            <div style={{ display: "flex", gap: 2, height: 14, borderRadius: 6, overflow: "hidden" }} aria-hidden="true">
              <span style={{ width: "80%", background: "#4E9E85" }} />
              <span style={{ width: "1.2%", background: "#E4A157" }} />
              <span style={{ flex: "1 1 auto", background: "#7FA9DE" }} />
            </div>
            <div style={{ display: "flex", flexWrap: "wrap", gap: "6px 16px", fontSize: 12.5, color: "var(--on-forest)" }}>
              <span>■ Ứng trước 1,60 tỷ</span>
              <span>■ Lãi 90 ngày 23,3 tr</span>
              <span>■ Hoàn lại khi người mua trả 376,7 tr</span>
            </div>
            <div style={{ fontSize: 12, color: "var(--on-forest-2)" }}>
              Ví dụ minh họa, không phải cam kết hay báo giá. Giả định: tính 365 ngày, lãi thu cuối kỳ, chưa gồm phí FCC, phí bên tài trợ và thuế; việc tài trợ do tổ chức tài chính quyết định.
            </div>
            <div
              style={{
                display: "flex",
                gap: 10,
                alignItems: "flex-start",
                background: "var(--forest-2)",
                borderRadius: 12,
                padding: 12,
                fontSize: 13,
                color: "var(--on-forest)",
              }}
            >
              <Sparkles size={16} color="#DDF1C4" style={{ flex: "0 0 auto", marginTop: 2 }} aria-hidden="true" />
              <span>
                Ví dụ: “Ngày 28/10 bạn có thể thiếu 420 tr. Tài trợ HD-0412 đủ bù với chi phí thấp nhất.” — Trợ lý FCC
              </span>
            </div>
          </div>
        </section>

        <section id="roles" className="stack" aria-labelledby="roles-title">
          <div className="ph-text">
            <span className="eyebrow">Bạn là ai?</span>
            <h2 id="roles-title" style={{ fontSize: 24, letterSpacing: "-0.02em" }}>
              Mỗi vai trò có một không gian làm việc riêng
            </h2>
          </div>
          <div className="role-cards">
            {ROLE_CARDS.map((r) => (
              <Link key={r.href} href={r.href} className="role-card">
                <span className="role-ic" style={{ background: r.bg, color: r.fg }}>
                  <r.icon size={22} aria-hidden="true" />
                </span>
                <span>
                  <strong style={{ fontSize: 16 }}>{r.who}</strong>
                  <span className="muted" style={{ display: "block" }}>
                    {r.sub}
                  </span>
                </span>
                <ul>
                  {r.points.map((p) => (
                    <li key={p}>{p}</li>
                  ))}
                </ul>
                <span className="strong" style={{ color: "var(--brand)", marginTop: "auto" }}>
                  Vào không gian làm việc →
                </span>
              </Link>
            ))}
          </div>
        </section>

        <section className="stack" aria-labelledby="flow-title">
          <div className="ph-text">
            <span className="eyebrow">Vòng tuần hoàn khép kín</span>
            <h2 id="flow-title" style={{ fontSize: 24, letterSpacing: "-0.02em" }}>
              Từ hóa đơn đến tiền về tài khoản
            </h2>
          </div>
          <ol className="flow">
            {FLOW.map(([n, t, d]) => (
              <li key={n}>
                <span className="num muted">{n}</span>
                <strong>{t}</strong>
                <span className="muted">{d}</span>
              </li>
            ))}
          </ol>
        </section>

        <section className="card" style={{ display: "flex", flexWrap: "wrap", gap: "14px 28px", alignItems: "center" }}>
          <strong style={{ display: "flex", alignItems: "center", gap: 8 }}>
            <ShieldCheck size={18} color="var(--brand)" aria-hidden="true" />
            An toàn & minh bạch
          </strong>
          {[
            [Lock, "Tệp chứng từ lưu mã hóa · TLS"],
            [Fingerprint, "MFA cho thao tác nhạy cảm · eKYC, chữ ký số: kế hoạch"],
            [ScrollText, "Nhật ký thao tác nối chuỗi băm"],
            [Leaf, "ESG 18 chỉ tiêu: khung nội bộ, không phải chứng nhận xanh"],
          ].map(([Icon, label]) => {
            const I = Icon as typeof Lock;
            return (
              <span key={label as string} className="muted" style={{ display: "flex", alignItems: "center", gap: 6, fontSize: 13 }}>
                <I size={16} aria-hidden="true" />
                {label as string}
              </span>
            );
          })}
          <span className="muted" style={{ flexBasis: "100%" }}>
            FCC không giữ tiền, không cho vay và không tự quyết định tín dụng. Điểm số là tham khảo; giá do tổ chức tài chính công bố.
          </span>
        </section>
      </div>
    </div>
  );
}
