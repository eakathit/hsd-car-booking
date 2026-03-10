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
  },
  {
    id: 'RENTAL-TEMP',
    name: 'รถเช่าชั่วคราว',
    plate: 'รอระบุ',
    imageUrl: 'https://cdn-icons-png.flaticon.com/512/3085/3085330.png',
    isRental: true,
  }
];

export default function BookCarPage() {
  const router = useRouter();
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isLiffReady, setIsLiffReady] = useState(false);

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

    // TODO: Add logic to check Firestore for overlapping datetimes (Race Condition Check) before saving

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

      // Notify via API Route
      await fetch('/api/notify', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          bookerName: formData.bookerName,
          car: formData.car,
          destination: formData.destination,
          date: formData.startDatetime // Maybe format this better in the API
        })
      });

      alert('จองรถสำเร็จ! 🎉');
      router.push('/'); // กลับไปหน้า Dashboard

    } catch (error) {
      console.error(error);
      alert('เกิดข้อผิดพลาด กรุณาลองใหม่');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="min-h-screen bg-gray-50 p-4 font-sans pb-10">
      <div className="max-w-md mx-auto bg-white rounded-xl shadow-sm border border-gray-100 p-6">
        <div className="flex items-center mb-6">
          <button onClick={() => router.back()} className="text-gray-500 mr-4 p-2 active:bg-gray-100 rounded-full">
            <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor" className="w-5 h-5">
              <path strokeLinecap="round" strokeLinejoin="round" d="M15.75 19.5L8.25 12l7.5-7.5" />
            </svg>
          </button>
          <h1 className="text-xl font-bold text-gray-800">จองรถบริษัท</h1>
        </div>
        
        {!isLiffReady ? (
          <p className="text-center text-gray-500 py-10">กำลังโหลดข้อมูลผู้ใช้...</p>
        ) : (
          <form onSubmit={handleSubmit} className="space-y-5">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">ผู้จอง</label>
              <input type="text" readOnly value={formData.bookerName} className="w-full bg-gray-100 rounded-lg border-gray-200 p-3 text-gray-500 focus:outline-none" />
            </div>

            <div>
  <label className="block text-sm font-medium text-gray-700 mb-2">เลือกรถยนต์ *</label>
  <div className="grid grid-cols-2 gap-3">
    {availableCars.map((car) => (
      <div
        key={car.id}
        onClick={() => setFormData({ ...formData, car: car.id })}
        className={`relative flex flex-col items-center justify-center p-3 rounded-xl border-2 cursor-pointer transition-all ${
          formData.car === car.id
            ? 'border-blue-500 bg-blue-50 shadow-sm' 
            : 'border-gray-200 bg-white hover:border-gray-300' 
        }`}
      >
        {car.isRental && (
          <span className="absolute top-2 right-2 bg-amber-100 text-amber-700 text-[10px] font-bold px-2 py-0.5 rounded-full">
            รถเช่า
          </span>
        )}
        <div className="h-16 w-full flex items-center justify-center mb-2">
          <img src={car.imageUrl} alt={car.name} className="max-h-full object-contain drop-shadow-sm" />
        </div>
        <span className="text-sm font-bold text-gray-800 text-center leading-tight">
          {car.name}
        </span>
        <span className="text-xs text-gray-500 mt-0.5">
          ทะเบียน: {car.plate}
        </span>
        {formData.car === car.id && (
          <div className="absolute -top-2 -right-2 bg-blue-500 text-white rounded-full p-0.5 shadow-md">
            <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="currentColor" className="w-4 h-4">
              <path fillRule="evenodd" d="M19.916 4.626a.75.75 0 01.208 1.04l-9 13.5a.75.75 0 01-1.154.114l-6-6a.75.75 0 011.06-1.06l5.353 5.353 8.493-12.739a.75.75 0 011.04-.208z" clipRule="evenodd" />
            </svg>
          </div>
        )}
      </div>
    ))}
  </div>
</div>

            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">เวลาออก *</label>
                <input type="datetime-local" name="startDatetime" required value={formData.startDatetime} onChange={handleChange} className="w-full rounded-lg border border-gray-300 p-2.5 text-sm outline-none focus:ring-2 focus:ring-blue-500" />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">เวลาเข้า *</label>
                <input type="datetime-local" name="endDatetime" required value={formData.endDatetime} onChange={handleChange} className="w-full rounded-lg border border-gray-300 p-2.5 text-sm outline-none focus:ring-2 focus:ring-blue-500" />
              </div>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">จุดหมายเดินทาง *</label>
              <input type="text" name="destination" required value={formData.destination} onChange={handleChange} placeholder="เช่น DCI, Daikin, HARU" className="w-full rounded-lg border border-gray-300 p-3 outline-none focus:ring-2 focus:ring-blue-500" />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">วัตถุประสงค์ *</label>
              <input type="text" name="purpose" required value={formData.purpose} onChange={handleChange} placeholder="เช่น Install, Test run, Meeting" className="w-full rounded-lg border border-gray-300 p-3 outline-none focus:ring-2 focus:ring-blue-500" />
            </div>

            <button type="submit" disabled={isSubmitting} className="w-full bg-blue-600 text-white font-bold py-3.5 px-4 rounded-xl shadow-md hover:bg-blue-700 disabled:bg-gray-400 mt-6 active:scale-95 transition-transform">
              {isSubmitting ? 'กำลังบันทึก...' : '✅ ยืนยันการจองรถ'}
            </button>
          </form>
        )}
      </div>
    </div>
  );
}