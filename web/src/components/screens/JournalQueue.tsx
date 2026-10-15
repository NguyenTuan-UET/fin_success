"use client";

import { useState } from "react";
import { Check } from "lucide-react";
import { useToast } from "@/components/providers/Toast";

export type Entry = { id: string; desc: string; acct: string; amount: string; conf: number };

export function JournalQueue({ entries, pending, readOnly }: { entries: Entry[]; pending: number; readOnly?: boolean }) {
  const toast = useToast();
  const [done, setDone] = useState<Record<string, boolean>>({});
  const left = pending - Object.keys(done).length;

  return (
    <>
      <div className="ch" style={{ padding: "16px 16px 0", marginTop: 8 }}>
        <h2 className="ct">Bút toán tự động chờ duyệt</h2>
        <span className={`chip ${left > 0 ? "c-warn" : "c-ok"}`}>{left > 0 ? `${left} chứng từ` : "Đã duyệt hết"}</span>
      </div>
      <div className="tw">
        <table>
          <thead>
            <tr>
              <th>Chứng từ</th>
              <th>Diễn giải</th>
              <th>Nợ / Có</th>
              <th className="r">Số tiền (đ)</th>
              <th className="r">Tin cậy</th>
              <th>
                <span className="sr-only">Thao tác</span>
              </th>
            </tr>
          </thead>
          <tbody>
            {entries.map((e) => {
              const low = e.conf < 90;
              return (
                <tr key={e.id}>
                  <td className="num">{e.id}</td>
                  <td className="wrap" style={{ minWidth: 150 }}>
                    {e.desc}
                  </td>
                  <td className="num wrap" style={{ minWidth: 110 }}>
                    {e.acct}
                  </td>
                  <td className="r num">{e.amount}</td>
                  <td className={`r num${low ? " t-warn strong" : ""}`}>{e.conf}%</td>
                  <td>
                    {readOnly ? (
                      <span className="muted">Chỉ xem</span>
                    ) : done[e.id] ? (
                      <span className="chip c-ok">
                        <Check size={13} aria-hidden="true" />
                        Đã duyệt
                      </span>
                    ) : (
                      <button
                        className="btn bs sm"
                        onClick={() => {
                          setDone((d) => ({ ...d, [e.id]: true }));
                          toast(low ? `Đã kiểm tra và duyệt ${e.id}.` : `Đã duyệt bút toán ${e.id}.`);
                        }}
                      >
                        {low ? "Kiểm tra" : "Duyệt"}
                      </button>
                    )}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </>
  );
}
