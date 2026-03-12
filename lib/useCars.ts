// lib/useCars.ts
// ✅ ดึงรถจาก Firestore แทน hardcode — real-time
"use client";

import { useEffect, useState } from "react";
import { collection, query, where, orderBy, onSnapshot } from "firebase/firestore";
import { db } from "./firebase";

export interface CarData {
  id: string;
  name: string;
  short?: string;
  plate: string;
  color: string;
  colorLight: string;
  imageUrl: string;
  active: boolean;
}

// ✅ hook สำหรับใช้ใน component
export function useCars(activeOnly = true) {
  const [cars, setCars]       = useState<CarData[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const q = activeOnly
      ? query(collection(db, "cars"), where("active", "==", true), orderBy("createdAt", "asc"))
      : query(collection(db, "cars"), orderBy("createdAt", "asc"));

    const unsub = onSnapshot(q, (snap) => {
      setCars(snap.docs.map((d) => ({ id: d.id, ...d.data() } as CarData)));
      setLoading(false);
    });
    return () => unsub();
  }, [activeOnly]);

  return { cars, loading };
}