export default function Login() {
  return (
    <div style={{ maxWidth: 420 }}>
      <h2 style={{ marginTop: 0 }}>Log in</h2>
      <form method="POST" action="/api/auth/login" style={{ display: "grid", gap: 10 }}>
        <input name="email" placeholder="email" required style={{ padding: 10, borderRadius: 10, border: "1px solid rgba(255,255,255,0.14)", background: "rgba(0,0,0,0.25)", color: "#fff" }} />
        <input name="password" type="password" placeholder="password" required style={{ padding: 10, borderRadius: 10, border: "1px solid rgba(255,255,255,0.14)", background: "rgba(0,0,0,0.25)", color: "#fff" }} />
        <button style={{ padding: "10px 14px", borderRadius: 10, background: "#1a2238", color: "#fff", border: 0, cursor: "pointer" }}>
          Log in
        </button>
      </form>
    </div>
  );
}
