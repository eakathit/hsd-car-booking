// types/index.ts — updated to match paper log (PDF)

export interface UserProfile {
  userId: string;
  displayName: string;
  pictureUrl?: string;
}

export interface Car {
  id: string;
  name: string;      // ชื่อรุ่น
  plate: string;     // ทะเบียน
  model: string;     // ชื่อย่อ (MIRAGS, VIOS, CITY …)
  imageUrl: string;
  badge: string;
}

/**
 * Booking — ตรงกับ columns ในสมุดบันทึกรถบริษัท (PDF)
 *
 * วันที่จอง  | ผู้จอง | เวลาที่จอง | จาก | ถึง | สำหรับ
 * วันที่ใช้  | เวลาออก | เวลาเข้า | ผู้ใช้รถ | น้ำมัน
 */
export interface Booking {
  id?: string;

  // ── รถ ──────────────────────────────
  carId: string;
  carName: string;   // e.g. "Mitsubishi Mirage"
  carPlate: string;  // e.g. "7ทศ1247"

  // ── ผู้จอง (LINE profile) ────────────
  bookerId: string;
  bookerName: string;
  bookedAt?: string;   // ISO timestamp เวลาที่กด "ยืนยัน"

  // ── รายละเอียดเดินทาง ────────────────
  driverName: string;     // ผู้ใช้รถ (อาจต่างจาก booker)
  fromLocation: string;   // จาก  (default = "Haru")
  toLocation: string;     // ถึง
  purpose: string;        // สำหรับ

  // ── ตารางเวลา ────────────────────────
  useDate: string;    // วันที่ใช้  YYYY-MM-DD
  startTime: string;  // เวลาออก   HH:mm
  endTime: string;    // เวลาเข้า  HH:mm

  // ── ข้อมูลเพิ่มเติม ──────────────────
  fuel?: string;      // น้ำมัน (กรอกตอนคืนรถ)
  status: 'booked' | 'active' | 'completed' | 'cancelled';
  createdAt?: any;    // Firestore serverTimestamp
}