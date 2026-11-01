"use client";

import { useEffect, useRef, useState } from "react";
import { Camera, Clock, ExternalLink, Hourglass, Plus, X } from "lucide-react";
import { jsPDF } from "jspdf";

import { FIRST_YEAR_SUBJECTS } from "@/lib/subjects";
import { cn } from "@/lib/utils";
import {
  downscaleImage,
} from "@/lib/browser-store";

const MAX_PAGES = 25;

type Assignment = {
  id: string;
  title: string;
  course: string;
  dueDate: string; // ISO date
  moodleUrl: string | null;
  createdById: string | null;
  createdBy: { name: string | null; email: string | null } | null;
  createdAt: string;
  canDelete: boolean;
};

function countdownLabel(date: string, now: number): string {
  const remaining = new Date(date).getTime() - now;
  if (remaining <= 0) return "Overdue";

  const totalMinutes = Math.floor(remaining / 60000);
  const days = Math.floor(totalMinutes / 1440);
  const hours = Math.floor((totalMinutes % 1440) / 60);
  const minutes = totalMinutes % 60;

  if (days > 0) return `${days}d ${hours}h remaining`;
  if (hours > 0) return `${hours}h ${minutes}m remaining`;
  return `${Math.max(minutes, 1)}m remaining`;
}

function formatDate(date: string): string {
  return new Date(date).toLocaleDateString(undefined, {
    month: "short",
    day: "numeric",
    year: "numeric",
  });
}

export function CourseAssignments() {
  const [assignments, setAssignments] = useState<Assignment[]>([]);
  const [loadingAssignments, setLoadingAssignments] = useState(true);
  const [feedError, setFeedError] = useState<string | null>(null);
  const [page, setPage] = useState(1);
  const [hasMore, setHasMore] = useState(false);
  const [loadingMore, setLoadingMore] = useState(false);
  const [now, setNow] = useState(() => Date.now());
  const [activeId, setActiveId] = useState<string | null>(null);
  const [modalOpen, setModalOpen] = useState(false);
  const [addModalOpen, setAddModalOpen] = useState(false);
  const [pages, setPages] = useState<string[]>([]);
  const [previewPdf, setPreviewPdf] = useState<string | null>(null);
  const [cameraActive, setCameraActive] = useState(false);
  const [cameraError, setCameraError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [addForm, setAddForm] = useState<{
    title: string;
    courseCode: string;
    dueDate: string;
    moodleUrl: string;
  }>({
    title: "",
    courseCode: FIRST_YEAR_SUBJECTS[0].code,
    dueDate: "",
    moodleUrl: "",
  });
  const [addError, setAddError] = useState<string | null>(null);

  const videoRef = useRef<HTMLVideoElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const streamRef = useRef<MediaStream | null>(null);

  const activeAssignment = assignments.find((item) => item.id === activeId) ?? null;

  useEffect(() => {
    const timer = window.setInterval(() => setNow(Date.now()), 60_000);
    return () => window.clearInterval(timer);
  }, []);

  useEffect(() => {
    let cancelled = false;
    async function load() {
      try {
        const response = await fetch("/api/assignments?page=1&pageSize=100");
        if (!response.ok) {
          const data = (await response.json()) as { error?: string };
          throw new Error(data.error ?? "Could not load assignments.");
        }
        const data = (await response.json()) as {
          assignments?: Assignment[];
          hasMore?: boolean;
        };
        if (!cancelled && data.assignments) {
          setAssignments(data.assignments);
          setHasMore(Boolean(data.hasMore));
          setPage(1);
        }
      } catch (err) {
        if (!cancelled) {
          setFeedError(
            err instanceof Error ? err.message : "Could not load assignments.",
          );
        }
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

  async function snapPhoto() {
    if (pages.length >= MAX_PAGES) {
      setError(`You can attach up to ${MAX_PAGES} pages per submission.`);
      return;
    }
    const video = videoRef.current;
    const canvas = canvasRef.current;
    if (!video || !canvas) return;
    canvas.width = video.videoWidth || 640;
    canvas.height = video.videoHeight || 480;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;
    ctx.drawImage(video, 0, 0, canvas.width, canvas.height);
    const data = await downscaleImage(canvas.toDataURL("image/jpeg", 0.9));
    setPages((current) =>
      current.length >= MAX_PAGES ? current : [...current, data],
    );
    setPreviewPdf(null);
  }

  async function handleFileChange(event: React.ChangeEvent<HTMLInputElement>) {
    const files = Array.from(event.target.files ?? []);
    if (files.length === 0) return;
    event.target.value = "";
    try {
      const images = await Promise.all(
        files.map(
          (file) =>
            new Promise<string>((resolve, reject) => {
              const reader = new FileReader();
              reader.onload = async () => {
                if (typeof reader.result !== "string") {
                  reject(new Error(`Could not read ${file.name}.`));
                  return;
                }
                resolve(
                  file.type.startsWith("image/")
                    ? await downscaleImage(reader.result)
                    : reader.result,
                );
              };
              reader.onerror = () => reject(new Error(`Could not read ${file.name}.`));
              reader.readAsDataURL(file);
            }),
        ),
      );
      setPages((current) => {
        const merged = [...current, ...images];
        if (merged.length > MAX_PAGES) {
          setError(`Only the first ${MAX_PAGES} pages are kept.`);
        }
        return merged.slice(0, MAX_PAGES);
      });
      setPreviewPdf(null);
      if (images.length + pages.length <= MAX_PAGES) setError(null);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not read selected pages.");
    }
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
      const pdf = new jsPDF({
        orientation: "portrait",
        unit: "mm",
        format: "a4",
        compress: true,
      });
      const pageWidth = pdf.internal.pageSize.getWidth();
      const pageHeight = pdf.internal.pageSize.getHeight();
      const margin = 10;
      const maxWidth = pageWidth - margin * 2;
      const maxHeight = pageHeight - margin * 2;

      pages.forEach((page, index) => {
        if (index > 0) pdf.addPage();
        const props = pdf.getImageProperties(page);
        const ratio = Math.min(maxWidth / props.width, maxHeight / props.height);
        const width = props.width * ratio;
        const height = props.height * ratio;
        pdf.addImage(
          page,
          "JPEG",
          (pageWidth - width) / 2,
          margin,
          width,
          height,
          undefined,
          "FAST",
        );
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
      if (!response.ok) {
        const payload = (await response.json().catch(() => null)) as
          | { error?: string }
          | null;
        throw new Error(payload?.error ?? "Submission failed");
      }

      await response.json();

      try {
        await fetch("/api/study-materials", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            title: `${activeAssignment.title} (Submitted)`,
            course: activeAssignment.course,
            category: "Assignment",
            privacy: "private",
            fileData: previewPdf,
            fileType: "application/pdf",
          }),
        });
      } catch {
        // The submission already succeeded; the vault copy is best-effort.
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

  async function loadMoreAssignments() {
    if (loadingMore || !hasMore) return;
    setLoadingMore(true);
    const nextPage = page + 1;
    try {
      const response = await fetch(
        `/api/assignments?page=${nextPage}&pageSize=100`,
      );
      if (!response.ok) {
        const payload = (await response.json().catch(() => null)) as
          | { error?: string }
          | null;
        throw new Error(payload?.error ?? "Could not load more assignments.");
      }

      const data = (await response.json()) as {
        assignments?: Assignment[];
        hasMore?: boolean;
      };

      setAssignments((current) => {
        const seen = new Set(current.map((item) => item.id));
        return [
          ...current,
          ...(data.assignments ?? []).filter((item) => !seen.has(item.id)),
        ].sort(
          (left, right) =>
            new Date(left.dueDate).getTime() - new Date(right.dueDate).getTime(),
        );
      });
      setPage(nextPage);
      setHasMore(Boolean(data.hasMore));
      setFeedError(null);
    } catch (err) {
      setFeedError(
        err instanceof Error ? err.message : "Could not load more assignments.",
      );
    } finally {
      setLoadingMore(false);
    }
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
          courseCode: addForm.courseCode,
          dueDate: new Date(addForm.dueDate).toISOString(),
          moodleUrl: addForm.moodleUrl.trim() || null,
        }),
      });
      if (!response.ok) {
        const data = (await response.json()) as { error?: string };
        throw new Error(data.error ?? "Could not create assignment.");
      }

      const data = (await response.json()) as { assignment: Assignment };
      setAssignments((current) =>
        [data.assignment, ...current].sort(
          (left, right) =>
            new Date(left.dueDate).getTime() - new Date(right.dueDate).getTime(),
        ),
      );
      setAddForm({
        title: "",
        courseCode: FIRST_YEAR_SUBJECTS[0].code,
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
      if (!response.ok) {
        const data = (await response.json()) as { error?: string };
        throw new Error(data.error ?? "Could not delete assignment.");
      }
      setAssignments((current) => current.filter((item) => item.id !== id));
      setFeedError(null);
    } catch (err) {
      setFeedError(err instanceof Error ? err.message : "Could not delete assignment.");
    }
  }

  return (
    <div className="w-full space-y-4">
      <div className="flex items-center justify-between gap-3">
        <div>
          <h2 className="text-sm font-semibold tracking-tight text-gray-200">
            CS 1st Year Batch Assignments Feed
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
          Add CS Assignment
        </button>
      </div>

      {/* Moodle status bar (auto-connected from signup) */}
      <div className="rounded-xl border border-zinc-800 bg-zinc-900/60 p-3">
        <p className="text-[10px] text-gray-400">
          Moodle token is auto-linked from your signup credentials. Use the
          scanner below to submit handwritten work directly.
        </p>
      </div>

      {feedError && (
        <p className="text-xs text-rose-400" role="alert">
          {feedError}
        </p>
      )}

      {loadingAssignments ? (
        <p className="text-xs text-gray-500">Loading assignments…</p>
      ) : feedError && assignments.length === 0 ? (
        <p className="text-xs text-gray-400">
          The shared feed is unavailable. Refresh the page to try again.
        </p>
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
            + Add CS Assignment
          </button>
        </div>
      ) : (
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {assignments.map((assignment) => {
            const isOverdue = new Date(assignment.dueDate).getTime() <= now;
            const courseCode = (assignment.course ?? "").split(" - ")[0] || "CS";
            return (
              <div
                key={assignment.id}
                className="flex flex-col rounded-xl border border-zinc-800 bg-zinc-900/70 p-4"
              >
                <div className="mb-2 flex items-start justify-between gap-2">
                  <div className="min-w-0">
                    <span className="mb-1 inline-flex rounded-md border border-sky-400/20 bg-sky-400/10 px-2 py-0.5 text-[10px] font-semibold text-sky-300">
                      {courseCode}
                    </span>
                    <p className="truncate text-sm font-medium text-gray-100">
                      {assignment.title}
                    </p>
                    {assignment.createdBy && (
                      <p className="truncate text-[10px] text-gray-500">
                        Added by {assignment.createdBy.name ?? assignment.createdBy.email}
                      </p>
                    )}
                  </div>
                </div>

                <div
                  className={cn(
                    "mb-3 flex items-center gap-2 rounded-lg border px-2.5 py-2",
                    isOverdue
                      ? "border-rose-400/20 bg-rose-400/5 text-rose-300"
                      : "border-sky-400/20 bg-sky-400/5 text-sky-200",
                  )}
                  aria-label={`Time remaining: ${countdownLabel(assignment.dueDate, now)}`}
                >
                  <Hourglass className="size-3.5 shrink-0" aria-hidden="true" />
                  <span className="text-[10px] font-medium">Time remaining</span>
                  <span className="ml-auto text-[10px] tabular-nums">
                    {countdownLabel(assignment.dueDate, now)}
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
                    Open in Moodle
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
                  {assignment.canDelete ? (
                    <button
                      type="button"
                      onClick={() => deleteAssignment(assignment.id)}
                      className={cn(
                        "w-full mt-2 rounded-lg border border-zinc-700 bg-zinc-800/50 px-2.5 py-1.5 text-[10px] font-medium text-gray-500 transition-colors hover:bg-zinc-700 hover:text-gray-200",
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

      {!loadingAssignments && assignments.length > 0 && hasMore ? (
        <div className="flex justify-center">
          <button
            type="button"
            onClick={loadMoreAssignments}
            disabled={loadingMore}
            className="rounded-lg border border-zinc-700 bg-zinc-800 px-4 py-2 text-xs font-medium text-gray-300 transition-colors hover:bg-zinc-700 disabled:opacity-50"
          >
            {loadingMore ? "Loading…" : "Load more assignments"}
          </button>
        </div>
      ) : null}

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
                  value={addForm.courseCode}
                  onChange={(event) =>
                    setAddForm((state) => ({ ...state, courseCode: event.target.value }))
                  }
                  className="h-10 w-full rounded-lg border border-zinc-700 bg-zinc-800 px-3 text-sm text-white focus:border-indigo-500 focus:outline-none"
                >
                  {FIRST_YEAR_SUBJECTS.map((subject) => (
                    <option
                      key={subject.code}
                      value={subject.code}
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
                    accept="image/jpeg,image/png"
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

            <div className="flex flex-wrap justify-end gap-2">
              {previewPdf && (
                <a
                  href={previewPdf}
                  download={`${activeAssignment.title.replace(/[^\w.-]+/g, "-")}.pdf`}
                  className="inline-flex items-center gap-1.5 rounded-lg border border-zinc-700 bg-zinc-800 px-3 py-2 text-xs font-medium text-gray-200 transition-colors hover:bg-zinc-700"
                >
                  Download PDF
                </a>
              )}
              {activeAssignment.moodleUrl && (
                <a
                  href={activeAssignment.moodleUrl}
                  target="_blank"
                  rel="noreferrer noopener"
                  className="inline-flex items-center gap-1.5 rounded-lg border border-sky-400/30 bg-sky-400/10 px-3 py-2 text-xs font-medium text-sky-200 transition-colors hover:bg-sky-400/20"
                >
                  <ExternalLink className="size-3.5" />
                  Go to Moodle Submission Page
                </a>
              )}
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
