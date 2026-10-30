import { NextResponse } from "next/server";

import { prisma } from "@/lib/prisma";
import { readJson, requireUserId, unauthorized } from "@/lib/api";
import { z } from "zod";

const submitSchema = z.object({
  title: z.string().trim().min(1).max(200),
  course: z.string().trim().min(1).max(120),
  moodleAssignmentId: z.string().trim().max(80).optional().nullable(),
  pdfBase64: z.string().min(1),
  fileType: z.string().trim().max(80).optional(),
});

export async function POST(request: Request) {
  const userId = await requireUserId();
  if (!userId) return unauthorized();

  const body = await readJson(request);
  const parsed = submitSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { error: "VALIDATION_ERROR", fieldErrors: parsed.error.flatten().fieldErrors },
      { status: 422 },
    );
  }

  const { title, course, moodleAssignmentId, pdfBase64 } = parsed.data;

  const moodleUrl = process.env.MOODLE_URL;
  const moodleToken = process.env.MOODLE_TOKEN;

  let moodleStatus: "simulated" | "submitted" = "simulated";
  let moodleItemId: string | null = null;

  // If Moodle credentials are configured, attempt a real submission.
  if (moodleUrl && moodleToken && moodleAssignmentId) {
    try {
      // Step A: upload the PDF to the Moodle draft area.
      const uploadUrl = new URL(`${moodleUrl}/webservice/rest/server.php`);
      uploadUrl.searchParams.set("wstoken", moodleToken);
      uploadUrl.searchParams.set("wsfunction", "core_files_upload");
      uploadUrl.searchParams.set("moodlewsrestformat", "json");
      uploadUrl.searchParams.set("contextid", "0"); // site context fallback
      uploadUrl.searchParams.set("component", "user");
      uploadUrl.searchParams.set("filearea", "draft");
      uploadUrl.searchParams.set("itemid", "0");
      uploadUrl.searchParams.set("filepath", "/");
      uploadUrl.searchParams.set("filename", `${title}.pdf`);
      uploadUrl.searchParams.set("filecontent", pdfBase64);

      const uploadResponse = await fetch(uploadUrl.toString(), { method: "POST" });
      const uploadResult = await uploadResponse.json().catch(() => null);
      moodleItemId =
        uploadResult?.itemid?.toString() ??
        uploadResult?.[0]?.itemid?.toString() ??
        null;

      // Step B: save + submit for grading.
      if (moodleAssignmentId) {
        const saveUrl = new URL(`${moodleUrl}/webservice/rest/server.php`);
        saveUrl.searchParams.set("wstoken", moodleToken);
        saveUrl.searchParams.set("wsfunction", "mod_assign_save_submission");
        saveUrl.searchParams.set("moodlewsrestformat", "json");
        saveUrl.searchParams.set("assignmentid", moodleAssignmentId);
        if (moodleItemId) {
          saveUrl.searchParams.set(
            "plugindata[files_filemanager]",
            moodleItemId,
          );
        }
        await fetch(saveUrl.toString(), { method: "POST" });

        const submitUrl = new URL(`${moodleUrl}/webservice/rest/server.php`);
        submitUrl.searchParams.set("wstoken", moodleToken);
        submitUrl.searchParams.set("wsfunction", "mod_assign_submit_for_grading");
        submitUrl.searchParams.set("moodlewsrestformat", "json");
        submitUrl.searchParams.set("assignmentid", moodleAssignmentId);
        submitUrl.searchParams.set("acceptsubmissionstatement", "1");
        await fetch(submitUrl.toString(), { method: "POST" });
      }

      moodleStatus = "submitted";
    } catch (err) {
      console.error("Moodle submission failed:", err);
      // Fall back to a logged submission so the student is not blocked.
      moodleStatus = "simulated";
    }
  }

  const submittedAt = new Date();

  await prisma.assignmentSubmission.create({
    data: {
      title,
      course,
      moodleAssignmentId: moodleAssignmentId ?? null,
      submittedAt,
      status: moodleStatus,
      userId,
    },
  });

  return NextResponse.json(
    {
      ok: true,
      status: moodleStatus,
      submittedAt: submittedAt.toISOString(),
      moodleItemId,
    },
    { status: 201 },
  );
}
