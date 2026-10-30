import type {
  AssessmentType,
  ProjectStatus,
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
  isPublic: boolean;
  shareSlug: string | null;
  createdAt: string;
  updatedAt: string;
};

export type SyllabusTopicDTO = {
  id: string;
  course: string;
  title: string;
  isDone: boolean;
  position: number;
  createdAt: string;
  updatedAt: string;
};

export type ProjectDTO = {
  id: string;
  title: string;
  description: string | null;
  techStack: string[];
  repoUrl: string | null;
  liveUrl: string | null;
  status: ProjectStatus;
  completedAt: string | null;
  featured: boolean;
  createdAt: string;
  updatedAt: string;
};

export type FocusDayDTO = {
  /** Local `YYYY-MM-DD` key. */
  date: string;
  minutes: number;
  sessions: number;
};

export type FocusAnalyticsDTO = {
  days: FocusDayDTO[];
  totalMinutes: number;
  totalSessions: number;
  streak: number;
  bestDayMinutes: number;
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
  gpa: number | null;
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
  emailVerified: string | null;
  approvedAt: string | null;
  createdAt: string;
};

export type StudyMaterialDTO = {
  id: string;
  title: string;
  course: string;
  category: string;
  privacy: "private" | "public";
  fileData: string;
  fileType: string;
  owner: string;
  createdAt: string;
  isOwner: boolean;
};
export type AdminAuditDTO = {
  id: string;
  action: string;
  actor: string | null;
  target: string | null;
  createdAt: string;
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
  page?: number;
  pageSize?: number;
  total?: number;
  hasMore?: boolean;
};
