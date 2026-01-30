import { NextResponse } from "next/server";
import { runMigrations } from "@/lib/db/migrations";
import {
  getDailyMetrics,
  getSeasonalStats,
  getCommitsByTempRange,
  getCommitsByPrecipitation,
  calculateCorrelations,
} from "@/lib/analysis/correlations";

export async function GET() {
  try {
    runMigrations();
    const dailyMetrics = getDailyMetrics();
    const seasonalStats = getSeasonalStats();
    const commitsByTemp = getCommitsByTempRange();
    const commitsByPrecip = getCommitsByPrecipitation();
    const correlations = calculateCorrelations();

    return NextResponse.json({
      dailyMetrics,
      seasonalStats,
      commitsByTemp,
      commitsByPrecip,
      correlations,
    });
  } catch (error) {
    console.error("Analysis error:", error);
    return NextResponse.json(
      {
        error: error instanceof Error ? error.message : "Failed to compute correlations",
      },
      { status: 500 }
    );
  }
}
