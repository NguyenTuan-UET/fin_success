"use client";

import Link from "next/link";
import { Clock, FileSignature, Wallet } from "lucide-react";
import { Disclaimer, Kpi, PageHeader } from "@/components/ui/basic";
import { TodoTiles, type Todo } from "@/components/ui/TodoTiles";
import { date, money, vnd } from "@/lib/format";
import { APP_STATE_LABEL, orgName } from "@/lib/model";
import { useData } from "@/lib/session";
import { useScores } from "@/lib/scores";
import { Bar } from "@/components/ui/basic";

export default function LenderOverview() {
  const { data, org } = useData();
  const scores = useScores(data);
  const apps = data.applications.filter((a) => a.lenderId === org.id);
  const queue = apps.filter((a) => ["SUBMITTED", "UNDER_REVIEW"].includes(a.state));
  const accepted = apps.filter((a) => a.state === "ACCEPTED");
  const funded = apps.filter((a) => a.state === "FUNDED");
  const outstanding = funded.reduce((a, x) => a + (x.fundedAmount ?? x.offer?.advanceVnd ?? 0), 0);
  const settled = apps.filter((a) => a.state === "SETTLED");
  const rfqs = data.rfqs.filter((q) => ["OPEN", "RESPONDED"].includes(q.state));
  const products = data.products.filter((p) => p.lenderId === org.id);

  // dư nợ theo hạng hồ sơ
  const byRating = new Map<string, number>();
  for (const a of funded) {
    const r = data.receivables.find((x) => x.id === a.receivableId);
    if (!r) continue;
    const k = scores.application(r.id).rating;
    byRating.set(k, (byRating.get(k) ?? 0) + (a.fundedAmount ?? a.offer?.advanceVnd ?? 0));
  }

  const todos: Todo[] = [
    ...(!org.verified ? [{ icon: Clock, bg: "var(--warn-bg)", fg: "var(--warn)", title: "Tổ chức chờ FCC xác minh", note: "Sau khi được xác minh bạn mới đăng được sản phẩm", href: "/lender/marketplace", cta: "Xem" }] : []),
    ...(queue.length ? [{ icon: Clock, bg: "var(--info-bg)", fg: "var(--info)", title: `${queue.length} hồ sơ cần thẩm định`, note: "Hồ sơ có điểm 5C và ESG", href: "/lender/appraisal", cta: "Thẩm định" }] : []),
    ...(accepted.length ? [{ icon: Wallet, bg: "var(--ok-bg)", fg: "var(--ok)", title: `${accepted.length} hồ sơ chờ giải ngân`, note: "Doanh nghiệp đã chấp thuận", href: "/lender/appraisal", cta: "Giải ngân" }] : []),
    ...(rfqs.length && products.length ? [{ icon: FileSignature, bg: "var(--warn-bg)", fg: "var(--warn)", title: `${rfqs.length} RFQ đang mở`, note: "Trả báo giá trước hạn", href: "/lender/appraisal", cta: "Xem" }] : []),
  ];

  return (
    <>
      <PageHeader eyebrow="Tổng quan · Tổ chức tài chính" title={org.name} sub="Danh mục tài trợ, hàng đợi thẩm định và rủi ro đang theo dõi." />
      {todos.length > 0 ? <TodoTiles items={todos} /> : <section className="card empty">Chưa có việc cần làm.</section>}
      <section className="grid-kpi">
        <Kpi label="Dư nợ đang tài trợ" value={money(outstanding)} note={`${funded.length} khoản`} />
        <Kpi label="Hồ sơ chờ xử lý" value={String(queue.length)} note={`${accepted.length} chờ giải ngân`} />
        <Kpi label="Đã tất toán" value={String(settled.length)} note="khoản" />
        <Kpi label="Sản phẩm đang công bố" value={String(products.filter((p) => p.status === "published").length)} note={`${products.length} sản phẩm`} />
      </section>
      <section className="row top">
        <div className="card grow-2 stack-sm">
          <h2 className="ct">Dư nợ theo hạng hồ sơ</h2>
          {byRating.size === 0 && <span className="muted">Chưa có khoản đang tài trợ.</span>}
          {[...byRating].sort().map(([k, v]) => (
            <div key={k} style={{ display: "grid", gridTemplateColumns: "50px 1fr 120px", gap: 10, alignItems: "center" }}>
              <strong>{k}</strong><Bar value={outstanding ? (v / outstanding) * 100 : 0} /><span className="num r">{money(v)} đ</span>
            </div>
          ))}
        </div>
        <div className="card flush grow-2">
          <div className="ch"><h2 className="ct">Hồ sơ gần đây</h2><Link className="btn bs sm" href="/lender/appraisal">Thẩm định</Link></div>
          <div className="tw"><table>
            <thead><tr><th>Hồ sơ</th><th>Doanh nghiệp</th><th className="r">Giá trị (đ)</th><th>Trạng thái</th></tr></thead>
            <tbody>
              {apps.slice(0, 6).map((a) => { const r = data.receivables.find((x) => x.id === a.receivableId); return <tr key={a.id}><td className="num strong">{a.id}<div className="muted">{date(a.submittedAt)}</div></td><td>{r ? orgName(data.orgs, r.sellerId) : "—"}</td><td className="r num">{r ? vnd(r.amount) : "—"}</td><td><span className={`chip ${APP_STATE_LABEL[a.state].chip}`}>{APP_STATE_LABEL[a.state].label}</span></td></tr>; })}
              {apps.length === 0 && <tr><td colSpan={4} className="empty">Chưa có hồ sơ.</td></tr>}
            </tbody></table></div>
        </div>
      </section>
      <Disclaimer>Xếp hạng tham khảo FCC — không phải quyết định tín dụng. Tổ chức tài chính tự thẩm định, quyết định, ký hợp đồng và giải ngân.</Disclaimer>
    </>
  );
}
