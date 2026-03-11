// app/api/notify/route.ts
import { NextResponse } from "next/server";

export async function POST(req: Request) {
  try {
    const body = await req.json();
    // ✅ รับ bookerId เพิ่มเข้ามา
    const { bookerId, bookerName, car, destination, date } = body;

    console.log("📨 notify called:", { bookerId, bookerName, car, destination, date });

    // ── ตรวจสอบว่ามี ID ส่งมาหรือไม่ ──
    if (!bookerId) {
      console.error("❌ No bookerId provided for:", bookerName);
      return NextResponse.json({ error: "Missing bookerId" }, { status: 400 });
    }

    // ── ส่ง LINE push message ──
    const token = process.env.LINE_ACCESS_TOKEN;
    console.log("🔑 LINE_ACCESS_TOKEN exists:", !!token);

    if (!token) {
      console.error("❌ LINE_ACCESS_TOKEN is not set");
      return NextResponse.json({ error: "Missing token" }, { status: 500 });
    }

    const message = {
      to: bookerId, // ✅ ใช้ bookerId ที่ได้มาส่งหาผู้ใช้โดยตรง ไม่ต้องเดาจากชื่อ
      messages: [
        {
          type: "text",
          text: `🚗 จองรถสำเร็จ!\n\n` +
                `👤 ผู้จอง: ${bookerName}\n` +
                `🚙 รถ: ${car}\n` +
                `📍 ปลายทาง: ${destination}\n` +
                `📅 วันเวลา: ${date}`,
        },
      ],
    };

    const res = await fetch("https://api.line.me/v2/bot/message/push", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${token}`,
      },
      body: JSON.stringify(message),
    });

    const resBody = await res.json();
    console.log("📤 LINE push response:", res.status, JSON.stringify(resBody));

    if (!res.ok) {
      console.error("❌ LINE push failed:", resBody);
      return NextResponse.json({ error: resBody }, { status: 500 });
    }

    console.log("✅ LINE notify sent successfully");
    return NextResponse.json({ status: "ok" });

  } catch (err) {
    console.error("❌ notify error:", err);
    return NextResponse.json({ error: String(err) }, { status: 500 });
  }
}