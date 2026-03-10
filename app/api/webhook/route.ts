import { NextResponse } from 'next/server';
import { db } from '../../../lib/firebase';
import { doc, setDoc } from 'firebase/firestore';

export async function POST(req: Request) {
  const body = await req.json();
  const events = body.events;

  for (const event of events) {
    if (event.source.type === 'user') {
      const userId = event.source.userId;

      // ดึง Profile จาก LINE API
      const profileRes = await fetch(
        `https://api.line.me/v2/bot/profile/${userId}`,
        { headers: { Authorization: `Bearer ${process.env.LINE_ACCESS_TOKEN}` } }
      );
      const profile = await profileRes.json();

      console.log('✅ Webhook profile:', profile);

      // เก็บ userId + displayName ลง Firebase
      await setDoc(doc(db, 'lineUsers', userId), {
        userId,
        displayName: profile.displayName,
        updatedAt: new Date().toISOString()
      }, { merge: true });
    }
  }

  return NextResponse.json({ status: 'ok' });
}