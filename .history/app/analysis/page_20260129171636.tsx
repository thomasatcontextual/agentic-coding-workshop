"use client";

import { useState, useEffect } from "react";
import { Card, CardHeader, CardTitle, CardContent, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { RefreshCw, Cloud, Thermometer, Droplets, Sun } from "lucide-react";

interface Stats {
  commits: {
    total_commits: number;
    total_repos: number;
    date_range_start: string | null;
    date_range_end: string | null;
  };
  pullRequests: {
    total_prs: number;
    merged_prs: number;
  };
  weather: {
    weather_days: number;
    date_range_start: string | null;
    date_range_end: string | null;
  };
}

interface SeasonalStats {
  season: string;
  commitCount: number;
  avgCommitsPerDay: number;
  avgLinesChanged: number;
  avgTemp: number;
  avgPrecipitation: number;
}

interface TempRange {
  tempRange: string;
  commitCount: number;
  avgLinesChanged: number;
}

interface PrecipCategory {
  precipCategory: string;
  commitCount: number;
  avgCommitsPerDay: number;
}

interface Correlations {
  tempVsCommits: number;
  precipVsCommits: number;
  daylightVsCommits: number;
}

export default function AnalysisPage() {
  const [stats, setStats] = useState<Stats | null>(null);
  const [seasonalStats, setSeasonalStats] = useState<SeasonalStats[]>([]);
  const [tempRanges, setTempRanges] = useState<TempRange[]>([]);
  const [precipCategories, setPrecipCategories] = useState<PrecipCategory[]>([]);
  const [correlations, setCorrelations] = useState<Correlations | null>(null);
  const [loading, setLoading] = useState(true);
  const [syncing, setSyncing] = useState(false);

  const loadData = async () => {
    setLoading(true);
    try {
      const [statsRes, analysisRes] = await Promise.all([
        fetch("/api/analysis/stats"),
        fetch("/api/analysis/correlations"),
      ]);

      const statsData = await statsRes.json();
      const analysisData = await analysisRes.json();

      setStats(statsData);
      setSeasonalStats(analysisData.seasonalStats || []);
      setTempRanges(analysisData.commitsByTemp || []);
      setPrecipCategories(analysisData.commitsByPrecip || []);
      setCorrelations(analysisData.correlations || null);
    } catch (error) {
      console.error("Failed to load data:", error);
    } finally {
      setLoading(false);
    }
  };

  const syncGitHub = async () => {
    setSyncing(true);
    try {
      const res = await fetch("/api/github/sync", { method: "POST" });
      const data = await res.json();
      if (res.ok) {
        console.log(`Synced ${data.commitsAdded} commits and ${data.prsAdded} PRs`);
        await loadData();
        return true;
      } else {
        console.error(`Error: ${data.error}`);
        return false;
      }
    } catch (error) {
      console.error(`Error: ${error instanceof Error ? error.message : "Unknown error"}`);
      return false;
    } finally {
      setSyncing(false);
    }
  };

  const syncWeather = async () => {
    setSyncing(true);
    try {
      const res = await fetch("/api/weather/sync", { method: "POST" });
      const data = await res.json();
      if (res.ok) {
        console.log(`Synced ${data.weatherAdded} days of weather data`);
        await loadData();
        return true;
      } else {
        console.error(`Error: ${data.error}`);
        return false;
      }
    } catch (error) {
      console.error(`Error: ${error instanceof Error ? error.message : "Unknown error"}`);
      return false;
    } finally {
      setSyncing(false);
    }
  };

  useEffect(() => {
    let mounted = true;
    let hasAutoSynced = false;
    
    const autoSync = async () => {
      if (hasAutoSynced) return;
      hasAutoSynced = true;
      
      try {
        const statsRes = await fetch("/api/analysis/stats");
        if (!statsRes.ok) {
          console.error("Failed to fetch stats:", statsRes.status);
          await loadData();
          return;
        }
        
        const currentStats = await statsRes.json();
        
        if (!mounted || !currentStats || !currentStats.commits) {
          await loadData();
          return;
        }
        
        // Auto-sync GitHub if no commits exist
        if (currentStats.commits.total_commits === 0 && !syncing) {
          console.log("Auto-syncing GitHub data...");
          const githubSuccess = await syncGitHub();
          if (githubSuccess && mounted) {
            // Wait a bit then sync weather
            setTimeout(async () => {
              if (mounted) {
                console.log("Auto-syncing weather data...");
                await syncWeather();
              }
            }, 2000);
          }
        } else if (currentStats.commits.total_commits > 0 && currentStats.weather.weather_days === 0 && !syncing) {
          // If we have commits but no weather data, sync weather
          console.log("Auto-syncing weather data...");
          await syncWeather();
        } else {
          // Data exists, just load it
          await loadData();
        }
      } catch (error) {
        console.error("Auto-sync error:", error);
        await loadData();
      }
    };
    
    autoSync();
    
    return () => {
      mounted = false;
    };
  }, []);

  if (loading) {
    return (
      <main className="min-h-screen p-8">
        <div className="max-w-6xl mx-auto">
          <div className="text-center">Loading...</div>
        </div>
      </main>
    );
  }

  return (
    <main className="min-h-screen p-8 bg-background">
      <div className="max-w-6xl mx-auto space-y-6">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-4xl font-bold tracking-tight">Weather & Code Analysis</h1>
            <p className="text-lg text-foreground/60 mt-2">
              How does weather affect your coding patterns?
            </p>
          </div>
          <div className="flex gap-2">
            <Button onClick={syncGitHub} disabled={syncing} variant="outline">
              <RefreshCw className={`mr-2 h-4 w-4 ${syncing ? "animate-spin" : ""}`} />
              Sync GitHub
            </Button>
            <Button onClick={syncWeather} disabled={syncing} variant="outline">
              <RefreshCw className={`mr-2 h-4 w-4 ${syncing ? "animate-spin" : ""}`} />
              Sync Weather
            </Button>
          </div>
        </div>

        {stats && (
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <Card>
              <CardHeader>
                <CardTitle className="text-lg">Commits</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="text-3xl font-bold">{stats.commits.total_commits.toLocaleString()}</div>
                <div className="text-sm text-foreground/60">
                  Across {stats.commits.total_repos} repositories
                </div>
              </CardContent>
            </Card>
            <Card>
              <CardHeader>
                <CardTitle className="text-lg">Pull Requests</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="text-3xl font-bold">{stats.pullRequests.total_prs.toLocaleString()}</div>
                <div className="text-sm text-foreground/60">
                  {stats.pullRequests.merged_prs} merged
                </div>
              </CardContent>
            </Card>
            <Card>
              <CardHeader>
                <CardTitle className="text-lg">Weather Data</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="text-3xl font-bold">{stats.weather.weather_days.toLocaleString()}</div>
                <div className="text-sm text-foreground/60">Days of data</div>
              </CardContent>
            </Card>
          </div>
        )}

        {correlations && (
          <Card>
            <CardHeader>
              <CardTitle>Correlations</CardTitle>
              <CardDescription>
                Pearson correlation coefficients (-1 to 1). Positive = more commits with higher values.
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <div className="flex items-center gap-3">
                  <Thermometer className="h-5 w-5 text-foreground/60" />
                  <div>
                    <div className="text-sm text-foreground/60">Temperature</div>
                    <div className="text-2xl font-bold">
                      {correlations.tempVsCommits.toFixed(3)}
                    </div>
                  </div>
                </div>
                <div className="flex items-center gap-3">
                  <Droplets className="h-5 w-5 text-foreground/60" />
                  <div>
                    <div className="text-sm text-foreground/60">Precipitation</div>
                    <div className="text-2xl font-bold">
                      {correlations.precipVsCommits.toFixed(3)}
                    </div>
                  </div>
                </div>
                <div className="flex items-center gap-3">
                  <Sun className="h-5 w-5 text-foreground/60" />
                  <div>
                    <div className="text-sm text-foreground/60">Daylight Hours</div>
                    <div className="text-2xl font-bold">
                      {correlations.daylightVsCommits.toFixed(3)}
                    </div>
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>
        )}

        {seasonalStats.length > 0 && (
          <Card>
            <CardHeader>
              <CardTitle>Seasonal Patterns</CardTitle>
              <CardDescription>Average commits and code changes by season</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
                {seasonalStats.map((season) => (
                  <div key={season.season} className="border rounded-lg p-4">
                    <div className="font-semibold text-lg">{season.season}</div>
                    <div className="mt-2 space-y-1 text-sm">
                      <div>
                        <span className="text-foreground/60">Commits/day: </span>
                        <span className="font-medium">{season.avgCommitsPerDay.toFixed(1)}</span>
                      </div>
                      <div>
                        <span className="text-foreground/60">Avg lines: </span>
                        <span className="font-medium">{season.avgLinesChanged.toFixed(0)}</span>
                      </div>
                      <div>
                        <span className="text-foreground/60">Avg temp: </span>
                        <span className="font-medium">{season.avgTemp.toFixed(1)}°F</span>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        )}

        {tempRanges.length > 0 && (
          <Card>
            <CardHeader>
              <CardTitle>Commits by Temperature</CardTitle>
              <CardDescription>Do you code more when it's cold or hot?</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                {tempRanges.map((range) => {
                  const maxCommits = Math.max(...tempRanges.map((r) => r.commitCount));
                  const width = maxCommits > 0 ? (range.commitCount / maxCommits) * 100 : 0;
                  return (
                    <div key={range.tempRange}>
                      <div className="flex justify-between text-sm mb-1">
                        <span className="font-medium">{range.tempRange}</span>
                        <span className="text-foreground/60">
                          {range.commitCount} commits ({range.avgLinesChanged.toFixed(0)} avg lines)
                        </span>
                      </div>
                      <div className="w-full bg-foreground/5 rounded-full h-2">
                        <div
                          className="bg-foreground h-2 rounded-full transition-all"
                          style={{ width: `${width}%` }}
                        />
                      </div>
                    </div>
                  );
                })}
              </div>
            </CardContent>
          </Card>
        )}

        {precipCategories.length > 0 && (
          <Card>
            <CardHeader>
              <CardTitle>Indoor Coding Score</CardTitle>
              <CardDescription>Do you code more when stuck inside due to rain?</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                {precipCategories.map((category) => {
                  const maxCommits = Math.max(...precipCategories.map((c) => c.commitCount));
                  const width = maxCommits > 0 ? (category.commitCount / maxCommits) * 100 : 0;
                  return (
                    <div key={category.precipCategory}>
                      <div className="flex justify-between text-sm mb-1">
                        <span className="font-medium">{category.precipCategory}</span>
                        <span className="text-foreground/60">
                          {category.commitCount} commits ({category.avgCommitsPerDay.toFixed(1)}/day)
                        </span>
                      </div>
                      <div className="w-full bg-foreground/5 rounded-full h-2">
                        <div
                          className="bg-blue-500 h-2 rounded-full transition-all"
                          style={{ width: `${width}%` }}
                        />
                      </div>
                    </div>
                  );
                })}
              </div>
            </CardContent>
          </Card>
        )}

        {(!stats || stats.commits.total_commits === 0) && (
          <Card>
            <CardContent className="pt-6">
              <div className="text-center py-8">
                <Cloud className="h-12 w-12 mx-auto text-foreground/20 mb-4" />
                <h3 className="text-lg font-semibold mb-2">No data yet</h3>
                <p className="text-foreground/60 mb-4">
                  Sync your GitHub data to start analyzing how weather affects your coding patterns.
                </p>
                <Button onClick={syncGitHub} disabled={syncing}>
                  <RefreshCw className={`mr-2 h-4 w-4 ${syncing ? "animate-spin" : ""}`} />
                  Sync GitHub Data
                </Button>
              </div>
            </CardContent>
          </Card>
        )}
      </div>
    </main>
  );
}
