import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import bcrypt from "bcryptjs";

export async function POST(req: Request) {
  const form = await req.formData();
  const email = String(form.get("email") || "").toLowerCase().trim();
  const password = String(form.get("password") || "");

  if (!email || password.length < 6) {
    return NextResponse.redirect(new URL("/auth/signup", req.url), { status: 303 });
  }

  const existing = await prisma.user.findUnique({ where: { email } });
  if (existing) {
    return NextResponse.redirect(new URL("/auth/login", req.url), { status: 303 });
  }

  const hash = await bcrypt.hash(password, 10);
  await prisma.user.create({ data: { email, password: hash } });

  return NextResponse.redirect(new URL("/auth/login", req.url), { status: 303 });
}
