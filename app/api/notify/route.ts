import { NextResponse } from 'next/server';
import { db } from '../../../lib/firebase';
import { collection, query, where, getDocs } from 'firebase/firestore';

export async function POST(req: Request) {
  const body = await req.json();
  const { bookerName, car, destination, date } = body;

  const LINE_ACCESS_TOKEN = process.env.LINE_ACCESS_TOKEN;

  try {
    // ดึง userId จาก Firebase ที่เก็บตอน Add Bot
    const q = query(
      collection(db, 'lineUsers'),
      where('displayName', '==', bookerName)
    );
    const snapshot = await getDocs(q);
    
    if (snapshot.empty) {
      console.log('❌ ไม่พบ userId ของ:', bookerName);
      return NextResponse.json({ success: false, error: 'User not found' });
    }

    const userId = snapshot.docs[0].data().userId;

    // Push หาคนนั้น
    const response = await fetch('https://api.line.me/v2/bot/message/push', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${LINE_ACCESS_TOKEN}`
      },
      body: JSON.stringify({
        to: userId,
        messages: [{
          type: 'text',
          text: `🚗 ยืนยันการจองรถสำเร็จ!\n\nผู้จอง: ${bookerName}\nรถ: ${car}\nไปที่: ${destination}\nวันที่: ${date}`
        }]
      })
    });

    const result = await response.text();
    console.log('📬 LINE response:', response.status, result);

    return NextResponse.json({ success: response.ok });
  } catch (error) {
    return NextResponse.json({ success: false, error: String(error) });
  }
}