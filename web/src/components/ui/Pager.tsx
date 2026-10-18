"use client";

/** Phân trang đơn giản cho bảng dài. */
export function Pager({ page, total, size, onPage }: { page: number; total: number; size: number; onPage: (p: number) => void }) {
  const pages = Math.max(1, Math.ceil(total / size));
  if (total <= size) return null;
  return (
    <div className="between" style={{ padding: "8px 16px 12px" }}>
      <span className="muted">{page * size + 1}–{Math.min(total, (page + 1) * size)} / {total}</span>
      <span className="row" style={{ gap: 6 }}>
        <button className="btn bs sm" disabled={page === 0} onClick={() => onPage(page - 1)}>Trước</button>
        <span className="muted num">Trang {page + 1}/{pages}</span>
        <button className="btn bs sm" disabled={page >= pages - 1} onClick={() => onPage(page + 1)}>Sau</button>
      </span>
    </div>
  );
}
