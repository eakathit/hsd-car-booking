// app/api/notify/route.ts
import { NextResponse } from "next/server";
import { db } from "../../../lib/firebase";
import { collection, query, where, getDocs } from "firebase/firestore";

export async function POST(req: Request) {
  try {
    const body = await req.json();
    const { bookerName, car, destination, date } = body;

    console.log("📨 notify called:", { bookerName, car, destination, date });

    // ── หา userId จาก displayName ──
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

    const userId = snap.docs[0].data().userId;
    console.log("✅ userId:", userId);

    // ── ส่ง LINE push message ──
    const token = process.env.LINE_ACCESS_TOKEN;
    console.log("🔑 LINE_ACCESS_TOKEN exists:", !!token);

    if (!token) {
      console.error("❌ LINE_ACCESS_TOKEN is not set");
      return NextResponse.json({ error: "Missing token" }, { status: 500 });
    }

    const message = {
      to: userId,
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