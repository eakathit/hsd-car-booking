// app/components/BottomNav.tsx
"use client";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useLiff } from "../../lib/liff-context";

const TABS = [
  {
    href: "/",
    label: "สถานะ",
    icon: () => (
      <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24"
        fill="none" stroke="currentColor" strokeWidth={1.8}
        width="22" height="22">
        <path strokeLinecap="round" strokeLinejoin="round"
          d="M2.25 12l8.954-8.955a1.126 1.126 0 011.591 0L21.75 12M4.5 9.75v10.125c0 .621.504 1.125 1.125 1.125H9.75v-4.875c0-.621.504-1.125 1.125-1.125h2.25c.621 0 1.125.504 1.125 1.125V21h4.125c.621 0 1.125-.504 1.125-1.125V9.75M8.25 21h8.25" />
      </svg>
    ),
  },
  {
    href: "/queue",
    label: "คิวรถ",
    icon: () => (
      <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24"
        fill="none" stroke="currentColor" strokeWidth={1.8}
        width="22" height="22">
        <path strokeLinecap="round" strokeLinejoin="round"
          d="M8.25 6.75h12M8.25 12h12m-12 5.25h12M3.75 6.75h.007v.008H3.75V6.75zm.375 0a.375.375 0 11-.75 0 .375.375 0 01.75 0zM3.75 12h.007v.008H3.75V12zm.375 0a.375.375 0 11-.75 0 .375.375 0 01.75 0zm-.375 5.25h.007v.008H3.75v-.008zm.375 0a.375.375 0 11-.75 0 .375.375 0 01.75 0z" />
      </svg>
    ),
  },
  {
    href: "/book",
    label: "จองรถ",
    icon: () => (
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

const ADMIN_TAB = {
  href: "/admin",
  label: "Admin",
  icon: () => (
    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24"
      fill="none" stroke="currentColor" strokeWidth={1.8}
      width="22" height="22">
      <path strokeLinecap="round" strokeLinejoin="round"
        d="M10.343 3.94c.09-.542.56-.94 1.11-.94h1.093c.55 0 1.02.398 1.11.94l.149.894c.07.424.384.764.78.93.398.164.855.142 1.205-.108l.737-.527a1.125 1.125 0 011.45.12l.773.774c.39.389.44 1.002.12 1.45l-.527.737c-.25.35-.272.806-.107 1.204.165.397.505.71.93.78l.893.15c.543.09.94.56.94 1.109v1.094c0 .55-.397 1.02-.94 1.11l-.893.149c-.425.07-.765.383-.93.78-.165.398-.143.854.107 1.204l.527.738c.32.447.269 1.06-.12 1.45l-.774.773a1.125 1.125 0 01-1.449.12l-.738-.527c-.35-.25-.806-.272-1.203-.107-.397.165-.71.505-.781.929l-.149.894c-.09.542-.56.94-1.11.94h-1.094c-.55 0-1.019-.398-1.11-.94l-.148-.894c-.071-.424-.384-.764-.781-.93-.398-.164-.854-.142-1.204.108l-.738.527c-.447.32-1.06.269-1.45-.12l-.773-.774a1.125 1.125 0 01-.12-1.45l.527-.737c.25-.35.273-.806.108-1.204-.165-.397-.505-.71-.93-.78l-.894-.15c-.542-.09-.94-.56-.94-1.109v-1.094c0-.55.398-1.02.94-1.11l.894-.149c.424-.07.765-.383.93-.78.165-.398.143-.854-.108-1.204l-.526-.738a1.125 1.125 0 01.12-1.45l.773-.773a1.125 1.125 0 011.45-.12l.737.527c.35.25.807.272 1.204.107.397-.165.71-.505.78-.929l.15-.894z" />
      <path strokeLinecap="round" strokeLinejoin="round"
        d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
    </svg>
  ),
};

export default function BottomNav() {
  const path = usePathname();
  const { isAdmin } = useLiff();

  const allTabs = isAdmin ? [...TABS, ADMIN_TAB] : TABS;

  return (
    <nav style={{
      position: "fixed", bottom: 0, left: 0, right: 0, zIndex: 50,
      background: "white",
      borderTop: "1px solid #e2e8f0",
      display: "flex",
      boxShadow: "0 -4px 20px rgba(0,0,0,0.08)",
      paddingBottom: "env(safe-area-inset-bottom)",
    }}>
      {allTabs.map((tab) => {
        const active = path === tab.href;

        if ("isAction" in tab && tab.isAction) {
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
                {tab.icon()}
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
            position: "relative",
          }}>
            {tab.icon()}
            <span style={{
              fontSize: 10, fontWeight: active ? 700 : 500,
              color: active ? "#1d4ed8" : "#94a3b8",
            }}>
              {tab.label}
            </span>
            {/* ✅ indicator บนสุด — สีน้ำเงินทุก tab รวม Admin */}
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