// lib/liff-context.tsx
// Singleton LIFF provider — init ครั้งเดียวตลอด session
// ✅ ลบ Firestore save ออก — ใช้ webhook บันทึก userId แทน
"use client";

import { createContext, useContext, useEffect, useState, ReactNode } from "react";
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
  const [isReady, setIsReady]       = useState(false);
  const [user, setUser]             = useState<UserProfile | null>(null);
  const [isLoggedIn, setIsLoggedIn] = useState(false);

  useEffect(() => {
    if (_initPromise) {
      _initPromise.then(() => {
        setUser(_user);
        setIsLoggedIn(_isLoggedIn);
        setIsReady(true);
      });
      return;
    }

    _initPromise = (async () => {
      // ⚠️ DEV ONLY — ปิดก่อน deploy production
      if (typeof window !== 'undefined' && window.location.hostname === 'localhost') {
    _user = {
      userId: 'dev-user-id',
      displayName: 'eakarthit',
      pictureUrl: '',
    };
    _isLoggedIn = true;
    setUser(_user);
    setIsLoggedIn(true);
    setIsReady(true);
    return;
  }

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
        } else {
          liff.login();
          return;
        }
      } catch (e) {
        console.error("LIFF init error:", e);
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