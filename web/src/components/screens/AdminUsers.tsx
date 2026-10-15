"use client";

import { useState } from "react";
import { useToast } from "@/components/providers/Toast";

type U = { name: string; org: string; role: string; perm: string; mfa: boolean; last: string; locked: boolean; group: "buy" | "sup" | "fin" | "adm" };

const USERS: U[] = [
  { name: "Nguyễn Lan", org: "Vật liệu Sao Mai", role: "Nhà cung cấp", perm: "Quản trị doanh nghiệp", mfa: true, last: "15/10 23:41", locked: false, group: "sup" },
  { name: "Trần Hùng", org: "Xây dựng Đông Á", role: "Người mua", perm: "Xác nhận hóa đơn, thanh toán", mfa: true, last: "15/10 22:10", locked: false, group: "buy" },
  { name: "Phạm Minh", org: "Quỹ Đầu tư Xanh", role: "Tổ chức tài chính", perm: "Thẩm định, phê duyệt", mfa: true, last: "16/10 09:02", locked: false, group: "fin" },
  { name: "Lê Hòa", org: "Vật liệu Sao Mai", role: "Nhà cung cấp", perm: "Tải & sửa hóa đơn", mfa: true, last: "15/10 17:35", locked: false, group: "sup" },
  { name: "Võ Thanh", org: "Thương mại Bảo Long", role: "Nhà cung cấp", perm: "Quản trị doanh nghiệp", mfa: false, last: "15/10 14:30", locked: true, group: "sup" },
  { name: "Đặng Vy", org: "FCC Operations", role: "Quản trị", perm: "Toàn quyền hệ thống", mfa: true, last: "16/10 08:15", locked: false, group: "adm" },
];

const FILTERS = [
  ["all", "Tất cả"],
  ["buy", "Người mua"],
  ["sup", "Nhà cung cấp"],
  ["fin", "TCTC"],
  ["adm", "Quản trị"],
] as const;

export function AdminUsers() {
  const toast = useToast();
  const [f, setF] = useState<(typeof FILTERS)[number][0]>("all");
  const [locked, setLocked] = useState<Record<string, boolean>>(Object.fromEntries(USERS.map((u) => [u.name, u.locked])));
  const list = USERS.filter((u) => f === "all" || u.group === f);

  return (
    <section id="users" className="card flush" style={{ scrollMarginTop: 80 }}>
      <div className="ch">
        <h2 className="ct">Người dùng & phân quyền</h2>
        <div className="seg" role="group" aria-label="Lọc theo vai trò">
          {FILTERS.map(([k, l]) => (
            <button key={k} className="seg-btn" aria-pressed={f === k} onClick={() => setF(k)}>
              {l}
            </button>
          ))}
        </div>
      </div>
      <div className="tw">
        <table>
          <thead>
            <tr>
              <th>Người dùng</th>
              <th>Tổ chức</th>
              <th>Vai trò</th>
              <th>Quyền</th>
              <th>MFA</th>
              <th>Đăng nhập gần nhất</th>
              <th>Trạng thái</th>
              <th>
                <span className="sr-only">Thao tác</span>
              </th>
            </tr>
          </thead>
          <tbody>
            {list.map((u) => {
              const isLocked = locked[u.name];
              return (
                <tr key={u.name}>
                  <td className="strong">{u.name}</td>
                  <td>{u.org}</td>
                  <td>
                    <span className="chip c-info">{u.role}</span>
                  </td>
                  <td>{u.perm}</td>
                  <td>
                    <span className={`chip ${u.mfa ? "c-ok" : "c-warn"}`}>{u.mfa ? "Bật" : "Chưa bật"}</span>
                  </td>
                  <td className="num">{u.last}</td>
                  <td>
                    <span className={`chip ${isLocked ? "c-bad" : "c-ok"}`}>{isLocked ? "Tạm khóa · nghi trùng lặp hóa đơn" : "Hoạt động"}</span>
                  </td>
                  <td>
                    <button
                      className={isLocked ? "btn bs sm" : "btn bd sm"}
                      onClick={() => {
                        setLocked((x) => ({ ...x, [u.name]: !isLocked }));
                        toast(isLocked ? `Đã mở khóa ${u.name}. Đã ghi lý do vào Audit Trail.` : `Đã tạm khóa ${u.name}.`);
                      }}
                    >
                      {isLocked ? "Mở khóa" : "Khóa"}
                    </button>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </section>
  );
}
