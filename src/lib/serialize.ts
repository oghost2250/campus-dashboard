import type {
  Assessment,
  Course,
  Note,
  PomodoroSession,
  Snippet,
  Task,
  UserRole,
  UserStatus,
} from "@prisma/client";
import type {
  AdminUserDTO,
  AssessmentDTO,
  CourseDTO,
  NoteDTO,
  PomodoroDTO,
  SnippetDTO,
  TaskDTO,
} from "@/lib/types";

const iso = (date: Date | null | undefined): string | null =>
  date ? date.toISOString() : null;

export function taskDTO(task: Task): TaskDTO {
  return {
    id: task.id,
    title: task.title,
    description: task.description,
    subject: task.subject,
    status: task.status,
    priority: task.priority,
    dueDate: iso(task.dueDate),
    completedAt: iso(task.completedAt),
    createdAt: task.createdAt.toISOString(),
    updatedAt: task.updatedAt.toISOString(),
  };
}

export function snippetDTO(snippet: Snippet): SnippetDTO {
  return {
    id: snippet.id,
    title: snippet.title,
    code: snippet.code,
    language: snippet.language,
    tags: snippet.tags,
    isFavorite: snippet.isFavorite,
    createdAt: snippet.createdAt.toISOString(),
    updatedAt: snippet.updatedAt.toISOString(),
  };
}

export function noteDTO(note: Note): NoteDTO {
  return {
    id: note.id,
    title: note.title,
    content: note.content,
    isPinned: note.isPinned,
    createdAt: note.createdAt.toISOString(),
    updatedAt: note.updatedAt.toISOString(),
  };
}

export function assessmentDTO(assessment: Assessment): AssessmentDTO {
  return {
    id: assessment.id,
    name: assessment.name,
    type: assessment.type,
    weight: assessment.weight,
    score: assessment.score,
    maxScore: assessment.maxScore,
    dueDate: iso(assessment.dueDate),
  };
}

export function courseDTO(course: Course & { assessments: Assessment[] }): CourseDTO {
  return {
    id: course.id,
    name: course.name,
    code: course.code,
    credits: course.credits,
    targetGrade: course.targetGrade,
    color: course.color,
    assessments: course.assessments.map(assessmentDTO),
  };
}

export function pomodoroDTO(session: PomodoroSession): PomodoroDTO {
  return {
    id: session.id,
    label: session.label,
    durationMinutes: session.durationMinutes,
    wasCompleted: session.wasCompleted,
    startedAt: session.startedAt.toISOString(),
  };
}

export type AdminUserRecord = {
  id: string;
  name: string | null;
  email: string;
  image: string | null;
  role: UserRole;
  status: UserStatus;
  approvedAt: Date | null;
  createdAt: Date;
  _count: {
    tasks: number;
    courses: number;
    snippets: number;
    notes: number;
  };
};

export function adminUserDTO(user: AdminUserRecord): AdminUserDTO {
  return {
    id: user.id,
    name: user.name,
    email: user.email,
    image: user.image,
    role: user.role,
    status: user.status,
    approvedAt: iso(user.approvedAt),
    createdAt: user.createdAt.toISOString(),
    counts: {
      tasks: user._count.tasks,
      courses: user._count.courses,
      snippets: user._count.snippets,
      notes: user._count.notes,
    },
  };
}
