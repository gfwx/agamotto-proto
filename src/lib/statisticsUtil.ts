import type { Session } from "./db/appSessionUtil";

/**
 * Represents a single day's data for a specific tag
 */
export interface DayData {
  date: string; // YYYY-MM-DD format
  duration: number; // milliseconds for specific tag
  totalDayHours: number; // total hours across all tags
}

/**
 * Complete statistical measures for a dataset
 */
export interface Statistics {
  mean: number; // milliseconds
  median: number; // milliseconds
  mode: number | null; // milliseconds (bucketed)
  variance: number;
  standardDeviation: number;
  min: number;
  max: number;
  count: number;
  sum: number;
}

/**
 * Z-score normalized data point
 */
export interface ZScorePoint {
  date: string;
  duration: number; // original value in milliseconds
  zScore: number; // (value - mean) / stdDev
}

/**
 * Distribution histogram bucket
 */
export interface DistributionPoint {
  zScore: number; // x-axis value
  frequency: number; // y-axis value (count of days)
}

/**
 * Returns a YYYY-MM-DD string for a timestamp
 */
export function getDayKey(timestamp: number): string {
  return new Date(timestamp).toLocaleDateString("en-CA");
}

/**
 * Groups sessions by date (YYYY-MM-DD)
 */
export function groupSessionsByDay(
  sessions: Session[],
): Map<string, Session[]> {
  const grouped = new Map<string, Session[]>();

  sessions.forEach((session) => {
    const dayKey = getDayKey(session.timestamp);
    if (!grouped.has(dayKey)) {
      grouped.set(dayKey, []);
    }
    grouped.get(dayKey)!.push(session);
  });

  return grouped;
}

/**
 * Calculates total hours tracked per day (across all tags)
 * Returns Map<date, totalMilliseconds>
 */
export function calculateDayTotals(
  sessionsByDay: Map<string, Session[]>,
): Map<string, number> {
  const dayTotals = new Map<string, number>();

  sessionsByDay.forEach((sessions, date) => {
    const totalDuration = sessions.reduce((sum, s) => sum + s.duration, 0);
    dayTotals.set(date, totalDuration);
  });

  return dayTotals;
}

/**
 * Gets daily durations for a specific tag with completeness info
 * Only includes days where the tag was used (duration > 0)
 */
export function getTagDailyDurations(
  sessions: Session[],
  tagName: string,
): DayData[] {
  // Group all completed sessions by day
  const completedSessions = sessions.filter((s) => s.state === "completed");
  const sessionsByDay = groupSessionsByDay(completedSessions);
  const dayTotals = calculateDayTotals(sessionsByDay);

  const dayData: DayData[] = [];

  sessionsByDay.forEach((daySessions, date) => {
    // Calculate duration for this specific tag on this day
    const tagDuration = daySessions
      .filter((s) => s.tag?.name === tagName)
      .reduce((sum, s) => sum + s.duration, 0);

    // Only include days where this tag was used
    if (tagDuration > 0) {
      dayData.push({
        date,
        duration: tagDuration,
        totalDayHours: dayTotals.get(date) || 0,
      });
    }
  });

  return dayData;
}

/**
 * Calculates percentile rank (0-100) for each day's total hours
 * Returns Map<date, percentile>
 */
export function calculateCompletenessPercentiles(
  dayTotals: Map<string, number>,
): Map<string, number> {
  const percentiles = new Map<string, number>();

  // Convert to array for sorting
  const totalsArray = Array.from(dayTotals.entries());
  const sortedTotals = totalsArray
    .map(([date, total]) => ({ date, total }))
    .sort((a, b) => a.total - b.total);

  const totalDays = sortedTotals.length;

  sortedTotals.forEach((entry, index) => {
    // Percentile = (rank / totalDays) * 100
    // rank is 1-indexed (index + 1)
    const percentile = ((index + 1) / totalDays) * 100;
    percentiles.set(entry.date, percentile);
  });

  return percentiles;
}

/**
 * Filters days based on completeness percentile threshold
 * Only includes days where total daily hours >= minPercentile
 */
export function filterDaysByCompleteness(
  dayData: DayData[],
  dayTotals: Map<string, number>,
  minPercentile: number,
): DayData[] {
  if (minPercentile === 0) {
    return dayData; // No filtering
  }

  const percentiles = calculateCompletenessPercentiles(dayTotals);

  return dayData.filter((day) => {
    const dayPercentile = percentiles.get(day.date) || 0;
    return dayPercentile >= minPercentile;
  });
}

/**
 * Calculates comprehensive statistics for a set of durations
 */
export function calculateStatistics(durations: number[]): Statistics {
  if (durations.length === 0) {
    return {
      mean: 0,
      median: 0,
      mode: null,
      variance: 0,
      standardDeviation: 0,
      min: 0,
      max: 0,
      count: 0,
      sum: 0,
    };
  }

  const sorted = [...durations].sort((a, b) => a - b);
  const count = durations.length;
  const sum = durations.reduce((acc, val) => acc + val, 0);
  const mean = sum / count;

  // Median
  let median: number;
  const middleIndex = Math.floor(count / 2);
  if (count % 2 === 0) {
    median = (sorted[middleIndex - 1] + sorted[middleIndex]) / 2;
  } else {
    median = sorted[middleIndex];
  }

  // Mode (bucketed approach with 30-minute intervals)
  const BUCKET_SIZE = 30 * 60 * 1000; // 30 minutes in milliseconds
  const buckets = new Map<number, number>();

  durations.forEach((duration) => {
    const bucketKey = Math.floor(duration / BUCKET_SIZE);
    buckets.set(bucketKey, (buckets.get(bucketKey) || 0) + 1);
  });

  let mode: number | null = null;
  let maxFrequency = 0;
  let maxFrequencyBucket: number | null = null;

  buckets.forEach((frequency, bucket) => {
    if (frequency > maxFrequency) {
      maxFrequency = frequency;
      maxFrequencyBucket = bucket;
    }
  });

  // Only set mode if there's actually a repeating bucket
  if (maxFrequency > 1 && maxFrequencyBucket !== null) {
    // Return midpoint of the bucket
    mode = maxFrequencyBucket * BUCKET_SIZE + BUCKET_SIZE / 2;
  }

  // Variance (sample variance: n-1)
  const variance =
    count > 1
      ? durations.reduce((acc, val) => acc + Math.pow(val - mean, 2), 0) /
        (count - 1)
      : 0;

  const standardDeviation = Math.sqrt(variance);

  return {
    mean,
    median,
    mode,
    variance,
    standardDeviation,
    min: sorted[0],
    max: sorted[count - 1],
    count,
    sum,
  };
}

/**
 * Calculates z-score for each day's duration
 * Z-score = (value - mean) / standardDeviation
 */
export function calculateZScores(
  dayData: DayData[],
  stats: Statistics,
): ZScorePoint[] {
  // Handle edge case: no variation (stdDev = 0)
  if (stats.standardDeviation === 0) {
    return dayData.map((day) => ({
      date: day.date,
      duration: day.duration,
      zScore: 0,
    }));
  }

  return dayData.map((day) => ({
    date: day.date,
    duration: day.duration,
    zScore: (day.duration - stats.mean) / stats.standardDeviation,
  }));
}

/**
 * Creates histogram buckets for z-score distribution visualization
 */
export function createDistributionData(
  zScores: ZScorePoint[],
  bucketCount: number = 20,
): DistributionPoint[] {
  if (zScores.length === 0) {
    return [];
  }

  const zScoreValues = zScores.map((z) => z.zScore);
  const minZ = Math.min(...zScoreValues);
  const maxZ = Math.max(...zScoreValues);

  // Handle case where all z-scores are the same
  if (minZ === maxZ) {
    return [
      {
        zScore: minZ,
        frequency: zScores.length,
      },
    ];
  }

  const range = maxZ - minZ;
  const bucketSize = range / bucketCount;

  // Initialize buckets
  const buckets: DistributionPoint[] = [];
  for (let i = 0; i < bucketCount; i++) {
    const bucketZScore = minZ + i * bucketSize + bucketSize / 2;
    buckets.push({
      zScore: bucketZScore,
      frequency: 0,
    });
  }

  // Count frequencies
  zScores.forEach((point) => {
    const bucketIndex = Math.min(
      Math.floor((point.zScore - minZ) / bucketSize),
      bucketCount - 1,
    );
    buckets[bucketIndex].frequency++;
  });

  return buckets;
}

/**
 * Calculates percentile rank (0-100) for a specific value
 * Returns the percentage of values that are less than or equal to the given value
 */
export function calculatePercentile(
  value: number,
  allValues: number[],
): number {
  if (allValues.length === 0) {
    return 0;
  }

  const sorted = [...allValues].sort((a, b) => a - b);
  const countLessOrEqual = sorted.filter((v) => v <= value).length;

  return (countLessOrEqual / sorted.length) * 100;
}

/**
 * Formats duration in milliseconds as "Xh Ym" (omits seconds)
 */
export function formatDuration(ms: number): string {
  const totalSeconds = Math.floor(ms / 1000);
  const hours = Math.floor(totalSeconds / 3600);
  const minutes = Math.floor((totalSeconds % 3600) / 60);

  if (hours > 0 && minutes > 0) {
    return `${hours}h ${minutes}m`;
  }
  if (hours > 0) {
    return `${hours}h`;
  }
  if (minutes > 0) {
    return `${minutes}m`;
  }
  return "< 1m";
}

/**
 * Formats z-score as "+X.Xσ" or "-X.Xσ"
 */
export function formatZScore(zScore: number): string {
  const sign = zScore >= 0 ? "+" : "";
  return `${sign}${zScore.toFixed(1)}σ`;
}
