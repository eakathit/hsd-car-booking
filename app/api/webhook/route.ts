// app/api/webhook/route.ts
// ✅ ชั่วคราว — ปิด signature verify เพื่อทดสอบ deploy

import { NextResponse } from "next/server";
import { db } from "../../../lib/firebase";
import { doc, setDoc } from "firebase/firestore";

export async function POST(req: Request) {
  let body: { events: any[] };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  const events = body.events ?? [];

  for (const event of events) {
    if (event.source?.type === "user") {
      const userId = event.source.userId as string;
      try {
        const profileRes = await fetch(
          `https://api.line.me/v2/bot/profile/${userId}`,
          { headers: { Authorization: `Bearer ${process.env.LINE_ACCESS_TOKEN}` } },
        );

        if (!profileRes.ok) {
          console.error("❌ Failed to fetch LINE profile:", await profileRes.text());
          continue;
        }

        const profile = await profileRes.json();
        console.log("✅ Webhook profile:", profile.displayName);

        await setDoc(
          doc(db, "lineUsers", userId),
          { userId, displayName: profile.displayName, updatedAt: new Date().toISOString() },
          { merge: true },
        );
      } catch (err) {
        console.error("❌ Webhook error for user", userId, err);
      }
    }
  }

  return NextResponse.json({ status: "ok" });
}