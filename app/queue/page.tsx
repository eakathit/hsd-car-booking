// app/queue/page.tsx — ตารางคิวรถ real-time
"use client";

import { useEffect, useState } from "react";
import { collection, query, where, orderBy, onSnapshot, doc, updateDoc } from "firebase/firestore";
import { db } from "../../lib/firebase";
import { COMPANY_CARS } from "../../lib/cars";
import BottomNav from "../components/BottomNav";
import type { Booking } from "../../types";

type Filter = "upcoming" | "date" | "all";

const STATUS_LABEL: Record<string, string> = {
  booked: "จองแล้ว", active: "กำลังใช้", completed: "เสร็จแล้ว", cancelled: "ยกเลิก",
};
const STATUS_STYLE: Record<string, string> = {
  booked:    "background:#dbeafe;color:#1d4ed8",
  active:    "background:#dcfce7;color:#16a34a",
  completed: "background:#f1f5f9;color:#64748b",
  cancelled: "background:#fee2e2;color:#dc2626",
};

function todayStr() { return new Date().toISOString().split("T")[0]; }
function fmtDate(d: string) {
  return new Date(d + "T00:00:00").toLocaleDateString("th-TH", {
    day: "numeric", month: "short", year: "2-digit",
  });
}

export default function QueuePage() {
  const [bookings, setBookings] = useState<Booking[]>([]);
  const [loading, setLoading]   = useState(true);
  const [filter, setFilter]     = useState<Filter>("upcoming");
  const [fDate, setFDate]       = useState(todayStr());

  useEffect(() => {
    setLoading(true);
    let q;
    if (filter === "upcoming") {
      q = query(collection(db, "bookings"),
        where("useDate", ">=", todayStr()),
        where("status", "in", ["booked", "active"]),
        orderBy("useDate", "asc"), orderBy("startTime", "asc"));
    } else if (filter === "date") {
      q = query(collection(db, "bookings"),
        where("useDate", "==", fDate),
        orderBy("startTime", "asc"));
    } else {
      q = query(collection(db, "bookings"),
        orderBy("useDate", "desc"), orderBy("startTime", "asc"));
    }
    const unsub = onSnapshot(q, (snap) => {
      setBookings(snap.docs.map((d) => ({ id: d.id, ...d.data() } as Booking)));
      setLoading(false);
    });
    return () => unsub();
  }, [filter, fDate]);

  const cancelBooking = async (id: string) => {
    if (!confirm("ยืนยันยกเลิกการจองนี้?")) return;
    await updateDoc(doc(db, "bookings", id), { status: "cancelled" });
  };

  return (
    <>
      <Styles />
      <div className="page">
        <header className="header">
          <div>
            <p className="h-sub">HARU SYSTEM DEVELOPMENT</p>
            <h1 className="h-title">📋 ตารางคิวรถ</h1>
          </div>
        </header>

        <div className="wrap">
          {/* Filter bar */}
          <div className="filter-bar">
            {(["upcoming","date","all"] as Filter[]).map((f) => (
              <button key={f} className={`fb ${filter === f ? "active" : ""}`} onClick={() => setFilter(f)}>
                {f === "upcoming" ? "🔜 กำลังจะมา" : f === "date" ? "📅 เลือกวัน" : "📋 ทั้งหมด"}
              </button>
            ))}
          </div>

          {filter === "date" && (
            <div style={{ marginBottom: 12 }}>
              <input type="date" value={fDate} onChange={(e) => setFDate(e.target.value)}
                className="d-input" />
            </div>
          )}

          {!loading && (
            <p className="count-txt">{bookings.length} รายการ</p>
          )}

          {/* Cards */}
          {loading ? (
            <div className="loading"><div className="spin" />กำลังโหลด…</div>
          ) : bookings.length === 0 ? (
            <div className="empty-card">
              <p style={{ fontSize: 36, marginBottom: 8 }}>📋</p>
              <p className="empty-title">ไม่มีรายการ</p>
              <p className="empty-sub">ไม่พบการจองในช่วงเวลาที่เลือก</p>
            </div>
          ) : (
            <div className="list">
              {bookings.map((b) => {
                const car = COMPANY_CARS.find((c) => c.id === b.carId);
                return (
                  <div key={b.id} className="bk-card">
                    {/* Color accent strip */}
                    <div style={{ width: 4, background: car?.color || "#94a3b8", borderRadius: "4px 0 0 4px", flexShrink: 0, alignSelf: "stretch" }} />

                    <div style={{ flex: 1, padding: "12px 12px 12px 0" }}>
                      {/* Row 1: date + status */}
                      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 6 }}>
                        <span className="bk-date">{fmtDate(b.useDate)}</span>
                        <span className="bk-badge" style={{ cssText: STATUS_STYLE[b.status] } as any}>
                          {STATUS_LABEL[b.status] || b.status}
                        </span>
                      </div>

                      {/* Row 2: driver + time */}
                      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-end", marginBottom: 4 }}>
                        <p className="bk-driver">{b.driverName}</p>
                        <span className="bk-time">{b.startTime} – {b.endTime}</span>
                      </div>

                      {/* Row 3: car */}
                      <div style={{ display: "flex", alignItems: "center", gap: 5, marginBottom: 4 }}>
                        <span style={{ width: 6, height: 6, borderRadius: "50%", background: car?.color, flexShrink: 0 }} />
                        <span className="bk-car">{car?.name} ({car?.plate})</span>
                      </div>

                      {/* Row 4: route + purpose */}
                      <p className="bk-route">{b.fromLocation} → {b.toLocation} · <span style={{ color: "#94a3b8" }}>{b.purpose}</span></p>

                      {/* Row 5: booker + cancel */}
                      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginTop: 8 }}>
                        <p className="bk-booker">จองโดย: {b.bookerName}</p>
                        {b.status === "booked" && (
                          <button className="cancel-btn" onClick={() => b.id && cancelBooking(b.id)}>
                            ยกเลิก
                          </button>
                        )}
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          )}

          <div style={{ height: 90 }} />
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
      .h-sub{font-size:10px;color:#94a3b8;margin:0}
      .h-title{font-size:16px;font-weight:700;color:#1e3a5f;margin:0;font-family:'Prompt',sans-serif}

      .wrap{padding:14px;max-width:480px;margin:0 auto}

      .filter-bar{display:flex;gap:7px;margin-bottom:10px;overflow-x:auto;-webkit-overflow-scrolling:touch;padding-bottom:2px}
      .fb{padding:7px 14px;border-radius:20px;font-size:12px;font-weight:600;cursor:pointer;border:1.5px solid #e2e8f0;background:white;color:#64748b;white-space:nowrap;transition:all .15s}
      .fb.active{background:#1d4ed8;color:white;border-color:#1d4ed8}

      .d-input{border:1.5px solid #e2e8f0;border-radius:10px;padding:7px 12px;font-size:13px;color:#1e293b;background:white;outline:none;font-family:'Sarabun',sans-serif}
      .d-input:focus{border-color:#1d4ed8}

      .count-txt{font-size:11px;color:#94a3b8;margin-bottom:8px}

      .loading{display:flex;align-items:center;gap:8px;padding:24px;justify-content:center;color:#94a3b8;font-size:13px}
      .spin{width:16px;height:16px;border:2px solid #e2e8f0;border-top-color:#1d4ed8;border-radius:50%;animation:spin .7s linear infinite;flex-shrink:0}
      @keyframes spin{to{transform:rotate(360deg)}}

      .empty-card{background:white;border-radius:16px;padding:40px 20px;text-align:center;box-shadow:0 2px 12px rgba(0,0,0,.06)}
      .empty-title{font-size:15px;font-weight:700;color:#1e3a5f;margin-bottom:4px;font-family:'Prompt',sans-serif}
      .empty-sub{font-size:12px;color:#94a3b8}

      .list{display:flex;flex-direction:column;gap:10px}
      .bk-card{background:white;border-radius:14px;box-shadow:0 2px 10px rgba(0,0,0,.06);display:flex;overflow:hidden}

      .bk-date{font-size:11px;font-weight:700;color:#1d4ed8;background:#eff6ff;border-radius:20px;padding:2px 8px}
      .bk-badge{display:inline-block;font-size:11px;font-weight:700;border-radius:20px;padding:2px 9px}
      .bk-driver{font-size:14px;font-weight:700;color:#1e293b;margin:0}
      .bk-time{font-size:12px;color:#475569;font-weight:600}
      .bk-car{font-size:11px;color:#475569;font-weight:600}
      .bk-route{font-size:12px;color:#475569;margin:0}
      .bk-booker{font-size:11px;color:#94a3b8;margin:0}
      .cancel-btn{font-size:11px;color:#dc2626;background:#fee2e2;border:none;border-radius:8px;padding:4px 10px;cursor:pointer;font-weight:700;transition:background .15s}
      .cancel-btn:hover{background:#fecaca}
    `}</style>
  );
}