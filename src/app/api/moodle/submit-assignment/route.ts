import { NextResponse } from "next/server";
import { z } from "zod";

import { prisma } from "@/lib/prisma";
import { readJson, requireUserId, unauthorized } from "@/lib/api";
import { rateLimit, tooManyRequests } from "@/lib/rate-limit";

/**
 * Vercel caps request bodies at ~4.5 MB. Base64 inflates by ~33%, so keep the
 * encoded payload under 4 MB and let the client compress pages before upload.
 */
const MAX_PDF_BASE64_BYTES = 4_000_000;
const MOODLE_TIMEOUT_MS = 15_000;

export const maxDuration = 60;

const submitSchema = z.object({
  title: z.string().trim().min(1).max(200),
  course: z.string().trim().min(1).max(120),
  moodleAssignmentId: z.string().trim().max(80).optional().nullable(),
  pdfBase64: z.string().min(1),
  fileType: z.string().trim().max(80).optional(),
});

function encodeForm(params: Record<string, string>) {
  return new URLSearchParams(params).toString();
}

export async function POST(request: Request) {
  try {
    const userId = await requireUserId();
    if (!userId) return unauthorized();

    const burst = rateLimit(`moodle:submit:${userId}`, 20, 60 * 60 * 1000);
    if (!burst.ok) return tooManyRequests(burst.retryAfter);

    const body = await readJson(request);
    const parsed = submitSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json(
        { error: "VALIDATION_ERROR", fieldErrors: parsed.error.flatten().fieldErrors },
        { status: 422 },
      );
    }

    const { title, course, moodleAssignmentId, pdfBase64 } = parsed.data;

    if (pdfBase64.length > MAX_PDF_BASE64_BYTES) {
      return NextResponse.json(
        {
          error:
            "The compiled PDF is too large. Remove a few pages or lower the capture quality.",
        },
        { status: 413 },
      );
    }

    // Prefer the per-student Moodle credentials captured at signup, then fall
    // back to the deployment-wide service account.
    const profile = await prisma.user.findUnique({
      where: { id: userId },
      select: { moodleToken: true, moodleUrl: true },
    });

    const moodleUrl = profile?.moodleUrl ?? process.env.MOODLE_URL;
    const moodleToken = profile?.moodleToken ?? process.env.MOODLE_TOKEN;

    let moodleStatus: "simulated" | "submitted" = "simulated";
    let moodleItemId: string | null = null;

    if (moodleUrl && moodleToken && moodleAssignmentId) {
      try {
        const signal = AbortSignal.timeout(MOODLE_TIMEOUT_MS);
        const endpoint = `${moodleUrl}/webservice/rest/server.php`;

        // Step A: upload the PDF to the Moodle draft area.
        const uploadResponse = await fetch(endpoint, {
          method: "POST",
          headers: { "Content-Type": "application/x-www-form-urlencoded" },
          body: encodeForm({
            wstoken: moodleToken,
            wsfunction: "core_files_upload",
            moodlewsrestformat: "json",
            contextid: "0",
            component: "user",
            filearea: "draft",
            itemid: "0",
            filepath: "/",
            filename: `${title}.pdf`,
            filecontent: pdfBase64,
          }),
          signal,
        });
        const uploadResult = (await uploadResponse.json().catch(() => null)) as
          | { itemid?: number | string }
          | Array<{ itemid?: number | string }>
          | null;

        moodleItemId = Array.isArray(uploadResult)
          ? (uploadResult[0]?.itemid?.toString() ?? null)
          : (uploadResult?.itemid?.toString() ?? null);

        // Step B: save + submit for grading.
        const saveBody: Record<string, string> = {
          wstoken: moodleToken,
          wsfunction: "mod_assign_save_submission",
          moodlewsrestformat: "json",
          assignmentid: moodleAssignmentId,
        };
        if (moodleItemId) {
          saveBody["plugindata[files_filemanager]"] = moodleItemId;
        }

        await fetch(endpoint, {
          method: "POST",
          headers: { "Content-Type": "application/x-www-form-urlencoded" },
          body: encodeForm(saveBody),
          signal,
        });

        await fetch(endpoint, {
          method: "POST",
          headers: { "Content-Type": "application/x-www-form-urlencoded" },
          body: encodeForm({
            wstoken: moodleToken,
            wsfunction: "mod_assign_submit_for_grading",
            moodlewsrestformat: "json",
            assignmentid: moodleAssignmentId,
            acceptsubmissionstatement: "1",
          }),
          signal,
        });

        moodleStatus = "submitted";
      } catch (error) {
        console.error("[moodle:submit] falling back to simulated:", error);
        moodleStatus = "simulated";
      }
    }

    const submittedAt = new Date();

    const where =
      moodleAssignmentId != null
        ? {
            userId_moodleAssignmentId: {
              userId,
              moodleAssignmentId,
            },
          }
        : undefined;

    const submission = where
      ? await prisma.assignmentSubmission.upsert({
          where,
          create: {
            title,
            course,
            moodleAssignmentId,
            submittedAt,
            status: moodleStatus,
            userId,
          },
          update: { title, course, submittedAt, status: moodleStatus },
        })
      : await prisma.assignmentSubmission.create({
          data: {
            title,
            course,
            moodleAssignmentId: null,
            submittedAt,
            status: moodleStatus,
            userId,
          },
        });

    return NextResponse.json(
      {
        ok: true,
        status: moodleStatus,
        submittedAt: submission.submittedAt.toISOString(),
        moodleItemId,
      },
      { status: 201 },
    );
  } catch (error) {
    console.error("[moodle:submit]", error);
    return NextResponse.json(
      {
        error:
          error instanceof Error
            ? error.message
            : "Could not save the submission.",
      },
      { status: 500 },
    );
  }
}
