// app/components/BottomNav.tsx
"use client";
import Link from "next/link";
import { usePathname } from "next/navigation";

const TABS = [
  {
    href: "/",
    label: "สถานะ",
    icon: (active: boolean) => (
      <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24"
        fill={active ? "currentColor" : "none"}
        stroke="currentColor" strokeWidth={active ? 0 : 1.8}
        width="22" height="22">
        <path strokeLinecap="round" strokeLinejoin="round"
          d="M2.25 12l8.954-8.955a1.126 1.126 0 011.591 0L21.75 12M4.5 9.75v10.125c0 .621.504 1.125 1.125 1.125H9.75v-4.875c0-.621.504-1.125 1.125-1.125h2.25c.621 0 1.125.504 1.125 1.125V21h4.125c.621 0 1.125-.504 1.125-1.125V9.75M8.25 21h8.25" />
      </svg>
    ),
  },
  {
    href: "/queue",
    label: "คิวรถ",
    icon: (active: boolean) => (
      <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24"
        fill={active ? "currentColor" : "none"}
        stroke="currentColor" strokeWidth={active ? 0 : 1.8}
        width="22" height="22">
        <path strokeLinecap="round" strokeLinejoin="round"
          d="M8.25 6.75h12M8.25 12h12m-12 5.25h12M3.75 6.75h.007v.008H3.75V6.75zm.375 0a.375.375 0 11-.75 0 .375.375 0 01.75 0zM3.75 12h.007v.008H3.75V12zm.375 0a.375.375 0 11-.75 0 .375.375 0 01.75 0zm-.375 5.25h.007v.008H3.75v-.008zm.375 0a.375.375 0 11-.75 0 .375.375 0 01.75 0z" />
      </svg>
    ),
  },
  {
    href: "/book",
    label: "จองรถ",
    icon: (_active: boolean) => (
      <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24"
        fill="currentColor" width="22" height="22">
        <path fillRule="evenodd"
          d="M12 3.75a.75.75 0 01.75.75v6.75h6.75a.75.75 0 010 1.5h-6.75v6.75a.75.75 0 01-1.5 0v-6.75H4.5a.75.75 0 010-1.5h6.75V4.5a.75.75 0 01.75-.75z"
          clipRule="evenodd" />
      </svg>
    ),
    isAction: true,
  },
];

export default function BottomNav() {
  const path = usePathname();

  return (
    <nav style={{
      position: "fixed", bottom: 0, left: 0, right: 0, zIndex: 50,
      background: "white",
      borderTop: "1px solid #e2e8f0",
      display: "flex",
      boxShadow: "0 -4px 20px rgba(0,0,0,0.08)",
      paddingBottom: "env(safe-area-inset-bottom)",
    }}>
      {TABS.map((tab) => {
        const active = path === tab.href;
        if (tab.isAction) {
          return (
            <Link key={tab.href} href={tab.href} style={{
              flex: 1, display: "flex", flexDirection: "column",
              alignItems: "center", justifyContent: "center",
              padding: "10px 0 8px", textDecoration: "none", gap: 3,
            }}>
              <div style={{
                width: 44, height: 44, borderRadius: "50%",
                background: "linear-gradient(135deg, #1d4ed8, #1e3a5f)",
                display: "flex", alignItems: "center", justifyContent: "center",
                color: "white", marginTop: -20,
                boxShadow: "0 4px 16px rgba(29,78,216,0.45)",
              }}>
                {tab.icon(active)}
              </div>
              <span style={{ fontSize: 10, fontWeight: 700, color: "#1d4ed8", marginTop: 2 }}>
                {tab.label}
              </span>
            </Link>
          );
        }
        return (
          <Link key={tab.href} href={tab.href} style={{
            flex: 1, display: "flex", flexDirection: "column",
            alignItems: "center", justifyContent: "center",
            padding: "10px 0 8px", textDecoration: "none", gap: 3,
            color: active ? "#1d4ed8" : "#94a3b8",
            transition: "color 0.15s",
          }}>
            {tab.icon(active)}
            <span style={{
              fontSize: 10, fontWeight: active ? 700 : 500,
              color: active ? "#1d4ed8" : "#94a3b8",
            }}>
              {tab.label}
            </span>
            {active && (
              <div style={{
                position: "absolute", top: 0,
                width: 32, height: 2, borderRadius: 2,
                background: "#1d4ed8",
              }} />
            )}
          </Link>
        );
      })}
    </nav>
  );
}