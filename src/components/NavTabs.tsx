"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { ConnectButton } from "@rainbow-me/rainbowkit";

export default function NavTabs() {
  const pathname = usePathname();

  const items = [
    { href: "/", label: "Main" },
    { href: "/bridge", label: "ZK Bridge" },      // <── NEW TAB
  //  { href: "/SmartAccount", label: "Smart Account" },
    { href: "/leaderboard", label: "Leaderboard" },
    { href: "/dashboard", label: "Dashboard" }, // ← NEW
 //   { href: '/mgid-leaderboard', label: 'MGID Leaderboard' },
  ];

  return (
    <div
      style={{
        display: "flex",
        alignItems: "center",
        gap: 16,
        justifyContent: "space-between",
      }}
    >
      {/* Tabs (left) */}
      <div style={{ display: "flex", gap: 12, flexWrap: "wrap" }}>
        {items.map((it) => {
          const active =
            pathname === it.href ||
            (it.href !== "/" && pathname?.startsWith(it.href));

          const base: React.CSSProperties = {
            padding: "12px 18px",          // bigger like the screenshot
            borderRadius: 999,
            textDecoration: "none",
            fontWeight: 800,
            fontSize: 15,
            background: "#0f0f12",         // black pill
            color: "#e5e7eb",
            border: "1px solid #27272a",
          };

          const activeStyles: React.CSSProperties = active
            ? {
                border: "2px solid #7c3aed",            // purple active
                boxShadow: "0 0 0 3px rgba(124,58,237,0.18)",
                color: "#e9d5ff",
              }
            : {};

          return (
            <Link key={it.href} href={it.href} style={{ ...base, ...activeStyles }}>
              {it.label}
            </Link>
          );
        })}
      </div>

      {/* Wallet connect (right) */}
      <div>
        <ConnectButton
          chainStatus="icon"
          accountStatus={{ smallScreen: "avatar", largeScreen: "full" }}
          showBalance={{ smallScreen: true, largeScreen: true }}
        />
      </div>
    </div>
  );
}
