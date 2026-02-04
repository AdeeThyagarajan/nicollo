export default function Signup() {
  return (
    <div style={{ maxWidth: 420 }}>
      <h2 style={{ marginTop: 0 }}>Sign up</h2>
      <form method="POST" action="/api/auth/signup" style={{ display: "grid", gap: 10 }}>
        <input name="email" placeholder="email" required style={{ padding: 10, borderRadius: 10, border: "1px solid rgba(255,255,255,0.14)", background: "rgba(0,0,0,0.25)", color: "#fff" }} />
        <input name="password" type="password" placeholder="password" required style={{ padding: 10, borderRadius: 10, border: "1px solid rgba(255,255,255,0.14)", background: "rgba(0,0,0,0.25)", color: "#fff" }} />
        <button style={{ padding: "10px 14px", borderRadius: 10, background: "#1a2238", color: "#fff", border: 0, cursor: "pointer" }}>
          Create account
        </button>
      </form>
      <div style={{ marginTop: 10, opacity: 0.8, fontSize: 13 }}>
        Already have an account? <a href="/auth/login" style={{ color: "#c6d3ff" }}>Log in</a>
      </div>
    </div>
  );
}
