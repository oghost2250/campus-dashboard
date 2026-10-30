import { NextResponse } from "next/server";
import bcrypt from "bcryptjs";
import { Prisma } from "@prisma/client";

import { prisma } from "@/lib/prisma";
import { env } from "@/lib/env";
import { registerSchema } from "@/lib/validations/auth";
import { FIRST_YEAR_SUBJECTS } from "@/lib/subjects";

export async function POST(request: Request) {
  let payload: unknown;
  try {
    payload = await request.json();
  } catch {
    return NextResponse.json({ error: "INVALID_JSON" }, { status: 400 });
  }

  const parsed = registerSchema.safeParse(payload);
  if (!parsed.success) {
    const fieldErrors: Record<string, string> = {};
    for (const issue of parsed.error.issues) {
      const key = issue.path[0];
      if (typeof key === "string" && !fieldErrors[key]) {
        fieldErrors[key] = issue.message;
      }
    }
    return NextResponse.json(
      { error: "VALIDATION_ERROR", fieldErrors },
      { status: 422 },
    );
  }

  const { name, email, password } = parsed.data;

  // Optional campus allowlist: when ALLOWED_EMAIL_DOMAIN is set, only that
  // university's addresses can register. Off by default.
  if (env.ALLOWED_EMAIL_DOMAIN && !email.endsWith(`@${env.ALLOWED_EMAIL_DOMAIN}`)) {
    return NextResponse.json({ error: "EMAIL_DOMAIN" }, { status: 422 });
  }

  try {
    const passwordHash = await bcrypt.hash(password, 12);

    const user = await prisma.user.create({
      data: { name, email, passwordHash },
      select: { id: true, email: true, name: true },
    });

    // Auto-attach Subjects First Year courses to the new student profile.
    await prisma.course.createMany({
      data: FIRST_YEAR_SUBJECTS.map((subject, index) => ({
        name: subject.title,
        code: subject.code,
        credits: 3,
        color: ["#6366f1", "#0ea5e9", "#10b981", "#f59e0b", "#ec4899", "#8b5cf6"][index % 6],
        userId: user.id,
      })),
    });

    // Attempt automatic Moodle SSO handshake using the signup credentials.
    const moodleUrl = "https://moodle.zewailcity.edu.eg";
    try {
      const tokenResponse = await fetch(`${moodleUrl}/login/token.php`, {
        method: "POST",
        headers: { "Content-Type": "application/x-www-form-urlencoded" },
        body: new URLSearchParams({
          username: email,
          password,
          service: "moodle_mobile_app",
        }).toString(),
      });
      const tokenData = await tokenResponse.json().catch(() => null);
      if (tokenData?.token) {
        await prisma.user.update({
          where: { id: user.id },
          data: { moodleToken: tokenData.token, moodleUrl },
        });
      }
    } catch {
      // Moodle may be unreachable or credentials invalid; signup still succeeds.
    }

    return NextResponse.json({ user }, { status: 201 });
  } catch (error) {
    // Unique constraint on email — do not leak whether the address exists.
    if (
      error instanceof Prisma.PrismaClientKnownRequestError &&
      error.code === "P2002"
    ) {
      return NextResponse.json(
        { error: "EMAIL_TAKEN" },
        { status: 409 },
      );
    }

    console.error("[register]", error);
    return NextResponse.json({ error: "INTERNAL_ERROR" }, { status: 500 });
  }
}
