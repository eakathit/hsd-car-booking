'use client';

import { useEffect, useState } from 'react';
import { collection, query, orderBy, onSnapshot } from 'firebase/firestore';
import { db } from '../../lib/firebase';
import Link from 'next/link';

// สร้าง Interface เพื่อกำหนดโครงสร้างข้อมูล
interface Booking {
  id: string;
  bookerName: string;
  car: string;
  useDate: string;
  destination: string;
  purpose: string;
  status: string;
}

export default function QueuePage() {
  const [bookings, setBookings] = useState<Booking[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    // สร้าง Query ดึงข้อมูลจาก collection 'bookings' และเรียงลำดับตามวันที่ใช้งาน
    const q = query(collection(db, 'bookings'), orderBy('useDate', 'asc'));

    // ใช้ onSnapshot เพื่อดึงข้อมูลแบบ Real-time
    const unsubscribe = onSnapshot(q, (querySnapshot) => {
      const bookingsData: Booking[] = [];
      querySnapshot.forEach((doc) => {
        bookingsData.push({ id: doc.id, ...doc.data() } as Booking);
      });
      setBookings(bookingsData);
      setLoading(false);
    });

    // คืนค่าฟังก์ชันยกเลิกการติดตามเมื่อเปลี่ยนหน้า
    return () => unsubscribe();
  }, []);

  return (
    <div className="min-h-screen bg-gray-50 p-4 md:p-8 font-sans">
      <div className="max-w-4xl mx-auto">
        <div className="flex justify-between items-center mb-6">
          <h1 className="text-2xl font-bold text-gray-800">📅 ตารางคิวรถบริษัท</h1>
          <Link href="/">
            <button className="bg-blue-600 text-white px-4 py-2 rounded-md hover:bg-blue-700 transition shadow-sm">
              + จองรถใหม่
            </button>
          </Link>
        </div>

        {loading ? (
          <div className="text-center py-10 text-gray-500">กำลังโหลดข้อมูล...</div>
        ) : (
          <div className="bg-white rounded-xl shadow-md overflow-hidden border border-gray-200">
            <div className="overflow-x-auto">
              <table className="w-full text-sm text-left">
                <thead className="text-xs text-gray-700 uppercase bg-gray-100 border-b">
                  <tr>
                    <th className="px-6 py-4">วันที่ใช้รถ</th>
                    <th className="px-6 py-4">ผู้จอง</th>
                    <th className="px-6 py-4">รถที่จอง</th>
                    <th className="px-6 py-4">ปลายทาง</th>
                    <th className="px-6 py-4">สำหรับ</th>
                    <th className="px-6 py-4">สถานะ</th>
                  </tr>
                </thead>
                <tbody>
                  {bookings.length === 0 ? (
                    <tr>
                      <td colSpan={6} className="px-6 py-8 text-center text-gray-500">
                        ยังไม่มีข้อมูลการจองรถในระบบ
                      </td>
                    </tr>
                  ) : (
                    bookings.map((booking) => (
                      <tr key={booking.id} className="border-b hover:bg-gray-50">
                        <td className="px-6 py-4 font-medium text-gray-900">{booking.useDate}</td>
                        <td className="px-6 py-4">{booking.bookerName}</td>
                        <td className="px-6 py-4 text-blue-600 font-semibold">{booking.car}</td>
                        <td className="px-6 py-4">{booking.destination}</td>
                        <td className="px-6 py-4">{booking.purpose}</td>
                        <td className="px-6 py-4">
                          <span className="bg-yellow-100 text-yellow-800 text-xs font-medium px-2.5 py-1 rounded-full border border-yellow-200">
                            {booking.status === 'pending' ? 'รอใช้งาน' : booking.status}
                          </span>
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}