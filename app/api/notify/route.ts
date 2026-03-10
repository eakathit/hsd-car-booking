import { NextResponse } from 'next/server';

export async function POST(req: Request) {
  const body = await req.json();
  const { car, destination, date, bookerName } = body;

  const LINE_ACCESS_TOKEN = process.env.LINE_ACCESS_TOKEN;

  try {
    const response = await fetch('https://api.line.me/v2/bot/message/broadcast', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${LINE_ACCESS_TOKEN}`
      },
      body: JSON.stringify({
        messages: [
          {
            type: 'text',
            text: `🚗 มีการจองรถใหม่!\n\nผู้จอง: ${bookerName}\nรถ: ${car}\nไปที่: ${destination}\nวันที่: ${date}`
          }
        ]
      })
    });

    return NextResponse.json({ success: response.ok });
  } catch (error) {
    return NextResponse.json({ success: false });
  }
}