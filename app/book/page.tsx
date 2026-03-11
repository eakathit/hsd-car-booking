// app/book/page.tsx — ใช้ useLiff() แทน liff.init() โดยตรง
"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import {
  collection, getDocs, query, where,
  serverTimestamp, runTransaction, doc,
} from "firebase/firestore";
import { db } from "../../lib/firebase";
import { COMPANY_CARS } from "../../lib/cars";
import type { Booking } from "../../types";
import { useLiff } from "../../lib/liff-context"; // ✅ ใช้ context

const STEPS = ["วันที่ & เวลา", "เลือกรถ", "รายละเอียด"];

async function getCarAvailability(
  useDate: string,
  startTime: string,
  endTime: string,
): Promise<Record<string, { available: boolean; bookerName: string; startTime: string; endTime: string }>> {
  const q = query(
    collection(db, "bookings"),
    where("useDate", "==", useDate),
    where("status", "in", ["booked", "active"]),
  );
  const snap = await getDocs(q);

  const result: Record<string, { available: boolean; bookerName: string; startTime: string; endTime: string }> = {};
  for (const car of COMPANY_CARS) {
    result[car.id] = { available: true, bookerName: "", startTime: "", endTime: "" };
  }

  for (const d of snap.docs) {
    const b = d.data() as Booking;
    if (startTime < b.endTime && endTime > b.startTime) {
      result[b.carId] = {
        available: false,
        bookerName: b.bookerName,
        startTime: b.startTime,
        endTime: b.endTime,
      };
    }
  }
  return result;
}

function todayStr() { return new Date().toISOString().split("T")[0]; }
function fmtDate(d: string) {
  return new Date(d + "T00:00:00").toLocaleDateString("th-TH", {
    day: "2-digit", month: "short", year: "numeric",
  });
}
function getDuration(s: string, e: string) {
  const [sh, sm] = s.split(":").map(Number);
  const [eh, em] = e.split(":").map(Number);
  const m = (eh * 60 + em) - (sh * 60 + sm);
  if (m <= 0) return "—";
  const h = Math.floor(m / 60), r = m % 60;
  return h > 0 ? `${h} ชม. ${r} นาที` : `${r} นาที`;
}

export default function BookPage() {
  const router = useRouter();

  // ✅ ดึง user จาก LiffProvider — ไม่ init ซ้ำ
  const { user, isReady } = useLiff();

  const [step, setStep]                   = useState(0);
  const [isLoadingCars, setIsLoadingCars] = useState(false);
  const [isSubmitting, setIsSubmitting]   = useState(false);
  const [submitted, setSubmitted]         = useState(false);

  const [availability, setAvailability] = useState<
    Record<string, { available: boolean; bookerName: string; startTime: string; endTime: string }>
  >({});

  const [form, setForm] = useState({
    bookerId: "", bookerName: "", pictureUrl: "",
    useDate: todayStr(), startTime: "08:30", endTime: "17:00",
    carId: "",
    fromLocation: "Haru", toLocation: "", purpose: "", driverName: "",
  });

  // ✅ sync user จาก context เข้า form เมื่อพร้อม
  useEffect(() => {
    if (isReady && user) {
      setForm((f) => ({
        ...f,
        bookerId:   user.userId,
        bookerName: user.displayName,
        pictureUrl: user.pictureUrl ?? "",
        driverName: f.driverName || user.displayName,
      }));
    }
  }, [isReady, user]);

  const set = (k: string, v: string) => setForm((f) => ({ ...f, [k]: v }));
  const selectedCar = COMPANY_CARS.find((c) => c.id === form.carId);

  const ok0 = !!form.useDate && !!form.startTime && !!form.endTime && form.startTime < form.endTime;
  const ok1 = !!form.carId && availability[form.carId]?.available === true;
  const ok2 = !!form.toLocation && !!form.purpose && !!form.driverName;

  const goStep1 = async () => {
    setIsLoadingCars(true);
    try {
      const av = await getCarAvailability(form.useDate, form.startTime, form.endTime);
      setAvailability(av);
      if (form.carId && !av[form.carId]?.available) set("carId", "");
      setStep(1);
    } catch (e) {
      console.error(e);
      setStep(1);
    } finally {
      setIsLoadingCars(false);
    }
  };

  const submit = async () => {
    setIsSubmitting(true);
    try {
      const bookingsRef = collection(db, "bookings");

      await runTransaction(db, async (tx) => {
        const q = query(
          bookingsRef,
          where("useDate", "==", form.useDate),
          where("carId",   "==", form.carId),
          where("status",  "in", ["booked", "active"]),
        );
        const snap = await getDocs(q);

        const conflict = snap.docs.find((d) => {
          const b = d.data();
          return form.startTime < b.endTime && form.endTime > b.startTime;
        });

        if (conflict) {
          const b = conflict.data();
          throw new Error(`CONFLICT:${b.bookerName}:${b.startTime}:${b.endTime}`);
        }

        const newRef = doc(bookingsRef);
        tx.set(newRef, {
          carId:        form.carId,
          carName:      selectedCar!.name,
          carPlate:     selectedCar!.plate,
          bookerId:     form.bookerId,
          bookerName:   form.bookerName,
          bookedAt:     new Date().toISOString(),
          driverName:   form.driverName,
          fromLocation: form.fromLocation,
          toLocation:   form.toLocation,
          purpose:      form.purpose,
          useDate:      form.useDate,
          startTime:    form.startTime,
          endTime:      form.endTime,
          status:       "booked",
          createdAt:    serverTimestamp(),
        });
      });

      await fetch("/api/notify", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          bookerName:  form.bookerName,
          car:         `${selectedCar!.name} (${selectedCar!.plate})`,
          destination: form.toLocation,
          date:        `${form.useDate} ${form.startTime}–${form.endTime}`,
        }),
      });

      setSubmitted(true);
    } catch (e: any) {
      if (e?.message?.startsWith("CONFLICT:")) {
        const [, booker, start, end] = e.message.split(":");
        alert(`❌ รถถูกจองแล้วโดย ${booker} (${start}–${end})\nกรุณากลับไปเลือกรถหรือช่วงเวลาใหม่`);
        const av = await getCarAvailability(form.useDate, form.startTime, form.endTime);
        setAvailability(av);
        setForm((f) => ({ ...f, carId: "" }));
        setStep(1);
      } else {
        console.error(e);
        alert("เกิดข้อผิดพลาด กรุณาลองใหม่");
      }
    } finally {
      setIsSubmitting(false);
    }
  };

  // ─── Loading ──────────────────────────────────────────
  if (!isReady) return (
    <>
      <Styles />
      <div style={{ background: "#f0f4f8", minHeight: "100vh", display: "flex", alignItems: "center", justifyContent: "center" }}>
        <div style={{ textAlign: "center" }}>
          <div className="spin" style={{ margin: "0 auto 12px" }} />
          <p style={{ fontSize: 13, color: "#94a3b8", fontFamily: "Sarabun,sans-serif" }}>กำลังโหลด…</p>
        </div>
      </div>
    </>
  );

  // ─── Success screen ───────────────────────────────────
  if (submitted) return (
    <>
      <Styles />
      <div style={{ background: "#f0f4f8", minHeight: "100vh", display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", padding: 24 }}>
        <div style={{ animation: "popIn .5s cubic-bezier(.34,1.56,.64,1)", textAlign: "center", width: "100%", maxWidth: 400 }}>
          <div style={{ width: 80, height: 80, borderRadius: "50%", background: "linear-gradient(135deg,#22c55e,#16a34a)", margin: "0 auto 20px", display: "flex", alignItems: "center", justifyContent: "center", boxShadow: "0 8px 24px rgba(34,197,94,.3)" }}>
            <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="white" width="38" height="38">
              <path fillRule="evenodd" d="M19.916 4.626a.75.75 0 01.208 1.04l-9 13.5a.75.75 0 01-1.154.114l-6-6a.75.75 0 011.06-1.06l5.353 5.353 8.493-12.739a.75.75 0 011.04-.208z" clipRule="evenodd" />
            </svg>
          </div>
          <h2 style={{ fontFamily: "Prompt,sans-serif", fontSize: 22, fontWeight: 700, color: "#1e3a5f", marginBottom: 4 }}>จองรถสำเร็จ! 🎉</h2>
          <p style={{ color: "#64748b", fontSize: 13, marginBottom: 20 }}>ระบบแจ้งเตือนไปที่ LINE ของคุณแล้ว</p>
          <div className="sum-box" style={{ marginBottom: 20, textAlign: "left" }}>
            {([
              ["🚗", "รถ",         `${selectedCar!.name} (${selectedCar!.plate})`],
              ["📅", "วันที่",      fmtDate(form.useDate)],
              ["🕐", "เวลา",       `${form.startTime} – ${form.endTime}`],
              ["📍", "จาก → ถึง",  `${form.fromLocation} → ${form.toLocation}`],
              ["📋", "สำหรับ",     form.purpose],
              ["👤", "ผู้ใช้รถ",   form.driverName],
            ] as [string,string,string][]).map(([i, l, v], idx, arr) => (
              <div key={l} style={{ display: "flex", gap: 8, paddingBottom: idx < arr.length - 1 ? 10 : 0, marginBottom: idx < arr.length - 1 ? 10 : 0, borderBottom: idx < arr.length - 1 ? "1px solid #f1f5f9" : "none" }}>
                <span style={{ fontSize: 14, width: 20, textAlign: "center", flexShrink: 0 }}>{i}</span>
                <span style={{ fontSize: 12, color: "#94a3b8", width: 68, flexShrink: 0 }}>{l}</span>
                <span style={{ fontSize: 13, fontWeight: 600, color: "#1e3a5f", flex: 1 }}>{v}</span>
              </div>
            ))}
          </div>
          <button className="btn-primary" onClick={() => router.push("/")}>กลับหน้าหลัก</button>
        </div>
      </div>
    </>
  );

  // ─── Main form ────────────────────────────────────────
  return (
    <>
      <Styles />
      <div style={{ background: "#f0f4f8", minHeight: "100vh", paddingBottom: 40 }}>

        <header className="header">
          <button className="back-btn" onClick={() => step > 0 ? setStep((s) => s - 1) : router.push("/")}>‹</button>
          <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
            <img src="/logo.jpg" alt="" style={{ width: 32, height: 32, borderRadius: 8, objectFit: "cover" }}
              onError={(e) => { (e.target as HTMLImageElement).style.display = "none"; }} />
            <div>
              <p style={{ fontSize: 9, color: "#94a3b8", margin: 0 }}>HARU SYSTEM DEVELOPMENT</p>
              <h1 style={{ fontSize: 14, fontWeight: 700, color: "#1e3a5f", margin: 0, fontFamily: "Prompt,sans-serif" }}>จองรถบริษัท</h1>
            </div>
          </div>
          {form.bookerName && (
            <div style={{ marginLeft: "auto", display: "flex", alignItems: "center", gap: 5, background: "#eff6ff", border: "1px solid #bfdbfe", borderRadius: 20, padding: "3px 10px 3px 4px" }}>
              {form.pictureUrl
                ? <img src={form.pictureUrl} alt="" style={{ width: 20, height: 20, borderRadius: "50%", objectFit: "cover" }} />
                : <div style={{ width: 20, height: 20, borderRadius: "50%", background: "linear-gradient(135deg,#1d4ed8,#1e3a5f)", color: "white", fontSize: 10, fontWeight: 700, display: "flex", alignItems: "center", justifyContent: "center" }}>{form.bookerName.charAt(0)}</div>}
              <span style={{ fontSize: 11, fontWeight: 600, color: "#1d4ed8" }}>{form.bookerName.split(" ")[0]}</span>
            </div>
          )}
        </header>

        <div style={{ maxWidth: 440, margin: "0 auto", padding: "14px 14px 0" }}>

          {/* Step indicator */}
          <div style={{ display: "flex", alignItems: "center", padding: "14px 4px 12px" }}>
            {STEPS.map((label, i) => (
              <div key={i} style={{ display: "flex", alignItems: "center", flex: i < STEPS.length - 1 ? 1 : "none" }}>
                <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 3 }}>
                  <div style={{
                    width: 26, height: 26, borderRadius: "50%", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 11, fontWeight: 700,
                    background: i < step ? "#16a34a" : i === step ? "linear-gradient(135deg,#1d4ed8,#1e3a5f)" : "#e2e8f0",
                    color: i <= step ? "white" : "#94a3b8",
                    boxShadow: i === step ? "0 3px 10px rgba(29,78,216,.35)" : "none",
                  }}>
                    {i < step ? "✓" : i + 1}
                  </div>
                  <span style={{ fontSize: 10, fontWeight: i === step ? 700 : 500, color: i === step ? "#1d4ed8" : i < step ? "#16a34a" : "#94a3b8" }}>{label}</span>
                </div>
                {i < STEPS.length - 1 && (
                  <div style={{ flex: 1, height: 2, background: i < step ? "#16a34a" : "#e2e8f0", margin: "0 6px", marginBottom: 14, borderRadius: 2 }} />
                )}
              </div>
            ))}
          </div>

          <div className="card">
            {/* ══ STEP 0 ══ */}
            {step === 0 && (
              <div className="step-in">
                <div className="fg">
                  <label className="fl">ผู้จอง</label>
                  <div className="bk-row">
                    {form.pictureUrl
                      ? <img src={form.pictureUrl} alt="" style={{ width: 34, height: 34, borderRadius: "50%", objectFit: "cover", border: "2px solid #bfdbfe" }} />
                      : <div style={{ width: 34, height: 34, borderRadius: "50%", background: "linear-gradient(135deg,#1d4ed8,#1e3a5f)", color: "white", fontSize: 13, fontWeight: 700, display: "flex", alignItems: "center", justifyContent: "center" }}>{form.bookerName.charAt(0)}</div>}
                    <div style={{ flex: 1 }}>
                      <p style={{ fontSize: 11, color: "#94a3b8", margin: 0 }}>ผู้จอง</p>
                      <p style={{ fontSize: 14, fontWeight: 700, color: "#1e293b", margin: 0 }}>{form.bookerName}</p>
                    </div>
                    <span style={{ fontSize: 11, fontWeight: 700, color: "#16a34a", background: "#dcfce7", border: "1px solid #bbf7d0", borderRadius: 20, padding: "2px 8px" }}>✓ LINE</span>
                  </div>
                </div>

                <div className="fg">
                  <label className="fl">📅 วันที่ใช้รถ *</label>
                  <input type="date" value={form.useDate} min={todayStr()}
                    onChange={(e) => set("useDate", e.target.value)} className="inp" />
                </div>

                <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10 }}>
                  <div className="fg">
                    <label className="fl">🕐 เวลาออก *</label>
                    <input type="time" value={form.startTime}
                      onChange={(e) => set("startTime", e.target.value)} className="inp" />
                  </div>
                  <div className="fg">
                    <label className="fl">🕔 เวลาเข้า *</label>
                    <input type="time" value={form.endTime}
                      onChange={(e) => set("endTime", e.target.value)} className="inp" />
                  </div>
                </div>

                {ok0 && (
                  <div style={{ display: "flex", alignItems: "center", gap: 8, background: "#f0fdf4", border: "1px solid #bbf7d0", borderRadius: 12, padding: "10px 13px", marginBottom: 14 }}>
                    ⏱ <span style={{ color: "#15803d", fontWeight: 600, fontSize: 13 }}>
                      ระยะเวลา: <strong>{getDuration(form.startTime, form.endTime)}</strong>
                    </span>
                  </div>
                )}

                {form.startTime && form.endTime && form.startTime >= form.endTime && (
                  <div className="err">⚠️ เวลาเข้าต้องมากกว่าเวลาออก</div>
                )}

                <button className="btn-primary" disabled={!ok0 || isLoadingCars} onClick={goStep1}>
                  {isLoadingCars
                    ? <><span className="spin-sm" /> กำลังตรวจสอบรถว่าง…</>
                    : "ดูรถว่าง →"}
                </button>
              </div>
            )}

            {/* ══ STEP 1 ══ */}
            {step === 1 && (
              <div className="step-in">
                <div style={{ display: "flex", gap: 8, background: "#eff6ff", border: "1px solid #bfdbfe", borderRadius: 12, padding: "10px 13px", marginBottom: 16 }}>
                  <div style={{ flex: 1 }}>
                    <p style={{ fontSize: 10, color: "#64748b", margin: 0 }}>วันที่ใช้รถ</p>
                    <p style={{ fontSize: 13, fontWeight: 700, color: "#1e3a5f", margin: 0 }}>{fmtDate(form.useDate)}</p>
                  </div>
                  <div style={{ flex: 1 }}>
                    <p style={{ fontSize: 10, color: "#64748b", margin: 0 }}>เวลา</p>
                    <p style={{ fontSize: 13, fontWeight: 700, color: "#1e3a5f", margin: 0 }}>{form.startTime} – {form.endTime}</p>
                  </div>
                  <button onClick={() => setStep(0)} style={{ background: "none", border: "none", cursor: "pointer", color: "#1d4ed8", fontSize: 11, fontWeight: 700, alignSelf: "center", padding: 0 }}>
                    แก้ไข
                  </button>
                </div>

                <div className="fg">
                  <label className="fl">เลือกรถยนต์ *</label>
                  <div style={{ display: "grid", gridTemplateColumns: "repeat(2, 1fr)", gap: 12 }}>
                    {COMPANY_CARS.map((car) => {
                      const av     = availability[car.id];
                      const isFree = av?.available !== false;
                      const isSel  = form.carId === car.id;
                      const SEL_BORDER = "#1d4ed8";
                      const SEL_BG     = "#eff6ff";
                      const SEL_SHADOW = "0 0 0 3px rgba(29,78,216,.12), 0 6px 18px rgba(29,78,216,.14)";

                      return (
                        <div key={car.id} onClick={() => isFree && set("carId", car.id)} style={{
                          display: "flex", flexDirection: "column", borderRadius: 16, overflow: "hidden",
                          border: `2px solid ${isSel ? SEL_BORDER : isFree ? "#e2e8f0" : "#fecaca"}`,
                          cursor: isFree ? "pointer" : "not-allowed",
                          background: isSel ? SEL_BG : isFree ? "white" : "#fff8f8",
                          boxShadow: isSel ? SEL_SHADOW : "0 2px 8px rgba(0,0,0,.07)",
                          transition: "all .2s", position: "relative",
                        }}>
                          <div style={{
                            width: "100%", aspectRatio: "4 / 3",
                            background: isSel ? "#dbeafe" : isFree ? "#f1f5f9" : "#fee2e2",
                            display: "flex", alignItems: "center", justifyContent: "center",
                            overflow: "hidden", position: "relative",
                          }}>
                            <img src={car.imageUrl} alt={car.name}
                              style={{ width: "100%", height: "100%", objectFit: "cover", display: "block" }}
                              onError={(e) => {
                                (e.target as HTMLImageElement).src = "https://cdn-icons-png.flaticon.com/512/3085/3085330.png";
                                (e.target as HTMLImageElement).style.objectFit = "contain";
                                (e.target as HTMLImageElement).style.padding = "24px";
                              }}
                            />
                            {!isFree && (
                              <div style={{ position: "absolute", inset: 0, background: "rgba(0,0,0,0.38)", display: "flex", alignItems: "center", justifyContent: "center" }}>
                                <span style={{ fontSize: 15, fontWeight: 700, color: "white", background: "#ef4444", borderRadius: 20, padding: "4px 14px", boxShadow: "0 2px 8px rgba(0,0,0,.3)" }}>ไม่ว่าง</span>
                              </div>
                            )}
                            {isSel && (
                              <div style={{ position: "absolute", top: 8, right: 8, width: 26, height: 26, borderRadius: "50%", background: SEL_BORDER, display: "flex", alignItems: "center", justifyContent: "center", boxShadow: "0 2px 8px rgba(0,0,0,.25)" }}>
                                <span style={{ color: "white", fontSize: 13, fontWeight: 700 }}>✓</span>
                              </div>
                            )}
                          </div>
                          <div style={{ padding: "10px 12px 12px", textAlign: "center" }}>
                            <p style={{ fontSize: 13, fontWeight: 700, color: isFree ? "#1e293b" : "#94a3b8", margin: "0 0 4px" }}>{car.name}</p>
                            <p style={{ fontSize: 11, margin: "0 0 8px", display: "flex", alignItems: "center", justifyContent: "center", gap: 4 }}>
                              <span style={{ fontSize: 10, color: isFree ? "#64748b" : "#94a3b8", fontWeight: 600 }}>ทะเบียน</span>
                              <span style={{ fontWeight: 700, color: isFree ? "#64748b" : "#94a3b8" }}>{car.plate}</span>
                            </p>
                            {isFree ? (
                              <span style={{ display: "inline-block", fontSize: 12, fontWeight: 700, color: "#16a34a", background: "#dcfce7", border: "1px solid #bbf7d0", borderRadius: 20, padding: "3px 12px" }}>✓ ว่าง</span>
                            ) : (
                              <div>
                                <span style={{ display: "inline-block", fontSize: 12, fontWeight: 700, color: "#ef4444", background: "#fee2e2", border: "1px solid #fecaca", borderRadius: 20, padding: "3px 12px", marginBottom: 4 }}>✕ ไม่ว่าง</span>
                                <p style={{ fontSize: 11, color: "#94a3b8", margin: 0 }}>{av.startTime}–{av.endTime}</p>
                              </div>
                            )}
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>

                <div style={{ display: "flex", gap: 8 }}>
                  <button className="btn-sec" onClick={() => setStep(0)}>← ย้อน</button>
                  <button className="btn-primary" style={{ flex: 1 }} disabled={!ok1} onClick={() => setStep(2)}>
                    ถัดไป: รายละเอียด →
                  </button>
                </div>
              </div>
            )}

            {/* ══ STEP 2 ══ */}
            {step === 2 && (
              <div className="step-in">
                <div style={{ display: "flex", alignItems: "center", gap: 10, background: selectedCar!.colorLight, border: `1px solid ${selectedCar!.color}44`, borderRadius: 12, padding: "10px 13px", marginBottom: 16 }}>
                  <div style={{ width: 8, height: 8, borderRadius: "50%", background: selectedCar!.color, flexShrink: 0 }} />
                  <div style={{ flex: 1 }}>
                    <p style={{ fontSize: 10, color: "#64748b", margin: 0 }}>รถที่เลือก · {fmtDate(form.useDate)} · {form.startTime}–{form.endTime}</p>
                    <p style={{ fontSize: 13, fontWeight: 700, color: "#1e3a5f", margin: 0 }}>
                      {selectedCar!.name} <span style={{ fontWeight: 400, color: "#64748b", fontSize: 12 }}>({selectedCar!.plate})</span>
                    </p>
                  </div>
                  <button onClick={() => setStep(1)} style={{ background: "none", border: "none", cursor: "pointer", color: "#1d4ed8", fontSize: 11, fontWeight: 700, padding: 0 }}>แก้ไข</button>
                </div>

                <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10 }}>
                  <div className="fg">
                    <label className="fl">📍 จาก *</label>
                    <input type="text" value={form.fromLocation} onChange={(e) => set("fromLocation", e.target.value)} placeholder="Haru" className="inp" />
                  </div>
                  <div className="fg">
                    <label className="fl">🏁 ถึง *</label>
                    <input type="text" value={form.toLocation} onChange={(e) => set("toLocation", e.target.value)} placeholder="DCI, Daikin…" className="inp" />
                  </div>
                </div>

                <div className="fg">
                  <label className="fl">📋 สำหรับ *</label>
                  <input type="text" value={form.purpose} onChange={(e) => set("purpose", e.target.value)} placeholder="Install, Test run, Meeting…" className="inp" />
                </div>

                <div className="fg">
                  <label className="fl">👤 ผู้ใช้รถ *</label>
                  <input type="text" value={form.driverName} onChange={(e) => set("driverName", e.target.value)} placeholder="ชื่อผู้ขับ" className="inp" />
                </div>

                {ok2 && (
                  <div className="sum-box" style={{ marginBottom: 16 }}>
                    <p style={{ fontSize: 11, fontWeight: 700, color: "#1d4ed8", textTransform: "uppercase", letterSpacing: ".06em", marginBottom: 10 }}>📌 สรุปการจอง</p>
                    {([
                      ["🚗", "รถ",          `${selectedCar!.name} (${selectedCar!.plate})`],
                      ["📅", "วันที่",       fmtDate(form.useDate)],
                      ["🕐", "ออก → กลับ",  `${form.startTime} – ${form.endTime}`],
                      ["📍", "จาก → ถึง",   `${form.fromLocation} → ${form.toLocation}`],
                      ["📋", "สำหรับ",      form.purpose],
                      ["👤", "ผู้ใช้รถ",    form.driverName],
                    ] as [string,string,string][]).map(([i, l, v], idx, arr) => (
                      <div key={l} style={{ display: "flex", gap: 8, paddingBottom: idx < arr.length - 1 ? 10 : 0, marginBottom: idx < arr.length - 1 ? 10 : 0, borderBottom: idx < arr.length - 1 ? "1px solid #f1f5f9" : "none" }}>
                        <span style={{ fontSize: 13, width: 20, textAlign: "center", flexShrink: 0 }}>{i}</span>
                        <span style={{ fontSize: 12, color: "#94a3b8", width: 72, flexShrink: 0 }}>{l}</span>
                        <span style={{ fontSize: 13, fontWeight: 600, color: "#1e3a5f", flex: 1 }}>{v}</span>
                      </div>
                    ))}
                  </div>
                )}

                <div style={{ display: "flex", gap: 8 }}>
                  <button className="btn-sec" onClick={() => setStep(1)}>← ย้อน</button>
                  <button className="btn-primary btn-green" style={{ flex: 1 }} disabled={isSubmitting || !ok2} onClick={submit}>
                    {isSubmitting ? <><span className="spin-sm" /> บันทึก…</> : "ยืนยันการจอง"}
                  </button>
                </div>
              </div>
            )}
          </div>
        </div>
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
      .header{background:white;padding:10px 15px;display:flex;align-items:center;gap:10px;border-bottom:1px solid #e2e8f0;position:sticky;top:0;z-index:30;box-shadow:0 1px 8px rgba(0,0,0,.06)}
      .back-btn{width:32px;height:32px;border-radius:9px;border:1px solid #e2e8f0;background:#f8fafc;display:flex;align-items:center;justify-content:center;cursor:pointer;color:#475569;font-size:18px;flex-shrink:0}
      .card{background:white;border-radius:16px;padding:18px;box-shadow:0 2px 14px rgba(0,0,0,.07)}
      .step-in{animation:slideIn .3s cubic-bezier(.25,1,.5,1)}
      @keyframes slideIn{from{opacity:0;transform:translateX(14px)}to{opacity:1;transform:translateX(0)}}
      .fg{margin-bottom:14px}
      .fl{display:block;font-size:10px;font-weight:700;color:#64748b;text-transform:uppercase;letter-spacing:.06em;margin-bottom:6px}
      .inp{width:100%;border:1.5px solid #e2e8f0;border-radius:10px;padding:10px 12px;font-size:14px;color:#1e293b;background:#f8fafc;outline:none;transition:all .18s;font-family:'Sarabun',sans-serif}
      .inp:focus{border-color:#1d4ed8;background:white;box-shadow:0 0 0 3px rgba(29,78,216,.1)}
      .bk-row{display:flex;align-items:center;gap:10px;background:#f8fafc;border:1.5px solid #e2e8f0;border-radius:10px;padding:10px 12px}
      .err{background:#fef2f2;border:1px solid #fecaca;color:#dc2626;border-radius:10px;padding:9px 13px;font-size:12px;margin-bottom:12px}
      .sum-box{background:#f8fafc;border:1.5px solid #e2e8f0;border-radius:12px;padding:13px}
      .btn-primary{width:100%;padding:13px;border-radius:12px;font-size:14px;font-weight:700;color:white;border:none;cursor:pointer;background:linear-gradient(135deg,#1d4ed8,#1e3a5f);box-shadow:0 4px 14px rgba(29,78,216,.3);font-family:'Prompt',sans-serif;display:flex;align-items:center;justify-content:center;gap:6px;transition:all .18s}
      .btn-primary:disabled{background:#cbd5e1;box-shadow:none;cursor:not-allowed}
      .btn-primary:hover:not(:disabled){transform:translateY(-1px)}
      .btn-green{background:linear-gradient(135deg,#16a34a,#15803d)!important;box-shadow:0 4px 14px rgba(22,163,74,.3)!important}
      .btn-sec{padding:13px 16px;border-radius:12px;font-size:13px;font-weight:600;color:#475569;background:#f1f5f9;border:1.5px solid #e2e8f0;cursor:pointer;white-space:nowrap;font-family:'Sarabun',sans-serif}
      .spin{width:20px;height:20px;border:2px solid #e2e8f0;border-top-color:#1d4ed8;border-radius:50%;animation:spin .7s linear infinite}
      .spin-sm{display:inline-block;width:13px;height:13px;border:2px solid rgba(255,255,255,.4);border-top-color:white;border-radius:50%;animation:spin .7s linear infinite;flex-shrink:0}
      @keyframes spin{to{transform:rotate(360deg)}}
      @keyframes popIn{from{opacity:0;transform:scale(.85)}to{opacity:1;transform:scale(1)}}
    `}</style>
  );
}