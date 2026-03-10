// app/book/page.tsx
'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { collection, addDoc, serverTimestamp } from 'firebase/firestore';
import { db } from '../../lib/firebase';
import liff from '@line/liff';

const availableCars = [
  {
    id: 'MIRAGS (775-1247)',
    name: 'Mitsubishi Mirage',
    plate: '775-1247',
    imageUrl: '/cars/mirage.png',
    isRental: false,
    badge: 'ประจำการ',
  },
  {
    id: 'RENTAL-TEMP',
    name: 'รถเช่าชั่วคราว',
    plate: 'รอระบุ',
    imageUrl: 'https://cdn-icons-png.flaticon.com/512/3085/3085330.png',
    isRental: true,
    badge: 'รถเช่า',
  },
];

const steps = ['เลือกรถ', 'เวลา', 'ปลายทาง'];

export default function BookCarPage() {
  const router = useRouter();
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isLiffReady, setIsLiffReady] = useState(false);
  const [currentStep, setCurrentStep] = useState(0);
  const [submitted, setSubmitted] = useState(false);

  const [formData, setFormData] = useState({
    bookerName: '',
    userId: '',
    car: 'MIRAGS (775-1247)',
    startDatetime: '',
    endDatetime: '',
    destination: '',
    purpose: '',
  });

  useEffect(() => {
    const initLiff = async () => {
      try {
        await liff.init({ liffId: '2009402149-lV41Nacx' });
        if (liff.isLoggedIn()) {
          const profile = await liff.getProfile();
          setFormData(prev => ({
            ...prev,
            bookerName: profile.displayName,
            userId: profile.userId,
          }));
          setIsLiffReady(true);
        } else {
          liff.login();
        }
      } catch (error) {
        console.error('LIFF init failed', error);
      }
    };
    initLiff();
  }, []);

  const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) => {
    setFormData({ ...formData, [e.target.name]: e.target.value });
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSubmitting(true);
    try {
      await addDoc(collection(db, 'bookings'), {
        carName: formData.car,
        bookerId: formData.userId,
        bookerName: formData.bookerName,
        startDatetime: formData.startDatetime,
        endDatetime: formData.endDatetime,
        destination: formData.destination,
        purpose: formData.purpose,
        status: 'pending',
        createdAt: serverTimestamp(),
      });
      await fetch('/api/notify', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          bookerName: formData.bookerName,
          car: formData.car,
          destination: formData.destination,
          date: formData.startDatetime,
        }),
      });
      setSubmitted(true);
    } catch (error) {
      console.error(error);
      alert('เกิดข้อผิดพลาด กรุณาลองใหม่');
    } finally {
      setIsSubmitting(false);
    }
  };

  const canProceedStep0 = !!formData.car;
  const canProceedStep1 = !!formData.startDatetime && !!formData.endDatetime;
  const canProceedStep2 = !!formData.destination && !!formData.purpose;
  const selectedCar = availableCars.find(c => c.id === formData.car);

  // ── Success Screen ──
  if (submitted) {
    return (
      <>
        <GlobalStyles />
        <div className="page-bg" style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', minHeight: '100vh', padding: '24px' }}>
          <div className="success-pop" style={{ textAlign: 'center', width: '100%', maxWidth: 400 }}>
            {/* Check icon */}
            <div style={{ width: 80, height: 80, borderRadius: '50%', background: 'linear-gradient(135deg, #22c55e, #16a34a)', margin: '0 auto 20px', display: 'flex', alignItems: 'center', justifyContent: 'center', boxShadow: '0 8px 24px rgba(34,197,94,0.3)' }}>
              <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="white" width="38" height="38">
                <path fillRule="evenodd" d="M19.916 4.626a.75.75 0 01.208 1.04l-9 13.5a.75.75 0 01-1.154.114l-6-6a.75.75 0 011.06-1.06l5.353 5.353 8.493-12.739a.75.75 0 011.04-.208z" clipRule="evenodd" />
              </svg>
            </div>

            <h2 style={{ fontFamily: 'Prompt,sans-serif', fontSize: 22, fontWeight: 700, color: '#1e3a5f', marginBottom: 4 }}>จองรถสำเร็จ! 🎉</h2>
            <p style={{ color: '#64748b', fontSize: 13, marginBottom: 20 }}>ระบบส่งการแจ้งเตือนไปที่ LINE ของคุณแล้ว</p>

            {/* Summary */}
            <div className="white-card" style={{ textAlign: 'left', marginBottom: 20 }}>
              <SummaryRow icon="🚗" label="รถ" value={selectedCar?.name || formData.car} />
              <SummaryRow icon="📍" label="ปลายทาง" value={formData.destination} />
              <SummaryRow icon="🕐" label="ออกเดินทาง" value={formatDatetime(formData.startDatetime)} />
              <SummaryRow icon="🕔" label="กลับถึง" value={formatDatetime(formData.endDatetime)} />
              <SummaryRow icon="📋" label="วัตถุประสงค์" value={formData.purpose} last />
            </div>

            <button className="btn-primary" onClick={() => router.push('/')}>
              กลับหน้าหลัก
            </button>
          </div>
        </div>
      </>
    );
  }

  return (
    <>
      <GlobalStyles />
      <div className="page-bg" style={{ minHeight: '100vh', paddingBottom: 32 }}>

        {/* ── Header ── */}
        <header className="app-header">
          <button
            className="back-btn"
            onClick={() => currentStep > 0 ? setCurrentStep(s => s - 1) : router.back()}
          >
            <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={2.5} stroke="currentColor" width="18" height="18">
              <path strokeLinecap="round" strokeLinejoin="round" d="M15.75 19.5L8.25 12l7.5-7.5" />
            </svg>
          </button>

          {/* Logo + Title */}
          <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
            <img src="/logo.jpg" alt="HSD" style={{ width: 36, height: 36, borderRadius: 8, objectFit: 'cover' }} onError={(e) => { (e.target as HTMLImageElement).style.display = 'none'; }} />
            <div>
              <p
  title="HARU SYSTEM DEVELOPMENT (THAILAND) CO.,LTD."
  style={{
    fontSize: 10,
    color: '#94a3b8',
    margin: 0,
    lineHeight: 1,
    maxWidth: 160,        // จำกัดความกว้าง
    overflow: 'hidden',
    whiteSpace: 'nowrap',
    textOverflow: 'ellipsis',
  }}
>
  HARU SYSTEM DEVELOPMENT (THAILAND) CO.,LTD.
</p>
<h1 style={{ fontSize: 15, fontWeight: 700, color: '#1e3a5f', margin: 0, fontFamily: 'Prompt,sans-serif' }}>
  จองรถบริษัท
</h1>
            </div>
          </div>

          {/* User chip */}
          {formData.bookerName && (
            <div className="user-chip">
              <div className="user-avatar">{formData.bookerName.charAt(0)}</div>
              <span>{formData.bookerName.split(' ')[0]}</span>
            </div>
          )}
        </header>

        <div style={{ maxWidth: 440, margin: '0 auto', padding: '16px 16px 0' }}>

          {/* ── Step Indicator ── */}
          <div className="step-bar">
            {steps.map((label, i) => (
              <div key={i} style={{ display: 'flex', alignItems: 'center', flex: i < steps.length - 1 ? 1 : 'none' }}>
                <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 4 }}>
                  <div className={`step-dot ${i < currentStep ? 'done' : i === currentStep ? 'active' : 'idle'}`}>
                    {i < currentStep ? (
                      <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor" width="11" height="11">
                        <path fillRule="evenodd" d="M16.704 4.153a.75.75 0 01.143 1.052l-8 10.5a.75.75 0 01-1.127.075l-4.5-4.5a.75.75 0 011.06-1.06l3.894 3.893 7.48-9.817a.75.75 0 011.05-.143z" clipRule="evenodd" />
                      </svg>
                    ) : i + 1}
                  </div>
                  <span className={`step-label ${i === currentStep ? 'active' : i < currentStep ? 'done' : ''}`}>{label}</span>
                </div>
                {i < steps.length - 1 && (
                  <div className={`step-line ${i < currentStep ? 'done' : ''}`} />
                )}
              </div>
            ))}
          </div>

          {/* ── Form Card ── */}
          <div className="white-card">
            {!isLiffReady ? (
              <div style={{ padding: '40px 0', textAlign: 'center' }}>
                <div className="spinner" style={{ margin: '0 auto 12px' }} />
                <p style={{ fontSize: 13, color: '#94a3b8' }}>กำลังโหลดข้อมูล LINE...</p>
              </div>
            ) : (
              <form onSubmit={handleSubmit}>

                {/* ═══ STEP 0: เลือกรถ ═══ */}
                {currentStep === 0 && (
                  <div className="step-content">
                    {/* Booker */}
                    <div className="field-group">
                      <label className="field-label">ผู้จอง</label>
                      <div className="booker-row">
                        <div className="booker-avatar">{formData.bookerName.charAt(0)}</div>
                        <span className="booker-name">{formData.bookerName}</span>
                        <span className="verified-badge">✓ ยืนยัน</span>
                      </div>
                    </div>

                    {/* Car Selection */}
                    <div className="field-group">
                      <label className="field-label">เลือกรถยนต์ *</label>
                      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
                        {availableCars.map((car) => (
                          <div
                            key={car.id}
                            className={`car-card ${formData.car === car.id ? 'selected' : ''}`}
                            onClick={() => setFormData({ ...formData, car: car.id })}
                          >
                            <span className={`car-badge ${car.isRental ? 'rental' : 'regular'}`}>{car.badge}</span>
                            <div style={{ height: 56, display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '8px 0' }}>
                              <img src={car.imageUrl} alt={car.name} style={{ maxHeight: '100%', objectFit: 'contain', filter: 'drop-shadow(0 2px 4px rgba(0,0,0,0.12))' }} />
                            </div>
                            <p style={{ fontSize: 13, fontWeight: 700, color: '#1e3a5f', marginBottom: 2, lineHeight: 1.3 }}>{car.name}</p>
                            <p style={{ fontSize: 11, color: '#94a3b8' }}>ทะเบียน: {car.plate}</p>
                            {formData.car === car.id && (
                              <div className="check-badge">
                                <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="white" width="11" height="11">
                                  <path fillRule="evenodd" d="M16.704 4.153a.75.75 0 01.143 1.052l-8 10.5a.75.75 0 01-1.127.075l-4.5-4.5a.75.75 0 011.06-1.06l3.894 3.893 7.48-9.817a.75.75 0 011.05-.143z" clipRule="evenodd" />
                                </svg>
                              </div>
                            )}
                          </div>
                        ))}
                      </div>
                    </div>

                    <button type="button" disabled={!canProceedStep0} onClick={() => setCurrentStep(1)} className="btn-primary">
                      ถัดไป: เลือกเวลา →
                    </button>
                  </div>
                )}

                {/* ═══ STEP 1: เวลา ═══ */}
                {currentStep === 1 && (
                  <div className="step-content">
                    {/* Selected Car preview */}
                    <div className="info-strip">
                      <img src={selectedCar?.imageUrl} alt="" style={{ width: 36, height: 36, objectFit: 'contain' }} />
                      <div>
                        <p style={{ fontSize: 10, color: '#64748b', margin: 0 }}>รถที่เลือก</p>
                        <p style={{ fontSize: 14, fontWeight: 700, color: '#1e3a5f', margin: 0 }}>{selectedCar?.name}</p>
                      </div>
                    </div>

                    <div className="field-group">
                      <label className="field-label">🕐 เวลาออกเดินทาง *</label>
                      <input type="datetime-local" name="startDatetime" required value={formData.startDatetime} onChange={handleChange} className="input-field" />
                    </div>

                    <div className="field-group">
                      <label className="field-label">🕔 เวลากลับถึง *</label>
                      <input type="datetime-local" name="endDatetime" required value={formData.endDatetime} min={formData.startDatetime} onChange={handleChange} className="input-field" />
                    </div>

                    {/* Duration badge */}
                    {formData.startDatetime && formData.endDatetime && (
                      <div className="duration-badge">
                        <span>⏱</span>
                        <div>
                          <p style={{ fontSize: 11, color: '#16a34a', margin: 0, fontWeight: 600 }}>ระยะเวลาใช้งาน</p>
                          <p style={{ fontSize: 14, fontWeight: 700, color: '#15803d', margin: 0 }}>{getDuration(formData.startDatetime, formData.endDatetime)}</p>
                        </div>
                      </div>
                    )}

                    <div style={{ display: 'flex', gap: 10 }}>
                      <button type="button" onClick={() => setCurrentStep(0)} className="btn-secondary">← ย้อนกลับ</button>
                      <button type="button" disabled={!canProceedStep1} onClick={() => setCurrentStep(2)} className="btn-primary" style={{ flex: 1 }}>
                        ถัดไป: ปลายทาง →
                      </button>
                    </div>
                  </div>
                )}

                {/* ═══ STEP 2: ปลายทาง + Confirm ═══ */}
                {currentStep === 2 && (
                  <div className="step-content">
                    <div className="field-group">
                      <label className="field-label">📍 จุดหมายเดินทาง *</label>
                      <input type="text" name="destination" required value={formData.destination} onChange={handleChange} placeholder="เช่น DCI, Daikin, HARU" className="input-field" />
                    </div>

                    <div className="field-group">
                      <label className="field-label">📋 วัตถุประสงค์ *</label>
                      <input type="text" name="purpose" required value={formData.purpose} onChange={handleChange} placeholder="เช่น Install, Test run, Meeting" className="input-field" />
                    </div>

                    {/* Summary */}
                    {canProceedStep2 && (
                      <div className="summary-box">
                        <p className="summary-title">📌 สรุปการจอง</p>
                        <SummaryRow icon="👤" label="ผู้จอง" value={formData.bookerName} />
                        <SummaryRow icon="🚗" label="รถ" value={selectedCar?.name || ''} />
                        <SummaryRow icon="🕐" label="ออกเดินทาง" value={formatDatetime(formData.startDatetime)} />
                        <SummaryRow icon="🕔" label="กลับถึง" value={formatDatetime(formData.endDatetime)} />
                        <SummaryRow icon="📍" label="ปลายทาง" value={formData.destination} />
                        <SummaryRow icon="📋" label="วัตถุประสงค์" value={formData.purpose} last />
                      </div>
                    )}

                    <div style={{ display: 'flex', gap: 10 }}>
                      <button type="button" onClick={() => setCurrentStep(1)} className="btn-secondary">← ย้อนกลับ</button>
                      <button type="submit" disabled={isSubmitting || !canProceedStep2} className="btn-primary btn-green" style={{ flex: 1 }}>
                        {isSubmitting ? <><span className="spinner-sm" />กำลังบันทึก...</> : '✅ ยืนยันการจอง'}
                      </button>
                    </div>
                  </div>
                )}

              </form>
            )}
          </div>
        </div>
      </div>
    </>
  );
}

// ── Helpers ──

function SummaryRow({ icon, label, value, last }: { icon: string; label: string; value: string; last?: boolean }) {
  return (
    <div style={{ display: 'flex', alignItems: 'flex-start', gap: 8, paddingBottom: last ? 0 : 10, marginBottom: last ? 0 : 10, borderBottom: last ? 'none' : '1px solid #f1f5f9' }}>
      <span style={{ fontSize: 14, lineHeight: 1.5 }}>{icon}</span>
      <span style={{ fontSize: 12, color: '#94a3b8', width: 76, flexShrink: 0, lineHeight: 1.5 }}>{label}</span>
      <span style={{ fontSize: 13, fontWeight: 600, color: '#1e3a5f', flex: 1, lineHeight: 1.5 }}>{value}</span>
    </div>
  );
}

function formatDatetime(dt: string): string {
  if (!dt) return '';
  return new Date(dt).toLocaleString('th-TH', { day: '2-digit', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' });
}

function getDuration(start: string, end: string): string {
  const ms = new Date(end).getTime() - new Date(start).getTime();
  if (ms <= 0) return 'กรุณาตรวจสอบเวลา';
  const h = Math.floor(ms / 3600000);
  const m = Math.floor((ms % 3600000) / 60000);
  return h > 0 ? `${h} ชั่วโมง ${m} นาที` : `${m} นาที`;
}

// ── Global Styles Component ──
function GlobalStyles() {
  return (
    <style>{`
      @import url('https://fonts.googleapis.com/css2?family=Sarabun:wght@300;400;500;600;700&family=Prompt:wght@600;700&display=swap');

      *, *::before, *::after { box-sizing: border-box; margin: 0; padding: 0; }

      body, * { font-family: 'Sarabun', sans-serif; }

      /* ── Page Background ── */
      .page-bg {
        background: #f0f4f8;
        background-image:
          radial-gradient(circle at 20% 10%, rgba(30, 58, 95, 0.06) 0%, transparent 50%),
          radial-gradient(circle at 80% 80%, rgba(22, 163, 74, 0.05) 0%, transparent 50%);
      }

      /* ── Header ── */
      .app-header {
        position: sticky; top: 0; z-index: 20;
        background: white;
        border-bottom: 1px solid #e2e8f0;
        padding: 10px 16px;
        display: flex;
        align-items: center;
        gap: 12px;
        box-shadow: 0 1px 8px rgba(0,0,0,0.06);
      }
      .back-btn {
        width: 34px; height: 34px;
        border-radius: 10px;
        border: 1px solid #e2e8f0;
        background: #f8fafc;
        display: flex; align-items: center; justify-content: center;
        cursor: pointer;
        color: #475569;
        transition: all 0.15s;
        flex-shrink: 0;
      }
      .back-btn:hover { background: #f1f5f9; border-color: #cbd5e1; }

      .user-chip {
        margin-left: auto;
        display: flex; align-items: center; gap: 6px;
        background: #eff6ff;
        border: 1px solid #bfdbfe;
        border-radius: 20px;
        padding: 4px 10px 4px 4px;
      }
      .user-avatar {
        width: 22px; height: 22px; border-radius: 50%;
        background: linear-gradient(135deg, #1d4ed8, #1e3a5f);
        color: white; font-size: 11px; font-weight: 700;
        display: flex; align-items: center; justify-content: center;
      }
      .user-chip span { font-size: 12px; font-weight: 600; color: #1d4ed8; }

      /* ── Step Bar ── */
      .step-bar {
        display: flex; align-items: center;
        padding: 16px 4px 12px;
      }
      .step-dot {
        width: 26px; height: 26px; border-radius: 50%;
        display: flex; align-items: center; justify-content: center;
        font-size: 11px; font-weight: 700;
        transition: all 0.25s;
        flex-shrink: 0;
      }
      .step-dot.active {
        background: linear-gradient(135deg, #1d4ed8, #1e3a5f);
        color: white;
        box-shadow: 0 3px 10px rgba(29,78,216,0.35);
      }
      .step-dot.done { background: #16a34a; color: white; }
      .step-dot.idle { background: #e2e8f0; color: #94a3b8; }
      .step-label { font-size: 10px; color: #94a3b8; font-weight: 500; }
      .step-label.active { color: #1d4ed8; font-weight: 700; }
      .step-label.done { color: #16a34a; }
      .step-line {
        flex: 1; height: 2px; background: #e2e8f0;
        margin: 0 6px; margin-bottom: 14px;
        transition: background 0.25s;
        border-radius: 2px;
      }
      .step-line.done { background: #16a34a; }

      /* ── White Card ── */
      .white-card {
        background: white;
        border-radius: 18px;
        padding: 20px;
        box-shadow: 0 2px 16px rgba(0,0,0,0.07), 0 0 0 1px rgba(0,0,0,0.04);
      }

      /* ── Step Content ── */
      .step-content { animation: slideIn 0.3s cubic-bezier(0.25,1,0.5,1); }
      @keyframes slideIn {
        from { opacity: 0; transform: translateX(16px); }
        to   { opacity: 1; transform: translateX(0); }
      }

      /* ── Field ── */
      .field-group { margin-bottom: 16px; }
      .field-label {
        display: block;
        font-size: 11px; font-weight: 700;
        color: #64748b;
        text-transform: uppercase; letter-spacing: 0.06em;
        margin-bottom: 7px;
      }
      .input-field {
        width: 100%;
        border: 1.5px solid #e2e8f0;
        border-radius: 11px;
        padding: 11px 13px;
        font-size: 14px; color: #1e293b;
        background: #f8fafc;
        outline: none;
        transition: all 0.18s;
        font-family: 'Sarabun', sans-serif;
      }
      .input-field:focus {
        border-color: #1d4ed8;
        background: white;
        box-shadow: 0 0 0 3px rgba(29,78,216,0.1);
      }
      input[type="datetime-local"]::-webkit-calendar-picker-indicator {
        opacity: 0.45; cursor: pointer;
      }

      /* ── Booker row ── */
      .booker-row {
        display: flex; align-items: center; gap: 10px;
        background: #f8fafc;
        border: 1.5px solid #e2e8f0;
        border-radius: 11px;
        padding: 10px 13px;
      }
      .booker-avatar {
        width: 32px; height: 32px; border-radius: 50%;
        background: linear-gradient(135deg, #1d4ed8, #1e3a5f);
        color: white; font-size: 13px; font-weight: 700;
        display: flex; align-items: center; justify-content: center;
        flex-shrink: 0;
      }
      .booker-name { font-size: 14px; font-weight: 600; color: #1e293b; flex: 1; }
      .verified-badge {
        font-size: 11px; font-weight: 700;
        color: #16a34a;
        background: #dcfce7;
        border: 1px solid #bbf7d0;
        border-radius: 20px;
        padding: 2px 8px;
      }

      /* ── Car card ── */
      .car-card {
        border: 2px solid #e2e8f0;
        border-radius: 14px;
        padding: 12px;
        cursor: pointer;
        transition: all 0.2s;
        background: white;
        position: relative;
        overflow: hidden;
      }
      .car-card:hover:not(.selected) {
        border-color: #93c5fd;
        transform: translateY(-2px);
        box-shadow: 0 4px 14px rgba(0,0,0,0.08);
      }
      .car-card.selected {
        border-color: #1d4ed8;
        background: #eff6ff;
        box-shadow: 0 0 0 3px rgba(29,78,216,0.12), 0 4px 14px rgba(29,78,216,0.1);
      }
      .car-badge {
        display: inline-block;
        font-size: 10px; font-weight: 700;
        border-radius: 20px;
        padding: 2px 7px;
      }
      .car-badge.regular { background: #dcfce7; color: #16a34a; }
      .car-badge.rental  { background: #fef9c3; color: #ca8a04; }
      .check-badge {
        position: absolute; top: 8px; right: 8px;
        width: 20px; height: 20px; border-radius: 50%;
        background: #1d4ed8;
        display: flex; align-items: center; justify-content: center;
        box-shadow: 0 2px 8px rgba(29,78,216,0.35);
      }

      /* ── Info strip ── */
      .info-strip {
        display: flex; align-items: center; gap: 12px;
        background: #eff6ff;
        border: 1px solid #bfdbfe;
        border-radius: 12px;
        padding: 10px 14px;
        margin-bottom: 16px;
      }

      /* ── Duration badge ── */
      .duration-badge {
        display: flex; align-items: center; gap: 10px;
        background: #f0fdf4;
        border: 1px solid #bbf7d0;
        border-radius: 12px;
        padding: 10px 14px;
        margin-bottom: 16px;
        font-size: 18px;
      }

      /* ── Summary box ── */
      .summary-box {
        background: #f8fafc;
        border: 1.5px solid #e2e8f0;
        border-radius: 13px;
        padding: 14px;
        margin-bottom: 16px;
      }
      .summary-title {
        font-size: 11px; font-weight: 700;
        color: #1d4ed8;
        text-transform: uppercase; letter-spacing: 0.06em;
        margin-bottom: 12px;
      }

      /* ── Buttons ── */
      .btn-primary {
        width: 100%;
        padding: 14px;
        border-radius: 12px;
        font-size: 14px; font-weight: 700;
        color: white;
        border: none; cursor: pointer;
        transition: all 0.18s;
        background: linear-gradient(135deg, #1d4ed8, #1e3a5f);
        box-shadow: 0 4px 14px rgba(29,78,216,0.3);
        font-family: 'Prompt', sans-serif;
        letter-spacing: 0.02em;
        display: flex; align-items: center; justify-content: center; gap: 6px;
      }
      .btn-primary:hover:not(:disabled) {
        transform: translateY(-1px);
        box-shadow: 0 6px 18px rgba(29,78,216,0.35);
      }
      .btn-primary:active:not(:disabled) { transform: scale(0.98); }
      .btn-primary:disabled { background: #cbd5e1; box-shadow: none; cursor: not-allowed; }

      /* Green confirm button */
      .btn-green {
        background: linear-gradient(135deg, #16a34a, #15803d) !important;
        box-shadow: 0 4px 14px rgba(22,163,74,0.3) !important;
      }
      .btn-green:hover:not(:disabled) {
        box-shadow: 0 6px 18px rgba(22,163,74,0.35) !important;
      }

      .btn-secondary {
        padding: 14px 18px;
        border-radius: 12px;
        font-size: 13px; font-weight: 600;
        color: #475569;
        background: #f1f5f9;
        border: 1.5px solid #e2e8f0;
        cursor: pointer;
        transition: all 0.18s;
        white-space: nowrap;
        font-family: 'Sarabun', sans-serif;
      }
      .btn-secondary:hover { background: #e2e8f0; color: #1e293b; }

      /* ── Spinners ── */
      .spinner {
        width: 24px; height: 24px;
        border: 3px solid #e2e8f0;
        border-top-color: #1d4ed8;
        border-radius: 50%;
        animation: spin 0.7s linear infinite;
      }
      .spinner-sm {
        display: inline-block;
        width: 14px; height: 14px;
        border: 2px solid rgba(255,255,255,0.4);
        border-top-color: white;
        border-radius: 50%;
        animation: spin 0.7s linear infinite;
        flex-shrink: 0;
      }
      @keyframes spin { to { transform: rotate(360deg); } }

      /* ── Success animation ── */
      .success-pop { animation: popIn 0.55s cubic-bezier(0.34,1.56,0.64,1); }
      @keyframes popIn {
        from { opacity: 0; transform: scale(0.85); }
        to   { opacity: 1; transform: scale(1); }
      }
    `}</style>
  );
}