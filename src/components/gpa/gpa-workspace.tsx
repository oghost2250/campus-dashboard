"use client";

import { useEffect, useMemo, useState } from "react";
import { AnimatePresence, motion } from "framer-motion";
import {
  AlertTriangle,
  Calculator,
  Check,
  GraduationCap,
  Loader2,
  MoreHorizontal,
  Pencil,
  Plus,
  Target,
  Trash2,
  TrendingUp,
} from "lucide-react";
import { toast } from "sonner";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Progress } from "@/components/ui/progress";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { useI18n } from "@/i18n/provider";
import { computeCourseStats, computeGpa, gradeScale } from "@/lib/gpa";
import { toDateInputValue } from "@/lib/format";
import type { AssessmentDTO, CourseDTO } from "@/lib/types";
import type { AssessmentType } from "@/lib/validations/course";
import { cn } from "@/lib/utils";

const courseColors = [
  "#6366f1",
  "#0ea5e9",
  "#10b981",
  "#f59e0b",
  "#ef4444",
  "#ec4899",
  "#8b5cf6",
  "#14b8a6",
];

type CourseForm = {
  name: string;
  code: string;
  credits: string;
  targetGrade: string;
  color: string;
};

const emptyCourseForm: CourseForm = {
  name: "",
  code: "",
  credits: "3",
  targetGrade: "none",
  color: "#6366f1",
};

type AssessmentForm = {
  name: string;
  type: AssessmentType;
  weight: string;
  score: string;
  maxScore: string;
  dueDate: string;
};

const emptyAssessmentForm: AssessmentForm = {
  name: "",
  type: "MIDTERM",
  weight: "20",
  score: "",
  maxScore: "100",
  dueDate: "",
};

function percent(value: number | null, digits = 1) {
  if (value === null || !Number.isFinite(value)) return "—";
  return `${value.toFixed(digits).replace(/\.0$/, "")}%`;
}

export function GpaWorkspace({ initialCourses }: { initialCourses: CourseDTO[] }) {
  const { t } = useI18n();

  const [courses, setCourses] = useState(initialCourses);

  const [courseOpen, setCourseOpen] = useState(false);
  const [editingCourse, setEditingCourse] = useState<CourseDTO | null>(null);
  const [courseForm, setCourseForm] = useState<CourseForm>(emptyCourseForm);
  const [savingCourse, setSavingCourse] = useState(false);

  const [assessmentOpen, setAssessmentOpen] = useState(false);
  const [assessmentCourseId, setAssessmentCourseId] = useState<string | null>(
    null,
  );
  const [editingAssessment, setEditingAssessment] =
    useState<AssessmentDTO | null>(null);
  const [assessmentForm, setAssessmentForm] = useState<AssessmentForm>(
    emptyAssessmentForm,
  );
  const [savingAssessment, setSavingAssessment] = useState(false);

  const [deleteCourse, setDeleteCourse] = useState<CourseDTO | null>(null);
  const [deleteAssessment, setDeleteAssessment] = useState<{
    courseId: string;
    assessment: AssessmentDTO;
  } | null>(null);

  useEffect(() => setCourses(initialCourses), [initialCourses]);

  const typeLabels: Record<AssessmentType, string> = {
    QUIZ: t.gpa.typeQuiz,
    ASSIGNMENT: t.gpa.typeAssignment,
    LAB: t.gpa.typeLab,
    MIDTERM: t.gpa.typeMidterm,
    FINAL: t.gpa.typeFinal,
    PROJECT: t.gpa.typeProject,
    OTHER: t.gpa.typeOther,
  };

  const overall = useMemo(
    () =>
      computeGpa(
        courses.map((course) => ({
          credits: course.credits,
          stats: computeCourseStats(course.assessments, course.targetGrade),
        })),
      ),
    [courses],
  );

  function openCreateCourse() {
    setEditingCourse(null);
    setCourseForm({
      ...emptyCourseForm,
      color: courseColors[courses.length % courseColors.length],
    });
    setCourseOpen(true);
  }

  function openEditCourse(course: CourseDTO) {
    setEditingCourse(course);
    setCourseForm({
      name: course.name,
      code: course.code ?? "",
      credits: String(course.credits),
      targetGrade: course.targetGrade ?? "none",
      color: course.color,
    });
    setCourseOpen(true);
  }

  async function saveCourse(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!courseForm.name.trim()) return;

    setSavingCourse(true);
    const payload = {
      name: courseForm.name.trim(),
      code: courseForm.code.trim() || null,
      credits: Number(courseForm.credits) || 0,
      targetGrade:
        courseForm.targetGrade === "none" ? null : courseForm.targetGrade,
      color: courseForm.color,
    };

    try {
      const response = await fetch(
        editingCourse ? `/api/courses/${editingCourse.id}` : "/api/courses",
        {
          method: editingCourse ? "PATCH" : "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(payload),
        },
      );
      if (!response.ok) throw new Error("request failed");

      const data = (await response.json()) as { course: CourseDTO };
      setCourses((current) =>
        editingCourse
          ? current.map((item) =>
              item.id === data.course.id ? data.course : item,
            )
          : [...current, data.course],
      );

      toast.success(t.gpa.courseSaved);
      setCourseOpen(false);
    } catch {
      toast.error(t.common.error);
    } finally {
      setSavingCourse(false);
    }
  }

  function openCreateAssessment(course: CourseDTO) {
    setAssessmentCourseId(course.id);
    setEditingAssessment(null);
    const used = course.assessments.reduce(
      (sum, item) => sum + item.weight,
      0,
    );
    setAssessmentForm({
      ...emptyAssessmentForm,
      weight: String(Math.max(0, Math.min(100, 100 - used)) || 20),
    });
    setAssessmentOpen(true);
  }

  function openEditAssessment(courseId: string, assessment: AssessmentDTO) {
    setAssessmentCourseId(courseId);
    setEditingAssessment(assessment);
    setAssessmentForm({
      name: assessment.name,
      type: assessment.type,
      weight: String(assessment.weight),
      score: assessment.score === null ? "" : String(assessment.score),
      maxScore: String(assessment.maxScore ?? 100),
      dueDate: toDateInputValue(assessment.dueDate),
    });
    setAssessmentOpen(true);
  }

  async function saveAssessment(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!assessmentCourseId || !assessmentForm.name.trim()) return;

    setSavingAssessment(true);
    const payload = {
      name: assessmentForm.name.trim(),
      type: assessmentForm.type,
      weight: Number(assessmentForm.weight) || 0,
      score:
        assessmentForm.score.trim() === ""
          ? null
          : Number(assessmentForm.score),
      maxScore:
        assessmentForm.maxScore.trim() === ""
          ? 100
          : Number(assessmentForm.maxScore),
      dueDate: assessmentForm.dueDate || null,
    };

    try {
      const response = await fetch(
        editingAssessment
          ? `/api/assessments/${editingAssessment.id}`
          : `/api/courses/${assessmentCourseId}/assessments`,
        {
          method: editingAssessment ? "PATCH" : "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(payload),
        },
      );
      if (!response.ok) throw new Error("request failed");

      const data = (await response.json()) as { assessment: AssessmentDTO };

      setCourses((current) =>
        current.map((course) => {
          if (course.id !== assessmentCourseId) return course;
          return {
            ...course,
            assessments: editingAssessment
              ? course.assessments.map((item) =>
                  item.id === data.assessment.id ? data.assessment : item,
                )
              : [...course.assessments, data.assessment],
          };
        }),
      );

      toast.success(t.gpa.assessmentSaved);
      setAssessmentOpen(false);
    } catch {
      toast.error(t.common.error);
    } finally {
      setSavingAssessment(false);
    }
  }

  async function confirmDeleteCourse() {
    if (!deleteCourse) return;
    const target = deleteCourse;
    setDeleteCourse(null);
    const snapshot = courses;

    setCourses((current) => current.filter((item) => item.id !== target.id));

    try {
      const response = await fetch(`/api/courses/${target.id}`, {
        method: "DELETE",
      });
      if (!response.ok) throw new Error("request failed");
      toast.success(t.gpa.courseDeleted);
    } catch {
      setCourses(snapshot);
      toast.error(t.common.error);
    }
  }

  async function confirmDeleteAssessment() {
    if (!deleteAssessment) return;
    const { courseId, assessment } = deleteAssessment;
    setDeleteAssessment(null);
    const snapshot = courses;

    setCourses((current) =>
      current.map((course) =>
        course.id === courseId
          ? {
              ...course,
              assessments: course.assessments.filter(
                (item) => item.id !== assessment.id,
              ),
            }
          : course,
      ),
    );

    try {
      const response = await fetch(`/api/assessments/${assessment.id}`, {
        method: "DELETE",
      });
      if (!response.ok) throw new Error("request failed");
      toast.success(t.gpa.assessmentDeleted);
    } catch {
      setCourses(snapshot);
      toast.error(t.common.error);
    }
  }

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div className="space-y-1">
          <h1 className="text-2xl font-semibold tracking-tight">{t.gpa.title}</h1>
          <p className="text-sm text-muted-foreground">{t.gpa.subtitle}</p>
        </div>
        <Button className="h-9 rounded-xl" onClick={openCreateCourse}>
          <Plus className="size-4" />
          {t.gpa.newCourse}
        </Button>
      </div>

      <section className="relative overflow-hidden rounded-2xl border border-border/70 bg-card/70 p-5 shadow-soft backdrop-blur-sm">
        <div
          aria-hidden
          className="pointer-events-none absolute inset-0 opacity-60"
          style={{
            backgroundImage:
              "radial-gradient(32rem 16rem at 0% 0%, color-mix(in oklab, var(--primary) 12%, transparent), transparent 70%)",
          }}
        />
        <div className="relative flex flex-wrap items-center gap-x-10 gap-y-5">
          <div className="flex items-center gap-4">
            <span className="grid size-12 place-items-center rounded-2xl bg-gradient-to-br from-primary/20 to-chart-3/10 text-primary ring-1 ring-primary/15">
              <GraduationCap className="size-6" />
            </span>
            <div>
              <p className="text-[11px] font-medium uppercase tracking-[0.14em] text-muted-foreground">
                {t.gpa.overall}
              </p>
              <p className="text-3xl font-semibold leading-tight tabular-nums tracking-tight">
                {overall.gpa === null ? "—" : overall.gpa.toFixed(2)}
                <span className="ms-1 text-xs font-normal text-muted-foreground">
                  / 4.0
                </span>
              </p>
            </div>
          </div>

          <div className="flex flex-wrap gap-x-8 gap-y-3">
            <div>
              <p className="text-[11px] text-muted-foreground">
                {t.gpa.percent}
              </p>
              <p className="text-base font-semibold tabular-nums">
                {percent(overall.percent)}
              </p>
            </div>
            <div>
              <p className="text-[11px] text-muted-foreground">
                {t.gpa.gradedCredits}
              </p>
              <p className="text-base font-semibold tabular-nums">
                {overall.gradedCredits}
              </p>
            </div>
            <div>
              <p className="text-[11px] text-muted-foreground">
                {t.gpa.courses}
              </p>
              <p className="text-base font-semibold tabular-nums">
                {courses.length}
              </p>
            </div>
          </div>
        </div>
      </section>

      {courses.length === 0 ? (
        <div className="flex flex-col items-center gap-3 rounded-2xl border border-dashed border-border/80 bg-card/40 px-6 py-16 text-center">
          <div className="grid size-11 place-items-center rounded-2xl bg-muted text-muted-foreground">
            <Calculator className="size-5" />
          </div>
          <p className="text-sm text-muted-foreground">{t.gpa.empty}</p>
          <Button
            variant="outline"
            size="sm"
            className="rounded-lg"
            onClick={openCreateCourse}
          >
            <Plus className="size-3.5" />
            {t.gpa.addFirst}
          </Button>
        </div>
      ) : (
        <motion.div layout className="grid gap-4 xl:grid-cols-2">
          <AnimatePresence initial={false}>
            {courses.map((course) => {
              const stats = computeCourseStats(
                course.assessments,
                course.targetGrade,
              );
              const overWeight = stats.totalWeight > 100;

              return (
                <motion.article
                  key={course.id}
                  layout
                  initial={{ opacity: 0, y: 8 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, scale: 0.98 }}
                  transition={{ duration: 0.18 }}
                  className="flex flex-col rounded-2xl border border-border/70 bg-card/70 shadow-soft backdrop-blur-sm"
                >
                  <div className="flex items-start gap-3 border-b border-border/60 p-4">
                    <span
                      className="mt-1 size-2.5 shrink-0 rounded-full"
                      style={{
                        backgroundColor: course.color,
                        boxShadow: `0 0 0 4px ${course.color}22`,
                      }}
                    />
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-sm font-semibold tracking-tight">
                        {course.name}
                      </p>
                      <p className="mt-0.5 text-[11px] text-muted-foreground">
                        {[course.code, `${course.credits} ${t.gpa.credits}`]
                          .filter(Boolean)
                          .join(" · ")}
                      </p>
                    </div>

                    <Badge
                      variant="secondary"
                      className="shrink-0 rounded-md font-mono text-[11px]"
                      title={t.gpa.letterGrade}
                    >
                      {stats.letter ?? "—"}
                    </Badge>

                    <DropdownMenu>
                      <DropdownMenuTrigger asChild>
                        <Button
                          variant="ghost"
                          size="icon"
                          className="size-8 shrink-0 rounded-lg"
                          aria-label={t.common.actions}
                        >
                          <MoreHorizontal className="size-4" />
                        </Button>
                      </DropdownMenuTrigger>
                      <DropdownMenuContent align="end" className="w-44">
                        <DropdownMenuItem
                          className="cursor-pointer"
                          onClick={() => openEditCourse(course)}
                        >
                          <Pencil className="size-4" />
                          {t.common.edit}
                        </DropdownMenuItem>
                        <DropdownMenuSeparator />
                        <DropdownMenuItem
                          variant="destructive"
                          className="cursor-pointer"
                          onClick={() => setDeleteCourse(course)}
                        >
                          <Trash2 className="size-4" />
                          {t.common.delete}
                        </DropdownMenuItem>
                      </DropdownMenuContent>
                    </DropdownMenu>
                  </div>

                  <div className="grid grid-cols-3 divide-x divide-border/60 border-b border-border/60 text-center">
                    <div className="px-2 py-2.5">
                      <p className="text-[10px] text-muted-foreground">
                        {t.gpa.current}
                      </p>
                      <p className="text-sm font-semibold tabular-nums">
                        {percent(stats.currentPercent)}
                      </p>
                    </div>
                    <div className="px-2 py-2.5">
                      <p className="text-[10px] text-muted-foreground">
                        {t.gpa.projected}
                      </p>
                      <p className="text-sm font-semibold tabular-nums">
                        {percent(stats.projectedPercent)}
                      </p>
                    </div>
                    <div className="px-2 py-2.5">
                      <p className="text-[10px] text-muted-foreground">
                        {t.gpa.needed}
                      </p>
                      <p
                        className={cn(
                          "text-sm font-semibold tabular-nums",
                          stats.impossible && "text-destructive",
                          stats.alreadyReached && "text-success",
                        )}
                      >
                        {stats.targetPercent === null
                          ? "—"
                          : stats.neededOnRemaining === null
                            ? "—"
                            : percent(Math.max(0, stats.neededOnRemaining))}
                      </p>
                    </div>
                  </div>

                  <div className="space-y-3 p-4">
                    <div className="space-y-1.5">
                      <div className="flex items-center justify-between text-[11px]">
                        <span className="text-muted-foreground">
                          {t.gpa.weightTotal}
                        </span>
                        <span
                          className={cn(
                            "font-medium tabular-nums",
                            overWeight && "text-destructive",
                          )}
                        >
                          {Math.round(stats.totalWeight)}%
                        </span>
                      </div>
                      <Progress
                        value={Math.min(100, stats.totalWeight)}
                        className="h-1.5"
                      />
                    </div>

                    {overWeight ? (
                      <p className="flex items-start gap-1.5 text-[11px] text-destructive">
                        <AlertTriangle className="mt-0.5 size-3.5 shrink-0" />
                        {t.gpa.totalWeightWarning}
                      </p>
                    ) : null}

                    {stats.targetPercent !== null ? (
                      <div className="flex items-start gap-2 rounded-lg border border-border/60 bg-muted/40 px-2.5 py-2">
                        {stats.impossible ? (
                          <AlertTriangle className="mt-0.5 size-3.5 shrink-0 text-destructive" />
                        ) : stats.alreadyReached ? (
                          <Check className="mt-0.5 size-3.5 shrink-0 text-success" />
                        ) : (
                          <Target className="mt-0.5 size-3.5 shrink-0 text-primary" />
                        )}
                        <p className="text-[11px] leading-relaxed text-muted-foreground">
                          {stats.impossible
                            ? t.gpa.impossible
                            : stats.alreadyReached
                              ? t.gpa.alreadyReached
                              : stats.neededOnRemaining === null
                                ? t.gpa.needMoreData
                                : `${percent(stats.neededOnRemaining)} ${t.gpa.needed} · ${Math.round(stats.remainingWeight)}% ${t.gpa.remainingWeight}`}
                        </p>
                      </div>
                    ) : (
                      <p className="flex items-start gap-1.5 text-[11px] text-muted-foreground">
                        <TrendingUp className="mt-0.5 size-3.5 shrink-0 text-muted-foreground/70" />
                        {t.gpa.setTarget}
                      </p>
                    )}

                    {course.assessments.length === 0 ? (
                      <p className="rounded-lg border border-dashed border-border/70 px-3 py-4 text-center text-[11px] text-muted-foreground">
                        {t.gpa.noAssessments}
                      </p>
                    ) : (
                      <ul className="-mx-1 divide-y divide-border/50">
                        {course.assessments.map((assessment) => (
                          <li
                            key={assessment.id}
                            className="group flex items-center gap-2 px-1 py-1.5"
                          >
                            <div className="min-w-0 flex-1">
                              <p className="truncate text-xs font-medium">
                                {assessment.name}
                              </p>
                              <p className="text-[10px] text-muted-foreground">
                                {typeLabels[assessment.type]} · {assessment.weight}%
                              </p>
                            </div>

                            <span className="shrink-0 text-[11px] tabular-nums text-muted-foreground">
                              {assessment.score === null
                                ? t.gpa.ungraded
                                : `${assessment.score} / ${assessment.maxScore ?? 100}`}
                            </span>

                            <DropdownMenu>
                              <DropdownMenuTrigger asChild>
                                <Button
                                  variant="ghost"
                                  size="icon"
                                  className="size-7 shrink-0 rounded-md opacity-50 transition-opacity group-hover:opacity-100"
                                  aria-label={t.common.actions}
                                >
                                  <MoreHorizontal className="size-3.5" />
                                </Button>
                              </DropdownMenuTrigger>
                              <DropdownMenuContent align="end" className="w-40">
                                <DropdownMenuItem
                                  className="cursor-pointer"
                                  onClick={() =>
                                    openEditAssessment(course.id, assessment)
                                  }
                                >
                                  <Pencil className="size-4" />
                                  {t.common.edit}
                                </DropdownMenuItem>
                                <DropdownMenuSeparator />
                                <DropdownMenuItem
                                  variant="destructive"
                                  className="cursor-pointer"
                                  onClick={() =>
                                    setDeleteAssessment({
                                      courseId: course.id,
                                      assessment,
                                    })
                                  }
                                >
                                  <Trash2 className="size-4" />
                                  {t.common.delete}
                                </DropdownMenuItem>
                              </DropdownMenuContent>
                            </DropdownMenu>
                          </li>
                        ))}
                      </ul>
                    )}

                    <Button
                      variant="outline"
                      size="sm"
                      className="h-8 w-full rounded-lg text-xs"
                      onClick={() => openCreateAssessment(course)}
                    >
                      <Plus className="size-3.5" />
                      {t.gpa.addAssessment}
                    </Button>
                  </div>
                </motion.article>
              );
            })}
          </AnimatePresence>
        </motion.div>
      )}

      {/* Course dialog */}
      <Dialog open={courseOpen} onOpenChange={setCourseOpen}>
        <DialogContent className="sm:max-w-lg">
          <DialogHeader>
            <DialogTitle>
              {editingCourse ? t.gpa.editCourse : t.gpa.newCourse}
            </DialogTitle>
            <DialogDescription>{t.gpa.subtitle}</DialogDescription>
          </DialogHeader>

          <form onSubmit={saveCourse} className="space-y-4">
            <div className="space-y-1.5">
              <Label htmlFor="course-name">{t.gpa.courseName}</Label>
              <Input
                id="course-name"
                value={courseForm.name}
                onChange={(event) =>
                  setCourseForm((state) => ({
                    ...state,
                    name: event.target.value,
                  }))
                }
                placeholder={t.gpa.courseNamePlaceholder}
                required
                autoFocus
                className="h-10 rounded-xl"
              />
            </div>

            <div className="grid gap-4 sm:grid-cols-[1fr_110px]">
              <div className="space-y-1.5">
                <Label htmlFor="course-code">{t.gpa.courseCode}</Label>
                <Input
                  id="course-code"
                  value={courseForm.code}
                  onChange={(event) =>
                    setCourseForm((state) => ({
                      ...state,
                      code: event.target.value,
                    }))
                  }
                  placeholder={t.gpa.courseCodePlaceholder}
                  className="h-10 rounded-xl"
                  dir="ltr"
                />
              </div>

              <div className="space-y-1.5">
                <Label htmlFor="course-credits">{t.gpa.credits}</Label>
                <Input
                  id="course-credits"
                  type="number"
                  min={0}
                  max={30}
                  step={1}
                  value={courseForm.credits}
                  onChange={(event) =>
                    setCourseForm((state) => ({
                      ...state,
                      credits: event.target.value,
                    }))
                  }
                  className="h-10 rounded-xl"
                />
              </div>
            </div>

            <div className="space-y-1.5">
              <Label>{t.gpa.target}</Label>
              <Select
                value={courseForm.targetGrade}
                onValueChange={(value) =>
                  setCourseForm((state) => ({ ...state, targetGrade: value }))
                }
              >
                <SelectTrigger className="h-10 w-full rounded-xl">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent className="max-h-72">
                  <SelectItem value="none">{t.gpa.noTarget}</SelectItem>
                  {gradeScale
                    .filter((band) => band.letter !== "F")
                    .map((band) => (
                      <SelectItem key={band.letter} value={band.letter}>
                        {band.letter} · {band.min}%+
                      </SelectItem>
                    ))}
                </SelectContent>
              </Select>
              <p className="text-[11px] text-muted-foreground">
                {t.gpa.targetHint}
              </p>
            </div>

            <div className="space-y-2">
              <Label>{t.gpa.color}</Label>
              <div className="flex flex-wrap gap-2">
                {courseColors.map((color) => (
                  <button
                    key={color}
                    type="button"
                    onClick={() =>
                      setCourseForm((state) => ({ ...state, color }))
                    }
                    aria-label={color}
                    aria-pressed={courseForm.color === color}
                    className={cn(
                      "size-7 rounded-full ring-offset-2 ring-offset-card transition-all",
                      courseForm.color === color
                        ? "ring-2 ring-foreground/60"
                        : "ring-1 ring-border hover:scale-105",
                    )}
                    style={{ backgroundColor: color }}
                  />
                ))}
              </div>
            </div>

            <DialogFooter className="gap-2">
              <Button
                type="button"
                variant="ghost"
                className="rounded-xl"
                onClick={() => setCourseOpen(false)}
              >
                {t.common.cancel}
              </Button>
              <Button
                type="submit"
                disabled={savingCourse || !courseForm.name.trim()}
                className="rounded-xl"
              >
                {savingCourse ? (
                  <Loader2 className="size-4 animate-spin" />
                ) : (
                  <Check className="size-4" />
                )}
                {t.gpa.saveCourse}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      {/* Assessment dialog */}
      <Dialog open={assessmentOpen} onOpenChange={setAssessmentOpen}>
        <DialogContent className="sm:max-w-lg">
          <DialogHeader>
            <DialogTitle>
              {editingAssessment ? t.gpa.editAssessment : t.gpa.newAssessment}
            </DialogTitle>
            <DialogDescription>{t.gpa.subtitle}</DialogDescription>
          </DialogHeader>

          <form onSubmit={saveAssessment} className="space-y-4">
            <div className="grid gap-4 sm:grid-cols-2">
              <div className="space-y-1.5">
                <Label htmlFor="assessment-name">{t.gpa.assessmentName}</Label>
                <Input
                  id="assessment-name"
                  value={assessmentForm.name}
                  onChange={(event) =>
                    setAssessmentForm((state) => ({
                      ...state,
                      name: event.target.value,
                    }))
                  }
                  placeholder={t.gpa.assessmentNamePlaceholder}
                  required
                  autoFocus
                  className="h-10 rounded-xl"
                />
              </div>

              <div className="space-y-1.5">
                <Label>{t.gpa.type}</Label>
                <Select
                  value={assessmentForm.type}
                  onValueChange={(value) =>
                    setAssessmentForm((state) => ({
                      ...state,
                      type: value as AssessmentType,
                    }))
                  }
                >
                  <SelectTrigger className="h-10 w-full rounded-xl">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {(Object.keys(typeLabels) as AssessmentType[]).map((key) => (
                      <SelectItem key={key} value={key}>
                        {typeLabels[key]}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>

            <div className="space-y-1.5">
              <Label htmlFor="assessment-weight">{t.gpa.weight}</Label>
              <Input
                id="assessment-weight"
                type="number"
                min={0}
                max={100}
                step={0.5}
                value={assessmentForm.weight}
                onChange={(event) =>
                  setAssessmentForm((state) => ({
                    ...state,
                    weight: event.target.value,
                  }))
                }
                required
                className="h-10 rounded-xl"
              />
              <p className="text-[11px] text-muted-foreground">
                {t.gpa.weightHint}
              </p>
            </div>

            <div className="grid gap-4 sm:grid-cols-2">
              <div className="space-y-1.5">
                <Label htmlFor="assessment-score">{t.gpa.score}</Label>
                <Input
                  id="assessment-score"
                  type="number"
                  min={0}
                  step={0.5}
                  value={assessmentForm.score}
                  onChange={(event) =>
                    setAssessmentForm((state) => ({
                      ...state,
                      score: event.target.value,
                    }))
                  }
                  placeholder="—"
                  className="h-10 rounded-xl"
                />
              </div>

              <div className="space-y-1.5">
                <Label htmlFor="assessment-max">{t.gpa.maxScore}</Label>
                <Input
                  id="assessment-max"
                  type="number"
                  min={0}
                  step={1}
                  value={assessmentForm.maxScore}
                  onChange={(event) =>
                    setAssessmentForm((state) => ({
                      ...state,
                      maxScore: event.target.value,
                    }))
                  }
                  className="h-10 rounded-xl"
                />
              </div>
            </div>

            <p className="text-[11px] text-muted-foreground">
              {t.gpa.scoreHint}
            </p>

            <DialogFooter className="gap-2">
              <Button
                type="button"
                variant="ghost"
                className="rounded-xl"
                onClick={() => setAssessmentOpen(false)}
              >
                {t.common.cancel}
              </Button>
              <Button
                type="submit"
                disabled={savingAssessment || !assessmentForm.name.trim()}
                className="rounded-xl"
              >
                {savingAssessment ? (
                  <Loader2 className="size-4 animate-spin" />
                ) : (
                  <Check className="size-4" />
                )}
                {t.common.save}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      <AlertDialog
        open={deleteCourse !== null}
        onOpenChange={(open) => !open && setDeleteCourse(null)}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>{t.gpa.deleteCourse}</AlertDialogTitle>
            <AlertDialogDescription>
              {t.gpa.deleteCourseBody}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel className="rounded-xl">
              {t.common.cancel}
            </AlertDialogCancel>
            <AlertDialogAction
              onClick={confirmDeleteCourse}
              className="rounded-xl bg-destructive text-white hover:bg-destructive/90"
            >
              {t.common.delete}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      <AlertDialog
        open={deleteAssessment !== null}
        onOpenChange={(open) => !open && setDeleteAssessment(null)}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>{t.gpa.deleteAssessment}</AlertDialogTitle>
            <AlertDialogDescription>
              {deleteAssessment?.assessment.name}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel className="rounded-xl">
              {t.common.cancel}
            </AlertDialogCancel>
            <AlertDialogAction
              onClick={confirmDeleteAssessment}
              className="rounded-xl bg-destructive text-white hover:bg-destructive/90"
            >
              {t.common.delete}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
