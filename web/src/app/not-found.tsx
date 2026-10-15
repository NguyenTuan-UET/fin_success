import Link from "next/link";
import { Logo } from "@/components/ui/basic";

export default function NotFound() {
  return (
    <div className="landing" style={{ display: "flex", alignItems: "center", justifyContent: "center", padding: 24 }}>
      <div className="card stack" style={{ maxWidth: 440, textAlign: "center", alignItems: "center" }}>
        <Logo size={44} />
        <h1 className="h1">Không tìm thấy trang</h1>
        <p className="sub">Đường dẫn này không có trong bản mock FCC. Bạn quay về trang chính để chọn vai trò nhé.</p>
        <Link href="/" className="btn bp">
          Về trang chính
        </Link>
      </div>
    </div>
  );
}
