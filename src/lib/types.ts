import type {
  AssessmentType,
  TaskPriority,
  TaskStatus,
  UserRole,
  UserStatus,
} from "@prisma/client";

export type TaskDTO = {
  id: string;
  title: string;
  description: string | null;
  subject: string;
  status: TaskStatus;
  priority: TaskPriority;
  dueDate: string | null;
  completedAt: string | null;
  createdAt: string;
  updatedAt: string;
};

export type SnippetDTO = {
  id: string;
  title: string;
  code: string;
  language: string;
  tags: string[];
  isFavorite: boolean;
  createdAt: string;
  updatedAt: string;
};

export type NoteDTO = {
  id: string;
  title: string;
  content: string;
  isPinned: boolean;
  createdAt: string;
  updatedAt: string;
};

export type AssessmentDTO = {
  id: string;
  name: string;
  type: AssessmentType;
  weight: number;
  score: number | null;
  maxScore: number | null;
  dueDate: string | null;
};

export type CourseDTO = {
  id: string;
  name: string;
  code: string | null;
  credits: number;
  targetGrade: string | null;
  color: string;
  assessments: AssessmentDTO[];
};

export type PomodoroDTO = {
  id: string;
  label: string;
  durationMinutes: number;
  wasCompleted: boolean;
  startedAt: string;
};

export type StatsDTO = {
  dueThisWeek: number;
  completed: number;
  snippetCount: number;
  focusMinutes: number;
  focusSessions: number;
};

export type AdminUserDTO = {
  id: string;
  name: string | null;
  email: string;
  image: string | null;
  role: UserRole;
  status: UserStatus;
  approvedAt: string | null;
  createdAt: string;
  counts: {
    tasks: number;
    courses: number;
    snippets: number;
    notes: number;
  };
};

export type AdminStatsDTO = {
  total: number;
  pending: number;
  active: number;
  suspended: number;
  admins: number;
};

export type AdminUsersResponse = {
  users: AdminUserDTO[];
  stats: AdminStatsDTO;
};
