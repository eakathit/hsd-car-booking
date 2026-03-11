// app/page.tsx
'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { collection, query, where, onSnapshot, orderBy } from 'firebase/firestore';
import { db } from '../lib/firebase';
import { COMPANY_CARS } from '../lib/cars';
import type { Booking } from '../types';
import BottomNav from './components/BottomNav';
import { useLiff } from '../lib/liff-context'; // ✅ ใช้ context แทน init เอง

// ── Timeline config ──
const DAY_START  = 7 * 60;
const DAY_END    = 20 * 60;
const HOUR_MARKS = [8, 10, 12, 14, 16, 18];

function toMinutes(hhmm: string) {
  const [h, m] = hhmm.split(':').map(Number);
  return h * 60 + m;
}
function pct(mins: number) {
  return `${Math.max(0, Math.min(100, ((mins - DAY_START) / (DAY_END - DAY_START)) * 100)).toFixed(1)}%`;
}
function todayStr() { return new Date().toISOString().split('T')[0]; }
function formatThDate(d: string) {
  return new Date(d + 'T00:00:00').toLocaleDateString('th-TH', {
    weekday: 'long', day: 'numeric', month: 'long',
  });
}

const STATUS_COLOR: Record<string, string> = {
  booked: '#3b82f6', active: '#16a34a', completed: '#94a3b8', cancelled: '#ef4444',
};

export default function Dashboard() {
  // ✅ ดึง user จาก LiffProvider ที่ init ไว้แล้วใน layout — ไม่ init ซ้ำ
  const { user, isReady } = useLiff();

  const [selectedDate, setSelectedDate] = useState(todayStr());
  const [bookings, setBookings]         = useState<Booking[]>([]);
  const [loading, setLoading]           = useState(true);

  // Real-time bookings
  useEffect(() => {
    setLoading(true);
    const q = query(
      collection(db, 'bookings'),
      where('useDate', '==', selectedDate),
      where('status', 'in', ['booked', 'active', 'completed']),
      orderBy('startTime', 'asc'),
    );
    const unsub = onSnapshot(q, (snap) => {
      setBookings(snap.docs.map((d) => ({ id: d.id, ...d.data() } as Booking)));
      setLoading(false);
    });
    return () => unsub();
  }, [selectedDate]);

  // ✅ ใช้ isReady จาก context — ไม่ต้องมี state ของตัวเองอีกแล้ว
  if (!isReady) {
    return (
      <div style={{ display: 'flex', minHeight: '100vh', alignItems: 'center', justifyContent: 'center', background: '#f0f4f8' }}>
        <p style={{ color: '#94a3b8', fontFamily: 'Sarabun,sans-serif' }}>กำลังโหลด…</p>
      </div>
    );
  }

  const isToday = selectedDate === todayStr();

  return (
    <>
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Sarabun:wght@400;500;600;700&family=Prompt:wght@600;700&display=swap');
        *, *::before, *::after { box-sizing: border-box; margin: 0; padding: 0; }
        body, * { font-family: 'Sarabun', sans-serif; }

        .page { background: #f0f4f8; min-height: 100vh; padding-bottom: 96px; }

        .sticky-header {
          position: sticky; top: 0; z-index: 20;
          background: white; padding: 10px 16px;
          display: flex; align-items: center; gap: 12px;
          box-shadow: 0 1px 8px rgba(0,0,0,0.07);
          border-bottom: 1px solid #e2e8f0;
        }
        .avatar { width: 40px; height: 40px; border-radius: 50%; object-fit: cover; border: 2px solid #bfdbfe; }
        .avatar-fallback {
          width: 40px; height: 40px; border-radius: 50%;
          background: linear-gradient(135deg,#1d4ed8,#1e3a5f);
          color: white; font-weight: 700; font-size: 16px;
          display: flex; align-items: center; justify-content: center;
        }

        .section { max-width: 480px; margin: 0 auto; padding: 16px 16px 0; }

        .card {
          background: white; border-radius: 18px; padding: 18px;
          box-shadow: 0 2px 14px rgba(0,0,0,0.06); margin-bottom: 14px;
        }
        .card-title {
          font-family: 'Prompt',sans-serif; font-size: 14px;
          font-weight: 700; color: #1e3a5f; margin-bottom: 0;
        }

        .date-input {
          border: 1.5px solid #e2e8f0; border-radius: 10px;
          padding: 8px 12px; font-size: 13px; color: #1e293b;
          background: #f8fafc; outline: none; font-family: 'Sarabun',sans-serif;
        }
        .date-input:focus { border-color: #1d4ed8; box-shadow: 0 0 0 3px rgba(29,78,216,0.1); }

        .car-row { margin-bottom: 18px; }
        .car-label {
          font-size: 12px; font-weight: 700; color: #475569;
          margin-bottom: 6px; display: flex; align-items: center; gap: 6px;
        }

        .timeline-wrap {
          position: relative; height: 36px;
          background: #f1f5f9; border-radius: 8px; overflow: visible;
        }
        .timeline-hour {
          position: absolute; top: 100%; font-size: 9px;
          color: #94a3b8; transform: translateX(-50%); margin-top: 2px;
        }
        .booking-bar {
          position: absolute; height: 100%; border-radius: 6px;
          display: flex; align-items: center; padding: 0 8px;
          overflow: hidden; cursor: pointer; border: none;
          transition: filter .15s, transform .15s;
        }
        .booking-bar:hover  { filter: brightness(1.1); transform: scaleY(1.05); }
        .booking-bar:active { transform: scale(.97); }
        .booking-bar-label {
          font-size: 11px; font-weight: 600; color: white;
          white-space: nowrap; overflow: hidden; text-overflow: ellipsis;
          pointer-events: none;
        }
        .no-booking {
          font-size: 12px; color: #94a3b8;
          text-align: center; line-height: 36px;
        }

        .booking-list-item {
          display: flex; align-items: flex-start; gap: 10px;
          padding: 10px 0; border-bottom: 1px solid #f1f5f9;
        }
        .booking-list-item:last-child { border-bottom: none; }
        .status-dot { width: 8px; height: 8px; border-radius: 50%; margin-top: 4px; flex-shrink: 0; }
      `}</style>

      <div className="page">

        {/* ── Header ── */}
        <header className="sticky-header">
          {user?.pictureUrl
            ? <img src={user.pictureUrl} alt="" className="avatar" />
            : <div className="avatar-fallback">{user?.displayName?.charAt(0) || 'U'}</div>}
          <div>
            <p style={{ fontSize: 14, fontWeight: 700, color: '#1e3a5f', margin: 0 }}>
              {user?.displayName || 'พนักงาน'}
            </p>
          </div>
          <Link href="/queue" style={{
            marginLeft: 'auto', fontSize: 12, color: '#1d4ed8', fontWeight: 600,
            textDecoration: 'none', background: '#eff6ff',
            padding: '6px 12px', borderRadius: 20, border: '1px solid #bfdbfe',
            whiteSpace: 'nowrap',
          }}>
            ดูคิวทั้งหมด →
          </Link>
        </header>

        <div className="section">

          {/* ── Timeline card ── */}
          <div className="card">
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 8 }}>
              <p className="card-title">🗓️ สถานะรถ {isToday ? '(วันนี้)' : ''}</p>
              <input
                type="date"
                value={selectedDate}
                className="date-input"
                onChange={(e) => setSelectedDate(e.target.value)}
              />
            </div>

            <p style={{ fontSize: 12, color: '#64748b', marginBottom: 16 }}>
              {formatThDate(selectedDate)}
            </p>

            {loading ? (
              <p style={{ fontSize: 13, color: '#94a3b8', textAlign: 'center', padding: '16px 0' }}>
                กำลังโหลด…
              </p>
            ) : (
              COMPANY_CARS.map((car) => {
                const carBookings = bookings.filter((b) => b.carId === car.id);
                return (
                  <div key={car.id} className="car-row">
                    <div className="car-label">
                      <span style={{
                        width: 10, height: 10, borderRadius: '50%',
                        background: car.color, display: 'inline-block', flexShrink: 0,
                      }} />
                      <span>{car.short}</span>
                      <span style={{ fontSize: 11, color: '#94a3b8', fontWeight: 400 }}>
                        ({car.plate})
                      </span>
                      {carBookings.length === 0 && (
                        <span style={{ marginLeft: 'auto', fontSize: 11, color: '#16a34a', fontWeight: 600 }}>
                          ✓ ว่าง
                        </span>
                      )}
                    </div>

                    <div className="timeline-wrap">
                      {carBookings.length === 0 && (
                        <div className="no-booking">— ว่างทั้งวัน —</div>
                      )}
                      {carBookings.map((b) => {
                        const s = toMinutes(b.startTime);
                        const e = toMinutes(b.endTime);
                        return (
                          <button
                            key={b.id}
                            className="booking-bar"
                            style={{
                              left: pct(s),
                              width: `calc(${pct(e)} - ${pct(s)})`,
                              background: STATUS_COLOR[b.status] || car.color,
                              opacity: 0.88,
                            }}
                            title={`${b.driverName} | ${b.purpose} | ${b.startTime}–${b.endTime}`}
                          >
                            <span className="booking-bar-label">
                              {b.driverName} · {b.startTime}–{b.endTime}
                            </span>
                          </button>
                        );
                      })}

                      {HOUR_MARKS.map((h) => (
                        <span key={h} className="timeline-hour" style={{ left: pct(h * 60) }}>
                          {h}
                        </span>
                      ))}
                    </div>
                  </div>
                );
              })
            )}
          </div>

          {/* ── Booking list ── */}
          {!loading && bookings.length > 0 && (
            <div className="card">
              <p className="card-title" style={{ marginBottom: 12 }}>
                📋 รายการจองวันนี้ ({bookings.length} รายการ)
              </p>
              {bookings.map((b) => {
                const car = COMPANY_CARS.find((c) => c.id === b.carId);
                return (
                  <div key={b.id} className="booking-list-item">
                    <div className="status-dot" style={{ background: STATUS_COLOR[b.status] }} />
                    <div style={{ flex: 1 }}>
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                        <p style={{ fontSize: 13, fontWeight: 700, color: '#1e293b', margin: 0 }}>
                          {b.driverName}
                        </p>
                        <span style={{ fontSize: 11, background: '#f1f5f9', color: '#475569', borderRadius: 20, padding: '2px 8px', fontWeight: 600 }}>
                          {b.startTime} – {b.endTime}
                        </span>
                      </div>
                      <p style={{ fontSize: 12, color: '#64748b', margin: '2px 0 0' }}>
                        {car?.short} · {b.fromLocation} → {b.toLocation}
                      </p>
                      <p style={{ fontSize: 11, color: '#94a3b8', margin: '2px 0 0' }}>{b.purpose}</p>
                    </div>
                  </div>
                );
              })}
            </div>
          )}

          {/* ── Empty state ── */}
          {!loading && bookings.length === 0 && (
            <div className="card" style={{ textAlign: 'center', padding: '32px 20px' }}>
              <p style={{ fontSize: 32, marginBottom: 8 }}>🚗</p>
              <p style={{ fontSize: 14, fontWeight: 600, color: '#1e3a5f', margin: '0 0 4px', fontFamily: 'Prompt,sans-serif' }}>
                ยังไม่มีการจองในวันนี้
              </p>
              <p style={{ fontSize: 12, color: '#94a3b8' }}>รถทุกคันว่างพร้อมใช้งาน</p>
            </div>
          )}

        </div>

        <BottomNav />
      </div>
    </>
  );
}