import DashboardClient from "./ui/DashboardClient";

export const dynamic = "force-dynamic";

export default function DashboardPage() {
  return (
    <div>
      <h1
        style={{
          color: "#fff",
          fontSize: 32,
          fontWeight: 900,
          marginBottom: 8,
          letterSpacing: "-0.02em",
        }}
      >
        Cookieverse Dashboard
      </h1>

      <div
        style={{
          height: 2,
          width: 220,
          background: "linear-gradient(90deg,#7c3aed,#a855f7)",
          borderRadius: 999,
          marginBottom: 14,
        }}
      />

      <p style={{ marginBottom: 20, color: "#9ca3af", maxWidth: 640 }}>
        Track your <strong>multi-chain COOKIE score</strong>, bridges and mints
        across Monad, Base, Mantle, Linea and Mitosis. Complete daily & weekly
        quests to climb the ranks and become a <strong>Emerald Cookie</strong> 🍪✨.
        
        <strong>Data synchronizes every 10 minutes.</strong>
      </p>

      <DashboardClient />
    </div>
  );
}
