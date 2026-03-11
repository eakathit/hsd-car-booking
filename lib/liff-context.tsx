// lib/liff-context.tsx
// Singleton LIFF provider — init ครั้งเดียวตลอด session
// ✅ บันทึก userId ลง Firestore อัตโนมัติตอนเปิดแอป
"use client";

import { createContext, useContext, useEffect, useState, ReactNode } from "react";
import { db } from "./firebase";
import { doc, setDoc } from "firebase/firestore";
import type { UserProfile } from "../types";

interface LiffContextValue {
  user: UserProfile | null;
  isReady: boolean;
  isLoggedIn: boolean;
}

const LiffContext = createContext<LiffContextValue>({
  user: null,
  isReady: false,
  isLoggedIn: false,
});

// Module-level singleton — ไม่ init ซ้ำแม้ component remount
let _initPromise: Promise<void> | null = null;
let _user: UserProfile | null = null;
let _isLoggedIn = false;

export function LiffProvider({ children }: { children: ReactNode }) {
  const [isReady, setIsReady]     = useState(false);
  const [user, setUser]           = useState<UserProfile | null>(null);
  const [isLoggedIn, setIsLoggedIn] = useState(false);

  useEffect(() => {
    // ถ้า init ไปแล้ว ใช้ค่าที่แคชไว้เลย ไม่ต้อง init ใหม่
    if (_initPromise) {
      _initPromise.then(() => {
        setUser(_user);
        setIsLoggedIn(_isLoggedIn);
        setIsReady(true);
      });
      return;
    }

    _initPromise = (async () => {
      try {
        const liff = (await import("@line/liff")).default;
        await liff.init({ liffId: process.env.NEXT_PUBLIC_LIFF_ID! });

        if (liff.isLoggedIn()) {
          const p = await liff.getProfile();

          _user = {
            userId:      p.userId,
            displayName: p.displayName,
            pictureUrl:  p.pictureUrl,
          };
          _isLoggedIn = true;

          // ✅ บันทึก userId + displayName ลง Firestore ทันทีที่เปิดแอป
          // ใช้ merge: true เพื่ออัพเดตชื่อถ้าเปลี่ยน ไม่ overwrite ข้อมูลเก่า
          await setDoc(
            doc(db, "lineUsers", p.userId),
            {
              userId:      p.userId,
              displayName: p.displayName,
              updatedAt:   new Date().toISOString(),
            },
            { merge: true }
          );

        } else {
          liff.login();
          return; // redirect — ไม่ต้อง setReady
        }
      } catch (e) {
        console.error("LIFF init error:", e);
        // ถ้าอยู่นอก LINE (dev/browser) ให้ผ่านไปได้
      }
      setUser(_user);
      setIsLoggedIn(_isLoggedIn);
      setIsReady(true);
    })();

    _initPromise.then(() => {
      setUser(_user);
      setIsLoggedIn(_isLoggedIn);
      setIsReady(true);
    });
  }, []);

  return (
    <LiffContext.Provider value={{ user, isReady, isLoggedIn }}>
      {children}
    </LiffContext.Provider>
  );
}

export const useLiff = () => useContext(LiffContext);