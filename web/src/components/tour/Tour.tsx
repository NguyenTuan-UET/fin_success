"use client";

import { usePathname, useRouter } from "next/navigation";
import { createContext, useCallback, useContext, useEffect, useLayoutEffect, useRef, useState, useSyncExternalStore, type ReactNode } from "react";
import { X } from "lucide-react";
import type { Role } from "@/lib/roles";
import { TOURS } from "@/lib/tours";

type Ctx = { start: (role: Role) => void; seen: (role: Role) => boolean };
const TourCtx = createContext<Ctx>({ start: () => {}, seen: () => true });
export const useTour = () => useContext(TourCtx);

/** Đã xem hướng dẫn của vai trò này chưa (để nhắc ở nút mở hướng dẫn). */
const seenKey = (role: Role) => `fcc.tour.seen.${role}`;
const SEEN_EVENT = "fcc-tour-seen";
const subscribeSeen = (cb: () => void) => {
  window.addEventListener(SEEN_EVENT, cb);
  window.addEventListener("storage", cb);
  return () => {
    window.removeEventListener(SEEN_EVENT, cb);
    window.removeEventListener("storage", cb);
  };
};
const seenSnapshot = () => Object.keys(TOURS).filter((r) => window.localStorage.getItem(seenKey(r as Role))).join(",");
const markSeen = (role: Role) => {
  window.localStorage.setItem(seenKey(role), "1");
  window.dispatchEvent(new Event(SEEN_EVENT));
};

const PAD = 8; // khoảng hở quanh vùng làm nổi bật
const GAP = 14; // khoảng cách vùng nổi bật → hộp hướng dẫn
const EDGE = 12; // lề tối thiểu với mép màn hình
const WAIT_MS = 4000; // chờ trang mới hiển thị phần tử cần chỉ

type Box = { top: number; left: number; width: number; height: number };

/** Phần tử đầu tiên trong danh sách đang thực sự hiển thị (bỏ qua menu đã trượt ra ngoài trên điện thoại). */
function findVisible(selectors: string[]): HTMLElement | null {
  for (const sel of selectors) {
    for (const el of document.querySelectorAll<HTMLElement>(sel)) {
      const r = el.getBoundingClientRect();
      if (r.width === 0 || r.height === 0 || r.right <= 0 || r.left >= window.innerWidth) continue;
      if (getComputedStyle(el).visibility === "hidden") continue;
      return el;
    }
  }
  return null;
}

function boxOf(el: HTMLElement): Box {
  const r = el.getBoundingClientRect();
  // vùng nổi bật không vượt quá màn hình (phần tử cao hơn màn hình vẫn đọc được hộp hướng dẫn)
  const top = Math.max(r.top - PAD, EDGE / 2);
  const bottom = Math.min(r.bottom + PAD, window.innerHeight - EDGE / 2);
  const left = Math.max(r.left - PAD, EDGE / 2);
  const right = Math.min(r.right + PAD, window.innerWidth - EDGE / 2);
  return { top, left, width: Math.max(0, right - left), height: Math.max(0, bottom - top) };
}

/** Đặt hộp hướng dẫn: dưới → trên → phải → trái vùng nổi bật; không vừa thì nằm đáy màn hình. */
function placePop(box: Box | null, w: number, h: number) {
  const vw = window.innerWidth;
  const vh = window.innerHeight;
  const clampX = (x: number) => Math.min(Math.max(x, EDGE), vw - w - EDGE);
  const clampY = (y: number) => Math.min(Math.max(y, EDGE), vh - h - EDGE);
  if (!box) return { top: clampY((vh - h) / 2), left: clampX((vw - w) / 2) };
  const cx = box.left + box.width / 2 - w / 2;
  if (box.top + box.height + GAP + h <= vh - EDGE) return { top: box.top + box.height + GAP, left: clampX(cx) };
  if (box.top - GAP - h >= EDGE) return { top: box.top - GAP - h, left: clampX(cx) };
  if (box.left + box.width + GAP + w <= vw - EDGE) return { top: clampY(box.top), left: box.left + box.width + GAP };
  if (box.left - GAP - w >= EDGE) return { top: clampY(box.top), left: box.left - GAP - w };
  return { top: vh - h - EDGE, left: clampX(cx) };
}

export function TourProvider({ children }: { children: ReactNode }) {
  const [run, setRun] = useState<{ role: Role; idx: number } | null>(null);
  const seenList = useSyncExternalStore(subscribeSeen, seenSnapshot, () => Object.keys(TOURS).join(","));
  const seen = useCallback((role: Role) => seenList.split(",").includes(role), [seenList]);
  const start = useCallback((role: Role) => setRun({ role, idx: 0 }), []);
  return (
    <TourCtx.Provider value={{ start, seen }}>
      {children}
      {run && (
        <TourOverlay
          key={run.role}
          role={run.role}
          idx={run.idx}
          setIdx={(idx) => setRun({ role: run.role, idx })}
          close={() => {
            markSeen(run.role);
            setRun(null);
          }}
        />
      )}
    </TourCtx.Provider>
  );
}

function TourOverlay({ role, idx, setIdx, close }: { role: Role; idx: number; setIdx: (i: number) => void; close: () => void }) {
  const steps = TOURS[role];
  const step = steps[idx];
  const last = idx === steps.length - 1;
  const pathname = usePathname();
  const router = useRouter();
  const [found, setFound] = useState<{ idx: number; el: HTMLElement | null } | null>(null);
  const [box, setBox] = useState<Box | null>(null);
  const [pos, setPos] = useState<{ top: number; left: number } | null>(null);
  const popRef = useRef<HTMLDivElement>(null);
  const nextRef = useRef<HTMLButtonElement>(null);
  const ready = found?.idx === idx;
  const el = ready ? found.el : null;

  // sang bước mới: mở đúng trang rồi chờ phần tử cần chỉ xuất hiện
  const onPage = !step.path || pathname === step.path;
  useEffect(() => {
    if (!onPage) {
      router.push(step.path!);
      return;
    }
    const t0 = Date.now();
    let timer = 0;
    const tick = () => {
      const hit = step.target ? findVisible(step.target) : null;
      if (hit || !step.target || Date.now() - t0 > WAIT_MS) {
        if (hit) hit.scrollIntoView({ block: "center", behavior: matchMedia("(prefers-reduced-motion: reduce)").matches ? "auto" : "smooth" });
        setFound({ idx, el: hit });
        setBox(hit ? boxOf(hit) : null);
        return;
      }
      timer = window.setTimeout(tick, 120);
    };
    tick();
    return () => window.clearTimeout(timer);
  }, [idx, onPage, step, router]);

  // bám theo phần tử khi cuộn / đổi kích thước
  useEffect(() => {
    if (!ready) return;
    let raf = 0;
    const measure = () => {
      cancelAnimationFrame(raf);
      raf = requestAnimationFrame(() => setBox(el && el.isConnected ? boxOf(el) : null));
    };
    measure();
    window.addEventListener("resize", measure);
    window.addEventListener("scroll", measure, true);
    const ro = el ? new ResizeObserver(measure) : null;
    if (el) ro?.observe(el);
    return () => {
      cancelAnimationFrame(raf);
      window.removeEventListener("resize", measure);
      window.removeEventListener("scroll", measure, true);
      ro?.disconnect();
    };
  }, [ready, el]);

  useLayoutEffect(() => {
    const pop = popRef.current;
    if (!ready || !pop) return;
    setPos(placePop(box, pop.offsetWidth, pop.offsetHeight));
  }, [ready, box, idx]);

  // hộp hiển thị (đã có vị trí) mới nhận focus được
  const placed = pos !== null;
  useEffect(() => {
    if (ready && placed) nextRef.current?.focus({ preventScroll: true });
  }, [ready, placed, idx]);

  const go = useCallback((d: number) => {
    const n = idx + d;
    if (n < 0) return;
    if (n >= steps.length) return close();
    setPos(null);
    setBox(null);
    setIdx(n);
  }, [idx, steps.length, close, setIdx]);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") close();
      else if (e.key === "ArrowRight") go(1);
      else if (e.key === "ArrowLeft") go(-1);
      else if (e.key === "Tab") {
        // giữ focus trong hộp hướng dẫn
        const items = popRef.current?.querySelectorAll<HTMLElement>("button");
        if (!items?.length) return;
        const first = items[0];
        const lastItem = items[items.length - 1];
        if (e.shiftKey && document.activeElement === first) {
          e.preventDefault();
          lastItem.focus();
        } else if (!e.shiftKey && document.activeElement === lastItem) {
          e.preventDefault();
          first.focus();
        } else if (!popRef.current?.contains(document.activeElement)) {
          e.preventDefault();
          first.focus();
        }
      }
    };
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [go, close]);

  return (
    <div className="tour">
      {/* lớp chặn thao tác ngoài hướng dẫn; khi có vùng nổi bật thì bóng đổ của vùng đó làm tối nền */}
      <div className={`tour-block${box && ready ? "" : " dim"}`} />
      {ready && box && <div className="tour-spot" style={{ top: box.top, left: box.left, width: box.width, height: box.height }} />}
      {!ready && <div className="tour-wait">Đang mở trang…</div>}
      {ready && (
        <div
          ref={popRef}
          className="tour-pop"
          role="dialog"
          aria-modal="true"
          aria-labelledby="tour-title"
          aria-describedby="tour-body"
          style={pos ? { top: pos.top, left: pos.left } : { visibility: "hidden", top: 0, left: 0 }}
        >
          <div className="between" style={{ gap: 8 }}>
            <span className="eyebrow" aria-live="polite">
              Hướng dẫn · {idx + 1}/{steps.length}
            </span>
            <button className="tour-x" onClick={close} aria-label="Đóng hướng dẫn">
              <X size={16} aria-hidden="true" />
            </button>
          </div>
          <h2 id="tour-title" className="tour-title">
            {step.title}
          </h2>
          <div id="tour-body">
            <p className="tour-body">{step.body}</p>
            {step.tips && (
              <ul className="tour-tips">
                {step.tips.map((t) => (
                  <li key={t}>{t}</li>
                ))}
              </ul>
            )}
          </div>
          <div className="tour-progress" aria-hidden="true">
            <span style={{ width: `${((idx + 1) / steps.length) * 100}%` }} />
          </div>
          <div className="tour-actions">
            {!last && (
              <button className="btn bs sm tour-skip" onClick={close}>
                Bỏ qua
              </button>
            )}
            <span className="spacer" />
            {idx > 0 && (
              <button className="btn bs sm" onClick={() => go(-1)}>
                Quay lại
              </button>
            )}
            <button ref={nextRef} className="btn bp sm" onClick={() => go(1)}>
              {idx === 0 ? "Bắt đầu" : last ? "Hoàn thành" : "Tiếp"}
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
