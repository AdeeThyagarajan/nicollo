import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import bcrypt from "bcryptjs";
import crypto from "crypto";

export async function POST(req: Request) {
  const form = await req.formData();
  const email = String(form.get("email") || "").toLowerCase().trim();
  const password = String(form.get("password") || "");

  const user = await prisma.user.findUnique({ where: { email } });
  if (!user) return NextResponse.redirect(new URL("/auth/login", req.url), { status: 303 });

  const ok = await bcrypt.compare(password, user.password);
  if (!ok) return NextResponse.redirect(new URL("/auth/login", req.url), { status: 303 });

  const token = crypto.randomBytes(24).toString("hex");
  await prisma.session.create({
    data: {
      token,
      userId: user.id,
      expiresAt: new Date(Date.now() + 1000 * 60 * 60 * 24 * 14),
    },
  });

  const res = NextResponse.redirect(new URL("/dashboard", req.url), { status: 303 });
  res.cookies.set("session", token, { httpOnly: true, sameSite: "lax", path: "/" });
  return res;
}
