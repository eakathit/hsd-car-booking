// app/book/page.tsx
"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import {
  collection,
  getDocs,
  query,
  where,
  serverTimestamp,
  doc,
  writeBatch,
} from "firebase/firestore";
import { db } from "../../lib/firebase";
import { useCars } from "../../lib/useCars";
import type { CarData } from "../../lib/useCars";
import type { Booking } from "../../types";
import { useLiff } from "../../lib/liff-context";

const STEPS = ["วันที่ & เวลา", "เลือกรถ", "รายละเอียด"];

// ── Helpers ────────────────────────────────────────────────────────────────

function todayStr() {
  return new Date().toISOString().split("T")[0];
}

function fmtDate(d: string) {
  return new Date(d + "T00:00:00").toLocaleDateString("th-TH", {
    day: "2-digit",
    month: "short",
    year: "numeric",
  });
}

function fmtDateShort(d: string) {
  return new Date(d + "T00:00:00").toLocaleDateString("th-TH", {
    day: "numeric",
    month: "short",
  });
}

function getDuration(s: string, e: string) {
  const [sh, sm] = s.split(":").map(Number);
  const [eh, em] = e.split(":").map(Number);
  const m = eh * 60 + em - (sh * 60 + sm);
  if (m <= 0) return "—";
  const h = Math.floor(m / 60),
    r = m % 60;
  return h > 0 ? `${h} ชม. ${r > 0 ? r + " นาที" : ""}` : `${r} นาที`;
}

// คืน array ของวันทุกวันในช่วง start–end (inclusive)
function getDateRange(start: string, end: string): string[] {
  const dates: string[] = [];
  const cur = new Date(start + "T00:00:00");
  const last = new Date(end + "T00:00:00");
  while (cur <= last) {
    // ✅ ใช้ local date แทน UTC
    const y = cur.getFullYear();
    const m = String(cur.getMonth() + 1).padStart(2, "0");
    const d = String(cur.getDate()).padStart(2, "0");
    dates.push(`${y}-${m}-${d}`);
    cur.setDate(cur.getDate() + 1);
  }
  return dates;
}

// ── Availability check (รองรับหลายวัน) ────────────────────────────────────

type AvailResult = Record<
  string,
  {
    available: boolean;
    bookerName: string;
    startTime: string;
    endTime: string;
    conflictDate?: string;
  }
>;

async function getCarAvailability(
  dates: string[],
  startTime: string,
  endTime: string,
  carIds: string[],
): Promise<AvailResult> {
  const result: AvailResult = {};
  for (const id of carIds) {
    result[id] = {
      available: true,
      bookerName: "",
      startTime: "",
      endTime: "",
    };
  }

  for (const date of dates) {
    const q = query(
      collection(db, "bookings"),
      where("useDate", "==", date),
      where("status", "in", ["booked", "active"]),
    );
    const snap = await getDocs(q);
    for (const d of snap.docs) {
      const b = d.data() as Booking;
      if (startTime < b.endTime && endTime > b.startTime) {
        // มี conflict — บันทึกครั้งแรกที่เจอ
        if (result[b.carId]?.available) {
          result[b.carId] = {
            available: false,
            bookerName: b.bookerName,
            startTime: b.startTime,
            endTime: b.endTime,
            conflictDate: date,
          };
        }
      }
    }
  }
  return result;
}

// ── ImgWithSkeleton ────────────────────────────────────────────────────────

function ImgWithSkeleton({ src, alt }: { src: string; alt: string }) {
  const [loaded, setLoaded] = useState(false);
  const [error, setError] = useState(false);
  return (
    <>
      {!loaded && !error && (
        <div
          style={{
            position: "absolute",
            inset: 0,
            background:
              "linear-gradient(90deg,#e2e8f0 25%,#f1f5f9 50%,#e2e8f0 75%)",
            backgroundSize: "200% 100%",
            animation: "shimmer 1.4s infinite",
          }}
        />
      )}
      {error ? (
        <div
          style={{
            fontSize: 36,
            position: "absolute",
            inset: 0,
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
          }}
        >
          🚗
        </div>
      ) : (
        <img
          src={src}
          alt={alt}
          onLoad={() => setLoaded(true)}
          onError={() => {
            setError(true);
            setLoaded(true);
          }}
          style={{
            width: "100%",
            height: "100%",
            objectFit: "cover",
            display: "block",
            opacity: loaded ? 1 : 0,
            transition: "opacity 0.25s ease",
          }}
        />
      )}
    </>
  );
}

// ── BookPage ───────────────────────────────────────────────────────────────

export default function BookPage() {
  const router = useRouter();
  const { user, isReady } = useLiff();
  const { cars, loading: carsLoading } = useCars(true);

  const [step, setStep] = useState(0);
  const [isLoadingCars, setIsLoadingCars] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [submitted, setSubmitted] = useState(false);
  const [submittedDays, setSubmittedDays] = useState(1);
  const [availability, setAvailability] = useState<AvailResult>({});

  const [form, setForm] = useState({
    bookerId: "",
    bookerName: "",
    pictureUrl: "",
    useDate: todayStr(),
    endDate: todayStr(), // ← ใหม่: วันสิ้นสุด
    startTime: "08:30",
    endTime: "17:30",
    carId: "",
    fromLocation: "Haru",
    toLocation: "",
    purpose: "",
    driverName: "",
  });

  useEffect(() => {
    if (isReady && user) {
      setForm((f) => ({
        ...f,
        bookerId: user.userId,
        bookerName: user.displayName,
        pictureUrl: user.pictureUrl ?? "",
        driverName: f.driverName || user.displayName,
      }));
    }
  }, [isReady, user]);

  const set = (k: string, v: string) => setForm((f) => ({ ...f, [k]: v }));
  const selectedCar = cars.find((c) => c.id === form.carId);

  // วันที่เริ่มต้นต้องไม่เกินวันสิ้นสุด
  const dayCount =
    form.useDate && form.endDate && form.useDate <= form.endDate
      ? getDateRange(form.useDate, form.endDate).length
      : 0;

  const ok0 =
    !!form.useDate &&
    !!form.endDate &&
    !!form.startTime &&
    !!form.endTime &&
    form.startTime < form.endTime &&
    form.useDate <= form.endDate;
  const ok1 = !!form.carId && availability[form.carId]?.available === true;
  const ok2 = !!form.toLocation && !!form.purpose && !!form.driverName;

  // ── goStep1: ตรวจสอบรถว่างทุกวัน ──────────────────────────────────────

  const goStep1 = async () => {
    setIsLoadingCars(true);
    try {
      const dates = getDateRange(form.useDate, form.endDate);
      const av = await getCarAvailability(
        dates,
        form.startTime,
        form.endTime,
        cars.map((c) => c.id),
      );
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

  // ── submit: เช็ค conflict ทุกวัน แล้ว batch write ──────────────────────

  const submit = async () => {
    if (!selectedCar) return;
    setIsSubmitting(true);
    try {
      const dates = getDateRange(form.useDate, form.endDate);
      const groupId =
        dates.length > 1
          ? Date.now().toString(36) + Math.random().toString(36).slice(2, 6)
          : undefined;
      const bookingsRef = collection(db, "bookings");

      // Step 1: ตรวจ conflict ทุกวันก่อน
      for (const date of dates) {
        const q = query(
          bookingsRef,
          where("useDate", "==", date),
          where("carId", "==", form.carId),
          where("status", "in", ["booked", "active"]),
        );
        const snap = await getDocs(q);
        const conflict = snap.docs.find((d) => {
          const b = d.data();
          return form.startTime < b.endTime && form.endTime > b.startTime;
        });
        if (conflict) {
          const b = conflict.data();
          throw new Error(
            `CONFLICT:${b.bookerName}:${b.startTime}:${b.endTime}:${date}`,
          );
        }
      }

      // Step 2: Batch write ทุกวันพร้อมกัน
      const batch = writeBatch(db);
      for (const date of dates) {
        batch.set(doc(bookingsRef), {
          carId: form.carId,
          carName: selectedCar.name,
          carPlate: selectedCar.plate,
          bookerId: form.bookerId,
          bookerName: form.bookerName,
          bookedAt: new Date().toISOString(),
          driverName: form.driverName,
          fromLocation: form.fromLocation,
          toLocation: form.toLocation,
          purpose: form.purpose,
          useDate: date,
          startTime: form.startTime,
          endTime: form.endTime,
          status: "booked",
          createdAt: serverTimestamp(),
          ...(groupId ? { groupId, totalDays: dates.length } : {}),
        });
      }
      await batch.commit();

      // Notify
      await fetch("/api/notify", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          bookerName: form.bookerName,
          car: `${selectedCar.name} (${selectedCar.plate})`,
          destination: form.toLocation,
          date:
            dates.length > 1
              ? `${form.useDate} ถึง ${form.endDate} (${dates.length} วัน) เวลา ${form.startTime}–${form.endTime}`
              : `${form.useDate} ${form.startTime}–${form.endTime}`,
        }),
      });

      setSubmittedDays(dates.length);
      setSubmitted(true);
    } catch (e: any) {
      if (e?.message?.startsWith("CONFLICT:")) {
        const parts = e.message.split(":");
        const booker = parts[1];
        const sTime = parts[2];
        const eTime = parts[3];
        const cDate = parts[4];
        alert(
          `❌ รถถูกจองแล้วโดย ${booker}\nวันที่ ${fmtDate(cDate)} (${sTime}–${eTime})\n\nกรุณากลับไปเลือกรถหรือช่วงวันใหม่`,
        );
        const dates = getDateRange(form.useDate, form.endDate);
        const av = await getCarAvailability(
          dates,
          form.startTime,
          form.endTime,
          cars.map((c) => c.id),
        );
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

  // ── Loading ────────────────────────────────────────────────────────────

  if (!isReady)
    return (
      <>
        <Styles />
        <div
          style={{
            background: "#f0f4f8",
            minHeight: "100vh",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
          }}
        >
          <div style={{ textAlign: "center" }}>
            <div className="spin" style={{ margin: "0 auto 12px" }} />
            <p
              style={{
                fontSize: 13,
                color: "#94a3b8",
                fontFamily: "Sarabun,sans-serif",
              }}
            >
              กำลังโหลด…
            </p>
          </div>
        </div>
      </>
    );

  // ── Success screen ─────────────────────────────────────────────────────

  if (submitted && selectedCar)
    return (
      <>
        <Styles />
        <div
          style={{
            background: "#f0f4f8",
            minHeight: "100vh",
            display: "flex",
            flexDirection: "column",
            alignItems: "center",
            justifyContent: "center",
            padding: 24,
          }}
        >
          <div
            style={{
              animation: "popIn .5s cubic-bezier(.34,1.56,.64,1)",
              textAlign: "center",
              width: "100%",
              maxWidth: 400,
            }}
          >
            <div
              style={{
                width: 80,
                height: 80,
                borderRadius: "50%",
                background: "linear-gradient(135deg,#22c55e,#16a34a)",
                margin: "0 auto 20px",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                boxShadow: "0 8px 24px rgba(34,197,94,.3)",
              }}
            >
              <svg
                xmlns="http://www.w3.org/2000/svg"
                viewBox="0 0 24 24"
                fill="white"
                width="38"
                height="38"
              >
                <path
                  fillRule="evenodd"
                  d="M19.916 4.626a.75.75 0 01.208 1.04l-9 13.5a.75.75 0 01-1.154.114l-6-6a.75.75 0 011.06-1.06l5.353 5.353 8.493-12.739a.75.75 0 011.04-.208z"
                  clipRule="evenodd"
                />
              </svg>
            </div>
            <h2
              style={{
                fontFamily: "Prompt,sans-serif",
                fontSize: 22,
                fontWeight: 700,
                color: "#1e3a5f",
                marginBottom: 4,
              }}
            >
              {submittedDays > 1
                ? `จองรถสำเร็จ ${submittedDays} วัน!`
                : "จองรถสำเร็จ!"}
            </h2>
            <p style={{ color: "#64748b", fontSize: 14, marginBottom: 24 }}>
              ระบบบันทึกการจองของคุณแล้ว
            </p>

            <div
              style={{
                background: "white",
                borderRadius: 16,
                padding: "16px 20px",
                boxShadow: "0 2px 14px rgba(0,0,0,.07)",
                textAlign: "left",
                marginBottom: 20,
              }}
            >
              <div
                style={{
                  display: "flex",
                  alignItems: "center",
                  gap: 10,
                  marginBottom: 14,
                }}
              >
                <div
                  style={{
                    width: 10,
                    height: 10,
                    borderRadius: "50%",
                    background: selectedCar.color,
                  }}
                />
                <p
                  style={{
                    fontWeight: 700,
                    fontSize: 15,
                    color: "#1e3a5f",
                    margin: 0,
                  }}
                >
                  {selectedCar.name}
                </p>
                <span
                  style={{ fontSize: 12, color: "#64748b", marginLeft: "auto" }}
                >
                  {selectedCar.plate}
                </span>
              </div>
              {(
                [
                  [
                    "📅",
                    submittedDays > 1
                      ? `${fmtDateShort(form.useDate)} – ${fmtDateShort(form.endDate)} (${submittedDays} วัน)`
                      : fmtDate(form.useDate),
                  ],
                  ["🕐", `${form.startTime} – ${form.endTime}`],
                  ["📍", `${form.fromLocation} → ${form.toLocation}`],
                  ["📋", form.purpose],
                  ["👤", form.driverName],
                ] as [string, string][]
              ).map(([icon, val]) => (
                <div
                  key={icon}
                  style={{ display: "flex", gap: 8, marginBottom: 6 }}
                >
                  <span
                    style={{ fontSize: 14, width: 20, textAlign: "center" }}
                  >
                    {icon}
                  </span>
                  <span style={{ fontSize: 13, color: "#475569" }}>{val}</span>
                </div>
              ))}
            </div>

            <button
              onClick={() => router.push("/")}
              style={{
                width: "100%",
                padding: "13px",
                borderRadius: 12,
                fontSize: 14,
                fontWeight: 700,
                cursor: "pointer",
                border: "none",
                background: "linear-gradient(135deg,#1d4ed8,#1e3a5f)",
                color: "white",
                boxShadow: "0 4px 14px rgba(29,78,216,.3)",
                fontFamily: "Sarabun,sans-serif",
              }}
            >
              เสร็จสิ้น
            </button>
          </div>
        </div>
      </>
    );

  // ── Main render ────────────────────────────────────────────────────────

  return (
    <>
      <Styles />
      <div
        style={{ background: "#f0f4f8", minHeight: "100vh", paddingBottom: 40 }}
      >
        {/* Header */}
        <header className="header">
          <button
            className="back-btn"
            onClick={() => (step > 0 ? setStep((s) => s - 1) : router.back())}
          >
            ‹
          </button>
          <div
            style={{ flex: 1, display: "flex", alignItems: "center", gap: 8 }}
          >
            <img
              src="/logo.jpg"
              alt=""
              style={{
                width: 30,
                height: 30,
                borderRadius: 8,
                objectFit: "cover",
              }}
              onError={(e) => {
                (e.target as HTMLImageElement).style.display = "none";
              }}
            />
            <div>
              <p style={{ fontSize: 10, color: "#94a3b8", margin: 0 }}>
                HARU CAR BOOKING
              </p>
              <h1
                style={{
                  fontSize: 15,
                  fontWeight: 700,
                  color: "#1e3a5f",
                  margin: 0,
                  fontFamily: "Prompt,sans-serif",
                }}
              >
                จองรถ
              </h1>
            </div>
          </div>
          {/* โปรไฟล์ลบออกแล้ว */}
        </header>

        <div
          style={{ maxWidth: 440, margin: "0 auto", padding: "14px 14px 0" }}
        >
          {/* Step indicator */}
          <div
            style={{
              display: "flex",
              alignItems: "center",
              padding: "14px 4px 12px",
            }}
          >
            {STEPS.map((label, i) => (
              <div
                key={i}
                style={{
                  display: "flex",
                  alignItems: "center",
                  flex: i < STEPS.length - 1 ? 1 : ("none" as any),
                }}
              >
                <div
                  style={{
                    display: "flex",
                    flexDirection: "column",
                    alignItems: "center",
                    gap: 3,
                  }}
                >
                  <div
                    style={{
                      width: 26,
                      height: 26,
                      borderRadius: "50%",
                      display: "flex",
                      alignItems: "center",
                      justifyContent: "center",
                      fontSize: 11,
                      fontWeight: 700,
                      background:
                        i < step
                          ? "#16a34a"
                          : i === step
                            ? "linear-gradient(135deg,#1d4ed8,#1e3a5f)"
                            : "#e2e8f0",
                      color: i <= step ? "white" : "#94a3b8",
                      boxShadow:
                        i === step ? "0 3px 10px rgba(29,78,216,.35)" : "none",
                    }}
                  >
                    {i < step ? "✓" : i + 1}
                  </div>
                  <span
                    style={{
                      fontSize: 10,
                      fontWeight: i === step ? 700 : 500,
                      color:
                        i === step
                          ? "#1d4ed8"
                          : i < step
                            ? "#16a34a"
                            : "#94a3b8",
                    }}
                  >
                    {label}
                  </span>
                </div>
                {i < STEPS.length - 1 && (
                  <div
                    style={{
                      flex: 1,
                      height: 2,
                      background: i < step ? "#16a34a" : "#e2e8f0",
                      margin: "0 6px",
                      marginBottom: 14,
                      borderRadius: 2,
                    }}
                  />
                )}
              </div>
            ))}
          </div>

          <div className="card">
            {/* ══ STEP 0 ══ */}
            {step === 0 && (
              <div className="step-in">
                {/* ผู้จอง */}
                <div className="fg">
                  <label className="fl">ผู้จอง</label>
                  <div className="bk-row">
                    {form.pictureUrl ? (
                      <img
                        src={form.pictureUrl}
                        alt=""
                        style={{
                          width: 34,
                          height: 34,
                          borderRadius: "50%",
                          objectFit: "cover",
                          border: "2px solid #bfdbfe",
                        }}
                      />
                    ) : (
                      <div
                        style={{
                          width: 34,
                          height: 34,
                          borderRadius: "50%",
                          background: "linear-gradient(135deg,#1d4ed8,#1e3a5f)",
                          color: "white",
                          fontSize: 13,
                          fontWeight: 700,
                          display: "flex",
                          alignItems: "center",
                          justifyContent: "center",
                        }}
                      >
                        {form.bookerName.charAt(0)}
                      </div>
                    )}
                    <div style={{ flex: 1 }}>
                      <p style={{ fontSize: 11, color: "#94a3b8", margin: 0 }}>
                        ผู้จอง
                      </p>
                      <p
                        style={{
                          fontSize: 14,
                          fontWeight: 700,
                          color: "#1e293b",
                          margin: 0,
                        }}
                      >
                        {form.bookerName}
                      </p>
                    </div>
                    <span
                      style={{
                        fontSize: 11,
                        fontWeight: 700,
                        color: "#16a34a",
                        background: "#dcfce7",
                        border: "1px solid #bbf7d0",
                        borderRadius: 20,
                        padding: "2px 8px",
                      }}
                    >
                      ✓ LINE
                    </span>
                  </div>
                </div>

                {/* วันที่ — 2 columns */}
                <div
                  style={{
                    display: "grid",
                    gridTemplateColumns: "1fr 1fr",
                    gap: 10,
                  }}
                >
                  <div className="fg">
                    <label className="fl">📅 วันเริ่มต้น *</label>
                    <input
                      type="date"
                      value={form.useDate}
                      min={todayStr()}
                      onChange={(e) => {
                        const v = e.target.value;
                        set("useDate", v);
                        // ถ้าวันสิ้นสุดน้อยกว่าวันเริ่มต้น ให้ reset
                        if (form.endDate < v) set("endDate", v);
                      }}
                      className="inp"
                    />
                  </div>
                  <div className="fg">
                    <label className="fl">📅 วันสิ้นสุด *</label>
                    <input
                      type="date"
                      value={form.endDate}
                      min={form.useDate || todayStr()}
                      onChange={(e) => set("endDate", e.target.value)}
                      className="inp"
                    />
                  </div>
                </div>

                {/* Badge จำนวนวัน */}
                {form.useDate &&
                  form.endDate &&
                  form.useDate <= form.endDate && (
                    <div
                      style={{
                        display: "flex",
                        alignItems: "center",
                        gap: 8,
                        background: dayCount > 1 ? "#eff6ff" : "#f8fafc",
                        border: `1px solid ${dayCount > 1 ? "#bfdbfe" : "#e2e8f0"}`,
                        borderRadius: 10,
                        padding: "8px 12px",
                        marginBottom: 14,
                      }}
                    >
                      <span style={{ fontSize: 16 }}>
                        {dayCount > 1 ? "📆" : "📅"}
                      </span>
                      <span
                        style={{
                          fontSize: 13,
                          fontWeight: 600,
                          color: dayCount > 1 ? "#1d4ed8" : "#475569",
                        }}
                      >
                        {dayCount > 1
                          ? `จอง ${dayCount} วัน (${fmtDateShort(form.useDate)} – ${fmtDateShort(form.endDate)})`
                          : "จอง 1 วัน"}
                      </span>
                    </div>
                  )}

                {/* เวลา */}
                <div
                  style={{
                    display: "grid",
                    gridTemplateColumns: "1fr 1fr",
                    gap: 10,
                  }}
                >
                  <div className="fg">
                    <label className="fl">🕐 เวลาออก *</label>
                    <input
                      type="time"
                      value={form.startTime}
                      onChange={(e) => set("startTime", e.target.value)}
                      className="inp"
                    />
                  </div>
                  <div className="fg">
                    <label className="fl">🕔 เวลากลับ *</label>
                    <input
                      type="time"
                      value={form.endTime}
                      onChange={(e) => set("endTime", e.target.value)}
                      className="inp"
                    />
                  </div>
                </div>

                {ok0 && (
                  <div
                    style={{
                      display: "flex",
                      alignItems: "center",
                      gap: 8,
                      background: "#f0fdf4",
                      border: "1px solid #bbf7d0",
                      borderRadius: 12,
                      padding: "10px 13px",
                      marginBottom: 14,
                    }}
                  >
                    ⏱{" "}
                    <span
                      style={{
                        color: "#15803d",
                        fontWeight: 600,
                        fontSize: 13,
                      }}
                    >
                      ระยะเวลา/วัน:{" "}
                      <strong>
                        {getDuration(form.startTime, form.endTime)}
                      </strong>
                    </span>
                  </div>
                )}

                {form.startTime &&
                  form.endTime &&
                  form.startTime >= form.endTime && (
                    <div className="err">⚠️ เวลากลับต้องมากกว่าเวลาออก</div>
                  )}
                {form.useDate &&
                  form.endDate &&
                  form.useDate > form.endDate && (
                    <div className="err">
                      ⚠️ วันสิ้นสุดต้องไม่ก่อนวันเริ่มต้น
                    </div>
                  )}

                <button
                  className="btn-primary"
                  disabled={!ok0 || isLoadingCars || carsLoading}
                  onClick={goStep1}
                >
                  {isLoadingCars ? (
                    <>
                      <span className="spin-sm" /> กำลังตรวจสอบรถว่าง…
                    </>
                  ) : (
                    "ดูรถว่าง →"
                  )}
                </button>
              </div>
            )}

            {/* ══ STEP 1 ══ */}
            {step === 1 && (
              <div className="step-in">
                {/* Summary bar */}
                <div
                  style={{
                    display: "flex",
                    gap: 8,
                    background: "#eff6ff",
                    border: "1px solid #bfdbfe",
                    borderRadius: 12,
                    padding: "10px 13px",
                    marginBottom: 16,
                  }}
                >
                  <div style={{ flex: 1 }}>
                    <p style={{ fontSize: 10, color: "#64748b", margin: 0 }}>
                      วันที่
                    </p>
                    <p
                      style={{
                        fontSize: 13,
                        fontWeight: 700,
                        color: "#1e3a5f",
                        margin: 0,
                      }}
                    >
                      {dayCount > 1
                        ? `${fmtDateShort(form.useDate)} – ${fmtDateShort(form.endDate)}`
                        : fmtDate(form.useDate)}
                      {dayCount > 1 && (
                        <span
                          style={{
                            fontSize: 11,
                            color: "#1d4ed8",
                            fontWeight: 600,
                            marginLeft: 6,
                          }}
                        >
                          {dayCount} วัน
                        </span>
                      )}
                    </p>
                  </div>
                  <div style={{ flex: 1 }}>
                    <p style={{ fontSize: 10, color: "#64748b", margin: 0 }}>
                      เวลา
                    </p>
                    <p
                      style={{
                        fontSize: 13,
                        fontWeight: 700,
                        color: "#1e3a5f",
                        margin: 0,
                      }}
                    >
                      {form.startTime} – {form.endTime}
                    </p>
                  </div>
                  <button
                    onClick={() => setStep(0)}
                    style={{
                      background: "none",
                      border: "none",
                      cursor: "pointer",
                      color: "#1d4ed8",
                      fontSize: 11,
                      fontWeight: 700,
                      alignSelf: "center",
                      padding: 0,
                    }}
                  >
                    แก้ไข
                  </button>
                </div>

                <div className="fg">
                  <label className="fl">เลือกรถยนต์ *</label>
                  {carsLoading ? (
                    <div
                      style={{
                        textAlign: "center",
                        padding: "20px 0",
                        color: "#94a3b8",
                        fontSize: 13,
                      }}
                    >
                      กำลังโหลดรถ…
                    </div>
                  ) : cars.length === 0 ? (
                    <div
                      style={{
                        textAlign: "center",
                        padding: "20px 0",
                        color: "#94a3b8",
                        fontSize: 13,
                      }}
                    >
                      ยังไม่มีรถในระบบ
                    </div>
                  ) : (
                    <div
                      style={{
                        display: "grid",
                        gridTemplateColumns: "repeat(2,1fr)",
                        gap: 12,
                      }}
                    >
                      {cars.map((car) => {
                        const av = availability[car.id];
                        const isFree = av?.available !== false;
                        const isSel = form.carId === car.id;
                        return (
                          <div
                            key={car.id}
                            onClick={() => isFree && set("carId", car.id)}
                            style={{
                              display: "flex",
                              flexDirection: "column",
                              borderRadius: 16,
                              overflow: "hidden",
                              border: `2px solid ${isSel ? "#1d4ed8" : isFree ? "#e2e8f0" : "#fecaca"}`,
                              cursor: isFree ? "pointer" : "not-allowed",
                              background: isSel
                                ? "#eff6ff"
                                : isFree
                                  ? "white"
                                  : "#fff8f8",
                              boxShadow: isSel
                                ? "0 0 0 3px rgba(29,78,216,.12),0 6px 18px rgba(29,78,216,.14)"
                                : "0 2px 8px rgba(0,0,0,.07)",
                              transition: "all .2s",
                              position: "relative",
                            }}
                          >
                            <div
                              style={{
                                width: "100%",
                                aspectRatio: "4/3",
                                background: isSel
                                  ? "#dbeafe"
                                  : isFree
                                    ? "#f1f5f9"
                                    : "#fee2e2",
                                display: "flex",
                                alignItems: "center",
                                justifyContent: "center",
                                overflow: "hidden",
                                position: "relative",
                              }}
                            >
                              {car.imageUrl ? (
                                <ImgWithSkeleton
                                  src={car.imageUrl}
                                  alt={car.name}
                                />
                              ) : (
                                <span style={{ fontSize: 36 }}>🚗</span>
                              )}
                              {isSel && (
                                <div
                                  style={{
                                    position: "absolute",
                                    top: 8,
                                    right: 8,
                                    width: 22,
                                    height: 22,
                                    borderRadius: "50%",
                                    background: "#1d4ed8",
                                    display: "flex",
                                    alignItems: "center",
                                    justifyContent: "center",
                                  }}
                                >
                                  <svg
                                    viewBox="0 0 24 24"
                                    fill="white"
                                    width="13"
                                    height="13"
                                  >
                                    <path
                                      fillRule="evenodd"
                                      d="M19.916 4.626a.75.75 0 01.208 1.04l-9 13.5a.75.75 0 01-1.154.114l-6-6a.75.75 0 011.06-1.06l5.353 5.353 8.493-12.739a.75.75 0 011.04-.208z"
                                      clipRule="evenodd"
                                    />
                                  </svg>
                                </div>
                              )}
                              {!isFree && (
                                <div
                                  style={{
                                    position: "absolute",
                                    inset: 0,
                                    background: "rgba(239,68,68,.08)",
                                  }}
                                />
                              )}
                            </div>
                            <div
                              style={{
                                padding: "10px 10px 12px",
                                textAlign: "center",
                              }}
                            >
                              <p
                                style={{
                                  fontSize: 13,
                                  fontWeight: 700,
                                  color: isFree ? "#1e3a5f" : "#94a3b8",
                                  margin: "0 0 2px",
                                  lineHeight: 1.3,
                                }}
                              >
                                {car.name}
                              </p>
                              <p
                                style={{
                                  fontSize: 11,
                                  color: isFree ? "#64748b" : "#94a3b8",
                                  margin: "0 0 8px",
                                }}
                              >
                                <span style={{ fontSize: 9, fontWeight: 600 }}>
                                  ทะเบียน{" "}
                                </span>
                                <span style={{ fontSize: 11, fontWeight: 700 }}>
                                  {car.plate}
                                </span>
                              </p>
                              {isFree ? (
                                <span
                                  style={{
                                    display: "inline-block",
                                    fontSize: 12,
                                    fontWeight: 700,
                                    color: "#16a34a",
                                    background: "#dcfce7",
                                    border: "1px solid #bbf7d0",
                                    borderRadius: 20,
                                    padding: "3px 12px",
                                  }}
                                >
                                  ✓ ว่าง
                                </span>
                              ) : (
                                <div>
                                  <span
                                    style={{
                                      display: "inline-block",
                                      fontSize: 12,
                                      fontWeight: 700,
                                      color: "#ef4444",
                                      background: "#fee2e2",
                                      border: "1px solid #fecaca",
                                      borderRadius: 20,
                                      padding: "3px 12px",
                                      marginBottom: 4,
                                    }}
                                  >
                                    ✕ ไม่ว่าง
                                  </span>
                                  <p
                                    style={{
                                      fontSize: 11,
                                      color: "#94a3b8",
                                      margin: 0,
                                    }}
                                  >
                                    {av?.conflictDate
                                      ? `${fmtDateShort(av.conflictDate)} `
                                      : ""}
                                    {av?.startTime}–{av?.endTime}
                                  </p>
                                </div>
                              )}
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  )}
                </div>

                <div style={{ display: "flex", gap: 8 }}>
                  <button className="btn-sec" onClick={() => setStep(0)}>
                    ← ย้อน
                  </button>
                  <button
                    className="btn-primary"
                    style={{ flex: 1 }}
                    disabled={!ok1}
                    onClick={() => setStep(2)}
                  >
                    ถัดไป: รายละเอียด →
                  </button>
                </div>
              </div>
            )}

            {/* ══ STEP 2 ══ */}
            {step === 2 && selectedCar && (
              <div className="step-in">
                <div
                  style={{
                    display: "flex",
                    alignItems: "center",
                    gap: 10,
                    background: selectedCar.colorLight || "#f1f5f9",
                    border: `1px solid ${selectedCar.color}44`,
                    borderRadius: 12,
                    padding: "10px 13px",
                    marginBottom: 16,
                  }}
                >
                  <div
                    style={{
                      width: 8,
                      height: 8,
                      borderRadius: "50%",
                      background: selectedCar.color,
                      flexShrink: 0,
                    }}
                  />
                  <div style={{ flex: 1 }}>
                    <p style={{ fontSize: 10, color: "#64748b", margin: 0 }}>
                      {dayCount > 1
                        ? `${fmtDateShort(form.useDate)} – ${fmtDateShort(form.endDate)} (${dayCount} วัน) · ${form.startTime}–${form.endTime}`
                        : `${fmtDate(form.useDate)} · ${form.startTime}–${form.endTime}`}
                    </p>
                    <p
                      style={{
                        fontSize: 13,
                        fontWeight: 700,
                        color: "#1e3a5f",
                        margin: 0,
                      }}
                    >
                      {selectedCar.name}{" "}
                      <span
                        style={{
                          fontWeight: 400,
                          color: "#64748b",
                          fontSize: 12,
                        }}
                      >
                        ({selectedCar.plate})
                      </span>
                    </p>
                  </div>
                  <button
                    onClick={() => setStep(1)}
                    style={{
                      background: "none",
                      border: "none",
                      cursor: "pointer",
                      color: "#1d4ed8",
                      fontSize: 11,
                      fontWeight: 700,
                      padding: 0,
                    }}
                  >
                    แก้ไข
                  </button>
                </div>

                <div
                  style={{
                    display: "grid",
                    gridTemplateColumns: "1fr 1fr",
                    gap: 10,
                  }}
                >
                  <div className="fg">
                    <label className="fl">📍 จาก *</label>
                    <input
                      type="text"
                      value={form.fromLocation}
                      onChange={(e) => set("fromLocation", e.target.value)}
                      placeholder="Haru"
                      className="inp"
                    />
                  </div>
                  <div className="fg">
                    <label className="fl">🏁 ถึง *</label>
                    <input
                      type="text"
                      value={form.toLocation}
                      onChange={(e) => set("toLocation", e.target.value)}
                      placeholder="DCI, Daikin…"
                      className="inp"
                    />
                  </div>
                </div>
                <div className="fg">
                  <label className="fl">📋 สำหรับ *</label>
                  <input
                    type="text"
                    value={form.purpose}
                    onChange={(e) => set("purpose", e.target.value)}
                    placeholder="Install, Test run, Meeting…"
                    className="inp"
                  />
                </div>
                <div className="fg">
                  <label className="fl">👤 ผู้ใช้รถ *</label>
                  <input
                    type="text"
                    value={form.driverName}
                    onChange={(e) => set("driverName", e.target.value)}
                    placeholder="ชื่อผู้ขับ"
                    className="inp"
                  />
                </div>

                {ok2 && (
                  <div className="sum-box" style={{ marginBottom: 16 }}>
                    <p
                      style={{
                        fontSize: 11,
                        fontWeight: 700,
                        color: "#1d4ed8",
                        textTransform: "uppercase",
                        letterSpacing: ".06em",
                        marginBottom: 10,
                      }}
                    >
                      📌 สรุปการจอง
                    </p>
                    {(
                      [
                        [
                          "🚗",
                          "รถ",
                          `${selectedCar.name} (${selectedCar.plate})`,
                        ],
                        [
                          "📅",
                          "วันที่",
                          dayCount > 1
                            ? `${fmtDateShort(form.useDate)} – ${fmtDateShort(form.endDate)} (${dayCount} วัน)`
                            : fmtDate(form.useDate),
                        ],
                        [
                          "🕐",
                          "ออก → กลับ",
                          `${form.startTime} – ${form.endTime}`,
                        ],
                        [
                          "📍",
                          "จาก → ถึง",
                          `${form.fromLocation} → ${form.toLocation}`,
                        ],
                        ["📋", "สำหรับ", form.purpose],
                        ["👤", "ผู้ใช้รถ", form.driverName],
                      ] as [string, string, string][]
                    ).map(([i, l, v], idx, arr) => (
                      <div
                        key={l}
                        style={{
                          display: "flex",
                          gap: 8,
                          paddingBottom: idx < arr.length - 1 ? 10 : 0,
                          marginBottom: idx < arr.length - 1 ? 10 : 0,
                          borderBottom:
                            idx < arr.length - 1 ? "1px solid #f1f5f9" : "none",
                        }}
                      >
                        <span
                          style={{
                            fontSize: 13,
                            width: 20,
                            textAlign: "center",
                            flexShrink: 0,
                          }}
                        >
                          {i}
                        </span>
                        <span
                          style={{
                            fontSize: 12,
                            color: "#94a3b8",
                            width: 72,
                            flexShrink: 0,
                          }}
                        >
                          {l}
                        </span>
                        <span
                          style={{
                            fontSize: 13,
                            fontWeight: 600,
                            color: "#1e3a5f",
                            flex: 1,
                          }}
                        >
                          {v}
                        </span>
                      </div>
                    ))}
                  </div>
                )}

                <div style={{ display: "flex", gap: 8 }}>
                  <button className="btn-sec" onClick={() => setStep(1)}>
                    ← ย้อน
                  </button>
                  <button
                    className="btn-primary btn-green"
                    style={{ flex: 1 }}
                    disabled={isSubmitting || !ok2}
                    onClick={submit}
                  >
                    {isSubmitting ? (
                      <>
                        <span className="spin-sm" /> บันทึก
                        {dayCount > 1 ? ` ${dayCount} วัน` : ""}…
                      </>
                    ) : (
                      `ยืนยันการจอง${dayCount > 1 ? ` (${dayCount} วัน)` : ""}`
                    )}
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

// ── Styles ─────────────────────────────────────────────────────────────────

function Styles() {
  return (
    <style>{`
      @import url('https://fonts.googleapis.com/css2?family=Sarabun:wght@400;500;600;700&family=Prompt:wght@600;700&display=swap');
      *,*::before,*::after{box-sizing:border-box;margin:0;padding:0}
      body,*{font-family:'Sarabun',sans-serif}
      .header{background:white;padding:10px 15px;display:flex;align-items:center;gap:10px;border-bottom:1px solid #e2e8f0;position:sticky;top:0;z-index:30;box-shadow:0 1px 8px rgba(0,0,0,.06)}
      .back-btn{width:32px;height:32px;border-radius:9px;border:1px solid #e2e8f0;background:#f8fafc;display:flex;align-items:center;justify-content:center;cursor:pointer;color:#475569;font-size:18px;flex-shrink:0;line-height:1;padding:0}
      .card{background:white;border-radius:16px;padding:18px;box-shadow:0 2px 14px rgba(0,0,0,.07)}
      .step-in{animation:slideIn .3s cubic-bezier(.25,1,.5,1)}
      @keyframes slideIn{from{opacity:0;transform:translateX(18px)}to{opacity:1;transform:translateX(0)}}
      @keyframes shimmer{0%{background-position:200% 0}100%{background-position:-200% 0}}
      @keyframes popIn{from{opacity:0;transform:scale(.85)}to{opacity:1;transform:scale(1)}}
      .fg{margin-bottom:14px}
      .fl{display:block;font-size:10px;font-weight:700;color:#64748b;text-transform:uppercase;letter-spacing:.06em;margin-bottom:6px}
      .inp{width:100%;border:1.5px solid #e2e8f0;border-radius:10px;padding:10px 12px;font-size:14px;color:#1e293b;background:#f8fafc;outline:none;transition:all .18s;font-family:'Sarabun',sans-serif}
      .inp:focus{border-color:#1d4ed8;background:white;box-shadow:0 0 0 3px rgba(29,78,216,.1)}
      .bk-row{display:flex;align-items:center;gap:10px;background:#f8fafc;border:1.5px solid #e2e8f0;border-radius:12px;padding:10px 12px}
      .btn-primary{width:100%;padding:13px;border-radius:12px;font-size:14px;font-weight:700;cursor:pointer;border:none;background:linear-gradient(135deg,#1d4ed8,#1e3a5f);color:white;box-shadow:0 4px 14px rgba(29,78,216,.3);font-family:'Sarabun',sans-serif;display:flex;align-items:center;justify-content:center;gap:8px;transition:opacity .15s}
      .btn-primary:disabled{opacity:.5;cursor:not-allowed}
      .btn-primary.btn-green{background:linear-gradient(135deg,#22c55e,#16a34a);box-shadow:0 4px 14px rgba(34,197,94,.3)}
      .btn-sec{padding:13px 18px;border-radius:12px;font-size:13px;font-weight:600;cursor:pointer;border:1.5px solid #e2e8f0;background:white;color:#64748b;font-family:'Sarabun',sans-serif;transition:all .15s}
      .btn-sec:hover{background:#f8fafc}
      .err{background:#fef2f2;border:1px solid #fecaca;border-radius:10px;padding:10px 13px;font-size:13px;color:#dc2626;margin-bottom:14px}
      .sum-box{background:#f8fafc;border:1px solid #e2e8f0;border-radius:12px;padding:14px}
      .spin{width:32px;height:32px;border:3px solid #e2e8f0;border-top-color:#1d4ed8;border-radius:50%;animation:spin .8s linear infinite}
      .spin-sm{width:14px;height:14px;border:2px solid rgba(255,255,255,.4);border-top-color:white;border-radius:50%;animation:spin .8s linear infinite;display:inline-block}
      @keyframes spin{to{transform:rotate(360deg)}}
    `}</style>
  );
}
