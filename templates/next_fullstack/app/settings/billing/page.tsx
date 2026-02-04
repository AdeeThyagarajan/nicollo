export default function Billing() {
  return (
    <div style={{ display: "grid", gap: 12 }}>
      <h2 style={{ margin: 0 }}>Billing</h2>
      <p style={{ margin: 0, opacity: 0.85 }}>
        Stripe is wired via API routes. Devassist can generate checkout + webhook handling based on your product.
      </p>
      <form method="POST" action="/api/stripe/checkout">
        <button style={{ padding: "10px 14px", borderRadius: 10, background: "#1a2238", color: "#fff", border: 0, cursor: "pointer" }}>
          Start Checkout (test)
        </button>
      </form>
    </div>
  );
}
