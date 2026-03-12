// app/api/notify/route.ts
// ✅ ส่งหาทุก userId ที่มี displayName ตรงกัน — ป้องกันส่งผิดอัน

import { NextResponse } from "next/server";
import { db } from "../../../lib/firebase";
import { collection, query, where, getDocs } from "firebase/firestore";

export async function POST(req: Request) {
  try {
    const body = await req.json();
    const { bookerName, car, destination, date } = body;

    console.log("📨 notify called:", { bookerName, car, destination, date });

    const q = query(
      collection(db, "lineUsers"),
      where("displayName", "==", bookerName),
    );
    const snap = await getDocs(q);

    console.log("🔍 lineUsers found:", snap.size, "docs");

    if (snap.empty) {
      console.error("❌ No lineUser found for:", bookerName);
      return NextResponse.json({ error: "User not found" }, { status: 404 });
    }

    const token = process.env.LINE_ACCESS_TOKEN;
    if (!token) {
      console.error("❌ LINE_ACCESS_TOKEN is not set");
      return NextResponse.json({ error: "Missing token" }, { status: 500 });
    }

    const messageText =
      `🚗 จองรถสำเร็จ!\n\n` +
      `👤 ผู้จอง: ${bookerName}\n` +
      `🚙 รถ: ${car}\n` +
      `📍 ปลายทาง: ${destination}\n` +
      `📅 วันเวลา: ${date}`;

    // ── ส่งหาทุก userId — อันไหน follow บอทไว้จะได้รับ ──
    const results = await Promise.allSettled(
      snap.docs.map(async (d) => {
        const userId = d.data().userId;
        const res = await fetch("https://api.line.me/v2/bot/message/push", {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${token}`,
          },
          body: JSON.stringify({
            to: userId,
            messages: [{ type: "text", text: messageText }],
          }),
        });
        const resBody = await res.json();
        console.log(`📤 userId ${userId}: ${res.status}`, JSON.stringify(resBody));
        return { userId, status: res.status };
      })
    );

    const anySuccess = results.some(
      (r) => r.status === "fulfilled" && r.value.status === 200
    );

    if (!anySuccess) {
      return NextResponse.json({ error: "All push failed" }, { status: 500 });
    }

    console.log("✅ LINE notify sent successfully");
    return NextResponse.json({ status: "ok" });

  } catch (err) {
    console.error("❌ notify error:", err);
    return NextResponse.json({ error: String(err) }, { status: 500 });
  }
}