// app/api/webhook/route.ts
// ✅ เพิ่ม LINE signature verification — ป้องกัน fake webhook

import { NextResponse } from "next/server";
import { db } from "../../../lib/firebase";
import { doc, setDoc } from "firebase/firestore";
import * as crypto from "crypto";

/** ตรวจ HMAC-SHA256 signature ที่ LINE ส่งมาใน header */
function verifySignature(body: string, signature: string): boolean {
  const secret = process.env.LINE_CHANNEL_SECRET;
  if (!secret) {
    console.warn("⚠️  LINE_CHANNEL_SECRET not set — skipping verification");
    return true; // ถ้ายังไม่ได้ set ให้ผ่านไปก่อน (dev)
  }
  const expected = crypto
    .createHmac("sha256", secret)
    .update(body)
    .digest("base64");
  return signature === expected;
}

export async function POST(req: Request) {
  // อ่าน raw body เพื่อ verify signature
  const rawBody  = await req.text();
  const signature = req.headers.get("x-line-signature") ?? "";

  if (!verifySignature(rawBody, signature)) {
    console.error("❌ Invalid LINE signature — rejected");
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  let body: { events: any[] };
  try {
    body = JSON.parse(rawBody);
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