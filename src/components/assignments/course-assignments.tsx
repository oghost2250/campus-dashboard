"use client";

import { useEffect, useRef, useState } from "react";
import { Camera, CheckCircle2, Clock, Plus, X } from "lucide-react";
import { jsPDF } from "jspdf";

import { FIRST_YEAR_SUBJECTS } from "@/lib/subjects";

type Status = "pending" | "scanned" | "submitted";

type Assignment = {
  id: string;
  title: string;
  course: string;
  dueDate: string; // ISO date
  moodleAssignmentId: string;
  status: Status;
  submittedAt?: string;
};

const INITIAL_ASSIGNMENTS: Assignment[] = FIRST_YEAR_SUBJECTS.map((subject, index) => ({
  id: `asn-${index + 1}`,
  title: `${subject.code} - Assignment ${index + 1}`,
  course: `${subject.code} - ${subject.title}`,
  dueDate: new Date(Date.now() + (index + 1) * 86400000 * 2).toISOString(),
  moodleAssignmentId: `mdl-${1000 + index}`,
  status: "pending",
}));

function daysUntil(date: string): number {
  const target = new Date(date);
  const now = new Date();
  return Math.ceil((target.getTime() - now.getTime()) / 86400000);
}

function formatDate(date: string): string {
  return new Date(date).toLocaleDateString(undefined, {
    month: "short",
    day: "numeric",
    year: "numeric",
  });
}

export function CourseAssignments() {
  const [assignments, setAssignments] = useState<Assignment[]>(INITIAL_ASSIGNMENTS);
  const [activeId, setActiveId] = useState<string | null>(null);
  const [modalOpen, setModalOpen] = useState(false);
  const [pages, setPages] = useState<string[]>([]);
  const [previewPdf, setPreviewPdf] = useState<string | null>(null);
  const [cameraActive, setCameraActive] = useState(false);
  const [cameraError, setCameraError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const videoRef = useRef<HTMLVideoElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const streamRef = useRef<MediaStream | null>(null);

  const activeAssignment = assignments.find((item) => item.id === activeId) ?? null;

  useEffect(() => {
    if (!modalOpen) {
      stopCamera();
      setPages([]);
      setPreviewPdf(null);
      setError(null);
    }
  }, [modalOpen]);

  async function startCamera() {
    setCameraError(null);
    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        video: { facingMode: "environment" },
      });
      streamRef.current = stream;
      if (videoRef.current) {
        videoRef.current.srcObject = stream;
        await videoRef.current.play();
      }
      setCameraActive(true);
    } catch (err) {
      setCameraError(
        err instanceof Error ? err.message : "Camera unavailable.",
      );
      setCameraActive(false);
    }
  }

  function stopCamera() {
    streamRef.current?.getTracks().forEach((track) => track.stop());
    streamRef.current = null;
    setCameraActive(false);
  }

  function snapPhoto() {
    const video = videoRef.current;
    const canvas = canvasRef.current;
    if (!video || !canvas) return;
    canvas.width = video.videoWidth || 640;
    canvas.height = video.videoHeight || 480;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;
    ctx.drawImage(video, 0, 0, canvas.width, canvas.height);
    const data = canvas.toDataURL("image/jpeg", 0.9);
    setPages((current) => [...current, data]);
  }

  function handleFileChange(event: React.ChangeEvent<HTMLInputElement>) {
    const files = Array.from(event.target.files ?? []);
    if (files.length === 0) return;
    files.forEach((file) => {
      const reader = new FileReader();
      reader.onload = () => {
        setPages((current) => [...current, reader.result as string]);
      };
      reader.readAsDataURL(file);
    });
    event.target.value = "";
  }

  function removePage(index: number) {
    setPages((current) => current.filter((_, i) => i !== index));
    setPreviewPdf(null);
  }

  function generatePdf() {
    if (pages.length === 0) {
      setError("Capture or upload at least one page.");
      return;
    }
    try {
      const pdf = new jsPDF({ orientation: "portrait", unit: "mm", format: "a4" });
      pages.forEach((page, index) => {
        if (index > 0) pdf.addPage();
        const imgWidth = 190;
        const imgHeight = 270;
        pdf.addImage(page, "JPEG", 10, 10, imgWidth, imgHeight);
      });
      const url = pdf.output("datauristring");
      setPreviewPdf(url);
      setError(null);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not generate PDF.");
    }
  }

  async function submitAssignment() {
    if (!activeAssignment || !previewPdf) return;
    setSubmitting(true);
    setError(null);
    try {
      const base64 = previewPdf.split(",")[1];
      const response = await fetch("/api/moodle/submit-assignment", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          title: activeAssignment.title,
          course: activeAssignment.course,
          moodleAssignmentId: activeAssignment.moodleAssignmentId,
          pdfBase64: base64,
          fileType: "application/pdf",
        }),
      });
      if (!response.ok) throw new Error("Submission failed");

      const data = (await response.json()) as { submittedAt?: string };
      const submittedAt = data.submittedAt ?? new Date().toISOString();

      setAssignments((current) =>
        current.map((item) =>
          item.id === activeAssignment.id
            ? { ...item, status: "submitted", submittedAt }
            : item,
        ),
      );

      // Backup to Study Hub vault (localStorage)
      try {
        const raw = window.localStorage.getItem("campus-study-hub");
        const existing = raw ? (JSON.parse(raw) as unknown[]) : [];
        const backup = {
          id: `backup-${Date.now()}`,
          title: `${activeAssignment.title} (Submitted)`,
          course: activeAssignment.course,
          category: "Assignment",
          privacy: "private",
          fileData: previewPdf,
          fileType: "application/pdf",
          owner: "You",
          createdAt: Date.now(),
        };
        window.localStorage.setItem(
          "campus-study-hub",
          JSON.stringify([backup, ...existing]),
        );
      } catch {
        // ignore storage errors
      }

      setModalOpen(false);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Submission failed.");
    } finally {
      setSubmitting(false);
    }
  }

  function openScanner(assignment: Assignment) {
    setActiveId(assignment.id);
    setModalOpen(true);
  }

  function statusBadge(status: Status, submittedAt?: string) {
    if (status === "submitted") {
      return (
        <span className="rounded-md bg-emerald-500/15 px-2 py-0.5 text-[10px] font-medium text-emerald-300">
          ✅ Submitted to Moodle
          {submittedAt ? ` on ${new Date(submittedAt).toLocaleString()}` : ""}
        </span>
      );
    }
    if (status === "scanned") {
      return (
        <span className="rounded-md bg-indigo-500/15 px-2 py-0.5 text-[10px] font-medium text-indigo-300">
          Scanned &amp; Ready
        </span>
      );
    }
    return (
      <span className="rounded-md bg-amber-500/15 px-2 py-0.5 text-[10px] font-medium text-amber-300">
        Pending
      </span>
    );
  }

  return (
    <div className="w-full space-y-4">
      <div>
        <h2 className="text-sm font-semibold tracking-tight text-gray-200">
          Assignments
        </h2>
        <p className="text-[11px] text-gray-500">
          Auto-synced from Subjects First Year. Submit handwritten work via the
          in-app scanner.
        </p>
      </div>

      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
        {assignments.map((assignment) => {
          const remaining = daysUntil(assignment.dueDate);
          return (
            <div
              key={assignment.id}
              className="flex flex-col rounded-xl border border-zinc-800 bg-zinc-900/70 p-4"
            >
              <div className="mb-2 flex items-start justify-between gap-2">
                <div className="min-w-0">
                  <p className="truncate text-xs font-medium text-gray-200">
                    {assignment.title}
                  </p>
                  <p className="truncate text-[10px] text-gray-500">
                    {assignment.course}
                  </p>
                </div>
                {statusBadge(assignment.status, assignment.submittedAt)}
              </div>

              <div className="mb-3 flex items-center gap-1.5 text-[10px] text-gray-400">
                <Clock className="size-3" />
                Due {formatDate(assignment.dueDate)}
                {remaining >= 0 ? (
                  <span className="text-gray-500">
                    ({remaining} day{remaining === 1 ? "" : "s"} left)
                  </span>
                ) : (
                  <span className="text-rose-400">(overdue)</span>
                )}
              </div>

              {assignment.status !== "submitted" && (
                <button
                  type="button"
                  onClick={() => openScanner(assignment)}
                  className="mt-auto inline-flex items-center justify-center gap-1.5 rounded-lg bg-indigo-600 px-3 py-2 text-xs font-medium text-white transition-colors hover:bg-indigo-500"
                >
                  <Camera className="size-3.5" />
                  Submit via Camera / Scanner
                </button>
              )}
              {assignment.status === "submitted" && (
                <div className="mt-auto inline-flex items-center justify-center gap-1.5 rounded-lg border border-emerald-500/30 bg-emerald-500/10 px-3 py-2 text-xs font-medium text-emerald-300">
                  <CheckCircle2 className="size-3.5" />
                  Submitted
                </div>
              )}
            </div>
          );
        })}
      </div>

      {/* Scanner modal */}
      {modalOpen && activeAssignment && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 p-4 backdrop-blur-sm">
          <div className="w-full max-w-2xl rounded-2xl border border-zinc-800 bg-zinc-900 p-5 shadow-2xl">
            <div className="mb-4 flex items-center justify-between">
              <div>
                <h3 className="text-sm font-semibold text-gray-200">
                  Scan &amp; submit assignment
                </h3>
                <p className="text-[11px] text-gray-500">
                  {activeAssignment.title} · {activeAssignment.course}
                </p>
              </div>
              <button
                type="button"
                onClick={() => setModalOpen(false)}
                className="text-gray-500 transition-colors hover:text-gray-200"
                aria-label="Close"
              >
                <X className="size-4" />
              </button>
            </div>

            {/* Camera */}
            <div className="mb-4 space-y-2">
              <div className="flex gap-2">
                <button
                  type="button"
                  onClick={() => {
                    if (cameraActive) stopCamera();
                    else startCamera();
                  }}
                  className="inline-flex items-center gap-1.5 rounded-lg bg-zinc-800 px-3 py-1.5 text-xs font-medium text-gray-200 transition-colors hover:bg-zinc-700"
                >
                  <Camera className="size-3.5" />
                  {cameraActive ? "Stop camera" : "Start camera"}
                </button>
                {cameraActive && (
                  <button
                    type="button"
                    onClick={snapPhoto}
                    className="inline-flex items-center gap-1.5 rounded-lg bg-indigo-600 px-3 py-1.5 text-xs font-medium text-white transition-colors hover:bg-indigo-500"
                  >
                    Snap photo
                  </button>
                )}
                <label className="inline-flex cursor-pointer items-center gap-1.5 rounded-lg border border-zinc-700 bg-zinc-800 px-3 py-1.5 text-xs font-medium text-gray-200 transition-colors hover:bg-zinc-700">
                  <Plus className="size-3.5" />
                  Upload pages
                  <input
                    type="file"
                    accept="image/*,application/pdf"
                    multiple
                    onChange={handleFileChange}
                    className="hidden"
                  />
                </label>
              </div>
              {cameraError && (
                <p className="text-[11px] text-rose-400">{cameraError}</p>
              )}
              {cameraActive && (
                <div className="overflow-hidden rounded-lg border border-zinc-700 bg-black">
                  <video
                    ref={videoRef}
                    playsInline
                    muted
                    className="h-48 w-full object-cover"
                  />
                </div>
              )}
              <canvas ref={canvasRef} className="hidden" />
            </div>

            {/* Captured pages */}
            {pages.length > 0 && (
              <div className="mb-4">
                <p className="mb-2 text-[11px] font-medium text-gray-400">
                  Captured pages ({pages.length})
                </p>
                <div className="flex gap-2 overflow-x-auto">
                  {pages.map((page, index) => (
                    <div
                      key={index}
                      className="relative h-20 w-16 shrink-0 overflow-hidden rounded-md border border-zinc-700 bg-zinc-950"
                    >
                      {/* eslint-disable-next-line @next/next/no-img-element */}
                      <img
                        src={page}
                        alt={`Page ${index + 1}`}
                        className="h-full w-full object-cover"
                      />
                      <button
                        type="button"
                        onClick={() => removePage(index)}
                        className="absolute right-0.5 top-0.5 rounded bg-black/70 p-0.5 text-gray-300 hover:text-white"
                        aria-label="Remove page"
                      >
                        <X className="size-3" />
                      </button>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Generate / Preview */}
            <div className="mb-4 flex gap-2">
              <button
                type="button"
                onClick={generatePdf}
                disabled={pages.length === 0}
                className="rounded-lg bg-zinc-800 px-3 py-2 text-xs font-medium text-gray-200 transition-colors hover:bg-zinc-700 disabled:opacity-50"
              >
                Generate PDF preview
              </button>
              {previewPdf && (
                <span className="self-center text-[10px] text-emerald-400">
                  PDF ready ({pages.length} page{pages.length === 1 ? "" : "s"})
                </span>
              )}
            </div>

            {previewPdf && (
              <div className="mb-4 overflow-hidden rounded-lg border border-zinc-700 bg-zinc-950">
                <iframe
                  src={previewPdf}
                  title="PDF preview"
                  className="h-48 w-full"
                />
              </div>
            )}

            {error && (
              <p className="mb-3 text-[11px] text-rose-400" role="alert">
                {error}
              </p>
            )}

            <div className="flex justify-end gap-2">
              <button
                type="button"
                onClick={() => setModalOpen(false)}
                className="rounded-lg border border-zinc-700 bg-zinc-800 px-3 py-2 text-xs font-medium text-gray-300 transition-colors hover:bg-zinc-700"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={submitAssignment}
                disabled={!previewPdf || submitting}
                className="inline-flex items-center gap-1.5 rounded-lg bg-indigo-600 px-3 py-2 text-xs font-medium text-white transition-colors hover:bg-indigo-500 disabled:opacity-50"
              >
                {submitting ? "Submitting…" : "Submit to Moodle"}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

export default CourseAssignments;
