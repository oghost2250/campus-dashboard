export const FIRST_YEAR_SUBJECTS = [
  { code: "CSAI 112", title: "Digital Logic" },
  { code: "MATH 103", title: "Calculus for Computing" },
  { code: "CSAI 111", title: "Fundamentals of Programming (Python)" },
  { code: "CSAI 252", title: "Introduction to Computer Networks" },
  { code: "ENGL 004", title: "Remedial English / Academic Writing" },
  { code: "SCH 210", title: "Social Issues (Elective)" },
] as const;

export type FirstYearSubject = (typeof FIRST_YEAR_SUBJECTS)[number];
