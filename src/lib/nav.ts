import {
  BookOpenCheck,
  CalendarDays,
  ClipboardList,
  Calculator,
  Code2,
  FolderGit2,
  LayoutDashboard,
  Library,
  NotebookPen,
  ShieldCheck,
  Timer,
  Wrench,
  type LucideIcon,
} from "lucide-react";

export type NavItem = {
  href: string;
  /** Key inside `dictionary.nav` */
  id:
    | "dashboard"
    | "tasks"
    | "assignments"
    | "gpa"
    | "syllabus"
    | "schedule"
    | "studyHub"
    | "snippets"
    | "utilities"
    | "projects"
    | "pomodoro"
    | "notes"
    | "admin";
  icon: LucideIcon;
};

export type NavGroup = {
  /** Key inside `dictionary.nav` */
  id:
    | "overview"
    | "academic"
    | "developer"
    | "productivity"
    | "administration";
  items: NavItem[];
  /** Only rendered for accounts with the ADMIN role. */
  adminOnly?: boolean;
};

export const navGroups: NavGroup[] = [
  {
    id: "overview",
    items: [{ href: "/dashboard", id: "dashboard", icon: LayoutDashboard }],
  },
  {
    id: "academic",
    items: [
      { href: "/dashboard/assignments", id: "assignments", icon: ClipboardList },
      { href: "/dashboard/gpa", id: "gpa", icon: Calculator },
      { href: "/dashboard/syllabus", id: "syllabus", icon: BookOpenCheck },
      { href: "/dashboard/schedule", id: "schedule", icon: CalendarDays },
      { href: "/dashboard/study-hub", id: "studyHub", icon: Library },
    ],
  },
  {
    id: "developer",
    items: [
      { href: "/dashboard/snippets", id: "snippets", icon: Code2 },
      { href: "/dashboard/utilities", id: "utilities", icon: Wrench },
      { href: "/dashboard/projects", id: "projects", icon: FolderGit2 },
    ],
  },
  {
    id: "productivity",
    items: [
      { href: "/dashboard/pomodoro", id: "pomodoro", icon: Timer },
      { href: "/dashboard/notes", id: "notes", icon: NotebookPen },
    ],
  },
  {
    id: "administration",
    adminOnly: true,
    items: [{ href: "/dashboard/admin", id: "admin", icon: ShieldCheck }],
  },
];

/** Filter the sidebar down to what this account may open. */
export function navGroupsForRole(role: "USER" | "ADMIN"): NavGroup[] {
  return role === "ADMIN"
    ? navGroups
    : navGroups.filter((group) => !group.adminOnly);
}
