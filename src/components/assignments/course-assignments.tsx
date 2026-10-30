"use client";

import { useEffect, useRef, useState } from "react";
import { Camera, Clock, ExternalLink, Plus, X } from "lucide-react";
import { jsPDF } from "jspdf";

import { FIRST_YEAR_SUBJECTS } from "@/lib/subjects";
import { cn } from "@/lib/utils";

type Assignment = {
  id: string;
  title: string;
  course: string;
  dueDate: string; // ISO date
  moodleUrl: string | null;
  createdById: string;
  createdBy: { name: string | null; email: string | null };
  createdAt: string;
};

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

function countdownLabel(date: string): string {
  const remaining = daysUntil(date);
  if (remaining < 0) return "Urgent — Overdue";
  if (remaining === 0) return "Urgent — Due today";
  if (remaining === 1) return "Due in 1 day";
  return `Due in ${remaining} days`;
}

export function CourseAssignments() {
  const [assignments, setAssignments] = useState<Assignment[]>([]);
  const [loadingAssignments, setLoadingAssignments] = useState(true);
  const [activeId, setActiveId] = useState<string | null>(null);
  const [modalOpen, setModalOpen] = useState(false);
  const [addModalOpen, setAddModalOpen] = useState(false);
  const [pages, setPages] = useState<string[]>([]);
  const [previewPdf, setPreviewPdf] = useState<string | null>(null);
  const [cameraActive, setCameraActive] = useState(false);
  const [cameraError, setCameraError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [addForm, setAddForm] = useState({
    title: "",
    course: FIRST_YEAR_SUBJECTS[0].code + " - " + FIRST_YEAR_SUBJECTS[0].title,
    dueDate: "",
    moodleUrl: "",
  });
  const [addError, setAddError] = useState<string | null>(null);

  const videoRef = useRef<HTMLVideoElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const streamRef = useRef<MediaStream | null>(null);

  const activeAssignment = assignments.find((item) => item.id === activeId) ?? null;

  useEffect(() => {
    let cancelled = false;
    async function load() {
      try {
        const response = await fetch("/api/assignments");
        if (!response.ok) throw new Error("load failed");
        const data = (await response.json()) as { assignments?: Assignment[] };
        if (!cancelled && data.assignments) {
          setAssignments(data.assignments);
        }
      } catch {
        // Leave empty; empty state will render.
      } finally {
        if (!cancelled) setLoadingAssignments(false);
      }
    }
    load();
    return () => {
      cancelled = true;
    };
  }, []);

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

  function reorderPages(fromIndex: number, toIndex: number) {
    setPages((current) => {
      const next = [...current];
      const [removed] = next.splice(fromIndex, 1);
      next.splice(toIndex, 0, removed);
      return next;
    });
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
          moodleAssignmentId: activeAssignment.id,
          pdfBase64: base64,
          fileType: "application/pdf",
        }),
      });
      if (!response.ok) throw new Error("Submission failed");

      await response.json();

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

  async function handleAddSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!addForm.title.trim()) {
      setAddError("Title is required.");
      return;
    }
    if (!addForm.dueDate) {
      setAddError("Due date & time is required.");
      return;
    }

    setAddError(null);
    try {
      const response = await fetch("/api/assignments", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          title: addForm.title.trim(),
          course: addForm.course.trim(),
          dueDate: addForm.dueDate,
          moodleUrl: addForm.moodleUrl.trim() || null,
        }),
      });
      if (!response.ok) throw new Error("Create failed");

      const data = (await response.json()) as { assignment: Assignment };
      setAssignments((current) => [data.assignment, ...current]);
      setAddForm({
        title: "",
        course: FIRST_YEAR_SUBJECTS[0].code + " - " + FIRST_YEAR_SUBJECTS[0].title,
        dueDate: "",
        moodleUrl: "",
      });
      setAddModalOpen(false);
    } catch (err) {
      setAddError(err instanceof Error ? err.message : "Failed to create assignment.");
    }
  }

  async function deleteAssignment(id: string) {
    if (!window.confirm("Delete this assignment for the whole batch?")) return;
    try {
      const response = await fetch(`/api/assignments?id=${id}`, { method: "DELETE" });
      if (!response.ok) throw new Error("Delete failed");
      setAssignments((current) => current.filter((item) => item.id !== id));
    } catch {
      setError("Failed to delete assignment.");
    }
  }

  return (
    <div className="w-full space-y-4">
      <div className="flex items-center justify-between gap-3">
        <div>
          <h2 className="text-sm font-semibold tracking-tight text-gray-200">
            First Year CS Assignments
          </h2>
          <p className="text-[11px] text-gray-500">
            Batch-wide assignments for Subjects First Year. Everyone in your
            course sees the same cards.
          </p>
        </div>
        <button
          type="button"
          onClick={() => setAddModalOpen(true)}
          className="inline-flex items-center gap-1.5 rounded-lg bg-indigo-600 px-3 py-1.5 text-xs font-medium text-white transition-colors hover:bg-indigo-500"
        >
          <Plus className="size-3.5" />
          Add Assignment
        </button>
      </div>

      {/* Moodle status bar (auto-connected from signup) */}
      <div className="rounded-xl border border-zinc-800 bg-zinc-900/60 p-3">
        <p className="text-[10px] text-gray-400">
          Moodle token is auto-linked from your signup credentials. Use the
          scanner below to submit handwritten work directly.
        </p>
      </div>

      {loadingAssignments ? (
        <p className="text-xs text-gray-500">Loading assignments…</p>
      ) : assignments.length === 0 ? (
        <div className="flex flex-col items-center gap-2 rounded-2xl border border-dashed border-zinc-800 bg-zinc-900/40 px-6 py-12 text-center">
          <span className="text-2xl">🎉</span>
          <p className="text-xs font-medium text-gray-200">
            No pending assignments for First Year CS.
          </p>
          <button
            type="button"
            onClick={() => setAddModalOpen(true)}
            className="rounded-lg border border-zinc-700 bg-zinc-800 px-3 py-1.5 text-xs font-medium text-gray-300 transition-colors hover:bg-zinc-700"
          >
            + Add Assignment
          </button>
        </div>
      ) : (
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {assignments.map((assignment) => {
            const remaining = daysUntil(assignment.dueDate);
            const isUrgent = remaining <= 1;
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
                    <p className="truncate text-[10px] text-gray-400">
                      By {assignment.createdBy.name ?? assignment.createdBy.email}
                    </p>
                  </div>
                  <span className={cn(
                    "rounded-md px-2 py-0.5 text-[10px] font-medium",
                    remaining < 0
                      ? "bg-rose-500/15 text-rose-400"
                      : isUrgent
                        ? "bg-amber-500/15 text-amber-300"
                        : "bg-emerald-500/15 text-emerald-300",
                  )}>
                    {countdownLabel(assignment.dueDate)}
                  </span>
                </div>

                <div className="mb-3 flex items-center gap-1.5 text-[10px] text-gray-400">
                  <Clock className="size-3" />
                  Due {formatDate(assignment.dueDate)}
                </div>

                {assignment.moodleUrl ? (
                  <a
                    href={assignment.moodleUrl}
                    target="_blank"
                    rel="noreferrer noopener"
                    className="inline-flex items-center gap-1 rounded-lg border border-zinc-700 bg-zinc-800 px-2.5 py-1.5 text-[10px] text-gray-300 transition-colors hover:bg-zinc-700 hover:text-white"
                  >
                    <ExternalLink className="size-3.5" />
                    View on Moodle
                  </a>
                ) : null}

                <div className="mt-auto">
                  <button
                    type="button"
                    onClick={() => openScanner(assignment)}
                    className="w-full inline-flex items-center justify-center gap-1.5 rounded-lg bg-indigo-600 px-3 py-2 text-xs font-medium text-white transition-colors hover:bg-indigo-500"
                  >
                    <Camera className="size-3.5" />
                    Submit via Camera / Scanner
                  </button>
                  {assignment.createdById === undefined || true ? (
                    <button
                      type="button"
                      onClick={() => deleteAssignment(assignment.id)}
                      disabled={remaining < 0 ? false : true}
                      className={cn(
                        "w-full mt-2 rounded-lg border border-zinc-700 bg-zinc-800/50 px-2.5 py-1.5 text-[10px] font-medium text-gray-500 transition-colors hover:bg-zinc-700 hover:text-gray-200",
                        remaining < 0
                          ? "border-rose-500/30 bg-rose-500/10 text-rose-400"
                          : "",
                      )}
                    >
                      Delete batch assignment
                    </button>
                  ) : null}
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Add Assignment modal */}
      {addModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 p-4 backdrop-blur-sm">
          <div className="w-full max-w-md rounded-2xl border border-zinc-800 bg-zinc-900 p-5 shadow-2xl">
            <div className="mb-4 flex items-center justify-between">
              <h3 className="text-sm font-semibold text-gray-200">
                Add batch assignment
              </h3>
              <button
                type="button"
                onClick={() => setAddModalOpen(false)}
                className="text-gray-500 transition-colors hover:text-gray-200"
                aria-label="Close"
              >
                <X className="size-4" />
              </button>
            </div>

            <form onSubmit={handleAddSubmit} className="space-y-3">
              <div className="space-y-1.5">
                <label className="text-[11px] font-medium text-gray-400">
                  Assignment title
                </label>
                <input
                  type="text"
                  value={addForm.title}
                  onChange={(event) =>
                    setAddForm((state) => ({ ...state, title: event.target.value }))
                  }
                  placeholder="e.g. Homework 1"
                  className="h-10 w-full rounded-lg border border-zinc-700 bg-zinc-800 px-3 text-sm text-white placeholder:text-gray-500 focus:border-indigo-500 focus:outline-none"
                  required
                />
              </div>

              <div className="space-y-1.5">
                <label className="text-[11px] font-medium text-gray-400">
                  Course (Subjects First Year)
                </label>
                <select
                  value={addForm.course}
                  onChange={(event) =>
                    setAddForm((state) => ({ ...state, course: event.target.value }))
                  }
                  className="h-10 w-full rounded-lg border border-zinc-700 bg-zinc-800 px-3 text-sm text-white focus:border-indigo-500 focus:outline-none"
                >
                  {FIRST_YEAR_SUBJECTS.map((subject) => (
                    <option
                      key={subject.code}
                      value={`${subject.code} - ${subject.title}`}
                    >
                      {subject.code} - {subject.title}
                    </option>
                  ))}
                </select>
              </div>

              <div className="space-y-1.5">
                <label className="text-[11px] font-medium text-gray-400">
                  Due date & time
                </label>
                <input
                  type="datetime-local"
                  value={addForm.dueDate}
                  onChange={(event) =>
                    setAddForm((state) => ({ ...state, dueDate: event.target.value }))
                  }
                  className="h-10 w-full rounded-lg border border-zinc-700 bg-zinc-800 px-3 text-sm text-white focus:border-indigo-500 focus:outline-none"
                  required
                />
              </div>

              <div className="space-y-1.5">
                <label className="text-[11px] font-medium text-gray-400">
                  Moodle direct URL (optional)
                </label>
                <input
                  type="url"
                  value={addForm.moodleUrl}
                  onChange={(event) =>
                    setAddForm((state) => ({ ...state, moodleUrl: event.target.value }))
                  }
                  placeholder="https://moodle.zewailcity.edu.eg/mod/assign/view.php?id=…"
                  className="h-10 w-full rounded-lg border border-zinc-700 bg-zinc-800 px-3 text-sm text-white placeholder:text-gray-500 focus:border-indigo-500 focus:outline-none"
                />
              </div>

              {addError && (
                <p className="text-[11px] text-rose-400" role="alert">
                  {addError}
                </p>
              )}

              <div className="flex justify-end gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => setAddModalOpen(false)}
                  className="rounded-lg border border-zinc-700 bg-zinc-800 px-3 py-2 text-xs font-medium text-gray-300 transition-colors hover:bg-zinc-700"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="rounded-lg bg-indigo-600 px-3 py-2 text-xs font-medium text-white transition-colors hover:bg-indigo-500"
                >
                  Create assignment
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

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
                      {index > 0 && (
                        <button
                          type="button"
                          onClick={() => reorderPages(index, index - 1)}
                          className="absolute bottom-0.5 left-0.5 rounded bg-black/70 px-1 text-[8px] text-gray-300 hover:text-white"
                          aria-label="Move page up"
                        >
                          ←
                        </button>
                      )}
                      {index < pages.length - 1 && (
                        <button
                          type="button"
                          onClick={() => reorderPages(index, index + 1)}
                          className="absolute bottom-0.5 right-0.5 rounded bg-black/70 px-1 text-[8px] text-gray-300 hover:text-white"
                          aria-label="Move page down"
                        >
                          →
                        </button>
                      )}
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
