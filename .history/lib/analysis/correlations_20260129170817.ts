import { query } from "@/lib/db";

export interface CorrelationMetric {
  metric: string;
  value: number;
  weatherFactor: string;
  weatherValue: number;
}

export interface SeasonalStats {
  season: string;
  commitCount: number;
  avgCommitsPerDay: number;
  avgLinesChanged: number;
  avgTemp: number;
  avgPrecipitation: number;
}

export interface DailyMetric {
  date: string;
  commitCount: number;
  linesChanged: number;
  temp: number;
  precipitation: number;
  daylightHours: number;
}

export function getDailyMetrics(): DailyMetric[] {
  const results = query<{
    date: string;
    commit_count: number;
    lines_changed: number;
    temp_avg: number;
    precipitation: number;
    daylight_hours: number;
  }>(`
    SELECT 
      DATE(c.commit_date) as date,
      COUNT(c.id) as commit_count,
      SUM(c.additions + c.deletions) as lines_changed,
      w.temp_avg,
      w.precipitation,
      w.daylight_hours
    FROM github_commits c
    LEFT JOIN weather_data w ON DATE(c.commit_date) = w.date
    WHERE w.date IS NOT NULL
    GROUP BY DATE(c.commit_date)
    ORDER BY date
  `);

  return results.map((r) => ({
    date: r.date,
    commitCount: r.commit_count ?? 0,
    linesChanged: r.lines_changed ?? 0,
    temp: r.temp_avg ?? 0,
    precipitation: r.precipitation ?? 0,
    daylightHours: r.daylight_hours ?? 0,
  }));
}

export function getSeasonalStats(): SeasonalStats[] {
  const results = query<{
    season: string;
    commit_count: number;
    days: number;
    avg_lines: number;
    avg_temp: number;
    avg_precip: number;
  }>(`
    SELECT 
      CASE 
        WHEN CAST(strftime('%m', c.commit_date) AS INTEGER) IN (12, 1, 2) THEN 'Winter'
        WHEN CAST(strftime('%m', c.commit_date) AS INTEGER) IN (3, 4, 5) THEN 'Spring'
        WHEN CAST(strftime('%m', c.commit_date) AS INTEGER) IN (6, 7, 8) THEN 'Summer'
        ELSE 'Fall'
      END as season,
      COUNT(c.id) as commit_count,
      COUNT(DISTINCT DATE(c.commit_date)) as days,
      AVG(c.additions + c.deletions) as avg_lines,
      AVG(w.temp_avg) as avg_temp,
      AVG(w.precipitation) as avg_precip
    FROM github_commits c
    LEFT JOIN weather_data w ON DATE(c.commit_date) = w.date
    WHERE w.date IS NOT NULL
    GROUP BY season
  `);

  return results.map((r) => ({
    season: r.season,
    commitCount: r.commit_count ?? 0,
    avgCommitsPerDay: r.days > 0 ? (r.commit_count ?? 0) / r.days : 0,
    avgLinesChanged: r.avg_lines ?? 0,
    avgTemp: r.avg_temp ?? 0,
    avgPrecipitation: r.avg_precip ?? 0,
  }));
}

export function getCommitsByTempRange(): Array<{
  tempRange: string;
  commitCount: number;
  avgLinesChanged: number;
}> {
  const results = query<{
    temp_range: string;
    commit_count: number;
    avg_lines: number;
  }>(`
    SELECT 
      CASE 
        WHEN w.temp_avg < 32 THEN '< 32°F (Freezing)'
        WHEN w.temp_avg < 50 THEN '32-50°F (Cold)'
        WHEN w.temp_avg < 70 THEN '50-70°F (Cool)'
        WHEN w.temp_avg < 85 THEN '70-85°F (Warm)'
        ELSE '85°F+ (Hot)'
      END as temp_range,
      COUNT(c.id) as commit_count,
      AVG(c.additions + c.deletions) as avg_lines
    FROM github_commits c
    LEFT JOIN weather_data w ON DATE(c.commit_date) = w.date
    WHERE w.date IS NOT NULL
    GROUP BY temp_range
    ORDER BY MIN(w.temp_avg)
  `);

  return results.map((r) => ({
    tempRange: r.temp_range,
    commitCount: r.commit_count ?? 0,
    avgLinesChanged: r.avg_lines ?? 0,
  }));
}

export function getCommitsByPrecipitation(): Array<{
  precipCategory: string;
  commitCount: number;
  avgCommitsPerDay: number;
}> {
  const results = query<{
    precip_category: string;
    commit_count: number;
    days: number;
  }>(`
    SELECT 
      CASE 
        WHEN w.precipitation = 0 THEN 'No Rain'
        WHEN w.precipitation < 0.1 THEN 'Light Rain (< 0.1")'
        WHEN w.precipitation < 0.5 THEN 'Moderate Rain (0.1-0.5")'
        ELSE 'Heavy Rain (0.5"+)'
      END as precip_category,
      COUNT(c.id) as commit_count,
      COUNT(DISTINCT DATE(c.commit_date)) as days
    FROM github_commits c
    LEFT JOIN weather_data w ON DATE(c.commit_date) = w.date
    WHERE w.date IS NOT NULL
    GROUP BY precip_category
    ORDER BY AVG(w.precipitation)
  `);

  return results.map((r) => ({
    precipCategory: r.precip_category,
    commitCount: r.commit_count ?? 0,
    avgCommitsPerDay: r.days > 0 ? (r.commit_count ?? 0) / r.days : 0,
  }));
}

export function calculateCorrelations(): {
  tempVsCommits: number;
  precipVsCommits: number;
  daylightVsCommits: number;
} {
  const dailyMetrics = getDailyMetrics();

  if (dailyMetrics.length === 0) {
    return {
      tempVsCommits: 0,
      precipVsCommits: 0,
      daylightVsCommits: 0,
    };
  }

  // Calculate Pearson correlation coefficient
  const calculateCorrelation = (x: number[], y: number[]): number => {
    const n = x.length;
    const sumX = x.reduce((a, b) => a + b, 0);
    const sumY = y.reduce((a, b) => a + b, 0);
    const sumXY = x.reduce((sum, xi, i) => sum + xi * y[i], 0);
    const sumX2 = x.reduce((sum, xi) => sum + xi * xi, 0);
    const sumY2 = y.reduce((sum, yi) => sum + yi * yi, 0);

    const numerator = n * sumXY - sumX * sumY;
    const denominator = Math.sqrt(
      (n * sumX2 - sumX * sumX) * (n * sumY2 - sumY * sumY)
    );

    return denominator === 0 ? 0 : numerator / denominator;
  };

  const temps = dailyMetrics.map((m) => m.temp);
  const precip = dailyMetrics.map((m) => m.precipitation);
  const daylight = dailyMetrics.map((m) => m.daylightHours);
  const commits = dailyMetrics.map((m) => m.commitCount);

  return {
    tempVsCommits: calculateCorrelation(temps, commits),
    precipVsCommits: calculateCorrelation(precip, commits),
    daylightVsCommits: calculateCorrelation(daylight, commits),
  };
}
