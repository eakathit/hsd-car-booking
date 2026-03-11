// app/queue/page.tsx — Queue table matching PDF paper log columns
'use client';

import { useEffect, useState } from 'react';
import { collection, query, orderBy, onSnapshot, where, doc, updateDoc } from 'firebase/firestore';
import { db } from '../../lib/firebase';
import Link from 'next/link';
import type { Booking } from '../../types';

const STATUS_LABEL: Record<string, string> = {
  booked: 'จองแล้ว', active: 'กำลังใช้', completed: 'เสร็จแล้ว', cancelled: 'ยกเลิก',
};
const STATUS_BG: Record<string, string> = {
  booked:    'background:#dbeafe;color:#1d4ed8;',
  active:    'background:#dcfce7;color:#16a34a;',
  completed: 'background:#f1f5f9;color:#64748b;',
  cancelled: 'background:#fee2e2;color:#dc2626;',
};

function formatThDate(d: string): string {
  if (!d) return '—';
  return new Date(d + 'T00:00:00').toLocaleDateString('th-TH', { day: 'numeric', month: 'short', year: '2-digit' });
}

function todayStr() {
  return new Date().toISOString().split('T')[0];
}

type FilterMode = 'upcoming' | 'all' | 'date';

export default function QueuePage() {
  const [bookings, setBookings]   = useState<Booking[]>([]);
  const [loading, setLoading]     = useState(true);
  const [filter, setFilter]       = useState<FilterMode>('upcoming');
  const [filterDate, setFilterDate] = useState(todayStr());

  useEffect(() => {
    let q;
    if (filter === 'upcoming') {
      q = query(collection(db, 'bookings'),
        where('useDate', '>=', todayStr()),
        where('status', 'in', ['booked', 'active']),
        orderBy('useDate', 'asc'), orderBy('startTime', 'asc'));
    } else if (filter === 'date') {
      q = query(collection(db, 'bookings'),
        where('useDate', '==', filterDate),
        orderBy('startTime', 'asc'));
    } else {
      q = query(collection(db, 'bookings'),
        orderBy('useDate', 'desc'), orderBy('startTime', 'asc'));
    }

    setLoading(true);
    const unsub = onSnapshot(q, (snap) => {
      setBookings(snap.docs.map((d) => ({ id: d.id, ...d.data() } as Booking)));
      setLoading(false);
    });
    return () => unsub();
  }, [filter, filterDate]);

  // Cancel booking
  const cancelBooking = async (id: string) => {
    if (!confirm('ยืนยันยกเลิกการจองนี้?')) return;
    await updateDoc(doc(db, 'bookings', id), { status: 'cancelled' });
  };

  return (
    <>
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Sarabun:wght@400;500;600;700&family=Prompt:wght@600;700&display=swap');
        *, *::before, *::after { box-sizing: border-box; margin: 0; padding: 0; }
        body, * { font-family: 'Sarabun', sans-serif; }
        .page { background: #f0f4f8; min-height: 100vh; }
        .header { background: white; padding: 12px 16px; display: flex; align-items: center; gap: 12px; box-shadow: 0 1px 8px rgba(0,0,0,0.07); border-bottom: 1px solid #e2e8f0; position: sticky; top: 0; z-index: 20; }
        .wrap { max-width: 900px; margin: 0 auto; padding: 16px; }
        .filter-row { display: flex; gap: 8px; margin-bottom: 14px; flex-wrap: wrap; align-items: center; }
        .filter-btn { padding: 7px 14px; border-radius: 20px; font-size: 12px; font-weight: 600; cursor: pointer; border: 1.5px solid #e2e8f0; background: white; color: #64748b; transition: all 0.15s; }
        .filter-btn.active { background: #1d4ed8; color: white; border-color: #1d4ed8; }
        .date-input { border: 1.5px solid #e2e8f0; border-radius: 10px; padding: 7px 12px; font-size: 12px; color: #1e293b; background: #f8fafc; outline: none; }
        .date-input:focus { border-color: #1d4ed8; }
        .table-wrap { background: white; border-radius: 16px; overflow: hidden; box-shadow: 0 2px 14px rgba(0,0,0,0.06); }
        table { width: 100%; border-collapse: collapse; font-size: 13px; }
        thead { background: #f8fafc; }
        th { padding: 12px 14px; text-align: left; font-size: 11px; font-weight: 700; color: #64748b; text-transform: uppercase; letter-spacing: 0.05em; border-bottom: 1.5px solid #e2e8f0; white-space: nowrap; }
        td { padding: 12px 14px; border-bottom: 1px solid #f1f5f9; vertical-align: middle; }
        tr:last-child td { border-bottom: none; }
        tr:hover td { background: #f8fafc; }
        .badge { display: inline-block; font-size: 11px; font-weight: 700; border-radius: 20px; padding: 3px 10px; }
        .car-chip { display: inline-flex; align-items: center; gap: 4px; background: #eff6ff; color: #1d4ed8; border-radius: 20px; padding: 3px 9px; font-size: 11px; font-weight: 700; }
        .cancel-btn { font-size: 11px; color: #dc2626; background: #fee2e2; border: none; border-radius: 8px; padding: 4px 10px; cursor: pointer; font-weight: 600; transition: all 0.15s; }
        .cancel-btn:hover { background: #fecaca; }
        .empty { text-align: center; padding: 48px 16px; color: #94a3b8; }
        @media (max-width: 640px) {
          .hide-sm { display: none; }
          th, td { padding: 10px 10px; }
        }
      `}</style>

      <div className="page">
        <header className="header">
          <Link href="/" style={{ width: 34, height: 34, borderRadius: 10, border: '1px solid #e2e8f0', background: '#f8fafc', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#475569', textDecoration: 'none', flexShrink: 0 }}>
            ←
          </Link>
          <div>
            <p style={{ fontSize: 10, color: '#94a3b8', margin: 0 }}>HARU SYSTEM DEVELOPMENT</p>
            <h1 style={{ fontSize: 15, fontWeight: 700, color: '#1e3a5f', margin: 0, fontFamily: 'Prompt,sans-serif' }}>ตารางคิวรถบริษัท</h1>
          </div>
          <Link href="/book" style={{ marginLeft: 'auto', background: 'linear-gradient(135deg,#1d4ed8,#1e3a5f)', color: 'white', fontSize: 12, fontWeight: 700, padding: '8px 14px', borderRadius: 10, textDecoration: 'none', fontFamily: 'Prompt,sans-serif' }}>
            ➕ จองรถ
          </Link>
        </header>

        <div className="wrap">
          {/* Filters */}
          <div className="filter-row">
            <button className={`filter-btn ${filter === 'upcoming' ? 'active' : ''}`} onClick={() => setFilter('upcoming')}>📅 กำลังจะมาถึง</button>
            <button className={`filter-btn ${filter === 'date' ? 'active' : ''}`} onClick={() => setFilter('date')}>🔍 เลือกวัน</button>
            <button className={`filter-btn ${filter === 'all' ? 'active' : ''}`} onClick={() => setFilter('all')}>📋 ทั้งหมด</button>
            {filter === 'date' && (
              <input type="date" className="date-input" value={filterDate} onChange={(e) => setFilterDate(e.target.value)} />
            )}
            {!loading && (
              <span style={{ marginLeft: 'auto', fontSize: 12, color: '#94a3b8' }}>{bookings.length} รายการ</span>
            )}
          </div>

          {/* Table — columns match PDF: วันที่ใช้ | เวลา | รถ | จาก→ถึง | สำหรับ | ผู้ใช้รถ | ผู้จอง | สถานะ */}
          <div className="table-wrap">
            {loading ? (
              <div className="empty">กำลังโหลด…</div>
            ) : bookings.length === 0 ? (
              <div className="empty">
                <p style={{ fontSize: 28, marginBottom: 8 }}>📋</p>
                <p style={{ fontWeight: 600, color: '#1e3a5f', marginBottom: 4 }}>ไม่มีรายการ</p>
                <p style={{ fontSize: 12 }}>ยังไม่มีการจองในช่วงเวลาที่เลือก</p>
              </div>
            ) : (
              <div style={{ overflowX: 'auto' }}>
                <table>
                  <thead>
                    <tr>
                      <th>วันที่ใช้</th>
                      <th>เวลาออก–เข้า</th>
                      <th>รถ</th>
                      <th className="hide-sm">จาก → ถึง</th>
                      <th>สำหรับ</th>
                      <th className="hide-sm">ผู้ใช้รถ</th>
                      <th className="hide-sm">ผู้จอง</th>
                      <th>สถานะ</th>
                      <th></th>
                    </tr>
                  </thead>
                  <tbody>
                    {bookings.map((b) => (
                      <tr key={b.id}>
                        <td>
                          <span style={{ fontWeight: 700, color: '#1e3a5f', fontSize: 13 }}>{formatThDate(b.useDate)}</span>
                        </td>
                        <td>
                          <span style={{ fontSize: 12, fontWeight: 600, color: '#1e293b' }}>{b.startTime}</span>
                          <span style={{ color: '#94a3b8', margin: '0 3px' }}>–</span>
                          <span style={{ fontSize: 12, fontWeight: 600, color: '#1e293b' }}>{b.endTime}</span>
                        </td>
                        <td>
                          <span className="car-chip">🚗 {b.carPlate}</span>
                        </td>
                        <td className="hide-sm" style={{ color: '#475569', fontSize: 12 }}>
                          {b.fromLocation} → {b.toLocation}
                        </td>
                        <td style={{ fontWeight: 600, color: '#1e293b' }}>{b.purpose}</td>
                        <td className="hide-sm" style={{ color: '#1e293b' }}>{b.driverName}</td>
                        <td className="hide-sm" style={{ color: '#64748b', fontSize: 12 }}>{b.bookerName}</td>
                        <td>
                          <span className="badge" style={{ cssText: STATUS_BG[b.status] } as any}>
                            {STATUS_LABEL[b.status] || b.status}
                          </span>
                        </td>
                        <td>
                          {(b.status === 'booked') && (
                            <button className="cancel-btn" onClick={() => b.id && cancelBooking(b.id)}>ยกเลิก</button>
                          )}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </div>
      </div>
    </>
  );
}