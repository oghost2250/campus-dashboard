/**
 * Demo seed — creates a fully populated admin account you can sign in with:
 *
 *   email:    s-o.demo77@zewailcity.edu.eg
 *   password: campus1234
 *
 * It also adds one pending applicant and one active student so the admin
 * verification page has something to show.
 *
 * Re-running is safe: these three demo accounts' rows are deleted and rebuilt.
 */
import { PrismaClient, type AssessmentType } from "@prisma/client";
import { hash } from "bcryptjs";

const prisma = new PrismaClient();

const DEMO_EMAIL = "s-o.demo77@zewailcity.edu.eg";
const PENDING_EMAIL = "s-o.nour12@zewailcity.edu.eg";
const ACTIVE_EMAIL = "s-o.mariam31@zewailcity.edu.eg";

/** Local midnight + offset days, at a given hour. */
function day(offset: number, hour = 18) {
  const date = new Date();
  date.setDate(date.getDate() + offset);
  date.setHours(hour, 0, 0, 0);
  return date;
}

function minutesAgo(minutes: number) {
  return new Date(Date.now() - minutes * 60_000);
}

const tasks = [
  {
    title: "Compiler design lab report",
    description:
      "Write up the lexer + parser sections, include the grammar table and the AST diagrams.",
    subject: "CS 431",
    status: "IN_PROGRESS" as const,
    priority: "HIGH" as const,
    dueDate: day(1, 23),
  },
  {
    title: "Problem set 6 — dynamic programming",
    description: "Questions 3 and 5 need the memoised recurrence written out.",
    subject: "CS 220",
    status: "TODO" as const,
    priority: "MEDIUM" as const,
    dueDate: day(3, 12),
  },
  {
    title: "Database project checkpoint",
    description: "ER diagram + normalisation notes for the library system.",
    subject: "CS 361",
    status: "IN_PROGRESS" as const,
    priority: "HIGH" as const,
    dueDate: day(2, 17),
  },
  {
    title: "Linear algebra quiz review",
    description: "Eigenvalues, diagonalisation, and the past two quizzes.",
    subject: "MATH 241",
    status: "TODO" as const,
    priority: "MEDIUM" as const,
    dueDate: day(0, 20),
  },
  {
    title: "Technical writing portfolio draft",
    description: "Three revised artefacts plus the reflective preface.",
    subject: "ENGL 102",
    status: "TODO" as const,
    priority: "LOW" as const,
    dueDate: day(6, 23),
  },
  {
    title: "Register for next semester",
    description: "Check the hold on the account first.",
    subject: "Admin",
    status: "DONE" as const,
    priority: "MEDIUM" as const,
    dueDate: day(-2, 12),
  },
  {
    title: "Submit internship application",
    description: "CV, transcript, and the take-home link.",
    subject: "Career",
    status: "DONE" as const,
    priority: "HIGH" as const,
    dueDate: day(-4, 17),
  },
];

type SeedAssessment = {
  name: string;
  type: AssessmentType;
  weight: number;
  score: number | null;
  maxScore: number;
};

const courses: {
  name: string;
  code: string;
  credits: number;
  targetGrade: string | null;
  color: string;
  assessments: SeedAssessment[];
}[] = [
  {
    name: "Operating Systems",
    code: "CS 340",
    credits: 3,
    targetGrade: "A",
    color: "#6366f1",
    assessments: [
      { name: "Lab 1 — scheduling", type: "LAB", weight: 10, score: 9.5, maxScore: 10 },
      { name: "Quiz 1", type: "QUIZ", weight: 5, score: 4, maxScore: 5 },
      { name: "Midterm", type: "MIDTERM", weight: 25, score: 88, maxScore: 100 },
      { name: "Final exam", type: "FINAL", weight: 40, score: null, maxScore: 100 },
    ],
  },
  {
    name: "Linear Algebra",
    code: "MATH 241",
    credits: 4,
    targetGrade: "A-",
    color: "#0ea5e9",
    assessments: [
      { name: "Homework set", type: "ASSIGNMENT", weight: 20, score: 92, maxScore: 100 },
      { name: "Midterm", type: "MIDTERM", weight: 30, score: 84, maxScore: 100 },
      { name: "Final exam", type: "FINAL", weight: 50, score: null, maxScore: 100 },
    ],
  },
  {
    name: "Database Systems",
    code: "CS 361",
    credits: 3,
    targetGrade: "B+",
    color: "#10b981",
    assessments: [
      { name: "Semester project", type: "PROJECT", weight: 35, score: 95, maxScore: 100 },
      { name: "Midterm", type: "MIDTERM", weight: 25, score: 78, maxScore: 100 },
      { name: "Final exam", type: "FINAL", weight: 40, score: null, maxScore: 100 },
    ],
  },
  {
    name: "Technical Writing",
    code: "ENGL 102",
    credits: 2,
    targetGrade: "B",
    color: "#f59e0b",
    assessments: [
      { name: "Analytical essay", type: "ASSIGNMENT", weight: 40, score: 88, maxScore: 100 },
      { name: "Portfolio", type: "PROJECT", weight: 60, score: null, maxScore: 100 },
    ],
  },
];

const snippets = [
  {
    title: "useDebounce hook",
    language: "tsx",
    tags: ["react", "hooks", "performance"],
    isFavorite: true,
    code: `import { useEffect, useState } from "react";

export function useDebounce<T>(value: T, delay = 250): T {
  const [debounced, setDebounced] = useState(value);

  useEffect(() => {
    const timer = window.setTimeout(() => setDebounced(value), delay);
    return () => window.clearTimeout(timer);
  }, [value, delay]);

  return debounced;
}`,
  },
  {
    title: "Prisma transaction helper",
    language: "typescript",
    tags: ["prisma", "database", "backend"],
    isFavorite: false,
    code: `import { prisma } from "@/lib/prisma";

/** Move a task and log the change atomically. */
export async function moveTask(taskId: string, status: TaskStatus) {
  return prisma.$transaction(async (tx) => {
    const task = await tx.task.update({
      where: { id: taskId },
      data: { status, completedAt: status === "DONE" ? new Date() : null },
    });

    await tx.activity.create({
      data: { taskId, kind: "STATUS_CHANGED", value: status },
    });

    return task;
  });
}`,
  },
  {
    title: "Binary search (first true)",
    language: "python",
    tags: ["algorithms", "binary-search"],
    isFavorite: true,
    code: `def first_true(lo: int, hi: int, predicate) -> int:
    """Smallest x in [lo, hi] where predicate(x) is True."""
    while lo < hi:
        mid = (lo + hi) // 2
        if predicate(mid):
            hi = mid
        else:
            lo = mid + 1
    return lo`,
  },
  {
    title: "Glass card utility",
    language: "css",
    tags: ["css", "ui", "glassmorphism"],
    isFavorite: false,
    isPublic: true,
    shareSlug: "glass-card-demo-7f3a9c1e",
    code: `.glass {
  background: color-mix(in oklab, var(--card) 72%, transparent);
  backdrop-filter: blur(18px) saturate(140%);
  border: 1px solid color-mix(in oklab, var(--border) 70%, transparent);
  box-shadow:
    0 1px 0 0 rgb(255 255 255 / 0.06) inset,
    0 18px 40px -24px rgb(15 18 30 / 0.45);
  border-radius: 1rem;
}`,
  },
  {
    title: "Rank per group (window function)",
    language: "sql",
    tags: ["postgres", "sql", "analytics"],
    isFavorite: false,
    code: `select
  student_id,
  course_id,
  score,
  rank() over (
    partition by course_id
    order by score desc
  ) as course_rank
from assessments
where score is not null
order by course_id, course_rank;`,
  },
];

const syllabusTopics = [
  { course: "CS 431", title: "Lexical analysis & regular expressions", isDone: true },
  { course: "CS 431", title: "Recursive descent parsing", isDone: true },
  { course: "CS 431", title: "Intermediate representations", isDone: false },
  { course: "CS 431", title: "Register allocation", isDone: false },
  { course: "CS 340", title: "Processes & threads", isDone: true },
  { course: "CS 340", title: "Scheduling algorithms", isDone: true },
  { course: "CS 340", title: "Virtual memory", isDone: false },
  { course: "MATH 241", title: "Eigenvalues & diagonalisation", isDone: true },
  { course: "MATH 241", title: "Singular value decomposition", isDone: false },
];

const projects = [
  {
    title: "Campus Dashboard",
    description:
      "A multi-tenant student workspace with assignments, GPA projections, snippets, and focus tracking. Built as my capstone web project.",
    techStack: ["Next.js", "TypeScript", "Prisma", "Postgres", "Tailwind"],
    repoUrl: "https://github.com/oghost2250/campus-dashboard",
    liveUrl: null,
    status: "COMPLETED" as const,
    completedAt: day(-20, 12),
    featured: true,
  },
  {
    title: "Tiny Regex Engine",
    description:
      "A Thompson NFA regex matcher written from scratch in C, with a small CLI and a visualiser for the state graph.",
    techStack: ["C", "Make", "Graphviz"],
    repoUrl: "https://github.com/oghost2250",
    liveUrl: null,
    status: "COMPLETED" as const,
    completedAt: day(-55, 12),
    featured: false,
  },
  {
    title: "Campus Ride Share",
    description:
      "A course project matching students commuting to the same campus gate. Currently adding live trip tracking.",
    techStack: ["Flutter", "Firebase", "Node.js"],
    repoUrl: null,
    liveUrl: null,
    status: "IN_PROGRESS" as const,
    completedAt: null,
    featured: false,
  },
];

const notes = [
  {
    title: "System design cheat sheet",
    isPinned: true,
    content: `# System design — quick reference

## Back-of-envelope numbers
- 1 day ≈ **86,400 s** · 1 month ≈ 2.5M s
- SSD random read ≈ 100 µs · network round trip ≈ 1 ms
- 1M requests/day ≈ **12 req/s**

## Building blocks
- **Cache** — Redis, TTL + stampede protection
- **Queue** — at-least-once delivery, idempotent consumers
- **Sharding** — hash by tenant, avoid hot partitions

> Rule of thumb: write the read path first, then the write path.

\`\`\`sql
select tenant_id, count(*)
from events
group by tenant_id
order by 2 desc
limit 10;
\`\`\`

- [ ] Add capacity estimates for the final project
- [x] Pick Postgres over DynamoDB
`,
  },
  {
    title: "Algorithms — tricky proofs",
    isPinned: false,
    content: `## Loop invariants

1. **Initialisation** — true before the first iteration
2. **Maintenance** — true before → true after
3. **Termination** — gives the postcondition

### Master theorem

For \`T(n) = aT(n/b) + f(n)\`, compare \`f(n)\` with \`n^(log_b a)\`.

| Case | Condition | Result |
| --- | --- | --- |
| 1 | f(n) = O(n^(log_b a − ε)) | Θ(n^(log_b a)) |
| 2 | f(n) = Θ(n^(log_b a)) | Θ(n^(log_b a) log n) |
| 3 | f(n) = Ω(n^(log_b a + ε)) | Θ(f(n)) |
`,
  },
  {
    title: "Internship prep",
    isPinned: false,
    content: `# Application checklist

- [x] CV reviewed by the career centre
- [ ] Transcript PDF (request from registrar)
- [ ] Two references — Prof. Haddad, Mira from the coop
- [ ] Take-home: rate limiter with Redis

## Questions to ask
- How does the team handle on-call?
- What does the first 90 days look like?
- Which parts of the stack are you actively migrating?
`,
  },
];

async function main() {
  await prisma.user.deleteMany({
    where: { email: { in: [DEMO_EMAIL, PENDING_EMAIL, ACTIVE_EMAIL] } },
  });

  const user = await prisma.user.create({
    data: {
      email: DEMO_EMAIL,
      name: "Demo Student",
      passwordHash: await hash("campus1234", 10),
      locale: "en",
      emailVerified: new Date(),
      role: "ADMIN",
      status: "ACTIVE",
      approvedAt: new Date(),
    },
  });

  // Waiting for approval — appears at the top of /dashboard/admin.
  await prisma.user.create({
    data: {
      email: PENDING_EMAIL,
      name: "Nour Adel",
      passwordHash: await hash("campus1234", 10),
      locale: "en",
      status: "PENDING",
    },
  });

  // Already-approved student, with a little activity for the admin counters.
  const student = await prisma.user.create({
    data: {
      email: ACTIVE_EMAIL,
      name: "Mariam Fathy",
      passwordHash: await hash("campus1234", 10),
      locale: "ar",
      emailVerified: new Date(),
      role: "USER",
      status: "ACTIVE",
      approvedAt: new Date(),
    },
  });

  await prisma.task.createMany({
    data: [
      {
        userId: student.id,
        title: "Discrete maths sheet 4",
        subject: "MATH 212",
        status: "TODO",
        priority: "MEDIUM",
        dueDate: day(2, 14),
      },
      {
        userId: student.id,
        title: "Read chapter 5 — concurrency",
        subject: "CS 340",
        status: "IN_PROGRESS",
        priority: "LOW",
        dueDate: day(4, 20),
      },
    ],
  });

  await prisma.note.create({
    data: {
      userId: student.id,
      title: "Registration checklist",
      content:
        "# Next semester\n\n- [ ] Confirm the CS 431 lab slot\n- [x] Pay the activity fee\n- [ ] Pick a humanities elective",
    },
  });

  await prisma.task.createMany({
    data: tasks.map((task) => ({
      ...task,
      userId: user.id,
      completedAt: task.status === "DONE" ? day(-1, 12) : null,
    })),
  });

  for (const course of courses) {
    await prisma.course.create({
      data: {
        name: course.name,
        code: course.code,
        credits: course.credits,
        targetGrade: course.targetGrade,
        color: course.color,
        userId: user.id,
        assessments: {
          create: course.assessments.map((assessment) => ({
            ...assessment,
            dueDate: assessment.type === "FINAL" ? day(21, 9) : null,
          })),
        },
      },
    });
  }

  await prisma.snippet.createMany({
    data: snippets.map((snippet) => ({ ...snippet, userId: user.id })),
  });

  await prisma.syllabusTopic.createMany({
    data: syllabusTopics.map((topic, index) => ({
      ...topic,
      position: index,
      userId: user.id,
    })),
  });

  await prisma.project.createMany({
    data: projects.map((project) => ({ ...project, userId: user.id })),
  });

  await prisma.note.createMany({
    data: notes.map((note) => ({ ...note, userId: user.id })),
  });

  await prisma.pomodoroSession.createMany({
    data: [
      { label: "Algorithms problem set", durationMinutes: 25, startedAt: minutesAgo(40), endedAt: minutesAgo(15) },
      { label: "Database project", durationMinutes: 25, startedAt: minutesAgo(150), endedAt: minutesAgo(125) },
      { label: "Reading — OS chapter 7", durationMinutes: 25, startedAt: minutesAgo(260), endedAt: minutesAgo(235) },
      { label: "Essay outline", durationMinutes: 25, startedAt: minutesAgo(1400), endedAt: minutesAgo(1375) },
      { label: "Lab report", durationMinutes: 25, startedAt: minutesAgo(1500), endedAt: minutesAgo(1475) },
    ].map((session) => ({ ...session, userId: user.id, wasCompleted: true })),
  });

  console.log("Seeded demo accounts:");
  console.log(`  admin:   ${DEMO_EMAIL}`);
  console.log(`  pending: ${PENDING_EMAIL}`);
  console.log(`  active:  ${ACTIVE_EMAIL}`);
  console.log("  password: campus1234 (all three)");
  console.log(
    `  ${tasks.length} tasks · ${courses.length} courses · ${snippets.length} snippets · ${syllabusTopics.length} topics · ${projects.length} projects · ${notes.length} notes`,
  );
}

main()
  .catch((error) => {
    console.error(error);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
