import { NextResponse } from "next/server";
import { runMigrations } from "@/lib/db/migrations";
import { query, run, queryOne } from "@/lib/db";
import { getHistoricalWeather } from "@/lib/weather/client";

const NYC_LAT = 40.7128;
const NYC_LON = -74.006;

export async function POST() {
  try {
    runMigrations();

    // Get unique dates from commits
    const commitDates = query<{ commit_date: string }>(
      `SELECT DISTINCT DATE(commit_date) as commit_date 
       FROM github_commits 
       ORDER BY commit_date`
    );

    if (commitDates.length === 0) {
      return NextResponse.json({
        success: true,
        message: "No commit dates found. Sync GitHub data first.",
        weatherAdded: 0,
      });
    }

    // Find date range
    const dates = commitDates.map((d) => d.commit_date);
    const startDate = dates[0];
    const endDate = dates[dates.length - 1];

    // Fetch weather data for the entire range
    const weatherData = await getHistoricalWeather(
      NYC_LAT,
      NYC_LON,
      startDate,
      endDate
    );

    let weatherAdded = 0;

    // Store weather data
    for (const weather of weatherData) {
      // Check if already exists
      const existing = queryOne<{ id: number }>(
        "SELECT id FROM weather_data WHERE date = ?",
        [weather.date]
      );

      if (existing) continue;

      run(
        `INSERT INTO weather_data 
        (date, location, temp_min, temp_max, temp_avg, precipitation, humidity, cloud_cover, daylight_hours)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        [
          weather.date,
          "NYC",
          weather.temp_min,
          weather.temp_max,
          weather.temp_avg,
          weather.precipitation,
          weather.humidity,
          weather.cloud_cover,
          weather.daylight_hours,
        ]
      );
      weatherAdded++;
    }

    return NextResponse.json({
      success: true,
      dateRange: { startDate, endDate },
      weatherAdded,
      totalDates: dates.length,
    });
  } catch (error) {
    console.error("Weather sync error:", error);
    return NextResponse.json(
      {
        error: error instanceof Error ? error.message : "Failed to sync weather data",
      },
      { status: 500 }
    );
  }
}
