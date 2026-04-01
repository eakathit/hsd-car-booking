// app/queue/page.tsx
"use client";

import { useEffect, useState } from "react";
import { collection, query, where, orderBy, onSnapshot, doc, updateDoc } from "firebase/firestore";
import { db } from "../../lib/firebase";
import { useCars } from "../../lib/useCars";
import BottomNav from "../components/BottomNav";
import type { Booking } from "../../types";
import { useLiff } from "../../lib/liff-context";

type Filter = "date" | "all";

const STATUS_LABEL: Record<string, string> = {
  booked: "จองแล้ว", active: "กำลังใช้งาน", completed: "คืนรถแล้ว", cancelled: "ยกเลิกการจอง",
};
const STATUS_COLOR: Record<string, { bg: string; text: string; dot: string }> = {
  booked:    { bg: "#dbeafe", text: "#1d4ed8", dot: "#3b82f6" },
  active:    { bg: "#dcfce7", text: "#16a34a", dot: "#22c55e" },
  completed: { bg: "#f1f5f9", text: "#64748b", dot: "#94a3b8" },
  cancelled: { bg: "#fee2e2", text: "#dc2626", dot: "#ef4444" },
};

function todayStr() { return new Date().toISOString().split("T")[0]; }
function fmtDate(d: string) {
  return new Date(d + "T00:00:00").toLocaleDateString("th-TH", { day: "numeric", month: "short", year: "2-digit" });
}

export default function QueuePage() {
  const { user } = useLiff();
  const { cars } = useCars(false);

  const [bookings, setBookings]     = useState<Booking[]>([]);
  const [loading, setLoading]       = useState(true);
  const [filter, setFilter]         = useState<Filter>("date");
  const [fDate, setFDate]           = useState(todayStr());
  const [cancelling, setCancelling] = useState<string | null>(null);
  const [returning, setReturning]   = useState<string | null>(null);

  useEffect(() => {
    setLoading(true);
    const q = filter === "date"
      ? query(collection(db, "bookings"), where("useDate", "==", fDate), where("status", "in", ["booked", "active", "completed"]), orderBy("startTime", "asc"))
      : query(collection(db, "bookings"), where("status", "in", ["booked", "active", "completed"]), orderBy("useDate", "desc"), orderBy("startTime", "asc"));
    const unsub = onSnapshot(q, (snap) => {
      setBookings(snap.docs.map((d) => ({ id: d.id, ...d.data() } as Booking)));
      setLoading(false);
    });
    return () => unsub();
  }, [filter, fDate]);

  const handleCancel = async (b: Booking) => {
    if (!b.id) return;
    if (!confirm(`ยืนยันยกเลิกการจอง?\n\n🚗 ${b.carName} (${b.carPlate})\n📅 ${fmtDate(b.useDate)} · ${b.startTime}–${b.endTime}\n📍 ${b.fromLocation} → ${b.toLocation}`)) return;
    setCancelling(b.id);
    try {
      await updateDoc(doc(db, "bookings", b.id), { status: "cancelled", cancelledAt: new Date().toISOString(), cancelledBy: user?.userId ?? "unknown" });
    } catch (err) { console.error(err); alert("เกิดข้อผิดพลาด"); }
    finally { setCancelling(null); }
  };

  const handleReturn = async (b: Booking) => {
    if (!b.id) return;
    const now = new Date();
    const actualTime = `${String(now.getHours()).padStart(2, "0")}:${String(now.getMinutes()).padStart(2, "0")}`;
    if (!confirm(
      `ยืนยันคืนรถ?\n\n🚗 ${b.carName} (${b.carPlate})\n📅 ${fmtDate(b.useDate)}\n🕐 ออก ${b.startTime} → คืน ${actualTime} (เวลาจริง)`
    )) return;
    setReturning(b.id);
    try {
      await updateDoc(doc(db, "bookings", b.id), { status: "completed", endTime: actualTime, returnedAt: now.toISOString() });
    } catch (err) { console.error(err); alert("เกิดข้อผิดพลาด"); }
    finally { setReturning(null); }
  };

  const canCancel = (b: Booking) => b.status === "booked" && !!user && b.bookerId === user.userId;
  const canReturn = (b: Booking) => (b.status === "booked" || b.status === "active") && !!user && b.bookerId === user.userId;

  return (
    <><Styles />
      <div className="page">
        <header className="header">
          <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
            <img src="/logo.jpg" alt="" style={{ width: 34, height: 34, borderRadius: 8, objectFit: "cover", flexShrink: 0 }}
              onError={(e) => { (e.target as HTMLImageElement).style.display = "none"; }} />
            <div style={{ marginLeft: 2 }}>
              <p className="h-sub">HARU SYSTEM DEVELOPMENT</p>
              <h1 className="h-title">ตารางคิวรถ</h1>
            </div>
          </div>
        </header>

        <div className="wrap">
          <div className="filter-bar">
            {(["date", "all"] as Filter[]).map((f) => (
              <button key={f} className={`fb ${filter === f ? "active" : ""}`} onClick={() => setFilter(f)}>
                {f === "date" ? "📅 เลือกวัน" : "📋 ทั้งหมด"}
              </button>
            ))}
          </div>

          {filter === "date" && (
            <div className="date-wrap">
              <input type="date" value={fDate} onChange={(e) => setFDate(e.target.value)} className="d-input" />
            </div>
          )}
          {!loading && <p className="count-txt">{bookings.length} รายการ</p>}

          {loading ? (
            <div className="loading"><div className="spin" /> กำลังโหลด…</div>
          ) : bookings.length === 0 ? (
            <div className="empty-card">
              <p style={{ fontSize: 36, marginBottom: 8 }}>📋</p>
              <p className="empty-title">ไม่มีรายการ</p>
              <p className="empty-sub">ไม่พบการจองในช่วงเวลาที่เลือก</p>
            </div>
          ) : (
            <div className="list">
              {bookings.map((b) => {
                const car   = cars.find((c) => c.id === b.carId);
                const sc    = STATUS_COLOR[b.status] ?? STATUS_COLOR.booked;
                const isMine = !!user && b.bookerId === user.userId;
                const isMultiDay = !!(b.totalDays && b.totalDays > 1);

                return (
                  <div key={b.id} className="bk-card">
                    {/* Card header */}
                    <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: 10 }}>
                      <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                        {car?.imageUrl ? (
                          <div style={{ width: 40, height: 40, borderRadius: 10, overflow: "hidden", flexShrink: 0 }}>
                            <img src={car.imageUrl} alt={car.name} style={{ width: "100%", height: "100%", objectFit: "cover" }} />
                          </div>
                        ) : (
                          <div style={{ width: 40, height: 40, borderRadius: 10, background: car?.colorLight || "#f1f5f9", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 20, flexShrink: 0 }}>🚗</div>
                        )}
                        <div>
                          <p style={{ fontWeight: 700, fontSize: 14, color: "#1e3a5f", margin: 0 }}>{b.carName}</p>
                          <p style={{ fontSize: 11, color: "#94a3b8", margin: 0 }}>{b.carPlate}</p>
                        </div>
                      </div>
                      <div style={{ display: "flex", flexDirection: "column", alignItems: "flex-end", gap: 4 }}>
                        <span style={{ fontSize: 11, fontWeight: 700, color: sc.text, background: sc.bg, borderRadius: 20, padding: "3px 10px", display: "flex", alignItems: "center", gap: 4 }}>
                          <span style={{ width: 6, height: 6, borderRadius: "50%", background: sc.dot, display: "inline-block" }} />
                          {STATUS_LABEL[b.status]}
                        </span>
                        {/* ── Multi-day badge ── */}
                        {isMultiDay && (
                          <span style={{ fontSize: 10, fontWeight: 700, color: "#7c3aed", background: "#f5f3ff", border: "1px solid #ddd6fe", borderRadius: 20, padding: "2px 8px" }}>
                            📆 {b.totalDays} วัน
                          </span>
                        )}
                        {isMine && <span style={{ fontSize: 10, color: "#1d4ed8", background: "#eff6ff", border: "1px solid #bfdbfe", borderRadius: 20, padding: "2px 8px", fontWeight: 600 }}>ของฉัน</span>}
                      </div>
                    </div>

                    {/* Info rows */}
                    <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "6px 12px", marginBottom: 10 }}>
                      <div><p style={{ fontSize: 10, color: "#94a3b8", margin: "0 0 1px" }}>📅 วันที่</p><p style={{ fontSize: 13, fontWeight: 600, color: "#1e3a5f", margin: 0 }}>{fmtDate(b.useDate)}</p></div>
                      <div><p style={{ fontSize: 10, color: "#94a3b8", margin: "0 0 1px" }}>🕐 เวลา</p><p style={{ fontSize: 13, fontWeight: 600, color: "#1e3a5f", margin: 0 }}>{b.startTime} – {b.endTime}</p></div>
                      <div><p style={{ fontSize: 10, color: "#94a3b8", margin: "0 0 1px" }}>👤 ผู้จอง</p><p style={{ fontSize: 13, fontWeight: 600, color: "#1e3a5f", margin: 0 }}>{b.bookerName}</p></div>
                      <div><p style={{ fontSize: 10, color: "#94a3b8", margin: "0 0 1px" }}>🚘 ผู้ขับ</p><p style={{ fontSize: 13, fontWeight: 600, color: "#1e3a5f", margin: 0 }}>{b.driverName}</p></div>
                    </div>

                    <div style={{ background: "#f8fafc", borderRadius: 8, padding: "8px 10px", marginBottom: 10 }}>
                      <p style={{ fontSize: 11, color: "#64748b", margin: 0 }}>📍 {b.fromLocation} → {b.toLocation}</p>
                      <p style={{ fontSize: 11, color: "#64748b", margin: "2px 0 0" }}>📋 {b.purpose}</p>
                    </div>

                    {/* Actions */}
                    {(canCancel(b) || canReturn(b)) && (
                      <div style={{ display: "flex", gap: 8 }}>
                        {canCancel(b) && (
                          <button
                            onClick={() => handleCancel(b)}
                            disabled={cancelling === b.id}
                            style={{ flex: 1, padding: "9px", borderRadius: 10, fontSize: 12, fontWeight: 700, cursor: "pointer", border: "1.5px solid #fecaca", background: "#fff8f8", color: "#dc2626", fontFamily: "Sarabun,sans-serif" }}>
                            {cancelling === b.id ? "กำลังยกเลิก…" : "✕ ยกเลิก"}
                          </button>
                        )}
                        {canReturn(b) && (
                          <button
                            onClick={() => handleReturn(b)}
                            disabled={returning === b.id}
                            style={{ flex: 1, padding: "9px", borderRadius: 10, fontSize: 12, fontWeight: 700, cursor: "pointer", border: "none", background: "linear-gradient(135deg,#22c55e,#16a34a)", color: "white", fontFamily: "Sarabun,sans-serif" }}>
                            {returning === b.id ? "กำลังบันทึก…" : "✓ คืนรถแล้ว"}
                          </button>
                        )}
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          )}
          <div style={{ height: 100 }} />
        </div>
        <BottomNav />
      </div>
    </>
  );
}

function Styles() {
  return (
    <style>{`
      @import url('https://fonts.googleapis.com/css2?family=Sarabun:wght@400;500;600;700&family=Prompt:wght@600;700&display=swap');
      *,*::before,*::after{box-sizing:border-box;margin:0;padding:0}
      body,*{font-family:'Sarabun',sans-serif}
      .page{background:#f0f4f8;min-height:100vh}
      .header{background:white;padding:12px 16px;border-bottom:1px solid #e2e8f0;position:sticky;top:0;z-index:30;box-shadow:0 1px 8px rgba(0,0,0,.06)}
      .h-sub{font-size:9px;color:#94a3b8;margin:0}
      .h-title{font-size:15px;font-weight:700;color:#1e3a5f;margin:0;font-family:'Prompt',sans-serif}
      .wrap{padding:14px;max-width:480px;margin:0 auto}
      .filter-bar{display:flex;gap:8px;margin-bottom:12px}
      .fb{flex:1;padding:10px;border-radius:12px;font-size:13px;font-weight:600;cursor:pointer;border:1.5px solid #e2e8f0;background:white;color:#64748b;transition:all .15s;font-family:'Sarabun',sans-serif}
      .fb.active{background:#1d4ed8;color:white;border-color:#1d4ed8;box-shadow:0 3px 12px rgba(29,78,216,.25)}
      .date-wrap{margin-bottom:12px}
      .d-input{width:100%;border:1.5px solid #e2e8f0;border-radius:10px;padding:10px 12px;font-size:14px;color:#1e293b;background:white;outline:none;font-family:'Sarabun',sans-serif}
      .count-txt{font-size:12px;color:#94a3b8;margin-bottom:10px}
      .loading{display:flex;align-items:center;gap:10px;color:#94a3b8;font-size:13px;padding:20px 0}
      .spin{width:20px;height:20px;border:2.5px solid #e2e8f0;border-top-color:#1d4ed8;border-radius:50%;animation:spin .8s linear infinite;flex-shrink:0}
      @keyframes spin{to{transform:rotate(360deg)}}
      .empty-card{background:white;border-radius:16px;padding:32px;text-align:center;box-shadow:0 2px 14px rgba(0,0,0,.07)}
      .empty-title{font-size:15px;font-weight:700;color:#1e3a5f;margin-bottom:4px}
      .empty-sub{font-size:13px;color:#94a3b8}
      .list{display:flex;flex-direction:column;gap:12px}
      .bk-card{background:white;border-radius:16px;padding:14px;box-shadow:0 2px 14px rgba(0,0,0,.07)}

    `}</style>
  );
}