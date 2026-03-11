// app/book/page.tsx — rebuilt to match PDF paper form
"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import {
  collection, addDoc, getDocs,
  query, where, serverTimestamp,
} from "firebase/firestore";
import { db } from "../../lib/firebase";
import liff from "@line/liff";
import type { Booking } from "../../types";

// ─────────────────────────────────────────────
// 🚗  รถบริษัท 3 คัน  (อัปเดต plate / imageUrl ตามจริง)
// ─────────────────────────────────────────────
const COMPANY_CARS = [
  {
    id: "car-mirage",
    name: "Mitsubishi Mirage",
    model: "MIRAGS",
    plate: "7ทศ1247",           // ← ตามทะเบียนใน PDF
    imageUrl: "/cars/mirage.png",
    badge: "รถบริษัท",
  },
  {
    id: "car-2",
    name: "Toyota Vios",
    model: "VIOS",
    plate: "กก 0000",           // ← เปลี่ยนทะเบียนจริง
    imageUrl: "/cars/vios.png",
    badge: "รถบริษัท",
  },
  {
    id: "car-3",
    name: "Honda City",
    model: "CITY",
    plate: "ขข 0000",           // ← เปลี่ยนทะเบียนจริง
    imageUrl: "/cars/city.png",
    badge: "รถบริษัท",
  },
];

const STEPS = ["เลือกรถ", "วันที่ & เวลา", "รายละเอียด"];

// ─────────────────────────────────────────────
// Helper: ตรวจ overlap เวลาบน Firestore
// ─────────────────────────────────────────────
async function hasTimeOverlap(
  carId: string,
  useDate: string,
  startTime: string,
  endTime: string,
): Promise<{ overlap: boolean; bookerName?: string }> {
  const q = query(
    collection(db, "bookings"),
    where("carId", "==", carId),
    where("useDate", "==", useDate),
    where("status", "in", ["booked", "active"]),
  );
  const snap = await getDocs(q);
  for (const doc of snap.docs) {
    const b = doc.data() as Booking;
    // overlap = newStart < existEnd  AND  newEnd > existStart
    if (startTime < b.endTime && endTime > b.startTime) {
      return { overlap: true, bookerName: b.bookerName };
    }
  }
  return { overlap: false };
}

// ─────────────────────────────────────────────
// Main Component
// ─────────────────────────────────────────────
export default function BookCarPage() {
  const router = useRouter();
  const [step, setStep] = useState(0);
  const [isLiffReady, setIsLiffReady] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isChecking, setIsChecking] = useState(false);
  const [conflictMsg, setConflictMsg] = useState("");
  const [submitted, setSubmitted] = useState(false);

  const todayStr = new Date().toISOString().split("T")[0];

  const [form, setForm] = useState({
    // LINE user
    bookerId: "",
    bookerName: "",
    pictureUrl: "",
    // Step 0
    carId: "car-mirage",
    // Step 1
    useDate: todayStr,
    startTime: "08:30",
    endTime: "17:00",
    // Step 2
    fromLocation: "Haru",
    toLocation: "",
    purpose: "",
    driverName: "",   // default = bookerName (set after LINE login)
  });

  // ── LIFF init ──────────────────────────────
  useEffect(() => {
    (async () => {
      try {
        await liff.init({ liffId: "2009402149-lV41Nacx" });
        if (liff.isLoggedIn()) {
          const p = await liff.getProfile();
          setForm((prev) => ({
            ...prev,
            bookerId: p.userId,
            bookerName: p.displayName,
            pictureUrl: p.pictureUrl ?? "",
            driverName: p.displayName,
          }));
          setIsLiffReady(true);
        } else {
          liff.login();
        }
      } catch (e) {
        console.error("LIFF error", e);
      }
    })();
  }, []);

  const selectedCar = COMPANY_CARS.find((c) => c.id === form.carId)!;

  // ── Field change ───────────────────────────
  const setField = (k: string, v: string) => {
    setForm((p) => ({ ...p, [k]: v }));
    if (k === "startTime" || k === "endTime") setConflictMsg("");
  };

  // ── Step guards ────────────────────────────
  const canStep0 = !!form.carId;
  const canStep1 =
    !!form.useDate &&
    !!form.startTime &&
    !!form.endTime &&
    form.startTime < form.endTime;
  const canStep2 =
    !!form.toLocation && !!form.purpose && !!form.driverName;

  // ── Step 1 → 2: check overlap ──────────────
  const proceedToStep2 = async () => {
    setIsChecking(true);
    setConflictMsg("");
    try {
      const { overlap, bookerName } = await hasTimeOverlap(
        form.carId,
        form.useDate,
        form.startTime,
        form.endTime,
      );
      if (overlap) {
        setConflictMsg(
          `❌ รถคันนี้ถูกจองช่วงเวลาดังกล่าวแล้ว (โดย ${bookerName}) กรุณาเลือกเวลาอื่น`,
        );
      } else {
        setStep(2);
      }
    } catch {
      setStep(2); // ถ้า query fail ให้ผ่านไปก่อน
    } finally {
      setIsChecking(false);
    }
  };

  // ── Submit ─────────────────────────────────
  const handleSubmit = async () => {
    setIsSubmitting(true);
    try {
      // Double-check overlap before writing
      const { overlap, bookerName } = await hasTimeOverlap(
        form.carId,
        form.useDate,
        form.startTime,
        form.endTime,
      );
      if (overlap) {
        alert(`รถถูกจองแล้วโดย ${bookerName} กรุณากลับไปเลือกเวลาใหม่`);
        setStep(1);
        return;
      }

      const now = new Date().toISOString();
      const bookingData: Omit<Booking, "id"> = {
        carId: form.carId,
        carName: selectedCar.name,
        carPlate: selectedCar.plate,
        bookerId: form.bookerId,
        bookerName: form.bookerName,
        bookedAt: now,
        driverName: form.driverName,
        fromLocation: form.fromLocation,
        toLocation: form.toLocation,
        purpose: form.purpose,
        useDate: form.useDate,
        startTime: form.startTime,
        endTime: form.endTime,
        status: "booked",
        createdAt: serverTimestamp(),
      };

      await addDoc(collection(db, "bookings"), bookingData);

      // LINE push notification
      await fetch("/api/notify", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          bookerName: form.bookerName,
          car: `${selectedCar.name} (${selectedCar.plate})`,
          destination: form.toLocation,
          date: `${form.useDate} ${form.startTime}–${form.endTime}`,
        }),
      });

      setSubmitted(true);
    } catch (e) {
      console.error(e);
      alert("เกิดข้อผิดพลาด กรุณาลองใหม่");
    } finally {
      setIsSubmitting(false);
    }
  };

  // ─────────────────────────────────────────────
  // Success Screen
  // ─────────────────────────────────────────────
  if (submitted) {
    return (
      <>
        <GlobalStyles />
        <div className="page-bg center-screen">
          <div className="success-pop" style={{ textAlign: "center", width: "100%", maxWidth: 400 }}>
            <div className="check-circle">
              <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="white" width="38" height="38">
                <path fillRule="evenodd" d="M19.916 4.626a.75.75 0 01.208 1.04l-9 13.5a.75.75 0 01-1.154.114l-6-6a.75.75 0 011.06-1.06l5.353 5.353 8.493-12.739a.75.75 0 011.04-.208z" clipRule="evenodd" />
              </svg>
            </div>
            <h2 className="success-title">จองรถสำเร็จ! 🎉</h2>
            <p style={{ color: "#64748b", fontSize: 13, marginBottom: 20 }}>ระบบส่งการแจ้งเตือนไปที่ LINE ของคุณแล้ว</p>
            <div className="white-card" style={{ textAlign: "left", marginBottom: 20 }}>
              <SummaryRow icon="🚗" label="รถ"        value={`${selectedCar.name} (${selectedCar.plate})`} />
              <SummaryRow icon="📅" label="วันที่ใช้"  value={formatDate(form.useDate)} />
              <SummaryRow icon="🕐" label="เวลาออก"   value={form.startTime} />
              <SummaryRow icon="🕔" label="เวลาเข้า"  value={form.endTime} />
              <SummaryRow icon="📍" label="จาก → ถึง" value={`${form.fromLocation} → ${form.toLocation}`} />
              <SummaryRow icon="📋" label="สำหรับ"    value={form.purpose} />
              <SummaryRow icon="👤" label="ผู้ใช้รถ"  value={form.driverName} last />
            </div>
            <button className="btn-primary" onClick={() => router.push("/")}>กลับหน้าหลัก</button>
          </div>
        </div>
      </>
    );
  }

  // ─────────────────────────────────────────────
  // Main Form
  // ─────────────────────────────────────────────
  return (
    <>
      <GlobalStyles />
      <div className="page-bg" style={{ minHeight: "100vh", paddingBottom: 32 }}>
        {/* Header */}
        <header className="app-header">
          <button className="back-btn" onClick={() => step > 0 ? setStep((s) => s - 1) : router.back()}>
            <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={2.5} stroke="currentColor" width="18" height="18">
              <path strokeLinecap="round" strokeLinejoin="round" d="M15.75 19.5L8.25 12l7.5-7.5" />
            </svg>
          </button>
          <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
            <img src="/logo.jpg" alt="HSD" style={{ width: 36, height: 36, borderRadius: 8, objectFit: "cover" }}
              onError={(e) => { (e.target as HTMLImageElement).style.display = "none"; }} />
            <div>
              <p style={{ fontSize: 10, color: "#94a3b8", margin: 0 }}>HARU SYSTEM DEVELOPMENT</p>
              <h1 style={{ fontSize: 15, fontWeight: 700, color: "#1e3a5f", margin: 0, fontFamily: "Prompt,sans-serif" }}>จองรถบริษัท</h1>
            </div>
          </div>
          {form.bookerName && (
            <div className="user-chip">
              {form.pictureUrl
                ? <img src={form.pictureUrl} alt="" style={{ width: 22, height: 22, borderRadius: "50%", objectFit: "cover" }} />
                : <div className="user-avatar">{form.bookerName.charAt(0)}</div>}
              <span>{form.bookerName.split(" ")[0]}</span>
            </div>
          )}
        </header>

        <div style={{ maxWidth: 440, margin: "0 auto", padding: "16px 16px 0" }}>
          {/* Step Indicator */}
          <div className="step-bar">
            {STEPS.map((label, i) => (
              <div key={i} style={{ display: "flex", alignItems: "center", flex: i < STEPS.length - 1 ? 1 : "none" }}>
                <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 4 }}>
                  <div className={`step-dot ${i < step ? "done" : i === step ? "active" : "idle"}`}>
                    {i < step
                      ? <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor" width="11" height="11"><path fillRule="evenodd" d="M16.704 4.153a.75.75 0 01.143 1.052l-8 10.5a.75.75 0 01-1.127.075l-4.5-4.5a.75.75 0 011.06-1.06l3.894 3.893 7.48-9.817a.75.75 0 011.05-.143z" clipRule="evenodd" /></svg>
                      : i + 1}
                  </div>
                  <span className={`step-label ${i === step ? "active" : i < step ? "done" : ""}`}>{label}</span>
                </div>
                {i < STEPS.length - 1 && <div className={`step-line ${i < step ? "done" : ""}`} />}
              </div>
            ))}
          </div>

          {/* Form Card */}
          <div className="white-card">
            {!isLiffReady ? (
              <div style={{ padding: "40px 0", textAlign: "center" }}>
                <div className="spinner" style={{ margin: "0 auto 12px" }} />
                <p style={{ fontSize: 13, color: "#94a3b8" }}>กำลังโหลดข้อมูล LINE...</p>
              </div>
            ) : (
              <>
                {/* ══ STEP 0: เลือกรถ ══ */}
                {step === 0 && (
                  <div className="step-content">
                    {/* Booker info */}
                    <div className="field-group">
                      <label className="field-label">ผู้จอง</label>
                      <div className="booker-row">
                        {form.pictureUrl
                          ? <img src={form.pictureUrl} alt="" style={{ width: 36, height: 36, borderRadius: "50%", objectFit: "cover", border: "2px solid #bfdbfe", flexShrink: 0 }} />
                          : <div className="booker-avatar">{form.bookerName.charAt(0)}</div>}
                        <div style={{ flex: 1 }}>
                          <p style={{ fontSize: 11, color: "#94a3b8", margin: 0 }}>ผู้จอง</p>
                          <p style={{ fontSize: 14, fontWeight: 700, color: "#1e293b", margin: 0 }}>{form.bookerName}</p>
                        </div>
                        <span className="verified-badge">✓ LINE</span>
                      </div>
                    </div>

                    {/* Car selection */}
                    <div className="field-group">
                      <label className="field-label">เลือกรถยนต์ *</label>
                      <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
                        {COMPANY_CARS.map((car) => {
                          const sel = form.carId === car.id;
                          return (
                            <div key={car.id} onClick={() => setField("carId", car.id)}
                              style={{ display: "flex", alignItems: "center", gap: 14, border: `2px solid ${sel ? "#1d4ed8" : "#e2e8f0"}`, borderRadius: 14, padding: "12px 14px", cursor: "pointer", background: sel ? "#eff6ff" : "white", boxShadow: sel ? "0 0 0 3px rgba(29,78,216,0.1)" : "0 1px 4px rgba(0,0,0,0.05)", transition: "all 0.2s" }}>
                              <div style={{ width: 80, height: 60, flexShrink: 0, background: sel ? "#dbeafe" : "#f1f5f9", borderRadius: 10, display: "flex", alignItems: "center", justifyContent: "center", overflow: "hidden" }}>
                                <img src={car.imageUrl} alt={car.name}
                                  style={{ width: "100%", height: "100%", objectFit: "cover", borderRadius: 10 }}
                                  onError={(e) => { (e.target as HTMLImageElement).src = "https://cdn-icons-png.flaticon.com/512/3085/3085330.png"; (e.target as HTMLImageElement).style.objectFit = "contain"; (e.target as HTMLImageElement).style.padding = "10px"; }} />
                              </div>
                              <div style={{ flex: 1 }}>
                                <span className="car-badge regular">{car.badge}</span>
                                <p style={{ fontSize: 14, fontWeight: 700, color: "#1e293b", margin: "4px 0 2px" }}>{car.name}</p>
                                <p style={{ fontSize: 12, color: "#94a3b8", margin: 0 }}>ทะเบียน: <strong>{car.plate}</strong></p>
                              </div>
                              <div style={{ width: 22, height: 22, borderRadius: "50%", flexShrink: 0, border: `2px solid ${sel ? "#1d4ed8" : "#d1d5db"}`, background: sel ? "#1d4ed8" : "white", display: "flex", alignItems: "center", justifyContent: "center", transition: "all 0.2s" }}>
                                {sel && <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="white" width="12" height="12"><path fillRule="evenodd" d="M16.704 4.153a.75.75 0 01.143 1.052l-8 10.5a.75.75 0 01-1.127.075l-4.5-4.5a.75.75 0 011.06-1.06l3.894 3.893 7.48-9.817a.75.75 0 011.05-.143z" clipRule="evenodd" /></svg>}
                              </div>
                            </div>
                          );
                        })}
                      </div>
                    </div>

                    <button type="button" disabled={!canStep0} onClick={() => setStep(1)} className="btn-primary">ถัดไป: เลือกวันที่ & เวลา →</button>
                  </div>
                )}

                {/* ══ STEP 1: วันที่ & เวลา ══ */}
                {step === 1 && (
                  <div className="step-content">
                    <div className="info-strip">
                      <img src={selectedCar.imageUrl} alt="" style={{ width: 36, height: 36, objectFit: "contain" }}
                        onError={(e) => { (e.target as HTMLImageElement).src = "https://cdn-icons-png.flaticon.com/512/3085/3085330.png"; }} />
                      <div>
                        <p style={{ fontSize: 10, color: "#64748b", margin: 0 }}>รถที่เลือก</p>
                        <p style={{ fontSize: 14, fontWeight: 700, color: "#1e3a5f", margin: 0 }}>{selectedCar.name} — {selectedCar.plate}</p>
                      </div>
                    </div>

                    {/* วันที่ใช้ */}
                    <div className="field-group">
                      <label className="field-label">📅 วันที่ใช้รถ *</label>
                      <input type="date" value={form.useDate} min={todayStr}
                        onChange={(e) => setField("useDate", e.target.value)} className="input-field" />
                    </div>

                    {/* เวลาออก / เวลาเข้า (2 columns) */}
                    <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10 }}>
                      <div className="field-group">
                        <label className="field-label">🕐 เวลาออก *</label>
                        <input type="time" value={form.startTime}
                          onChange={(e) => setField("startTime", e.target.value)} className="input-field" />
                      </div>
                      <div className="field-group">
                        <label className="field-label">🕔 เวลาเข้า *</label>
                        <input type="time" value={form.endTime}
                          onChange={(e) => setField("endTime", e.target.value)} className="input-field" />
                      </div>
                    </div>

                    {/* Duration badge */}
                    {form.startTime && form.endTime && form.startTime < form.endTime && (
                      <div className="duration-badge">
                        <span>⏱</span>
                        <div>
                          <p style={{ fontSize: 11, color: "#16a34a", margin: 0, fontWeight: 600 }}>ระยะเวลาใช้งาน</p>
                          <p style={{ fontSize: 14, fontWeight: 700, color: "#15803d", margin: 0 }}>
                            {getDuration(form.startTime, form.endTime)}
                          </p>
                        </div>
                      </div>
                    )}

                    {form.startTime >= form.endTime && form.startTime && form.endTime && (
                      <div className="error-msg">⚠️ เวลาเข้าต้องมากกว่าเวลาออก</div>
                    )}

                    {/* Conflict error */}
                    {conflictMsg && <div className="error-msg">{conflictMsg}</div>}

                    <div style={{ display: "flex", gap: 10 }}>
                      <button type="button" onClick={() => setStep(0)} className="btn-secondary">← ย้อนกลับ</button>
                      <button type="button" disabled={!canStep1 || isChecking} onClick={proceedToStep2} className="btn-primary" style={{ flex: 1 }}>
                        {isChecking ? <><span className="spinner-sm" /> กำลังตรวจสอบ...</> : "ถัดไป: รายละเอียด →"}
                      </button>
                    </div>
                  </div>
                )}

                {/* ══ STEP 2: รายละเอียด + Confirm ══ */}
                {step === 2 && (
                  <div className="step-content">
                    {/* จาก → ถึง */}
                    <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10 }}>
                      <div className="field-group">
                        <label className="field-label">📍 จาก *</label>
                        <input type="text" value={form.fromLocation}
                          onChange={(e) => setField("fromLocation", e.target.value)}
                          placeholder="Haru" className="input-field" />
                      </div>
                      <div className="field-group">
                        <label className="field-label">🏁 ถึง *</label>
                        <input type="text" value={form.toLocation}
                          onChange={(e) => setField("toLocation", e.target.value)}
                          placeholder="DCI, Daikin…" className="input-field" />
                      </div>
                    </div>

                    {/* สำหรับ */}
                    <div className="field-group">
                      <label className="field-label">📋 สำหรับ (วัตถุประสงค์) *</label>
                      <input type="text" value={form.purpose}
                        onChange={(e) => setField("purpose", e.target.value)}
                        placeholder="Install, Test run, Meeting…" className="input-field" />
                    </div>

                    {/* ผู้ใช้รถ */}
                    <div className="field-group">
                      <label className="field-label">👤 ผู้ใช้รถ *</label>
                      <input type="text" value={form.driverName}
                        onChange={(e) => setField("driverName", e.target.value)}
                        placeholder="ชื่อผู้ขับ" className="input-field" />
                    </div>

                    {/* Summary */}
                    {canStep2 && (
                      <div className="summary-box">
                        <p className="summary-title">📌 สรุปการจอง</p>
                        <SummaryRow icon="🚗" label="รถ"         value={`${selectedCar.name} (${selectedCar.plate})`} />
                        <SummaryRow icon="📅" label="วันที่ใช้"  value={formatDate(form.useDate)} />
                        <SummaryRow icon="🕐" label="ออก → กลับ" value={`${form.startTime} – ${form.endTime}`} />
                        <SummaryRow icon="📍" label="จาก → ถึง" value={`${form.fromLocation} → ${form.toLocation}`} />
                        <SummaryRow icon="📋" label="สำหรับ"    value={form.purpose} />
                        <SummaryRow icon="👤" label="ผู้ใช้รถ"  value={form.driverName} last />
                      </div>
                    )}

                    <div style={{ display: "flex", gap: 10 }}>
                      <button type="button" onClick={() => setStep(1)} className="btn-secondary">← ย้อนกลับ</button>
                      <button type="button" disabled={isSubmitting || !canStep2} onClick={handleSubmit} className="btn-primary btn-green" style={{ flex: 1 }}>
                        {isSubmitting ? <><span className="spinner-sm" /> กำลังบันทึก...</> : "✅ ยืนยันการจอง"}
                      </button>
                    </div>
                  </div>
                )}
              </>
            )}
          </div>
        </div>
      </div>
    </>
  );
}

// ─────────────────────────────────────────────
// Helper Components
// ─────────────────────────────────────────────
function SummaryRow({ icon, label, value, last }: { icon: string; label: string; value: string; last?: boolean }) {
  return (
    <div style={{ display: "flex", alignItems: "flex-start", gap: 8, paddingBottom: last ? 0 : 10, marginBottom: last ? 0 : 10, borderBottom: last ? "none" : "1px solid #f1f5f9" }}>
      <span style={{ fontSize: 14, lineHeight: 1.5 }}>{icon}</span>
      <span style={{ fontSize: 12, color: "#94a3b8", width: 76, flexShrink: 0, lineHeight: 1.5 }}>{label}</span>
      <span style={{ fontSize: 13, fontWeight: 600, color: "#1e3a5f", flex: 1, lineHeight: 1.5 }}>{value}</span>
    </div>
  );
}

function formatDate(d: string): string {
  if (!d) return "";
  return new Date(d + "T00:00:00").toLocaleDateString("th-TH", { day: "2-digit", month: "short", year: "numeric" });
}

function getDuration(start: string, end: string): string {
  const [sh, sm] = start.split(":").map(Number);
  const [eh, em] = end.split(":").map(Number);
  const mins = (eh * 60 + em) - (sh * 60 + sm);
  if (mins <= 0) return "—";
  const h = Math.floor(mins / 60);
  const m = mins % 60;
  return h > 0 ? `${h} ชม. ${m} นาที` : `${m} นาที`;
}

// ─────────────────────────────────────────────
// Global Styles
// ─────────────────────────────────────────────
function GlobalStyles() {
  return (
    <style>{`
      @import url('https://fonts.googleapis.com/css2?family=Sarabun:wght@300;400;500;600;700&family=Prompt:wght@600;700&display=swap');
      *, *::before, *::after { box-sizing: border-box; margin: 0; padding: 0; }
      body, * { font-family: 'Sarabun', sans-serif; }

      .page-bg { background: #f0f4f8; background-image: radial-gradient(circle at 20% 10%, rgba(30,58,95,0.06) 0%, transparent 50%), radial-gradient(circle at 80% 80%, rgba(22,163,74,0.05) 0%, transparent 50%); }
      .center-screen { display: flex; flex-direction: column; align-items: center; justify-content: center; min-height: 100vh; padding: 24px; }

      .app-header { position: sticky; top: 0; z-index: 20; background: white; border-bottom: 1px solid #e2e8f0; padding: 10px 16px; display: flex; align-items: center; gap: 12px; box-shadow: 0 1px 8px rgba(0,0,0,0.06); }
      .back-btn { width: 34px; height: 34px; border-radius: 10px; border: 1px solid #e2e8f0; background: #f8fafc; display: flex; align-items: center; justify-content: center; cursor: pointer; color: #475569; transition: all 0.15s; flex-shrink: 0; }
      .back-btn:hover { background: #f1f5f9; }

      .user-chip { margin-left: auto; display: flex; align-items: center; gap: 6px; background: #eff6ff; border: 1px solid #bfdbfe; border-radius: 20px; padding: 4px 10px 4px 4px; }
      .user-avatar { width: 22px; height: 22px; border-radius: 50%; background: linear-gradient(135deg,#1d4ed8,#1e3a5f); color: white; font-size: 11px; font-weight: 700; display: flex; align-items: center; justify-content: center; }
      .user-chip span { font-size: 12px; font-weight: 600; color: #1d4ed8; }

      .step-bar { display: flex; align-items: center; padding: 16px 4px 12px; }
      .step-dot { width: 26px; height: 26px; border-radius: 50%; display: flex; align-items: center; justify-content: center; font-size: 11px; font-weight: 700; transition: all 0.25s; flex-shrink: 0; }
      .step-dot.active { background: linear-gradient(135deg,#1d4ed8,#1e3a5f); color: white; box-shadow: 0 3px 10px rgba(29,78,216,0.35); }
      .step-dot.done { background: #16a34a; color: white; }
      .step-dot.idle { background: #e2e8f0; color: #94a3b8; }
      .step-label { font-size: 10px; color: #94a3b8; font-weight: 500; }
      .step-label.active { color: #1d4ed8; font-weight: 700; }
      .step-label.done { color: #16a34a; }
      .step-line { flex: 1; height: 2px; background: #e2e8f0; margin: 0 6px; margin-bottom: 14px; transition: background 0.25s; border-radius: 2px; }
      .step-line.done { background: #16a34a; }

      .white-card { background: white; border-radius: 18px; padding: 20px; box-shadow: 0 2px 16px rgba(0,0,0,0.07), 0 0 0 1px rgba(0,0,0,0.04); }
      .step-content { animation: slideIn 0.3s cubic-bezier(0.25,1,0.5,1); }
      @keyframes slideIn { from { opacity:0; transform: translateX(16px); } to { opacity:1; transform: translateX(0); } }

      .field-group { margin-bottom: 16px; }
      .field-label { display: block; font-size: 11px; font-weight: 700; color: #64748b; text-transform: uppercase; letter-spacing: 0.06em; margin-bottom: 7px; }
      .input-field { width: 100%; border: 1.5px solid #e2e8f0; border-radius: 11px; padding: 11px 13px; font-size: 14px; color: #1e293b; background: #f8fafc; outline: none; transition: all 0.18s; font-family: 'Sarabun',sans-serif; }
      .input-field:focus { border-color: #1d4ed8; background: white; box-shadow: 0 0 0 3px rgba(29,78,216,0.1); }

      .booker-row { display: flex; align-items: center; gap: 10px; background: #f8fafc; border: 1.5px solid #e2e8f0; border-radius: 11px; padding: 10px 13px; }
      .booker-avatar { width: 32px; height: 32px; border-radius: 50%; background: linear-gradient(135deg,#1d4ed8,#1e3a5f); color: white; font-size: 13px; font-weight: 700; display: flex; align-items: center; justify-content: center; flex-shrink: 0; }
      .verified-badge { font-size: 11px; font-weight: 700; color: #16a34a; background: #dcfce7; border: 1px solid #bbf7d0; border-radius: 20px; padding: 2px 8px; }

      .car-badge { display: inline-block; font-size: 10px; font-weight: 700; border-radius: 20px; padding: 2px 7px; }
      .car-badge.regular { background: #dcfce7; color: #16a34a; }

      .info-strip { display: flex; align-items: center; gap: 12px; background: #eff6ff; border: 1px solid #bfdbfe; border-radius: 12px; padding: 10px 14px; margin-bottom: 16px; }
      .duration-badge { display: flex; align-items: center; gap: 10px; background: #f0fdf4; border: 1px solid #bbf7d0; border-radius: 12px; padding: 10px 14px; margin-bottom: 16px; font-size: 18px; }
      .error-msg { background: #fef2f2; border: 1px solid #fecaca; color: #dc2626; border-radius: 10px; padding: 10px 14px; font-size: 13px; margin-bottom: 14px; }

      .summary-box { background: #f8fafc; border: 1.5px solid #e2e8f0; border-radius: 13px; padding: 14px; margin-bottom: 16px; }
      .summary-title { font-size: 11px; font-weight: 700; color: #1d4ed8; text-transform: uppercase; letter-spacing: 0.06em; margin-bottom: 12px; }

      .btn-primary { width: 100%; padding: 14px; border-radius: 12px; font-size: 14px; font-weight: 700; color: white; border: none; cursor: pointer; transition: all 0.18s; background: linear-gradient(135deg,#1d4ed8,#1e3a5f); box-shadow: 0 4px 14px rgba(29,78,216,0.3); font-family: 'Prompt',sans-serif; letter-spacing: 0.02em; display: flex; align-items: center; justify-content: center; gap: 6px; }
      .btn-primary:hover:not(:disabled) { transform: translateY(-1px); box-shadow: 0 6px 18px rgba(29,78,216,0.35); }
      .btn-primary:disabled { background: #cbd5e1; box-shadow: none; cursor: not-allowed; }
      .btn-green { background: linear-gradient(135deg,#16a34a,#15803d) !important; box-shadow: 0 4px 14px rgba(22,163,74,0.3) !important; }
      .btn-secondary { padding: 14px 18px; border-radius: 12px; font-size: 13px; font-weight: 600; color: #475569; background: #f1f5f9; border: 1.5px solid #e2e8f0; cursor: pointer; transition: all 0.18s; white-space: nowrap; font-family: 'Sarabun',sans-serif; }
      .btn-secondary:hover { background: #e2e8f0; }

      .spinner { width: 24px; height: 24px; border: 3px solid #e2e8f0; border-top-color: #1d4ed8; border-radius: 50%; animation: spin 0.7s linear infinite; }
      .spinner-sm { display: inline-block; width: 14px; height: 14px; border: 2px solid rgba(255,255,255,0.4); border-top-color: white; border-radius: 50%; animation: spin 0.7s linear infinite; flex-shrink: 0; }
      @keyframes spin { to { transform: rotate(360deg); } }

      .check-circle { width: 80px; height: 80px; border-radius: 50%; background: linear-gradient(135deg,#22c55e,#16a34a); margin: 0 auto 20px; display: flex; align-items: center; justify-content: center; box-shadow: 0 8px 24px rgba(34,197,94,0.3); }
      .success-title { font-family: 'Prompt',sans-serif; font-size: 22px; font-weight: 700; color: #1e3a5f; margin-bottom: 4px; }
      .success-pop { animation: popIn 0.55s cubic-bezier(0.34,1.56,0.64,1); }
      @keyframes popIn { from { opacity:0; transform: scale(0.85); } to { opacity:1; transform: scale(1); } }
    `}</style>
  );
}