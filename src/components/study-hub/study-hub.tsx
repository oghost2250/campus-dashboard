"use client";

import { useEffect, useRef, useState } from "react";
import { Camera, FileText, Image as ImageIcon, Plus, X } from "lucide-react";

import { FIRST_YEAR_SUBJECTS } from "@/lib/subjects";
import {
  downscaleImage,
  loadPersisted,
  savePersisted,
} from "@/lib/browser-store";

type Privacy = "private" | "public";
type Category = "Lecture Notes" | "Past Exam" | "Summary" | "Assignment";
type Material = {
  id: string;
  title: string;
  course: string;
  category: Category;
  privacy: Privacy;
  fileData: string;
  fileType: string;
  owner: string;
  createdAt: number;
};

const STORAGE_KEY = "campus-study-hub";
const CURRENT_USER = "You";

const SEED_MATERIALS: Material[] = [
  {
    id: "seed-1",
    title: "Digital Logic - Lecture 3 (Combinational Circuits)",
    course: "CSAI 112 - Digital Logic",
    category: "Lecture Notes",
    privacy: "public",
    fileData:
      "https://images.unsplash.com/photo-1515879218367-8466d910aaa4?w=900",
    fileType: "image/jpeg",
    owner: "Layla H.",
    createdAt: Date.now() - 86400000 * 3,
  },
  {
    id: "seed-2",
    title: "Calculus Midterm 2024 (Solved)",
    course: "MATH 103 - Calculus for Computing",
    category: "Past Exam",
    privacy: "public",
    fileData:
      "https://images.unsplash.com/photo-1635070041078-e363dbe005cb?w=900",
    fileType: "image/jpeg",
    owner: "Omar T.",
    createdAt: Date.now() - 86400000 * 5,
  },
];

const CATEGORIES: Category[] = [
  "Lecture Notes",
  "Past Exam",
  "Summary",
  "Assignment",
];

function isImage(type: string) {
  return type.startsWith("image/");
}

export function StudyHub() {
  const [materials, setMaterials] = useState<Material[]>(SEED_MATERIALS);
  const [selectedCourse, setSelectedCourse] = useState<string>(
    FIRST_YEAR_SUBJECTS[0].code + " - " + FIRST_YEAR_SUBJECTS[0].title,
  );
  const [tab, setTab] = useState<"vault" | "community">("vault");
  const [modalOpen, setModalOpen] = useState(false);
  const [mode, setMode] = useState<"upload" | "camera">("upload");
  const [form, setForm] = useState({
    title: "",
    course: FIRST_YEAR_SUBJECTS[0].code + " - " + FIRST_YEAR_SUBJECTS[0].title,
    category: "Lecture Notes" as Category,
    privacy: "private" as Privacy,
  });
  const [fileData, setFileData] = useState<string | null>(null);
  const [fileType, setFileType] = useState<string>("");
  const [cameraActive, setCameraActive] = useState(false);
  const [cameraError, setCameraError] = useState<string | null>(null);
  const [viewing, setViewing] = useState<Material | null>(null);
  const [error, setError] = useState<string | null>(null);

  const videoRef = useRef<HTMLVideoElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const streamRef = useRef<MediaStream | null>(null);

  // Load persisted uploads from IndexedDB (migrates legacy localStorage).
  useEffect(() => {
    let cancelled = false;
    (async () => {
      const parsed = await loadPersisted<Material[]>(STORAGE_KEY);
      if (!cancelled && Array.isArray(parsed)) {
        setMaterials([...SEED_MATERIALS, ...parsed]);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  // Persist user uploads (debounced so scans do not rewrite on every render).
  useEffect(() => {
    const userUploads = materials.filter(
      (material) => !SEED_MATERIALS.some((seed) => seed.id === material.id),
    );

    const timer = window.setTimeout(async () => {
      const saved = await savePersisted(STORAGE_KEY, userUploads);
      if (!saved) {
        setError(
          "Local storage is full. Remove a few saved materials to free space.",
        );
      }
    }, 400);

    return () => window.clearTimeout(timer);
  }, [materials]);

  // Camera lifecycle
  useEffect(() => {
    if (!modalOpen || mode !== "camera") {
      stopCamera();
      return;
    }
    startCamera();
    return () => stopCamera();
  }, [modalOpen, mode]);

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
        err instanceof Error
          ? err.message
          : "Camera access denied or unavailable.",
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
    const video = videoRef.current;
    const canvas = canvasRef.current;
    if (!video || !canvas) return;
    canvas.width = video.videoWidth || 640;
    canvas.height = video.videoHeight || 480;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;
    ctx.drawImage(video, 0, 0, canvas.width, canvas.height);
    const data = await downscaleImage(canvas.toDataURL("image/jpeg", 0.9));
    setFileData(data);
    setFileType("image/jpeg");
    stopCamera();
  }

  function handleFileChange(event: React.ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0];
    if (!file) return;
    if (file.size > 8 * 1024 * 1024) {
      setError("File is too large (max 8 MB).");
      return;
    }
    const reader = new FileReader();
    reader.onload = async () => {
      const raw = reader.result as string;
      const data = file.type.startsWith("image/")
        ? await downscaleImage(raw)
        : raw;
      setFileData(data);
      setFileType(file.type || "application/octet-stream");
      setError(null);
    };
    reader.onerror = () => setError("Could not read the file.");
    reader.readAsDataURL(file);
  }

  function resetModal() {
    setModalOpen(false);
    setMode("upload");
    setForm({
      title: "",
      course: selectedCourse,
      category: "Lecture Notes",
      privacy: "private",
    });
    setFileData(null);
    setFileType("");
    setError(null);
    stopCamera();
  }

  function openModal() {
    setForm({
      title: "",
      course: selectedCourse,
      category: "Lecture Notes",
      privacy: "private",
    });
    setFileData(null);
    setFileType("");
    setError(null);
    setMode("upload");
    setModalOpen(true);
  }

  function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!form.title.trim()) {
      setError("Title is required.");
      return;
    }
    if (!fileData) {
      setError("Please upload a file or capture a photo.");
      return;
    }

    const material: Material = {
      id: `mat-${Date.now()}`,
      title: form.title.trim(),
      course: form.course,
      category: form.category,
      privacy: form.privacy,
      fileData,
      fileType,
      owner: CURRENT_USER,
      createdAt: Date.now(),
    };

    setMaterials((current) => [material, ...current]);
    resetModal();
  }

  const courseMaterials = materials.filter(
    (material) => material.course === selectedCourse,
  );

  const vaultMaterials = courseMaterials.filter(
    (material) => material.owner === CURRENT_USER,
  );
  const communityMaterials = courseMaterials.filter(
    (material) => material.privacy === "public",
  );

  const visibleMaterials =
    tab === "vault" ? vaultMaterials : communityMaterials;

  return (
    <div className="w-full space-y-4">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h2 className="text-sm font-semibold tracking-tight text-gray-200">
            Study Hub
          </h2>
          <p className="text-[11px] text-gray-500">
            Upload notes, scan documents, and share with your course.
          </p>
        </div>
        <button
          type="button"
          onClick={openModal}
          className="inline-flex items-center gap-1.5 rounded-lg bg-indigo-600 px-3 py-1.5 text-xs font-medium text-white transition-colors hover:bg-indigo-500"
        >
          <Plus className="size-3.5" />
          Add material
        </button>
      </div>

      {/* Course selector */}
      <div className="flex flex-wrap gap-2">
        {FIRST_YEAR_SUBJECTS.map((subject) => {
          const value = `${subject.code} - ${subject.title}`;
          const active = selectedCourse === value;
          return (
            <button
              key={value}
              type="button"
              onClick={() => setSelectedCourse(value)}
              className={[
                "rounded-lg border px-3 py-1.5 text-[11px] font-medium transition-colors",
                active
                  ? "border-indigo-500/40 bg-indigo-500/10 text-indigo-300"
                  : "border-zinc-800 bg-zinc-900/60 text-gray-400 hover:border-zinc-700 hover:text-gray-200",
              ].join(" ")}
            >
              {subject.code}
            </button>
          );
        })}
      </div>

      {/* Tabs */}
      <div className="flex gap-1 rounded-lg border border-zinc-800 bg-zinc-900/60 p-1">
        {[
          { id: "vault", label: "My Vault" },
          { id: "community", label: "Community Hub" },
        ].map((item) => (
          <button
            key={item.id}
            type="button"
            onClick={() => setTab(item.id as "vault" | "community")}
            className={[
              "flex-1 rounded-md px-3 py-1.5 text-xs font-medium transition-colors",
              tab === item.id
                ? "bg-zinc-800 text-white"
                : "text-gray-400 hover:text-gray-200",
            ].join(" ")}
          >
            {item.label}
          </button>
        ))}
      </div>

      {/* Materials grid */}
      {visibleMaterials.length === 0 ? (
        <div className="flex flex-col items-center gap-2 rounded-2xl border border-dashed border-zinc-800 bg-zinc-900/40 px-6 py-12 text-center">
          <FileText className="size-5 text-gray-500" />
          <p className="text-xs text-gray-500">
            {tab === "vault"
              ? "No materials in your vault yet. Add one to get started."
              : "No community materials shared for this course yet."}
          </p>
        </div>
      ) : (
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {visibleMaterials.map((material) => (
            <button
              key={material.id}
              type="button"
              onClick={() => setViewing(material)}
              className="group flex flex-col overflow-hidden rounded-xl border border-zinc-800 bg-zinc-900/70 text-left transition-colors hover:border-indigo-500/40"
            >
              <div className="relative h-32 w-full overflow-hidden bg-zinc-950">
                {isImage(material.fileType) ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img
                    src={material.fileData}
                    alt={material.title}
                    className="h-full w-full object-cover transition-transform group-hover:scale-105"
                  />
                ) : (
                  <div className="flex h-full w-full items-center justify-center">
                    <FileText className="size-8 text-gray-600" />
                  </div>
                )}
                <span
                  className={[
                    "absolute right-2 top-2 rounded-md px-1.5 py-0.5 text-[9px] font-medium",
                    material.privacy === "public"
                      ? "bg-emerald-500/20 text-emerald-300"
                      : "bg-zinc-700/80 text-gray-300",
                  ].join(" ")}
                >
                  {material.privacy === "public" ? "Public" : "Private"}
                </span>
              </div>
              <div className="space-y-1 p-3">
                <p className="truncate text-xs font-medium text-gray-200">
                  {material.title}
                </p>
                <p className="truncate text-[10px] text-gray-500">
                  {material.category} · {material.owner}
                </p>
              </div>
            </button>
          ))}
        </div>
      )}

      {/* Upload / Camera modal */}
      {modalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 p-4 backdrop-blur-sm">
          <div className="w-full max-w-lg rounded-2xl border border-zinc-800 bg-zinc-900 p-5 shadow-2xl">
            <div className="mb-4 flex items-center justify-between">
              <h3 className="text-sm font-semibold text-gray-200">
                Add study material
              </h3>
              <button
                type="button"
                onClick={resetModal}
                className="text-gray-500 transition-colors hover:text-gray-200"
                aria-label="Close"
              >
                <X className="size-4" />
              </button>
            </div>

            {/* Mode toggle */}
            <div className="mb-4 flex gap-1 rounded-lg border border-zinc-800 bg-zinc-950 p-1">
              {[
                { id: "upload", label: "Upload file", icon: ImageIcon },
                { id: "camera", label: "Live camera scan", icon: Camera },
              ].map((item) => {
                const Icon = item.icon;
                return (
                  <button
                    key={item.id}
                    type="button"
                    onClick={() => setMode(item.id as "upload" | "camera")}
                    className={[
                      "flex flex-1 items-center justify-center gap-1.5 rounded-md px-3 py-1.5 text-xs font-medium transition-colors",
                      mode === item.id
                        ? "bg-zinc-800 text-white"
                        : "text-gray-400 hover:text-gray-200",
                    ].join(" ")}
                  >
                    <Icon className="size-3.5" />
                    {item.label}
                  </button>
                );
              })}
            </div>

            <form onSubmit={handleSubmit} className="space-y-3">
              <div className="space-y-1.5">
                <label className="text-[11px] font-medium text-gray-400">
                  Material title
                </label>
                <input
                  type="text"
                  value={form.title}
                  onChange={(event) =>
                    setForm((state) => ({ ...state, title: event.target.value }))
                  }
                  placeholder="e.g. Lecture 3 notes"
                  className="h-10 w-full rounded-lg border border-zinc-700 bg-zinc-800 px-3 text-sm text-white placeholder:text-gray-500 focus:border-indigo-500 focus:outline-none"
                  required
                />
              </div>

              <div className="space-y-1.5">
                <label className="text-[11px] font-medium text-gray-400">
                  Course
                </label>
                <select
                  value={form.course}
                  onChange={(event) =>
                    setForm((state) => ({ ...state, course: event.target.value }))
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

              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1.5">
                  <label className="text-[11px] font-medium text-gray-400">
                    Category
                  </label>
                  <select
                    value={form.category}
                    onChange={(event) =>
                      setForm((state) => ({
                        ...state,
                        category: event.target.value as Category,
                      }))
                    }
                    className="h-10 w-full rounded-lg border border-zinc-700 bg-zinc-800 px-3 text-sm text-white focus:border-indigo-500 focus:outline-none"
                  >
                    {CATEGORIES.map((category) => (
                      <option key={category} value={category}>
                        {category}
                      </option>
                    ))}
                  </select>
                </div>
                <div className="space-y-1.5">
                  <label className="text-[11px] font-medium text-gray-400">
                    Privacy
                  </label>
                  <select
                    value={form.privacy}
                    onChange={(event) =>
                      setForm((state) => ({
                        ...state,
                        privacy: event.target.value as Privacy,
                      }))
                    }
                    className="h-10 w-full rounded-lg border border-zinc-700 bg-zinc-800 px-3 text-sm text-white focus:border-indigo-500 focus:outline-none"
                  >
                    <option value="private">Private (My Vault)</option>
                    <option value="public">Public (Community Hub)</option>
                  </select>
                </div>
              </div>

              {/* Upload mode */}
              {mode === "upload" && (
                <div className="space-y-1.5">
                  <label className="text-[11px] font-medium text-gray-400">
                    File (PDF or image, max 8 MB)
                  </label>
                  <input
                    type="file"
                    accept="application/pdf,image/*"
                    onChange={handleFileChange}
                    className="block w-full text-xs text-gray-400 file:mr-3 file:rounded-md file:border-0 file:bg-zinc-800 file:px-3 file:py-1.5 file:text-xs file:font-medium file:text-gray-200 hover:file:bg-zinc-700"
                  />
                  {fileData && (
                    <p className="text-[10px] text-emerald-400">
                      File ready ({fileType || "unknown"})
                    </p>
                  )}
                </div>
              )}

              {/* Camera mode */}
              {mode === "camera" && (
                <div className="space-y-2">
                  <div className="relative overflow-hidden rounded-lg border border-zinc-700 bg-black">
                    <video
                      ref={videoRef}
                      playsInline
                      muted
                      className="h-48 w-full object-cover"
                    />
                    {!cameraActive && (
                      <div className="absolute inset-0 flex items-center justify-center text-xs text-gray-500">
                        {cameraError ?? "Starting camera…"}
                      </div>
                    )}
                  </div>
                  <canvas ref={canvasRef} className="hidden" />
                  <div className="flex gap-2">
                    <button
                      type="button"
                      onClick={snapPhoto}
                      disabled={!cameraActive}
                      className="flex-1 rounded-lg bg-indigo-600 px-3 py-2 text-xs font-medium text-white transition-colors hover:bg-indigo-500 disabled:opacity-50"
                    >
                      Snap photo
                    </button>
                    {fileData && (
                      <span className="self-center text-[10px] text-emerald-400">
                        Photo captured
                      </span>
                    )}
                  </div>
                  <input
                    type="file"
                    accept="image/*"
                    capture="environment"
                    onChange={handleFileChange}
                    className="block w-full text-xs text-gray-400 file:mr-3 file:rounded-md file:border-0 file:bg-zinc-800 file:px-3 file:py-1.5 file:text-xs file:font-medium file:text-gray-200 hover:file:bg-zinc-700"
                  />
                  <p className="text-[10px] text-gray-500">
                    Fallback: use the file picker above if the live camera is
                    unavailable.
                  </p>
                </div>
              )}

              {error && (
                <p className="text-[11px] text-rose-400" role="alert">
                  {error}
                </p>
              )}

              <div className="flex justify-end gap-2 pt-2">
                <button
                  type="button"
                  onClick={resetModal}
                  className="rounded-lg border border-zinc-700 bg-zinc-800 px-3 py-2 text-xs font-medium text-gray-300 transition-colors hover:bg-zinc-700"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="rounded-lg bg-indigo-600 px-3 py-2 text-xs font-medium text-white transition-colors hover:bg-indigo-500"
                >
                  Save material
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Viewer lightbox */}
      {viewing && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 p-4 backdrop-blur-sm">
          <div className="relative w-full max-w-4xl">
            <button
              type="button"
              onClick={() => setViewing(null)}
              className="absolute -top-10 right-0 text-gray-400 transition-colors hover:text-white"
              aria-label="Close viewer"
            >
              <X className="size-5" />
            </button>
            <div className="overflow-hidden rounded-2xl border border-zinc-800 bg-zinc-950">
              {isImage(viewing.fileType) ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img
                  src={viewing.fileData}
                  alt={viewing.title}
                  className="max-h-[80vh] w-full object-contain"
                />
              ) : (
                <iframe
                  src={viewing.fileData}
                  title={viewing.title}
                  className="h-[80vh] w-full"
                />
              )}
            </div>
            <p className="mt-2 text-xs text-gray-400">{viewing.title}</p>
          </div>
        </div>
      )}
    </div>
  );
}

export default StudyHub;
