'use client';

import { useState, useEffect } from 'react';
import { collection, addDoc, serverTimestamp } from 'firebase/firestore';
import { db } from '../lib/firebase';
import liff from '@line/liff'; // นำเข้า LIFF SDK

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

  // --- ส่วนของ LINE LIFF ---
  useEffect(() => {
    const initLiff = async () => {
      try {
        await liff.init({ liffId: '2009402149-lV41Nacx' }); 
        
        if (liff.isLoggedIn()) {
          const profile = await liff.getProfile() as {
  userId: string;
  displayName: string;
};
          // 2. เก็บทั้งชื่อ และ userId ลงใน formData
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

      // 3. แก้ไขการส่งข้อมูลให้ตรงกับค่าที่มีใน formData
      await fetch('/api/notify', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          userId: formData.userId,        // มีค่าแล้วเพราะเพิ่มในขั้นตอนที่ 2
          car: formData.car,           // เปลี่ยนจาก carType เป็น car ให้ตรงกับ state
          destination: formData.destination,
          date: formData.useDate
        })
      });

      alert('จองรถสำเร็จและส่งข้อความยืนยันเรียบร้อยครับ! 🎉');
      setFormData(prev => ({ 
  ...prev, 
  bookerName: profile.displayName,
  userId: profile.userId  // ← เพิ่มตรงนี้
}));
    } catch (error) {
      alert('เกิดข้อผิดพลาด กรุณาลองใหม่');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="min-h-screen bg-gray-100 p-4 font-sans">
      <div className="max-w-md mx-auto bg-white rounded-xl shadow-md p-6">
        <h1 className="text-2xl font-bold text-center text-blue-600 mb-6">
          🚗 จองรถบริษัท (Haru System)
        </h1>
        
        {!isLiffReady ? (
          <p className="text-center text-gray-500">กำลังยืนยันตัวตนกับ LINE...</p>
        ) : (
          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-gray-700">ผู้จอง (จาก LINE)</label>
              <input 
                type="text" 
                name="bookerName" 
                readOnly // ล็อกไว้ไม่ให้แก้ เพราะดึงจาก LINE มาแล้ว
                value={formData.bookerName} 
                className="block w-full bg-gray-100 rounded-md border border-gray-300 p-2.5 text-gray-500 cursor-not-allowed"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700">รถที่ต้องการจอง</label>
              <select name="car" value={formData.car} onChange={handleChange} className="block w-full rounded-md border border-gray-300 p-2.5">
                <option value="MIRAGS (775-1247)">MIRAGS (775-1247)</option>
                <option value="รถคันที่ 2">รถคันที่ 2</option>
                <option value="รถคันที่ 3">รถคันที่ 3</option>
              </select>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700">วันที่ใช้รถ</label>
              <input type="date" name="useDate" required value={formData.useDate} onChange={handleChange} className="block w-full rounded-md border border-gray-300 p-2.5" />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700">สถานที่ปลายทาง</label>
              <input type="text" name="destination" required value={formData.destination} onChange={handleChange} className="block w-full rounded-md border border-gray-300 p-2.5" placeholder="เช่น DCI, Daikin" />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700">วัตถุประสงค์</label>
              <input type="text" name="purpose" required value={formData.purpose} onChange={handleChange} className="block w-full rounded-md border border-gray-300 p-2.5" placeholder="เช่น Meeting, Install" />
            </div>

            <button type="submit" disabled={isSubmitting} className="w-full bg-blue-600 text-white font-bold py-3 px-4 rounded-md hover:bg-blue-700 disabled:bg-gray-400 mt-6">
              {isSubmitting ? 'กำลังบันทึก...' : 'บันทึกการจองรถ'}
            </button>
          </form>
        )}
      </div>
    </div>
  );
}