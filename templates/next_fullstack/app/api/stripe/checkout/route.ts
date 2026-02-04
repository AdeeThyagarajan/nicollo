import { NextResponse } from "next/server";
import Stripe from "stripe";

export async function POST(req: Request) {
  const key = process.env.STRIPE_SECRET_KEY;
  const price = process.env.STRIPE_PRICE_ID;

  if (!key || !price) {
    return NextResponse.json({ ok: false, error: "Missing STRIPE_SECRET_KEY or STRIPE_PRICE_ID" }, { status: 500 });
  }

  const stripe = new Stripe(key, { apiVersion: "2024-06-20" as any });

  const origin = new URL(req.url).origin;

  const session = await stripe.checkout.sessions.create({
    mode: "subscription",
    line_items: [{ price, quantity: 1 }],
    success_url: origin + "/settings/billing?success=1",
    cancel_url: origin + "/settings/billing?canceled=1",
  });

  return NextResponse.redirect(session.url!, { status: 303 });
}
