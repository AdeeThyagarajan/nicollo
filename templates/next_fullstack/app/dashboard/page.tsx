import { cookies } from "next/headers";

export default function Dashboard() {
  const token = cookies().get("session")?.value;
  return (
    <div style={{ display: "grid", gap: 12 }}>
      <h2 style={{ margin: 0 }}>Dashboard</h2>
      <div style={{ padding: 16, borderRadius: 12, background: "rgba(255,255,255,0.06)", border: "1px solid rgba(255,255,255,0.12)" }}>
        <div style={{ fontSize: 13, opacity: 0.85 }}>Session</div>
        <div style={{ marginTop: 8, fontFamily: "ui-monospace, SFMono-Regular", fontSize: 12 }}>
          {token ? token.slice(0, 28) + "…" : "Not logged in (yet)."}
        </div>
      </div>
      <div style={{ display: "flex", gap: 10 }}>
        <a href="/settings/billing" style={{ padding: "10px 14px", borderRadius: 10, background: "#10162a", color: "#fff", textDecoration: "none", border: "1px solid rgba(255,255,255,0.12)" }}>
          Billing
        </a>
        <a href="/api/health" style={{ padding: "10px 14px", borderRadius: 10, background: "#10162a", color: "#fff", textDecoration: "none", border: "1px solid rgba(255,255,255,0.12)" }}>
          Health
        </a>
      </div>
    </div>
  );
}
