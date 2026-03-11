// app/layout.tsx
import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import { LiffProvider } from "../lib/liff-context";
import "./globals.css";

const geistSans = Geist({ variable: "--font-geist-sans", subsets: ["latin"] });
const geistMono = Geist_Mono({ variable: "--font-geist-mono", subsets: ["latin"] });

export const metadata: Metadata = {
  title: "Haru Car Booking",
  description: "ระบบจองรถบริษัท Haru System Development",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="th">
      <body className={`${geistSans.variable} ${geistMono.variable} antialiased`}>
        {/* LiffProvider ครอบทั้งแอป — init LIFF ครั้งเดียว */}
        <LiffProvider>
          {children}
        </LiffProvider>
      </body>
    </html>
  );
}