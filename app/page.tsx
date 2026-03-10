// app/page.tsx
'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import liff from '@line/liff';
import { UserProfile, Booking } from '../types';

export default function Dashboard() {
  const [user, setUser] = useState<UserProfile | null>(null);
  const [isLiffReady, setIsLiffReady] = useState(false);

  useEffect(() => {
    const initLiff = async () => {
      try {
        await liff.init({ liffId: '2009402149-lV41Nacx' }); // ใช้ LIFF ID ของคุณ
        if (liff.isLoggedIn()) {
          const profile = await liff.getProfile();
          setUser({
            userId: profile.userId,
            displayName: profile.displayName,
            pictureUrl: profile.pictureUrl,
          });
        } else {
          liff.login();
        }
      } catch (error) {
        console.error('LIFF init failed', error);
      } finally {
        setIsLiffReady(true);
      }
    };
    initLiff();
  }, []);

  if (!isLiffReady) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-gray-50">
        <p className="text-gray-500 animate-pulse">กำลังซิงค์ข้อมูลกับ LINE...</p>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50 pb-24 font-sans">
      {/* Sticky Header */}
      <header className="sticky top-0 z-10 bg-white px-4 py-3 shadow-sm flex items-center gap-3">
        {user?.pictureUrl ? (
          <img src={user.pictureUrl} alt="Profile" className="w-10 h-10 rounded-full border border-gray-200" />
        ) : (
          <div className="w-10 h-10 rounded-full bg-blue-100 flex items-center justify-center text-blue-600 font-bold">
            {user?.displayName?.charAt(0) || 'U'}
          </div>
        )}
        <div>
          <p className="text-xs text-gray-500">สวัสดี,</p>
          <p className="text-sm font-bold text-gray-800">{user?.displayName || 'พนักงาน'}</p>
        </div>
      </header>

      <main className="p-4 space-y-6">
        {/* TODO: Fetch and map actual timeline from Firestore */}
        <section>
          <div className="flex justify-between items-center mb-4">
            <h2 className="text-lg font-bold text-gray-800">🗓️ สถานะรถยนต์วันนี้</h2>
            <input type="date" className="text-sm border-gray-300 rounded-md p-1" defaultValue={new Date().toISOString().split('T')[0]} />
          </div>

          {/* Mock Timeline Card */}
          <div className="bg-white rounded-xl shadow-sm p-4 border border-gray-100 mb-3">
            <h3 className="font-semibold text-gray-800 flex items-center gap-2">
              🚗 MIRAGS <span className="text-xs bg-blue-100 text-blue-700 px-2 py-0.5 rounded-full">775-1247</span>
            </h3>
            <div className="mt-3 relative h-8 bg-gray-100 rounded-md overflow-hidden flex items-center">
              {/* Mock Time Bar: e.g. 08:30 - 17:30 */}
              <div 
                className="absolute h-full bg-red-400 opacity-80" 
                style={{ left: '20%', width: '50%' }} 
              ></div>
              <span className="absolute left-[22%] text-xs text-white font-medium z-10">08:30 จองแล้ว (Tomy)</span>
            </div>
          </div>
        </section>
      </main>

      {/* Floating Action Button (FAB) */}
      <div className="fixed bottom-6 left-0 right-0 px-4">
        <Link href="/book" className="block w-full bg-blue-600 text-white text-center font-bold py-4 rounded-xl shadow-lg shadow-blue-200 active:scale-95 transition-transform">
          ➕ จองรถบริษัท (Book a Car)
        </Link>
      </div>
    </div>
  );
}