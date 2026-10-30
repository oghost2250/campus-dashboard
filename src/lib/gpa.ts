export type AssessmentLike = {
  weight: number;
  score: number | null;
  maxScore: number | null;
  type?: string;
};

export type GradeBand = {
  min: number;
  letter: string;
  points: number;
};

/** Standard US letter bands, used only for display + target arithmetic. */
export const gradeScale: GradeBand[] = [
  { min: 97, letter: "A+", points: 4.0 },
  { min: 93, letter: "A", points: 4.0 },
  { min: 90, letter: "A-", points: 3.7 },
  { min: 87, letter: "B+", points: 3.3 },
  { min: 83, letter: "B", points: 3.0 },
  { min: 80, letter: "B-", points: 2.7 },
  { min: 77, letter: "C+", points: 2.3 },
  { min: 73, letter: "C", points: 2.0 },
  { min: 70, letter: "C-", points: 1.7 },
  { min: 67, letter: "D+", points: 1.3 },
  { min: 63, letter: "D", points: 1.0 },
  { min: 60, letter: "D-", points: 0.7 },
  { min: 0, letter: "F", points: 0.0 },
];

export function bandFor(percent: number): GradeBand {
  const clamped = Math.max(0, Math.min(100, percent));
  return gradeScale.find((band) => clamped >= band.min) ?? gradeScale[gradeScale.length - 1];
}

/** Minimum percentage needed to reach a letter, e.g. "A" -> 93. */
export function percentForLetter(letter?: string | null): number | null {
  if (!letter) return null;
  const band = gradeScale.find((item) => item.letter === letter.toUpperCase());
  return band ? band.min : null;
}

export type CourseStats = {
  totalWeight: number;
  gradedWeight: number;
  remainingWeight: number;
  /** Weighted average of graded work, 0-100. */
  currentPercent: number | null;
  /** Weighted average if every remaining assessment scores at the current rate. */
  projectedPercent: number | null;
  /** Percentage required across all remaining weight to hit the target. */
  neededOnRemaining: number | null;
  targetPercent: number | null;
  targetLetter: string | null;
  alreadyReached: boolean;
  impossible: boolean;
  letter: string | null;
  points: number | null;
  /** Percentage needed on ungraded final exams specifically. */
  finalWeight: number;
  finalRequiredPercent: number | null;
  finalAssumedPercent: number | null;
  hasFinal: boolean;
  finalGraded: boolean;
};

export function computeCourseStats(
  assessments: AssessmentLike[],
  targetLetter?: string | null,
): CourseStats {
  const totalWeight = assessments.reduce((sum, item) => sum + (item.weight || 0), 0);

  let gradedWeight = 0;
  let ungradedWeight = 0;
  let earnedWeighted = 0;

  for (const item of assessments) {
    if (item.score === null || item.score === undefined) {
      ungradedWeight += item.weight || 0;
      continue;
    }
    const max = item.maxScore && item.maxScore > 0 ? item.maxScore : 100;
    gradedWeight += item.weight || 0;
    earnedWeighted += ((item.weight || 0) * item.score) / max;
  }

  const unallocatedWeight = Math.max(0, 100 - totalWeight);
  const remainingWeight = ungradedWeight + unallocatedWeight;
  const currentPercent = gradedWeight > 0 ? (earnedWeighted / gradedWeight) * 100 : null;

  const targetPercent = percentForLetter(targetLetter);

  let neededOnRemaining: number | null = null;
  if (targetPercent !== null && remainingWeight > 0) {
    neededOnRemaining = ((targetPercent - earnedWeighted) / remainingWeight) * 100;
  }

  const finalAssessments = assessments.filter(
    (item) => (item.type ?? "").toUpperCase() === "FINAL",
  );
  const finalGraded = finalAssessments.some(
    (item) => item.score !== null && item.score !== undefined,
  );
  const finalWeight = finalAssessments.reduce(
    (sum, item) =>
      item.score === null || item.score === undefined
        ? sum + (item.weight || 0)
        : sum,
    0,
  );

  const finalAssumedPercent = currentPercent ?? 0;
  let finalRequiredPercent: number | null = null;
  if (targetPercent !== null && finalWeight > 0) {
    const otherRemainingWeight = Math.max(0, remainingWeight - finalWeight);
    finalRequiredPercent =
      ((targetPercent -
        earnedWeighted -
        (otherRemainingWeight * finalAssumedPercent) / 100) /
        finalWeight) *
      100;
  }

  const projectedPercent =
    currentPercent !== null && remainingWeight > 0
      ? earnedWeighted + (currentPercent * remainingWeight) / 100
      : currentPercent;

  const band = currentPercent !== null ? bandFor(currentPercent) : null;

  return {
    totalWeight,
    gradedWeight,
    remainingWeight,
    currentPercent,
    projectedPercent,
    neededOnRemaining,
    targetPercent,
    targetLetter: targetLetter ? targetLetter.toUpperCase() : null,
    alreadyReached:
      targetPercent !== null && neededOnRemaining !== null && neededOnRemaining <= 0,
    impossible:
      targetPercent !== null && neededOnRemaining !== null && neededOnRemaining > 100,
    letter: band?.letter ?? null,
    points: band?.points ?? null,
    finalWeight,
    finalRequiredPercent,
    finalAssumedPercent: finalWeight > 0 ? finalAssumedPercent : null,
    hasFinal: finalAssessments.length > 0,
    finalGraded,
  };
}

export type GpaCourse = {
  credits: number;
  stats: CourseStats;
};

/** Credit-weighted GPA, ignoring courses with no graded work. */
export function computeGpa(
  courses: GpaCourse[],
  scale: number = 4,
): {
  gpa: number | null;
  gradedCredits: number;
  percent: number | null;
} {
  let points = 0;
  let credits = 0;
  let weightedPercent = 0;
  const multiplier = scale === 5 ? 1.25 : 1;

  for (const course of courses) {
    if (course.stats.currentPercent === null || course.stats.points === null) continue;
    const weight = Math.max(0, course.credits);
    points += course.stats.points * weight * multiplier;
    weightedPercent += course.stats.currentPercent * weight;
    credits += weight;
  }

  if (credits === 0) {
    return { gpa: null, gradedCredits: 0, percent: null };
  }

  return {
    gpa: Math.round((points / credits) * 100) / 100,
    gradedCredits: credits,
    percent: Math.round((weightedPercent / credits) * 10) / 10,
  };
}

/**
 * GPA if every course lands exactly on its target grade, weighted by the
 * course credit hours. Courses without a target fall back to their projection.
 */
export function computeTargetGpa(
  courses: GpaCourse[],
  scale: number = 4,
): number | null {
  const multiplier = scale === 5 ? 1.25 : 1;
  let points = 0;
  let credits = 0;

  for (const course of courses) {
    const percent =
      course.stats.targetPercent ??
      course.stats.projectedPercent ??
      course.stats.currentPercent;
    if (percent === null) continue;
    const weight = Math.max(0, course.credits);
    points += bandFor(percent).points * weight * multiplier;
    credits += weight;
  }

  if (credits === 0) return null;
  return Math.round((points / credits) * 100) / 100;
}
