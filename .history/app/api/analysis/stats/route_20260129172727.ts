import { NextResponse } from "next/server";
import { runMigrations } from "@/lib/db/migrations";
import { queryOne } from "@/lib/db";

export async function GET() {
  try {
    runMigrations();
    const commitStats = queryOne<{
      total_commits: number;
      total_repos: number;
      date_range_start: string;
      date_range_end: string;
    }>(`
      SELECT 
        COUNT(*) as total_commits,
        COUNT(DISTINCT repo_name) as total_repos,
        MIN(DATE(commit_date)) as date_range_start,
        MAX(DATE(commit_date)) as date_range_end
      FROM github_commits
    `);

    const prStats = queryOne<{
      total_prs: number;
      merged_prs: number;
    }>(`
      SELECT 
        COUNT(*) as total_prs,
        COUNT(CASE WHEN merged_at IS NOT NULL THEN 1 END) as merged_prs
      FROM github_pull_requests
    `);

    const weatherStats = queryOne<{
      weather_days: number;
      date_range_start: string;
      date_range_end: string;
    }>(`
      SELECT 
        COUNT(*) as weather_days,
        MIN(date) as date_range_start,
        MAX(date) as date_range_end
      FROM weather_data
    `);

    return NextResponse.json({
      commits: commitStats ?? {
        total_commits: 0,
        total_repos: 0,
        date_range_start: null,
        date_range_end: null,
      },
      pullRequests: prStats ?? {
        total_prs: 0,
        merged_prs: 0,
      },
      weather: weatherStats ?? {
        weather_days: 0,
        date_range_start: null,
        date_range_end: null,
      },
    });
  } catch (error) {
    console.error("Stats error:", error);
    return NextResponse.json(
      {
        error: error instanceof Error ? error.message : "Failed to get stats",
      },
      { status: 500 }
    );
  }
}
