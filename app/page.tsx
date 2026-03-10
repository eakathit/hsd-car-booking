'use client';

import { useState, useEffect } from 'react';
import { collection, addDoc, serverTimestamp } from 'firebase/firestore';
import { db } from '../lib/firebase';
import liff from '@line/liff';

export default function Home() {
  const [formData, setFormData] = useState({
    bookerName: '',
    userId: '',
    useDate: '',
    destination: '',
    purpose: '',
    car: 'MIRAGS (775-1247)'
  });

  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isLiffReady, setIsLiffReady] = useState(false);
  const [submitted, setSubmitted] = useState(false);

  useEffect(() => {
    const initLiff = async () => {
      try {
        await liff.init({ liffId: '2009402149-lV41Nacx' });
        if (liff.isLoggedIn()) {
          const profile = await liff.getProfile();
          setFormData(prev => ({
            ...prev,
            bookerName: profile.displayName,
            userId: profile.userId
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
        ...formData,
        createdAt: serverTimestamp(),
        status: 'pending'
      });

      await fetch('/api/notify', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          bookerName: formData.bookerName,
          car: formData.car,
          destination: formData.destination,
          date: formData.useDate
        })
      });

      setSubmitted(true);
      setTimeout(() => {
        setSubmitted(false);
        setFormData(prev => ({
          ...prev,
          useDate: '',
          destination: '',
          purpose: ''
        }));
      }, 3000);

    } catch (error) {
      alert('เกิดข้อผิดพลาด กรุณาลองใหม่');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <>
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Sora:wght@300;400;500;600;700&family=Sarabun:wght@300;400;500;600&display=swap');

        * { box-sizing: border-box; margin: 0; padding: 0; }

        body {
          font-family: 'Sarabun', sans-serif;
          background: #0a0f1e;
          min-height: 100vh;
        }

        .page-wrapper {
          min-height: 100vh;
          background: linear-gradient(135deg, #0a0f1e 0%, #0d1b3e 50%, #0a1628 100%);
          position: relative;
          overflow: hidden;
          display: flex;
          align-items: flex-start;
          justify-content: center;
          padding: 32px 16px 40px;
        }

        /* Ambient background blobs */
        .page-wrapper::before {
          content: '';
          position: fixed;
          top: -200px;
          right: -200px;
          width: 600px;
          height: 600px;
          background: radial-gradient(circle, rgba(37, 99, 235, 0.12) 0%, transparent 70%);
          pointer-events: none;
          z-index: 0;
        }
        .page-wrapper::after {
          content: '';
          position: fixed;
          bottom: -200px;
          left: -200px;
          width: 500px;
          height: 500px;
          background: radial-gradient(circle, rgba(14, 165, 233, 0.08) 0%, transparent 70%);
          pointer-events: none;
          z-index: 0;
        }

        .card {
          position: relative;
          z-index: 1;
          width: 100%;
          max-width: 480px;
          background: rgba(255, 255, 255, 0.04);
          border: 1px solid rgba(255, 255, 255, 0.08);
          border-radius: 24px;
          padding: 40px 36px;
          backdrop-filter: blur(20px);
          box-shadow:
            0 0 0 1px rgba(37, 99, 235, 0.1),
            0 32px 64px rgba(0, 0, 0, 0.5),
            inset 0 1px 0 rgba(255, 255, 255, 0.08);
          animation: slideUp 0.6s cubic-bezier(0.16, 1, 0.3, 1) both;
        }

        @keyframes slideUp {
          from { opacity: 0; transform: translateY(24px); }
          to   { opacity: 1; transform: translateY(0); }
        }

        /* Header */
        .header {
          text-align: center;
          margin-bottom: 36px;
        }

        .logo-badge {
          display: inline-flex;
          align-items: center;
          gap: 8px;
          background: linear-gradient(135deg, #1d4ed8, #0ea5e9);
          border-radius: 50px;
          padding: 6px 16px 6px 8px;
          margin-bottom: 20px;
        }

        .logo-icon {
          width: 30px;
          height: 30px;
          background: rgba(255,255,255,0.2);
          border-radius: 50%;
          display: flex;
          align-items: center;
          justify-content: center;
          font-size: 16px;
        }

        .logo-text {
          font-family: 'Sora', sans-serif;
          font-size: 12px;
          font-weight: 600;
          color: #fff;
          letter-spacing: 0.08em;
          text-transform: uppercase;
        }

        .title {
          font-family: 'Sora', sans-serif;
          font-size: 26px;
          font-weight: 700;
          color: #f0f6ff;
          line-height: 1.2;
          margin-bottom: 8px;
        }

        .subtitle {
          font-size: 14px;
          color: rgba(255,255,255,0.4);
          font-weight: 300;
        }

        /* Divider */
        .divider {
          height: 1px;
          background: linear-gradient(90deg, transparent, rgba(255,255,255,0.1), transparent);
          margin: 0 -36px 28px;
        }

        /* Form */
        .form { display: flex; flex-direction: column; gap: 20px; }

        .field { display: flex; flex-direction: column; gap: 7px; }

        .label {
          font-size: 12px;
          font-weight: 600;
          color: rgba(255,255,255,0.5);
          letter-spacing: 0.06em;
          text-transform: uppercase;
          display: flex;
          align-items: center;
          gap: 6px;
        }

        .label-icon { font-size: 14px; }

        .input, .select {
          width: 100%;
          background: rgba(255, 255, 255, 0.05);
          border: 1px solid rgba(255, 255, 255, 0.1);
          border-radius: 12px;
          padding: 13px 16px;
          font-size: 15px;
          font-family: 'Sarabun', sans-serif;
          color: #e8f0fe;
          outline: none;
          transition: all 0.2s ease;
          appearance: none;
          -webkit-appearance: none;
        }

        .input::placeholder { color: rgba(255,255,255,0.2); }

        .input:focus, .select:focus {
          border-color: rgba(59, 130, 246, 0.6);
          background: rgba(59, 130, 246, 0.06);
          box-shadow: 0 0 0 3px rgba(59, 130, 246, 0.12);
        }

        .input:disabled, .input[readonly] {
          opacity: 0.5;
          cursor: not-allowed;
          color: rgba(255,255,255,0.4);
        }

        .input[type="date"]::-webkit-calendar-picker-indicator {
          filter: invert(0.6);
          cursor: pointer;
        }

        /* Select wrapper */
        .select-wrap {
          position: relative;
        }
        .select-wrap::after {
          content: '▾';
          position: absolute;
          right: 14px;
          top: 50%;
          transform: translateY(-50%);
          color: rgba(255,255,255,0.3);
          pointer-events: none;
          font-size: 13px;
        }
        .select option {
          background: #0d1b3e;
          color: #e8f0fe;
        }

        /* 2-col row */
        .row-2 { display: grid; grid-template-columns: 1fr 1fr; gap: 16px; }

        /* Locked badge */
        .locked-badge {
          display: inline-flex;
          align-items: center;
          gap: 4px;
          font-size: 10px;
          color: rgba(255,255,255,0.3);
          background: rgba(255,255,255,0.05);
          border-radius: 4px;
          padding: 2px 6px;
          margin-left: auto;
        }

        /* Submit button */
        .btn-submit {
          width: 100%;
          margin-top: 8px;
          padding: 16px;
          border: none;
          border-radius: 14px;
          font-family: 'Sora', sans-serif;
          font-size: 15px;
          font-weight: 600;
          cursor: pointer;
          transition: all 0.25s ease;
          position: relative;
          overflow: hidden;
          background: linear-gradient(135deg, #1d4ed8 0%, #0ea5e9 100%);
          color: #fff;
          box-shadow: 0 8px 24px rgba(29, 78, 216, 0.35);
          letter-spacing: 0.02em;
        }

        .btn-submit:hover:not(:disabled) {
          transform: translateY(-1px);
          box-shadow: 0 12px 32px rgba(29, 78, 216, 0.5);
        }

        .btn-submit:active:not(:disabled) {
          transform: translateY(0);
        }

        .btn-submit:disabled {
          opacity: 0.6;
          cursor: not-allowed;
          transform: none;
        }

        .btn-submit::before {
          content: '';
          position: absolute;
          top: 0; left: -100%;
          width: 100%; height: 100%;
          background: linear-gradient(90deg, transparent, rgba(255,255,255,0.1), transparent);
          transition: left 0.4s ease;
        }
        .btn-submit:hover::before { left: 100%; }

        /* Loading spinner */
        .spinner {
          display: inline-block;
          width: 16px;
          height: 16px;
          border: 2px solid rgba(255,255,255,0.3);
          border-top-color: #fff;
          border-radius: 50%;
          animation: spin 0.7s linear infinite;
          vertical-align: middle;
          margin-right: 8px;
        }
        @keyframes spin { to { transform: rotate(360deg); } }

        /* Loading state */
        .loading-state {
          display: flex;
          flex-direction: column;
          align-items: center;
          gap: 12px;
          padding: 32px 0;
          color: rgba(255,255,255,0.4);
          font-size: 14px;
        }
        .loading-ring {
          width: 40px; height: 40px;
          border: 3px solid rgba(59,130,246,0.2);
          border-top-color: #3b82f6;
          border-radius: 50%;
          animation: spin 0.8s linear infinite;
        }

        /* Success state */
        .success-state {
          display: flex;
          flex-direction: column;
          align-items: center;
          gap: 16px;
          padding: 24px 0;
          animation: slideUp 0.5s ease both;
        }
        .success-icon {
          width: 72px; height: 72px;
          background: linear-gradient(135deg, #059669, #10b981);
          border-radius: 50%;
          display: flex;
          align-items: center;
          justify-content: center;
          font-size: 32px;
          box-shadow: 0 0 40px rgba(16, 185, 129, 0.35);
        }
        .success-title {
          font-family: 'Sora', sans-serif;
          font-size: 20px;
          font-weight: 700;
          color: #f0f6ff;
        }
        .success-sub {
          font-size: 14px;
          color: rgba(255,255,255,0.4);
          text-align: center;
        }

        /* Queue link */
        .queue-link {
          text-align: center;
          margin-top: 20px;
          font-size: 13px;
          color: rgba(255,255,255,0.35);
        }
        .queue-link a {
          color: #60a5fa;
          text-decoration: none;
          font-weight: 500;
          transition: color 0.2s;
        }
        .queue-link a:hover { color: #93c5fd; }

        @media (max-width: 480px) {
          .card { padding: 32px 24px; border-radius: 20px; }
          .row-2 { grid-template-columns: 1fr; }
          .title { font-size: 22px; }
        }
      `}</style>

      <div className="page-wrapper">
        <div className="card">
          {/* Header */}
          <div className="header">
            <div className="logo-badge">
              <div className="logo-icon">🚗</div>
              <span className="logo-text">Haru System</span>
            </div>
            <h1 className="title">จองรถบริษัท</h1>
            <p className="subtitle">ระบบจัดการการใช้รถภายในองค์กร</p>
          </div>

          <div className="divider" />

          {/* States */}
          {!isLiffReady ? (
            <div className="loading-state">
              <div className="loading-ring" />
              <span>กำลังยืนยันตัวตนกับ LINE...</span>
            </div>
          ) : submitted ? (
            <div className="success-state">
              <div className="success-icon">✓</div>
              <p className="success-title">จองรถสำเร็จแล้ว!</p>
              <p className="success-sub">ระบบได้รับการจองของคุณเรียบร้อย<br />คุณจะได้รับการยืนยันทาง LINE</p>
            </div>
          ) : (
            <form className="form" onSubmit={handleSubmit}>
              {/* Booker */}
              <div className="field">
                <label className="label">
                  <span className="label-icon">👤</span>
                  ผู้จอง
                  <span className="locked-badge">🔒 จาก LINE</span>
                </label>
                <input
                  className="input"
                  type="text"
                  name="bookerName"
                  readOnly
                  value={formData.bookerName}
                />
              </div>

              {/* Car */}
              <div className="field">
                <label className="label">
                  <span className="label-icon">🚗</span>
                  รถที่ต้องการจอง
                </label>
                <div className="select-wrap">
                  <select
                    className="select"
                    name="car"
                    value={formData.car}
                    onChange={handleChange}
                  >
                    <option value="MIRAGS (775-1247)">MIRAGS (775-1247)</option>
                    <option value="รถคันที่ 2">รถคันที่ 2</option>
                    <option value="รถคันที่ 3">รถคันที่ 3</option>
                  </select>
                </div>
              </div>

              {/* Date & Destination in 2 columns */}
              <div className="row-2">
                <div className="field">
                  <label className="label">
                    <span className="label-icon">📅</span>
                    วันที่ใช้รถ
                  </label>
                  <input
                    className="input"
                    type="date"
                    name="useDate"
                    required
                    value={formData.useDate}
                    onChange={handleChange}
                  />
                </div>

                <div className="field">
                  <label className="label">
                    <span className="label-icon">📍</span>
                    ปลายทาง
                  </label>
                  <input
                    className="input"
                    type="text"
                    name="destination"
                    required
                    value={formData.destination}
                    onChange={handleChange}
                    placeholder="DCI, Daikin..."
                  />
                </div>
              </div>

              {/* Purpose */}
              <div className="field">
                <label className="label">
                  <span className="label-icon">📋</span>
                  วัตถุประสงค์
                </label>
                <input
                  className="input"
                  type="text"
                  name="purpose"
                  required
                  value={formData.purpose}
                  onChange={handleChange}
                  placeholder="Meeting, Install, Delivery..."
                />
              </div>

              {/* Submit */}
              <button
                type="submit"
                className="btn-submit"
                disabled={isSubmitting}
              >
                {isSubmitting ? (
                  <><span className="spinner" />กำลังบันทึก...</>
                ) : (
                  'ยืนยันการจองรถ →'
                )}
              </button>
            </form>
          )}

          {/* Footer link */}
          {!submitted && (
            <p className="queue-link">
              ดูตารางคิวรถทั้งหมด → <a href="/queue">Queue Board</a>
            </p>
          )}
        </div>
      </div>
    </>
  );
}