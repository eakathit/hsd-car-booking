// lib/liff-context.tsx
"use client";

import { createContext, useContext, useEffect, useState, ReactNode } from "react";
import { doc, getDoc, setDoc } from "firebase/firestore";
import { db } from "./firebase";
import type { UserProfile, UserRole } from "../types";

interface LiffContextValue {
  user: UserProfile | null;
  isReady: boolean;
  isLoggedIn: boolean;
  isAdmin: boolean;
}

const LiffContext = createContext<LiffContextValue>({
  user: null,
  isReady: false,
  isLoggedIn: false,
  isAdmin: false,
});

let _initPromise: Promise<void> | null = null;
let _user: UserProfile | null = null;
let _isLoggedIn = false;

// ✅ ใช้ lineUsers (collection เดิมที่มีอยู่แล้ว)
async function fetchRole(userId: string): Promise<UserRole> {
  try {
    const snap = await getDoc(doc(db, "lineUsers", userId));
    if (snap.exists()) return (snap.data().role as UserRole) ?? "employee";
  } catch (e) {
    console.error("fetchRole error:", e);
  }
  return "employee";
}

async function upsertUser(profile: UserProfile) {
  try {
    const ref  = doc(db, "lineUsers", profile.userId);
    const snap = await getDoc(ref);
    if (snap.exists()) {
      // มีอยู่แล้ว — update แค่ displayName/pictureUrl ไม่แตะ role
      await setDoc(ref, {
        userId:      profile.userId,
        displayName: profile.displayName,
        pictureUrl:  profile.pictureUrl ?? "",
        updatedAt:   new Date().toISOString(),
      }, { merge: true });
    } else {
      // ครั้งแรก — สร้างใหม่ด้วย role = "employee"
      await setDoc(ref, {
        userId:      profile.userId,
        displayName: profile.displayName,
        pictureUrl:  profile.pictureUrl ?? "",
        role:        "employee",
        createdAt:   new Date().toISOString(),
        updatedAt:   new Date().toISOString(),
      });
    }
  } catch (e) {
    console.error("upsertUser error:", e);
  }
}

export function LiffProvider({ children }: { children: ReactNode }) {
  const [isReady,    setIsReady]    = useState(false);
  const [user,       setUser]       = useState<UserProfile | null>(null);
  const [isLoggedIn, setIsLoggedIn] = useState(false);
  const [isAdmin,    setIsAdmin]    = useState(false);

  useEffect(() => {
    if (_initPromise) {
      _initPromise.then(() => {
        setUser(_user);
        setIsLoggedIn(_isLoggedIn);
        setIsAdmin(_user?.role === "admin");
        setIsReady(true);
      });
      return;
    }

    _initPromise = (async () => {

      // ⚠️ DEV ONLY — hardcode admin เพื่อทดสอบ localhost

      // if (typeof window !== "undefined" && window.location.hostname === "localhost") {
      //   _user = { userId: "dev-user-id", displayName: "eakarthit", pictureUrl: "", role: "admin" };
      //   _isLoggedIn = true;
      //   setUser(_user);
      //   setIsLoggedIn(true);
      //   setIsAdmin(true);
      //   setIsReady(true);
      //   return;
      // }

      try {
        const liff = (await import("@line/liff")).default;
        await liff.init({ liffId: process.env.NEXT_PUBLIC_LIFF_ID! });

        if (liff.isLoggedIn()) {
          const p = await liff.getProfile();

          await upsertUser({
            userId:      p.userId,
            displayName: p.displayName,
            pictureUrl:  p.pictureUrl,
          });

          const role = await fetchRole(p.userId);

          _user = {
            userId:      p.userId,
            displayName: p.displayName,
            pictureUrl:  p.pictureUrl,
            role,
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
      setIsAdmin(_user?.role === "admin");
      setIsReady(true);
    })();

    _initPromise.then(() => {
      setUser(_user);
      setIsLoggedIn(_isLoggedIn);
      setIsAdmin(_user?.role === "admin");
      setIsReady(true);
    });
  }, []);

  return (
    <LiffContext.Provider value={{ user, isReady, isLoggedIn, isAdmin }}>
      {children}
    </LiffContext.Provider>
  );
}

export const useLiff = () => useContext(LiffContext);