import { NextResponse } from 'next/server';

export async function POST(req: Request) {
  const body = await req.json();
  const { userId, car, destination, date } = body;

  const LINE_ACCESS_TOKEN = 'tamrZcN+QLyilGY2XppVnB7NUPP2rETwdPNY597zAXbJftyns0O1jGvnoPYr00cuNTcAxt9oPnGVDN0IDQkaaLUzWKQnY7sKrOXYB32piN6z/wOr59YxmGwNiWdjOm/p4roTvzhNp53rkJqTLMSUrAdB04t89/1O/w1cDnyilFU=';

  const message = {
    to: userId,
    messages: [
      {
        type: 'text',
        text: `🚗 ยืนยันการจองรถสำเร็จ!\n\nคุณ: ${car}\nไปที่: ${destination}\nวันที่: ${date}\n\nขอบคุณที่ใช้บริการ HSD ครับ 😊`
      }
    ]
  };

  try {
    const response = await fetch('https://api.line.me/v2/bot/message/push', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${LINE_ACCESS_TOKEN}`
      },
      body: JSON.stringify(message)
    });

    return NextResponse.json({ success: true });
  } catch (error) {
    return NextResponse.json({ success: false, error: 'Failed to send message' });
  }
}