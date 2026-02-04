export default function Home() {
  return (
    <div style={{ display: "grid", gap: 12 }}>
      <h1 style={{ margin: 0 }}>Welcome</h1>
      <p style={{ margin: 0, opacity: 0.85 }}>
        This is a real Next.js + Prisma sandbox app scaffold. Ask Devassist to change pages, add APIs, DB models, auth flows, and Stripe billing.
      </p>
      <div style={{ display: "flex", gap: 10 }}>
        <a href="/auth/signup" style={{ padding: "10px 14px", borderRadius: 10, background: "#1a2238", color: "#fff", textDecoration: "none" }}>
          Sign up
        </a>
        <a href="/auth/login" style={{ padding: "10px 14px", borderRadius: 10, background: "#10162a", color: "#fff", textDecoration: "none", border: "1px solid rgba(255,255,255,0.12)" }}>
          Log in
        </a>
        <a href="/dashboard" style={{ padding: "10px 14px", borderRadius: 10, background: "#10162a", color: "#fff", textDecoration: "none", border: "1px solid rgba(255,255,255,0.12)" }}>
          Dashboard
        </a>
      </div>
    </div>
  );
}
