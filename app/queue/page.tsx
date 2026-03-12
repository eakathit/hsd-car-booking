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

const STATUS_LABEL: Record<string,string> = { booked:"จองแล้ว", active:"กำลังใช้", completed:"เสร็จแล้ว", cancelled:"ยกเลิก" };
const STATUS_COLOR: Record<string,{bg:string;text:string;dot:string}> = {
  booked:    { bg:"#dbeafe", text:"#1d4ed8", dot:"#3b82f6" },
  active:    { bg:"#dcfce7", text:"#16a34a", dot:"#22c55e" },
  completed: { bg:"#f1f5f9", text:"#64748b", dot:"#94a3b8" },
  cancelled: { bg:"#fee2e2", text:"#dc2626", dot:"#ef4444" },
};

function todayStr() { return new Date().toISOString().split("T")[0]; }
function fmtDate(d: string) {
  return new Date(d+"T00:00:00").toLocaleDateString("th-TH", { day:"numeric", month:"short", year:"2-digit" });
}

export default function QueuePage() {
  const { user } = useLiff();
  const { cars } = useCars(false); // ✅ ดึงทั้งหมด รวม inactive (เพื่อแสดง booking เก่า)

  const [bookings, setBookings]     = useState<Booking[]>([]);
  const [loading, setLoading]       = useState(true);
  const [filter, setFilter]         = useState<Filter>("date");
  const [fDate, setFDate]           = useState(todayStr());
  const [cancelling, setCancelling] = useState<string|null>(null);

  useEffect(() => {
    setLoading(true);
    const q = filter==="date"
      ? query(collection(db,"bookings"), where("useDate","==",fDate), where("status","in",["booked","active","completed"]), orderBy("startTime","asc"))
      : query(collection(db,"bookings"), where("status","in",["booked","active","completed"]), orderBy("useDate","desc"), orderBy("startTime","asc"));
    const unsub = onSnapshot(q, (snap) => {
      setBookings(snap.docs.map((d) => ({ id:d.id, ...d.data() } as Booking)));
      setLoading(false);
    });
    return () => unsub();
  }, [filter, fDate]);

  const handleCancel = async (b: Booking) => {
    if (!b.id) return;
    if (!confirm(`ยืนยันยกเลิกการจอง?\n\n🚗 ${b.carName} (${b.carPlate})\n📅 ${fmtDate(b.useDate)} · ${b.startTime}–${b.endTime}\n📍 ${b.fromLocation} → ${b.toLocation}`)) return;
    setCancelling(b.id);
    try {
      await updateDoc(doc(db,"bookings",b.id), { status:"cancelled", cancelledAt:new Date().toISOString(), cancelledBy:user?.userId??"unknown" });
    } catch(err) { console.error(err); alert("เกิดข้อผิดพลาด"); }
    finally { setCancelling(null); }
  };

  const canCancel = (b: Booking) => b.status==="booked" && !!user && b.bookerId===user.userId;

  return (
    <><Styles />
      <div className="page">
        <header className="header">
          <div><p className="h-sub">HARU SYSTEM DEVELOPMENT</p><h1 className="h-title">📋 ตารางคิวรถ</h1></div>
        </header>

        <div className="wrap">
          <div className="filter-bar">
            {(["date","all"] as Filter[]).map((f) => (
              <button key={f} className={`fb ${filter===f?"active":""}`} onClick={() => setFilter(f)}>
                {f==="date"?"📅 เลือกวัน":"📋 ทั้งหมด"}
              </button>
            ))}
          </div>

          {filter==="date" && (
            <div className="date-wrap">
              <input type="date" value={fDate} onChange={(e) => setFDate(e.target.value)} className="d-input" />
            </div>
          )}
          {!loading && <p className="count-txt">{bookings.length} รายการ</p>}

          {loading ? (
            <div className="loading"><div className="spin" /> กำลังโหลด…</div>
          ) : bookings.length===0 ? (
            <div className="empty-card"><p style={{ fontSize:36,marginBottom:8 }}>📋</p><p className="empty-title">ไม่มีรายการ</p><p className="empty-sub">ไม่พบการจองในช่วงเวลาที่เลือก</p></div>
          ) : (
            <div className="list">
              {bookings.map((b) => {
                const car = cars.find((c) => c.id===b.carId);
                const sc  = STATUS_COLOR[b.status]??STATUS_COLOR.booked;
                const isMine      = !!user && b.bookerId===user.userId;
                const isCancelling = cancelling===b.id;
                return (
                  <div key={b.id} className="bk-card" style={{ opacity:b.status==="cancelled"?0.6:1 }}>
                    <div className="strip" style={{ background:b.status==="cancelled"?"#ef4444":car?.color??"#94a3b8" }} />
                    <div className="card-body">
                      <div className="row-between" style={{ marginBottom:10 }}>
                        <div style={{ display:"flex",alignItems:"center",gap:6 }}>
                          <span className="date-badge">{fmtDate(b.useDate)}</span>
                          {isMine && <span className="mine-badge">ของฉัน</span>}
                        </div>
                        <span className="status-badge" style={{ background:sc.bg,color:sc.text }}>
                          <span className="status-dot" style={{ background:sc.dot }} />
                          {STATUS_LABEL[b.status]??b.status}
                        </span>
                      </div>
                      <div className="row-between" style={{ marginBottom:6 }}>
                        <p className="driver-name">{b.driverName}</p>
                        <span className="time-chip">🕐 {b.startTime} – {b.endTime}</span>
                      </div>
                      <div className="car-row" style={{ marginBottom:8 }}>
                        <span className="car-dot" style={{ background:car?.color }} />
                        <span className="car-name">{b.carName}</span>
                        <span className="car-plate">({b.carPlate})</span>
                      </div>
                      <div className="divider" />
                      <div className="route-row" style={{ marginTop:8,marginBottom:4 }}>
                        <span className="route-icon">📍</span>
                        <span className="route-text">{b.fromLocation}<span className="route-arrow"> → </span>{b.toLocation}</span>
                        {b.purpose && <span className="purpose-chip">{b.purpose}</span>}
                      </div>
                      <div className="booker-row" style={{ marginTop:6 }}>
                        <span className="booker-icon">👤</span>
                        <span className="booker-label">จองโดย</span>
                        <span className="booker-name">{b.bookerName}</span>
                      </div>
                      {canCancel(b) && (
                        <button className="cancel-btn" disabled={isCancelling} onClick={() => handleCancel(b)}>
                          {isCancelling ? <><span className="spin-sm" /> กำลังยกเลิก…</> : "✕ ยกเลิกการจอง"}
                        </button>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          )}
          <div style={{ height:100 }} />
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
      .h-sub{font-size:10px;color:#94a3b8;margin:0}.h-title{font-size:16px;font-weight:700;color:#1e3a5f;margin:0;font-family:'Prompt',sans-serif}
      .wrap{padding:14px;max-width:480px;margin:0 auto}
      .filter-bar{display:flex;gap:8px;margin-bottom:10px;overflow-x:auto;-webkit-overflow-scrolling:touch;padding-bottom:2px}
      .fb{padding:8px 18px;border-radius:20px;font-size:13px;font-weight:600;cursor:pointer;border:1.5px solid #e2e8f0;background:white;color:#64748b;white-space:nowrap;transition:all .15s}
      .fb.active{background:#1d4ed8;color:white;border-color:#1d4ed8;box-shadow:0 3px 10px rgba(29,78,216,.25)}
      .date-wrap{margin-bottom:12px}
      .d-input{border:1.5px solid #e2e8f0;border-radius:10px;padding:8px 13px;font-size:13px;color:#1e293b;background:white;outline:none;font-family:'Sarabun',sans-serif}
      .d-input:focus{border-color:#1d4ed8}
      .count-txt{font-size:11px;color:#94a3b8;margin-bottom:8px}
      .loading{display:flex;align-items:center;gap:8px;padding:32px;justify-content:center;color:#94a3b8;font-size:13px}
      .spin{width:18px;height:18px;border:2.5px solid #e2e8f0;border-top-color:#1d4ed8;border-radius:50%;animation:spin .7s linear infinite;flex-shrink:0}
      .spin-sm{display:inline-block;width:12px;height:12px;border:2px solid rgba(220,38,38,.3);border-top-color:#dc2626;border-radius:50%;animation:spin .7s linear infinite;flex-shrink:0}
      @keyframes spin{to{transform:rotate(360deg)}}
      .empty-card{background:white;border-radius:16px;padding:44px 20px;text-align:center;box-shadow:0 2px 12px rgba(0,0,0,.06)}
      .empty-title{font-size:15px;font-weight:700;color:#1e3a5f;margin-bottom:4px;font-family:'Prompt',sans-serif}
      .empty-sub{font-size:12px;color:#94a3b8}
      .list{display:flex;flex-direction:column;gap:12px}
      .bk-card{background:white;border-radius:16px;box-shadow:0 2px 12px rgba(0,0,0,.07);display:flex;overflow:hidden;transition:opacity .2s}
      .strip{width:5px;flex-shrink:0}.card-body{flex:1;padding:14px 16px}
      .row-between{display:flex;justify-content:space-between;align-items:center}
      .date-badge{font-size:11px;font-weight:700;color:#1d4ed8;background:#eff6ff;border-radius:20px;padding:3px 10px}
      .mine-badge{font-size:10px;font-weight:700;color:#7c3aed;background:#f5f3ff;border:1px solid #ddd6fe;border-radius:20px;padding:2px 8px}
      .status-badge{display:inline-flex;align-items:center;gap:5px;font-size:11px;font-weight:700;border-radius:20px;padding:3px 10px}
      .status-dot{width:6px;height:6px;border-radius:50%;flex-shrink:0}
      .driver-name{font-size:15px;font-weight:700;color:#1e293b;margin:0}
      .time-chip{font-size:12px;font-weight:600;color:#475569;background:#f1f5f9;border-radius:8px;padding:3px 9px}
      .car-row{display:flex;align-items:center;gap:6px}
      .car-dot{width:8px;height:8px;border-radius:50%;flex-shrink:0}
      .car-name{font-size:12px;font-weight:600;color:#475569}
      .car-plate{font-size:11px;color:#94a3b8}
      .divider{height:1px;background:#f1f5f9}
      .route-row{display:flex;align-items:center;gap:6px;flex-wrap:wrap}
      .route-icon{font-size:13px;flex-shrink:0}
      .route-text{font-size:13px;font-weight:600;color:#334155}
      .route-arrow{color:#94a3b8}
      .purpose-chip{font-size:11px;color:#64748b;background:#f8fafc;border:1px solid #e2e8f0;border-radius:6px;padding:2px 8px}
      .booker-row{display:flex;align-items:center;gap:5px}
      .booker-icon{font-size:12px}.booker-label{font-size:11px;color:#94a3b8}.booker-name{font-size:11px;font-weight:600;color:#64748b}
      .cancel-btn{margin-top:12px;width:100%;padding:9px;border-radius:10px;font-size:13px;font-weight:700;color:#dc2626;background:#fef2f2;border:1.5px solid #fecaca;cursor:pointer;display:flex;align-items:center;justify-content:center;gap:6px;transition:all .15s;font-family:'Sarabun',sans-serif}
      .cancel-btn:hover:not(:disabled){background:#fee2e2;border-color:#fca5a5}
      .cancel-btn:disabled{opacity:0.6;cursor:not-allowed}
    `}</style>
  );
}