// app/admin/page.tsx
// ✅ Admin only — จัดการรถ + Export CSV
"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import {
  collection, getDocs, addDoc, updateDoc, doc,
  query, orderBy, where, serverTimestamp,
} from "firebase/firestore";
import { db } from "../../lib/firebase";
import { useLiff } from "../../lib/liff-context";
import BottomNav from "../components/BottomNav";
import type { Booking } from "../../types";

// ── Types ────────────────────────────────────────────────
interface CarDoc {
  id: string;
  name: string;
  plate: string;
  color: string;
  colorLight: string;
  imageUrl: string;
  active: boolean;
  createdAt?: any;
}

// ── Helpers ──────────────────────────────────────────────
function todayStr() { return new Date().toISOString().split("T")[0]; }

function fmtDate(d: string) {
  return new Date(d + "T00:00:00").toLocaleDateString("th-TH", {
    day: "numeric", month: "short", year: "2-digit",
  });
}

function exportCSV(bookings: Booking[]) {
  const headers = [
    "วันที่ใช้", "เวลาออก", "เวลาเข้า",
    "รถ", "ทะเบียน", "ผู้จอง", "ผู้ใช้รถ",
    "จาก", "ถึง", "สำหรับ", "สถานะ",
  ];
  const rows = bookings.map((b) => [
    b.useDate, b.startTime, b.endTime,
    b.carName, b.carPlate, b.bookerName, b.driverName,
    b.fromLocation, b.toLocation, b.purpose, b.status,
  ]);
  const csv = [headers, ...rows]
    .map((r) => r.map((v) => `"${String(v).replace(/"/g, '""')}"`).join(","))
    .join("\n");
  const bom = "\uFEFF";
  const blob = new Blob([bom + csv], { type: "text/csv;charset=utf-8;" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = `bookings_${todayStr()}.csv`;
  a.click();
  URL.revokeObjectURL(url);
}

// ── Default car colors ────────────────────────────────────
const COLOR_OPTIONS = [
  { color: "#2563eb", colorLight: "#dbeafe", label: "น้ำเงิน" },
  { color: "#7c3aed", colorLight: "#ede9fe", label: "ม่วง" },
  { color: "#0891b2", colorLight: "#cffafe", label: "ฟ้า" },
  { color: "#16a34a", colorLight: "#dcfce7", label: "เขียว" },
  { color: "#dc2626", colorLight: "#fee2e2", label: "แดง" },
  { color: "#d97706", colorLight: "#fef3c7", label: "ส้ม" },
];

// ═══════════════════════════════════════════════════════════
export default function AdminPage() {
  const router  = useRouter();
  const { user, isAdmin, isReady } = useLiff();

  const [tab, setTab]             = useState<"cars" | "export">("cars");
  const [cars, setCars]           = useState<CarDoc[]>([]);
  const [loadingCars, setLoadingCars] = useState(true);

  // Export state
  const [exportFrom, setExportFrom] = useState(todayStr());
  const [exportTo,   setExportTo]   = useState(todayStr());
  const [exporting,  setExporting]  = useState(false);
  const [exportCount, setExportCount] = useState<number | null>(null);

  // Add car form
  const [showAddForm, setShowAddForm] = useState(false);
  const [saving, setSaving]           = useState(false);
  const [newCar, setNewCar] = useState({
    name: "", plate: "",
    color: COLOR_OPTIONS[0].color,
    colorLight: COLOR_OPTIONS[0].colorLight,
    imageUrl: "",
  });

  // ── Guard — redirect non-admin ────────────────────────
  useEffect(() => {
    if (isReady && !isAdmin) router.replace("/");
  }, [isReady, isAdmin, router]);

  // ── Load cars ────────────────────────────────────────
  useEffect(() => {
    if (!isAdmin) return;
    (async () => {
      setLoadingCars(true);
      try {
        const snap = await getDocs(
          query(collection(db, "cars"), orderBy("createdAt", "asc"))
        );
        setCars(snap.docs.map((d) => ({ id: d.id, ...d.data() } as CarDoc)));
      } catch (e) {
        console.error(e);
      } finally {
        setLoadingCars(false);
      }
    })();
  }, [isAdmin]);

  // ── Add car ──────────────────────────────────────────
  const handleAddCar = async () => {
    if (!newCar.name.trim() || !newCar.plate.trim()) return;
    setSaving(true);
    try {
      const ref = await addDoc(collection(db, "cars"), {
        ...newCar,
        name:  newCar.name.trim(),
        plate: newCar.plate.trim(),
        active: true,
        createdAt: serverTimestamp(),
      });
      setCars((prev) => [...prev, {
        id: ref.id, ...newCar,
        name: newCar.name.trim(), plate: newCar.plate.trim(), active: true,
      }]);
      setNewCar({ name: "", plate: "", color: COLOR_OPTIONS[0].color, colorLight: COLOR_OPTIONS[0].colorLight, imageUrl: "" });
      setShowAddForm(false);
    } catch (e) {
      alert("เพิ่มรถไม่สำเร็จ");
      console.error(e);
    } finally {
      setSaving(false);
    }
  };

  // ── Toggle car active ────────────────────────────────
  const handleToggleCar = async (car: CarDoc) => {
    const next = !car.active;
    const label = next ? "เปิดใช้งาน" : "ปิดใช้งาน";
    if (!confirm(`${label} "${car.name}" ?`)) return;
    try {
      await updateDoc(doc(db, "cars", car.id), { active: next });
      setCars((prev) => prev.map((c) => c.id === car.id ? { ...c, active: next } : c));
    } catch (e) {
      alert("แก้ไขไม่สำเร็จ");
    }
  };

  // ── Export CSV ───────────────────────────────────────
  const handleExport = async () => {
    setExporting(true);
    setExportCount(null);
    try {
      const q = query(
        collection(db, "bookings"),
        where("useDate", ">=", exportFrom),
        where("useDate", "<=", exportTo),
        orderBy("useDate", "asc"),
        orderBy("startTime", "asc"),
      );
      const snap = await getDocs(q);
      const data = snap.docs.map((d) => ({ id: d.id, ...d.data() } as Booking));
      setExportCount(data.length);
      if (data.length === 0) { setExporting(false); return; }
      exportCSV(data);
    } catch (e) {
      alert("Export ไม่สำเร็จ");
      console.error(e);
    } finally {
      setExporting(false);
    }
  };

  // ── Loading / guard ──────────────────────────────────
  if (!isReady || !isAdmin) return (
    <>
      <Styles />
      <div style={{ minHeight: "100vh", display: "flex", alignItems: "center", justifyContent: "center", background: "#f0f4f8" }}>
        <p style={{ color: "#94a3b8", fontFamily: "Sarabun,sans-serif" }}>กำลังโหลด…</p>
      </div>
    </>
  );

  return (
    <>
      <Styles />
      <div className="page">

        {/* ── Header ── */}
        <header className="header">
          <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
            {user?.pictureUrl
              ? <img src={user.pictureUrl} alt="" className="avatar" />
              : <div className="avatar-fallback">{user?.displayName?.charAt(0) || "A"}</div>}
            <div>
              <p className="h-sub">ADMIN PANEL</p>
              <h1 className="h-title">⚙️ จัดการระบบ</h1>
            </div>
          </div>
          <span className="admin-badge">Admin</span>
        </header>

        <div className="wrap">

          {/* ── Tab bar ── */}
          <div className="tab-bar">
            <button className={`tb ${tab === "cars" ? "active" : ""}`} onClick={() => setTab("cars")}>
              🚗 จัดการรถ
            </button>
            <button className={`tb ${tab === "export" ? "active" : ""}`} onClick={() => setTab("export")}>
              📊 Export ข้อมูล
            </button>
          </div>

          {/* ══ TAB: CARS ══════════════════════════════════════ */}
          {tab === "cars" && (
            <div>
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 12 }}>
                <p style={{ fontSize: 12, color: "#64748b" }}>{cars.filter(c => c.active).length} คันที่ใช้งานอยู่</p>
                <button className="btn-add" onClick={() => setShowAddForm((v) => !v)}>
                  {showAddForm ? "✕ ยกเลิก" : "+ เพิ่มรถ"}
                </button>
              </div>

              {/* ── Add form ── */}
              {showAddForm && (
                <div className="form-card">
                  <p className="form-title">🚗 เพิ่มรถใหม่</p>

                  <div className="fg">
                    <label className="fl">ชื่อรถ *</label>
                    <input className="inp" placeholder="เช่น Toyota Vios" value={newCar.name}
                      onChange={(e) => setNewCar((f) => ({ ...f, name: e.target.value }))} />
                  </div>
                  <div className="fg">
                    <label className="fl">ทะเบียน *</label>
                    <input className="inp" placeholder="เช่น กข 1234" value={newCar.plate}
                      onChange={(e) => setNewCar((f) => ({ ...f, plate: e.target.value }))} />
                  </div>
                  <div className="fg">
                    <label className="fl">URL รูปภาพ (ถ้ามี)</label>
                    <input className="inp" placeholder="/cars/vios.png" value={newCar.imageUrl}
                      onChange={(e) => setNewCar((f) => ({ ...f, imageUrl: e.target.value }))} />
                  </div>
                  <div className="fg">
                    <label className="fl">สีตัวแทน</label>
                    <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
                      {COLOR_OPTIONS.map((c) => (
                        <button key={c.color} onClick={() => setNewCar((f) => ({ ...f, color: c.color, colorLight: c.colorLight }))}
                          style={{
                            width: 32, height: 32, borderRadius: "50%", background: c.color, border: newCar.color === c.color ? "3px solid #1e293b" : "2px solid transparent",
                            cursor: "pointer", boxShadow: "0 2px 6px rgba(0,0,0,.2)",
                          }} title={c.label} />
                      ))}
                    </div>
                  </div>

                  <button className="btn-primary" disabled={!newCar.name.trim() || !newCar.plate.trim() || saving} onClick={handleAddCar}>
                    {saving ? "กำลังบันทึก…" : "✓ บันทึกรถใหม่"}
                  </button>
                </div>
              )}

              {/* ── Car list ── */}
              {loadingCars ? (
                <div className="loading"><div className="spin" /> กำลังโหลด…</div>
              ) : cars.length === 0 ? (
                <div className="empty-card">
                  <p style={{ fontSize: 28 }}>🚗</p>
                  <p className="empty-title">ยังไม่มีรถในระบบ</p>
                  <p className="empty-sub">กดปุ่ม "+ เพิ่มรถ" เพื่อเริ่มต้น</p>
                </div>
              ) : (
                <div className="list">
                  {cars.map((car) => (
                    <div key={car.id} className="car-card" style={{ opacity: car.active ? 1 : 0.55 }}>
                      <div className="car-strip" style={{ background: car.color }} />
                      <div className="car-body">
                        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                          <div>
                            <p className="car-name">{car.name}</p>
                            <p className="car-plate">{car.plate}</p>
                          </div>
                          <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                            <span className={`status-chip ${car.active ? "active" : "inactive"}`}>
                              {car.active ? "✓ ใช้งาน" : "✕ ปิด"}
                            </span>
                            <button
                              className={`toggle-btn ${car.active ? "off" : "on"}`}
                              onClick={() => handleToggleCar(car)}
                            >
                              {car.active ? "ปิดใช้งาน" : "เปิดใช้งาน"}
                            </button>
                          </div>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              )}

              {/* ── Note ── */}
              <div className="note-box">
                <p style={{ fontSize: 11, color: "#64748b", margin: 0 }}>
                  💡 <strong>หมายเหตุ:</strong> รถที่ "ปิดใช้งาน" จะไม่ปรากฏในหน้าจองรถ แต่ข้อมูลการจองเดิมยังคงอยู่
                </p>
              </div>
            </div>
          )}

          {/* ══ TAB: EXPORT ════════════════════════════════════ */}
          {tab === "export" && (
            <div>
              <div className="form-card">
                <p className="form-title">📊 Export ข้อมูลการจอง</p>

                <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10 }}>
                  <div className="fg">
                    <label className="fl">📅 จากวันที่</label>
                    <input type="date" className="inp" value={exportFrom}
                      onChange={(e) => setExportFrom(e.target.value)} />
                  </div>
                  <div className="fg">
                    <label className="fl">📅 ถึงวันที่</label>
                    <input type="date" className="inp" value={exportTo}
                      onChange={(e) => setExportTo(e.target.value)} />
                  </div>
                </div>

                {exportCount !== null && (
                  <div className={`result-box ${exportCount > 0 ? "ok" : "empty"}`}>
                    {exportCount > 0
                      ? `✅ Export สำเร็จ ${exportCount} รายการ`
                      : "⚠️ ไม่พบข้อมูลในช่วงเวลาที่เลือก"}
                  </div>
                )}

                <button className="btn-primary btn-green" disabled={exporting || exportFrom > exportTo} onClick={handleExport}>
                  {exporting ? "กำลัง Export…" : "⬇️ Download CSV"}
                </button>

                <p style={{ fontSize: 11, color: "#94a3b8", marginTop: 10, textAlign: "center" }}>
                  ไฟล์ CSV เปิดได้ใน Excel และ Google Sheets (รองรับภาษาไทย)
                </p>
              </div>

              <div className="note-box">
                <p style={{ fontSize: 11, color: "#64748b", margin: 0 }}>
                  📋 <strong>คอลัมน์ที่ได้:</strong> วันที่ใช้, เวลาออก-เข้า, รถ, ทะเบียน, ผู้จอง, ผู้ใช้รถ, จาก, ถึง, สำหรับ, สถานะ
                </p>
              </div>
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
      *,*::before,*::after { box-sizing: border-box; margin: 0; padding: 0; }
      body, * { font-family: 'Sarabun', sans-serif; }

      .page { background: #f0f4f8; min-height: 100vh; }

      .header {
        background: white; padding: 12px 16px;
        border-bottom: 1px solid #e2e8f0;
        position: sticky; top: 0; z-index: 30;
        box-shadow: 0 1px 8px rgba(0,0,0,.06);
        display: flex; align-items: center; justify-content: space-between;
      }
      .avatar { width: 38px; height: 38px; border-radius: 50%; object-fit: cover; border: 2px solid #fecaca; }
      .avatar-fallback {
        width: 38px; height: 38px; border-radius: 50%;
        background: linear-gradient(135deg,#dc2626,#991b1b);
        color: white; font-weight: 700; font-size: 16px;
        display: flex; align-items: center; justify-content: center;
      }
      .h-sub   { font-size: 9px; color: #94a3b8; margin: 0; letter-spacing: .06em; }
      .h-title { font-size: 15px; font-weight: 700; color: #1e3a5f; margin: 0; font-family: 'Prompt', sans-serif; }
      .admin-badge {
        font-size: 11px; font-weight: 700; color: #dc2626;
        background: #fef2f2; border: 1.5px solid #fecaca;
        border-radius: 20px; padding: 4px 12px;
      }

      .wrap { padding: 14px; max-width: 480px; margin: 0 auto; }

      .tab-bar { display: flex; gap: 8px; margin-bottom: 16px; }
      .tb {
        flex: 1; padding: 10px; border-radius: 12px;
        font-size: 13px; font-weight: 600; cursor: pointer;
        border: 1.5px solid #e2e8f0; background: white;
        color: #64748b; transition: all .15s;
      }
      .tb.active { background: #1d4ed8; color: white; border-color: #1d4ed8; box-shadow: 0 3px 12px rgba(29,78,216,.25); }

      .btn-add {
        padding: 8px 16px; border-radius: 20px;
        font-size: 13px; font-weight: 700; cursor: pointer;
        border: 1.5px solid #1d4ed8; background: #eff6ff;
        color: #1d4ed8; transition: all .15s;
      }
      .btn-add:hover { background: #1d4ed8; color: white; }

      .form-card {
        background: white; border-radius: 16px; padding: 18px;
        box-shadow: 0 2px 14px rgba(0,0,0,.07); margin-bottom: 12px;
      }
      .form-title { font-size: 14px; font-weight: 700; color: #1e3a5f; margin-bottom: 16px; font-family: 'Prompt', sans-serif; }

      .fg { margin-bottom: 14px; }
      .fl { display: block; font-size: 10px; font-weight: 700; color: #64748b; text-transform: uppercase; letter-spacing: .06em; margin-bottom: 6px; }
      .inp {
        width: 100%; border: 1.5px solid #e2e8f0; border-radius: 10px;
        padding: 10px 12px; font-size: 14px; color: #1e293b;
        background: #f8fafc; outline: none; transition: all .18s;
        font-family: 'Sarabun', sans-serif;
      }
      .inp:focus { border-color: #1d4ed8; background: white; box-shadow: 0 0 0 3px rgba(29,78,216,.1); }

      .btn-primary {
        width: 100%; padding: 13px; border-radius: 12px;
        font-size: 14px; font-weight: 700; color: white; border: none; cursor: pointer;
        background: linear-gradient(135deg,#1d4ed8,#1e3a5f);
        box-shadow: 0 4px 14px rgba(29,78,216,.3);
        font-family: 'Prompt', sans-serif; transition: all .18s;
        display: flex; align-items: center; justify-content: center; gap: 6px;
      }
      .btn-primary:disabled { background: #cbd5e1; box-shadow: none; cursor: not-allowed; }
      .btn-green { background: linear-gradient(135deg,#16a34a,#15803d) !important; box-shadow: 0 4px 14px rgba(22,163,74,.3) !important; }

      .loading { display: flex; align-items: center; gap: 8px; padding: 32px; justify-content: center; color: #94a3b8; font-size: 13px; }
      .spin { width: 18px; height: 18px; border: 2.5px solid #e2e8f0; border-top-color: #1d4ed8; border-radius: 50%; animation: spin .7s linear infinite; flex-shrink: 0; }
      @keyframes spin { to { transform: rotate(360deg); } }

      .empty-card { background: white; border-radius: 16px; padding: 40px 20px; text-align: center; box-shadow: 0 2px 12px rgba(0,0,0,.06); margin-bottom: 12px; }
      .empty-title { font-size: 14px; font-weight: 700; color: #1e3a5f; margin-bottom: 4px; font-family: 'Prompt', sans-serif; }
      .empty-sub   { font-size: 12px; color: #94a3b8; }

      .list { display: flex; flex-direction: column; gap: 10px; margin-bottom: 12px; }
      .car-card { background: white; border-radius: 14px; box-shadow: 0 2px 10px rgba(0,0,0,.07); display: flex; overflow: hidden; transition: opacity .2s; }
      .car-strip { width: 5px; flex-shrink: 0; }
      .car-body  { flex: 1; padding: 14px 16px; }
      .car-name  { font-size: 14px; font-weight: 700; color: #1e293b; margin: 0 0 2px; }
      .car-plate { font-size: 12px; color: #64748b; margin: 0; }

      .status-chip { font-size: 11px; font-weight: 700; border-radius: 20px; padding: 3px 10px; }
      .status-chip.active   { color: #16a34a; background: #dcfce7; }
      .status-chip.inactive { color: #94a3b8; background: #f1f5f9; }

      .toggle-btn { font-size: 11px; font-weight: 600; border-radius: 8px; padding: 5px 10px; cursor: pointer; border: 1.5px solid; transition: all .15s; }
      .toggle-btn.off { color: #dc2626; border-color: #fecaca; background: #fef2f2; }
      .toggle-btn.off:hover { background: #fee2e2; }
      .toggle-btn.on  { color: #16a34a; border-color: #bbf7d0; background: #f0fdf4; }
      .toggle-btn.on:hover  { background: #dcfce7; }

      .result-box { border-radius: 10px; padding: 10px 14px; font-size: 13px; font-weight: 600; margin-bottom: 14px; }
      .result-box.ok    { background: #f0fdf4; border: 1px solid #bbf7d0; color: #16a34a; }
      .result-box.empty { background: #fffbeb; border: 1px solid #fde68a; color: #d97706; }

      .note-box { background: #f8fafc; border: 1.5px solid #e2e8f0; border-radius: 12px; padding: 12px 14px; margin-top: 4px; }
    `}</style>
  );
}