// app/admin/page.tsx
"use client";

import { useEffect, useState, useRef } from "react";
import { useRouter } from "next/navigation";
import {
  collection, getDocs, addDoc, updateDoc, deleteDoc, doc,
  query, orderBy, where, serverTimestamp,
} from "firebase/firestore";
import { ref, uploadBytesResumable, getDownloadURL, deleteObject } from "firebase/storage";
import { db, storage } from "../../lib/firebase";
import { useLiff } from "../../lib/liff-context";
import BottomNav from "../components/BottomNav";
import type { Booking } from "../../types";
import * as XLSX from 'xlsx';
interface CarDoc {
  id: string;
  name: string;
  plate: string;
  color: string;
  colorLight: string;
  imageUrl: string;
  storagePath?: string;
  active: boolean;
  createdAt?: any;
}

function todayStr() { return new Date().toISOString().split("T")[0]; }

function fmtDateTH(d: string) {
  return new Date(d + "T00:00:00").toLocaleDateString("th-TH", {
    weekday: "short", day: "numeric", month: "short", year: "numeric",
  });
}

const STATUS_LABEL: Record<string, string> = {
  booked: "จองแล้ว", active: "กำลังใช้งาน", completed: "คืนรถแล้ว", cancelled: "ยกเลิกการจอง",
};
const STATUS_STYLE: Record<string, { bg: string; text: string; dot: string }> = {
  booked:    { bg: "#dbeafe", text: "#1d4ed8", dot: "#3b82f6" },
  active:    { bg: "#dcfce7", text: "#16a34a", dot: "#22c55e" },
  completed: { bg: "#f1f5f9", text: "#64748b", dot: "#94a3b8" },
  cancelled: { bg: "#fee2e2", text: "#dc2626", dot: "#ef4444" },
};

// ✅ Pastel color options
const COLOR_OPTIONS = [
  { color: "#60a5fa", colorLight: "#dbeafe", label: "ฟ้าอ่อน" },
  { color: "#a78bfa", colorLight: "#ede9fe", label: "ม่วงอ่อน" },
  { color: "#34d399", colorLight: "#d1fae5", label: "เขียวมิ้นต์" },
  { color: "#f472b6", colorLight: "#fce7f3", label: "ชมพู" },
  { color: "#fb923c", colorLight: "#ffedd5", label: "ส้มอ่อน" },
  { color: "#94a3b8", colorLight: "#f1f5f9", label: "เทา" },
];

function ImgWithSkeleton({ src, alt }: { src: string; alt: string }) {
  const [loaded, setLoaded] = useState(false);
  const [error, setError]   = useState(false);
  return (
    <div style={{ position: "relative", width: "100%", height: "100%" }}>
      {!loaded && !error && (
        <div style={{
          position: "absolute", inset: 0,
          background: "linear-gradient(90deg,#e2e8f0 25%,#f1f5f9 50%,#e2e8f0 75%)",
          backgroundSize: "200% 100%",
          animation: "shimmer 1.4s infinite",
        }} />
      )}
      {error
        ? <div style={{ fontSize: 28, position: "absolute", inset: 0, display: "flex", alignItems: "center", justifyContent: "center" }}>🚗</div>
        : <img
            src={src} alt={alt}
            onLoad={() => setLoaded(true)}
            onError={() => { setError(true); setLoaded(true); }}
            style={{ width: "100%", height: "100%", objectFit: "cover", display: "block", opacity: loaded ? 1 : 0, transition: "opacity 0.25s ease" }}
          />
      }
    </div>
  );
}

function compressImage(file: File, maxWidth = 1200, quality = 0.8): Promise<File> {
  return new Promise((resolve) => {
    const img = new Image();
    const url = URL.createObjectURL(file);
    img.onload = () => {
      URL.revokeObjectURL(url);
      const scale = Math.min(1, maxWidth / img.width);
      const canvas = document.createElement("canvas");
      canvas.width  = img.width  * scale;
      canvas.height = img.height * scale;
      canvas.getContext("2d")!.drawImage(img, 0, 0, canvas.width, canvas.height);
      canvas.toBlob(
        (blob) => resolve(new File([blob!], file.name.replace(/\.[^.]+$/, ".jpg"), { type: "image/jpeg" })),
        "image/jpeg",
        quality,
      );
    };
    img.src = url;
  });
}

export default function AdminPage() {
  const router = useRouter();
  const { user, isAdmin, isReady } = useLiff();
  const fileInputRef = useRef<HTMLInputElement>(null);

  const [tab, setTab] = useState<"cars" | "export">("cars");

  // ── Cars state ──
  const [cars, setCars]                     = useState<CarDoc[]>([]);
  const [loadingCars, setLoadingCars]       = useState(true);
  const [showAddForm, setShowAddForm]       = useState(false);
  const [saving, setSaving]                 = useState(false);
  const [uploadProgress, setUploadProgress] = useState<number | null>(null);
  const [previewUrl, setPreviewUrl]         = useState<string | null>(null);
  const [imageFile, setImageFile]           = useState<File | null>(null);
  const [newCar, setNewCar] = useState({
    name: "", plate: "",
    color: COLOR_OPTIONS[0].color,
    colorLight: COLOR_OPTIONS[0].colorLight,
  });


  const [exportFrom,  setExportFrom]  = useState(todayStr());
const [exportTo,    setExportTo]    = useState(todayStr());
const [exporting,   setExporting]   = useState(false);
const [exportCount, setExportCount] = useState<number | null>(null);

  useEffect(() => { if (isReady && !isAdmin) router.replace("/"); }, [isReady, isAdmin, router]);

  useEffect(() => {
    if (!isAdmin) return;
    (async () => {
      setLoadingCars(true);
      try {
        const snap = await getDocs(query(collection(db, "cars"), orderBy("createdAt", "asc")));
        setCars(snap.docs.map((d) => ({ id: d.id, ...d.data() } as CarDoc)));
      } catch (e) { console.error(e); }
      finally { setLoadingCars(false); }
    })();
  }, [isAdmin]);

  // ── Car handlers ──
const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
  const file = e.target.files?.[0];
  if (!file) return;
  if (!file.type.startsWith("image/")) { alert("กรุณาเลือกไฟล์รูปภาพ"); return; }
  if (file.size > 10 * 1024 * 1024) { alert("ไฟล์ใหญ่เกิน 10MB"); return; }

  const compressed = await compressImage(file);

  setImageFile(compressed);
  setPreviewUrl(URL.createObjectURL(compressed));
};

  const uploadImage = (file: File, carName: string): Promise<{ url: string; path: string }> =>
    new Promise((resolve, reject) => {
      const ext  = file.name.split(".").pop();
      const path = `cars/${Date.now()}_${carName.replace(/\s/g, "_")}.${ext}`;
      const task = uploadBytesResumable(ref(storage, path), file);
      task.on("state_changed",
        (s) => setUploadProgress(Math.round((s.bytesTransferred / s.totalBytes) * 100)),
        reject,
        async () => resolve({ url: await getDownloadURL(task.snapshot.ref), path }),
      );
    });

  const handleAddCar = async () => {
    if (!newCar.name.trim() || !newCar.plate.trim()) return;
    setSaving(true); setUploadProgress(null);
    try {
      let imageUrl = "", storagePath = "";
      if (imageFile) { const r = await uploadImage(imageFile, newCar.name); imageUrl = r.url; storagePath = r.path; }
      const docRef = await addDoc(collection(db, "cars"), {
        name: newCar.name.trim(), plate: newCar.plate.trim(),
        color: newCar.color, colorLight: newCar.colorLight,
        imageUrl, storagePath, active: true, createdAt: serverTimestamp(),
      });
      setCars((prev) => [...prev, { id: docRef.id, name: newCar.name.trim(), plate: newCar.plate.trim(), color: newCar.color, colorLight: newCar.colorLight, imageUrl, storagePath, active: true }]);
      setNewCar({ name: "", plate: "", color: COLOR_OPTIONS[0].color, colorLight: COLOR_OPTIONS[0].colorLight });
      setImageFile(null); setPreviewUrl(null); setUploadProgress(null);
      if (fileInputRef.current) fileInputRef.current.value = "";
      setShowAddForm(false);
    } catch (e) { alert("เพิ่มรถไม่สำเร็จ"); console.error(e); }
    finally { setSaving(false); }
  };

  const handleToggleCar = async (car: CarDoc) => {
    const next = !car.active;
    if (!confirm(`${next ? "เปิดใช้งาน" : "ปิดใช้งาน"} "${car.name}" ?`)) return;
    try {
      await updateDoc(doc(db, "cars", car.id), { active: next });
      setCars((prev) => prev.map((c) => c.id === car.id ? { ...c, active: next } : c));
    } catch { alert("แก้ไขไม่สำเร็จ"); }
  };

  const handleDeleteCar = async (car: CarDoc) => {
    if (!confirm(`⚠️ ลบ "${car.name}" ถาวร?\n\nรูปภาพจะถูกลบออกจาก Storage ด้วย`)) return;
    try {
      if (car.storagePath) { try { await deleteObject(ref(storage, car.storagePath)); } catch {} }
      await deleteDoc(doc(db, "cars", car.id));
      setCars((prev) => prev.filter((c) => c.id !== car.id));
    } catch { alert("ลบไม่สำเร็จ"); }
  };

  // ── Search handler ──
  function exportExcel(bookings: Booking[]) {
  const rows = bookings.map((b) => ({
    "วันที่ใช้": b.useDate,
    "เวลาออก":  b.startTime,
    "เวลาเข้า": b.endTime,
    "รถ":       b.carName,
    "ทะเบียน":  b.carPlate,
    "ผู้จอง":   b.bookerName,
    "ผู้ใช้รถ": b.driverName,
    "จาก":      b.fromLocation,
    "ถึง":      b.toLocation,
    "สำหรับ":   b.purpose,
    "สถานะ": STATUS_LABEL[b.status] ?? b.status,
  }));
  const ws = XLSX.utils.json_to_sheet(rows);
  ws["!cols"] = Object.keys(rows[0] || {}).map(() => ({ wch: 18 }));
  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, ws, "การจอง");
  XLSX.writeFile(wb, `bookings_${todayStr()}.xlsx`);
}

const handleExport = async () => {
  setExporting(true); setExportCount(null);
  try {
    const snap = await getDocs(query(
      collection(db, "bookings"),
      where("useDate", ">=", exportFrom),
      where("useDate", "<=", exportTo),
      orderBy("useDate", "asc"),
      orderBy("startTime", "asc"),
    ));
    const data = snap.docs.map((d) => ({ id: d.id, ...d.data() } as Booking));
    setExportCount(data.length);
    if (data.length > 0) exportExcel(data);
  } catch { alert("Export ไม่สำเร็จ"); }
  finally { setExporting(false); }
};

  if (!isReady || !isAdmin) return (
    <><Styles />
      <div style={{ minHeight: "100vh", display: "flex", alignItems: "center", justifyContent: "center", background: "#f0f4f8" }}>
        <p style={{ color: "#94a3b8" }}>กำลังโหลด…</p>
      </div>
    </>
  );


  return (
    <><Styles />
      <div className="page">
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
          {/* Tab bar */}
          <div className="tab-bar">
            <button className={`tb ${tab === "cars" ? "active" : ""}`} onClick={() => setTab("cars")}>🚗 จัดการรถ</button>
            <button className={`tb ${tab === "export" ? "active" : ""}`} onClick={() => setTab("export")}>📊 Export Excel</button>
          </div>

          {/* ══ CARS TAB ══ */}
          {tab === "cars" && (
            <div>
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 12 }}>
                <p style={{ fontSize: 12, color: "#64748b" }}>{cars.filter(c => c.active).length} คันใช้งานอยู่ / {cars.length} ทั้งหมด</p>
                <button className="btn-add" onClick={() => setShowAddForm((v) => !v)}>{showAddForm ? "✕ ยกเลิก" : "+ เพิ่มรถ"}</button>
              </div>

              {showAddForm && (
                <div className="form-card">
                  <p className="form-title">🚗 เพิ่มรถใหม่</p>
                  <div className="fg">
                    <label className="fl">ชื่อรถ *</label>
                    <input className="inp" placeholder="เช่น Toyota Vios" value={newCar.name} onChange={(e) => setNewCar((f) => ({ ...f, name: e.target.value }))} />
                  </div>
                  <div className="fg">
                    <label className="fl">ทะเบียน *</label>
                    <input className="inp" placeholder="เช่น กข 1234" value={newCar.plate} onChange={(e) => setNewCar((f) => ({ ...f, plate: e.target.value }))} />
                  </div>
                  <div className="fg">
                    <label className="fl">รูปภาพรถ</label>
                    <div className="upload-zone" onClick={() => fileInputRef.current?.click()} style={{ borderColor: previewUrl ? "#60a5fa" : "#e2e8f0" }}>
                      {previewUrl ? (
                        <div style={{ position: "relative" }}>
                          <img src={previewUrl} alt="" style={{ width: "100%", height: 160, objectFit: "cover", borderRadius: 8, display: "block" }} />
                          <button onClick={(e) => { e.stopPropagation(); setPreviewUrl(null); setImageFile(null); if (fileInputRef.current) fileInputRef.current.value = ""; }}
                            style={{ position: "absolute", top: 6, right: 6, width: 26, height: 26, borderRadius: "50%", background: "#ef4444", color: "white", border: "none", cursor: "pointer", fontSize: 12, fontWeight: 700 }}>✕</button>
                        </div>
                      ) : (
                        <div style={{ textAlign: "center", padding: "28px 0" }}>
                          <div style={{ fontSize: 32, marginBottom: 6 }}>📷</div>
                          <p style={{ fontSize: 13, color: "#64748b", margin: 0 }}>กดเพื่อเลือกรูปภาพ</p>
                          <p style={{ fontSize: 11, color: "#94a3b8", margin: "4px 0 0" }}>JPG, PNG ไม่เกิน 5MB</p>
                        </div>
                      )}
                    </div>
                    <input ref={fileInputRef} type="file" accept="image/*" style={{ display: "none" }} onChange={handleFileChange} />
                  </div>

                  {uploadProgress !== null && (
                    <div style={{ marginBottom: 14 }}>
                      <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 4 }}>
                        <span style={{ fontSize: 11, color: "#64748b" }}>กำลังอัพโหลด…</span>
                        <span style={{ fontSize: 11, fontWeight: 700, color: "#1d4ed8" }}>{uploadProgress}%</span>
                      </div>
                      <div style={{ height: 6, background: "#e2e8f0", borderRadius: 4, overflow: "hidden" }}>
                        <div style={{ height: "100%", width: `${uploadProgress}%`, background: "linear-gradient(90deg,#60a5fa,#1d4ed8)", borderRadius: 4, transition: "width .2s" }} />
                      </div>
                    </div>
                  )}

                  <div className="fg">
                    <label className="fl">สีตัวแทน</label>
                    <div style={{ display: "flex", gap: 10, flexWrap: "wrap" }}>
                      {COLOR_OPTIONS.map((c) => (
                        <button key={c.color} onClick={() => setNewCar((f) => ({ ...f, color: c.color, colorLight: c.colorLight }))}
                          style={{ width: 36, height: 36, borderRadius: 10, background: c.colorLight, border: newCar.color === c.color ? `3px solid ${c.color}` : "2px solid #e2e8f0", cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center", transition: "all .15s", boxShadow: newCar.color === c.color ? `0 2px 8px ${c.color}66` : "none" }}>
                          <div style={{ width: 18, height: 18, borderRadius: 6, background: c.color }} />
                        </button>
                      ))}
                    </div>
                  </div>

                  <button className="btn-primary" disabled={!newCar.name.trim() || !newCar.plate.trim() || saving} onClick={handleAddCar}>
                    {saving ? (uploadProgress !== null ? `อัพโหลด ${uploadProgress}%…` : "กำลังบันทึก…") : "✓ บันทึกรถใหม่"}
                  </button>
                </div>
              )}

              {loadingCars ? (
                <div className="loading"><div className="spin" /> กำลังโหลด…</div>
              ) : cars.length === 0 ? (
                <div className="empty-card"><p style={{ fontSize: 28 }}>🚗</p><p className="empty-title">ยังไม่มีรถในระบบ</p><p className="empty-sub">กดปุ่ม "+ เพิ่มรถ"</p></div>
              ) : (
                <div className="list">
                  {cars.map((car) => (
                    <div key={car.id} className="car-card" style={{ opacity: car.active ? 1 : 0.6 }}>
                      <div className="car-img-wrap" style={{ background: car.colorLight }}>
                        {car.imageUrl
  ? <ImgWithSkeleton src={car.imageUrl} alt={car.name} />
  : <div style={{ fontSize: 28, display: "flex", alignItems: "center", justifyContent: "center", height: "100%" }}>🚗</div>
}
                        <div style={{ position: "absolute", bottom: 0, left: 0, right: 0, height: 3, background: car.color }} />
                      </div>
                      <div className="car-info">
                        <div style={{ flex: 1 }}>
                          <p className="car-name">{car.name}</p>
                          <div style={{ display: "flex", alignItems: "center", gap: 5, marginTop: 2 }}>
                            <div style={{ width: 8, height: 8, borderRadius: 3, background: car.color, flexShrink: 0 }} />
                            <p className="car-plate">{car.plate}</p>
                          </div>
                        </div>
                        <div style={{ display: "flex", flexDirection: "column", alignItems: "flex-end", gap: 6 }}>
                          <span className={`status-chip ${car.active ? "active" : "inactive"}`}>
                            {car.active ? "✓ ใช้งาน" : "✕ ปิด"}
                          </span>
                          <div style={{ display: "flex", gap: 6 }}>
                            <button className={`action-btn ${car.active ? "btn-pause" : "btn-resume"}`} onClick={() => handleToggleCar(car)}>
                              {car.active ? "ปิด" : "เปิด"}
                            </button>
                            <button className="action-btn btn-delete" onClick={() => handleDeleteCar(car)}>ลบ</button>
                          </div>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              )}

              <div className="note-box">
                <p style={{ fontSize: 11, color: "#64748b", margin: 0 }}>
                  💡 <strong>ปิด</strong> = ซ่อนจากหน้าจอง ประวัติยังอยู่ &nbsp;|&nbsp; <strong>ลบ</strong> = ลบถาวรรวมถึงรูปภาพใน Storage
                </p>
              </div>
            </div>
          )}

          {/* ══ EXPORT TAB ══ */}
{tab === "export" && (
  <div>
    <div className="form-card">
      <p className="form-title">📊 Export ข้อมูลการจองเป็น Excel</p>
      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10 }}>
        <div className="fg">
          <label className="fl">📅 จากวันที่</label>
          <input type="date" className="inp" value={exportFrom} onChange={(e) => setExportFrom(e.target.value)} />
        </div>
        <div className="fg">
          <label className="fl">📅 ถึงวันที่</label>
          <input type="date" className="inp" value={exportTo} onChange={(e) => setExportTo(e.target.value)} />
        </div>
      </div>
      <button className="btn-primary btn-green" disabled={exporting || exportFrom > exportTo} onClick={handleExport}>
        {exporting ? "กำลัง Export…" : "⬇️ Download Excel (.xlsx)"}
      </button>

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
      *,*::before,*::after{box-sizing:border-box;margin:0;padding:0}
      body,*{font-family:'Sarabun',sans-serif}
      .page{background:#f0f4f8;min-height:100vh}
      .header{background:white;padding:12px 16px;border-bottom:1px solid #e2e8f0;position:sticky;top:0;z-index:30;box-shadow:0 1px 8px rgba(0,0,0,.06);display:flex;align-items:center;justify-content:space-between}
      .avatar{width:38px;height:38px;border-radius:50%;object-fit:cover;border:2px solid #e2e8f0}
      .avatar-fallback{width:38px;height:38px;border-radius:50%;background:linear-gradient(135deg,#60a5fa,#1d4ed8);color:white;font-weight:700;font-size:16px;display:flex;align-items:center;justify-content:center}
      .h-sub{font-size:9px;color:#94a3b8;margin:0}
      .h-title{font-size:15px;font-weight:700;color:#1e3a5f;margin:0;font-family:'Prompt',sans-serif}
      .admin-badge{font-size:11px;font-weight:700;color:#1d4ed8;background:#eff6ff;border:1.5px solid #bfdbfe;border-radius:20px;padding:4px 12px}
      .wrap{padding:14px;max-width:480px;margin:0 auto}
      .tab-bar{display:flex;gap:8px;margin-bottom:16px}
      .tb{flex:1;padding:10px;border-radius:12px;font-size:13px;font-weight:600;cursor:pointer;border:1.5px solid #e2e8f0;background:white;color:#64748b;transition:all .15s}
      .tb.active{background:#1d4ed8;color:white;border-color:#1d4ed8;box-shadow:0 3px 12px rgba(29,78,216,.25)}
      .btn-add{padding:8px 16px;border-radius:20px;font-size:13px;font-weight:700;cursor:pointer;border:1.5px solid #1d4ed8;background:#eff6ff;color:#1d4ed8;transition:all .15s}
      .btn-add:hover{background:#1d4ed8;color:white}
      .form-card{background:white;border-radius:16px;padding:18px;box-shadow:0 2px 14px rgba(0,0,0,.07);margin-bottom:12px}
      .form-title{font-size:14px;font-weight:700;color:#1e3a5f;margin-bottom:16px;font-family:'Prompt',sans-serif}
      .fg{margin-bottom:14px}
      .fl{display:block;font-size:10px;font-weight:700;color:#64748b;text-transform:uppercase;letter-spacing:.06em;margin-bottom:6px}
      .inp{width:100%;border:1.5px solid #e2e8f0;border-radius:10px;padding:10px 12px;font-size:14px;color:#1e293b;background:#f8fafc;outline:none;transition:all .18s;font-family:'Sarabun',sans-serif}
      .inp:focus{border-color:#1d4ed8;background:white;box-shadow:0 0 0 3px rgba(29,78,216,.1)}
      .upload-zone{border:2px dashed #e2e8f0;border-radius:12px;cursor:pointer;overflow:hidden;transition:border-color .2s,background .2s;background:#f8fafc}
      .upload-zone:hover{border-color:#60a5fa;background:#f0f9ff}
      .btn-primary{width:100%;padding:13px;border-radius:12px;font-size:14px;font-weight:700;color:white;border:none;cursor:pointer;background:linear-gradient(135deg,#1d4ed8,#1e3a5f);box-shadow:0 4px 14px rgba(29,78,216,.3);font-family:'Prompt',sans-serif;transition:all .18s;display:flex;align-items:center;justify-content:center;gap:6px}
      .btn-primary:disabled{background:#cbd5e1;box-shadow:none;cursor:not-allowed}
      .loading{display:flex;align-items:center;gap:8px;padding:32px;justify-content:center;color:#94a3b8;font-size:13px}
      .spin{width:18px;height:18px;border:2.5px solid #e2e8f0;border-top-color:#1d4ed8;border-radius:50%;animation:spin .7s linear infinite;flex-shrink:0}
      .spin-sm{display:inline-block;width:13px;height:13px;border:2px solid rgba(255,255,255,.4);border-top-color:white;border-radius:50%;animation:spin .7s linear infinite;flex-shrink:0}
      @keyframes spin{to{transform:rotate(360deg)}}
      .empty-card{background:white;border-radius:16px;padding:40px 20px;text-align:center;box-shadow:0 2px 12px rgba(0,0,0,.06);margin-bottom:12px}
      .empty-title{font-size:14px;font-weight:700;color:#1e3a5f;margin-bottom:4px;font-family:'Prompt',sans-serif}
      .empty-sub{font-size:12px;color:#94a3b8}
      .list{display:flex;flex-direction:column;gap:10px;margin-bottom:12px}

      /* Car card */
      .car-card{background:white;border-radius:16px;box-shadow:0 2px 12px rgba(0,0,0,.07);display:flex;overflow:hidden;transition:opacity .2s,box-shadow .2s;min-height:90px}
      .car-card:hover{box-shadow:0 4px 18px rgba(0,0,0,.11)}
      .car-img-wrap{width:90px;flex-shrink:0;position:relative;overflow:hidden}
      .car-img{width:100%;height:100%;object-fit:cover;display:block}
      .car-info{flex:1;padding:12px 14px;display:flex;justify-content:space-between;align-items:center;gap:10}
      .car-name{font-size:14px;font-weight:700;color:#1e293b;margin:0}
      .car-plate{font-size:12px;color:#64748b;margin:0}
      .status-chip{font-size:11px;font-weight:700;border-radius:20px;padding:3px 10px;white-space:nowrap}
      .status-chip.active{color:#16a34a;background:#dcfce7}
      .status-chip.inactive{color:#94a3b8;background:#f1f5f9}
      .action-btn{font-size:11px;font-weight:700;border-radius:8px;padding:5px 12px;cursor:pointer;border:none;transition:all .15s;white-space:nowrap}
      .btn-pause{color:#92400e;background:#fef3c7}.btn-pause:hover{background:#fde68a}
      .btn-resume{color:#166534;background:#dcfce7}.btn-resume:hover{background:#bbf7d0}
      .btn-delete{color:#dc2626;background:#fee2e2}.btn-delete:hover{background:#fecaca}
      .note-box{background:#f8fafc;border:1.5px solid #e2e8f0;border-radius:12px;padding:12px 14px;margin-top:4px}

      /* Booking card */
      .bk-card{background:white;border-radius:12px;box-shadow:0 2px 10px rgba(0,0,0,.07);display:flex;overflow:hidden;transition:box-shadow .2s}
      .bk-card:hover{box-shadow:0 4px 16px rgba(0,0,0,.11)}
      @keyframes shimmer {
  0%   { background-position: 200% 0 }
  100% { background-position: -200% 0 }
}
      @media (min-width: 768px) {
  .wrap { max-width: 960px; padding: 20px 28px; }
  .list { display: grid; grid-template-columns: 1fr 1fr; align-items: start; }
  .car-card { min-height: 100px; }
}
      
    `}</style>
  );
}