"use client";

import { useState, useEffect } from "react";
import { Card, CardHeader, CardTitle, CardContent, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { RefreshCw, Cloud, Thermometer, Droplets, Sun, GitCommit, GitPullRequest, TrendingUp, Snowflake, Leaf, Sun as SunIcon, Wind } from "lucide-react";

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

const seasonConfig: Record<string, { icon: typeof Snowflake; colorClass: string; bgGradientClass: string }> = {
  Winter: { 
    icon: Snowflake, 
    colorClass: "text-blue-500", 
    bgGradientClass: "bg-gradient-to-br from-blue-50 to-cyan-50 dark:from-blue-950/20 dark:to-cyan-950/20" 
  },
  Spring: { 
    icon: Leaf, 
    colorClass: "text-green-500", 
    bgGradientClass: "bg-gradient-to-br from-green-50 to-emerald-50 dark:from-green-950/20 dark:to-emerald-950/20" 
  },
  Summer: { 
    icon: SunIcon, 
    colorClass: "text-yellow-500", 
    bgGradientClass: "bg-gradient-to-br from-yellow-50 to-orange-50 dark:from-yellow-950/20 dark:to-orange-950/20" 
  },
  Fall: { 
    icon: Leaf, 
    colorClass: "text-orange-500", 
    bgGradientClass: "bg-gradient-to-br from-orange-50 to-amber-50 dark:from-orange-950/20 dark:to-amber-950/20" 
  },
};

function CorrelationCard({ 
  icon: Icon, 
  label, 
  value, 
  colorType 
}: { 
  icon: typeof Thermometer; 
  label: string; 
  value: number; 
  colorType: 'blue' | 'green' | 'yellow';
}) {
  const absValue = Math.abs(value);
  const isPositive = value > 0;
  const strength = absValue < 0.1 ? "Weak" : absValue < 0.3 ? "Moderate" : absValue < 0.5 ? "Strong" : "Very Strong";
  
  const bgClasses = {
    blue: "bg-gradient-to-br from-blue-50 to-cyan-50 dark:from-blue-950/20 dark:to-cyan-950/20 border-blue-200 dark:border-blue-800",
    green: "bg-gradient-to-br from-green-50 to-emerald-50 dark:from-green-950/20 dark:to-emerald-950/20 border-green-200 dark:border-green-800",
    yellow: "bg-gradient-to-br from-yellow-50 to-orange-50 dark:from-yellow-950/20 dark:to-orange-950/20 border-yellow-200 dark:border-yellow-800",
  };
  
  const iconClasses = {
    blue: "text-blue-600 dark:text-blue-400",
    green: "text-green-600 dark:text-green-400",
    yellow: "text-yellow-600 dark:text-yellow-400",
  };
  
  return (
    <div className={`relative overflow-hidden rounded-xl border-2 p-6 ${bgClasses[colorType]} transition-all hover:scale-105 hover:shadow-lg`}>
      <div className="flex items-start justify-between mb-4">
        <Icon className={`h-8 w-8 ${iconClasses[colorType]}`} />
        <div className={`text-xs font-semibold px-2 py-1 rounded-full ${
          isPositive ? 'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400' : 'bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400'
        }`}>
          {isPositive ? '↑' : '↓'} {strength}
        </div>
      </div>
      <div className="space-y-1">
        <div className="text-sm font-medium text-foreground/70">{label}</div>
        <div className="text-4xl font-bold">{value.toFixed(3)}</div>
        <div className="text-xs text-foreground/50">Correlation coefficient</div>
      </div>
    </div>
  );
}

function SeasonCard({ season, stats }: { season: string; stats: SeasonalStats }) {
  const config = seasonConfig[season] || seasonConfig.Fall;
  const Icon = config.icon;
  
  return (
    <div className={`relative overflow-hidden rounded-xl border-2 p-6 ${config.bgGradientClass} transition-all hover:scale-105 hover:shadow-lg`}>
      <div className="flex items-center justify-between mb-4">
        <Icon className={`h-8 w-8 ${config.colorClass}`} />
        <div className="text-2xl font-bold">{season}</div>
      </div>
      <div className="space-y-3">
        <div>
          <div className="text-xs text-foreground/60 mb-1">Commits per day</div>
          <div className="text-3xl font-bold">{stats.avgCommitsPerDay.toFixed(1)}</div>
        </div>
        <div className="grid grid-cols-2 gap-3 pt-2 border-t border-foreground/10">
          <div>
            <div className="text-xs text-foreground/60">Avg lines</div>
            <div className="text-lg font-semibold">{stats.avgLinesChanged.toFixed(0)}</div>
          </div>
          <div>
            <div className="text-xs text-foreground/60">Avg temp</div>
            <div className="text-lg font-semibold">{stats.avgTemp.toFixed(0)}°F</div>
          </div>
        </div>
      </div>
    </div>
  );
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
      // Load stats first
      const statsRes = await fetch("/api/analysis/stats");
      if (!statsRes.ok) {
        throw new Error(`Stats API failed: ${statsRes.status}`);
      }
      const statsData = await statsRes.json();
      setStats(statsData);

      // Try correlations with timeout
      try {
        const controller = new AbortController();
        const timeoutId = setTimeout(() => controller.abort(), 10000);
        
        const analysisRes = await fetch("/api/analysis/correlations", {
          signal: controller.signal,
        });
        clearTimeout(timeoutId);
        
        if (analysisRes.ok) {
          const parsed = await analysisRes.json();
          setSeasonalStats(parsed.seasonalStats || []);
          setTempRanges(parsed.commitsByTemp || []);
          setPrecipCategories(parsed.commitsByPrecip || []);
          setCorrelations(parsed.correlations || null);
        } else {
          throw new Error(`Correlations API failed: ${analysisRes.status}`);
        }
      } catch (e: unknown) {
        if (e instanceof Error && e.name !== 'AbortError') {
          console.warn("Correlations API failed:", e);
        }
        // Set empty defaults
        setSeasonalStats([]);
        setTempRanges([]);
        setPrecipCategories([]);
        setCorrelations(null);
      }
    } catch (error) {
      console.error("Failed to load data:", error);
      // Set empty state so page still renders
      setStats({
        commits: { total_commits: 0, total_repos: 0, date_range_start: null, date_range_end: null },
        pullRequests: { total_prs: 0, merged_prs: 0 },
        weather: { weather_days: 0, date_range_start: null, date_range_end: null },
      });
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
    // Just load data, don't auto-sync
    loadData();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  if (loading) {
    return (
      <main className="min-h-screen p-8 bg-gradient-to-br from-background via-background to-foreground/5">
        <div className="max-w-7xl mx-auto">
          <div className="flex items-center justify-center min-h-[60vh]">
            <div className="text-center space-y-4">
              <RefreshCw className="h-12 w-12 mx-auto animate-spin text-foreground/40" />
              <div className="text-lg font-medium">Loading your coding patterns...</div>
            </div>
          </div>
        </div>
      </main>
    );
  }

  return (
    <main className="min-h-screen p-6 md:p-8 bg-gradient-to-br from-background via-background to-foreground/5">
      <div className="max-w-7xl mx-auto space-y-8">
        {/* Header */}
        <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
          <div className="space-y-2">
            <h1 className="text-5xl font-bold tracking-tight bg-gradient-to-r from-foreground to-foreground/60 bg-clip-text text-transparent">
              Weather & Code Analysis
            </h1>
            <p className="text-xl text-foreground/70">
              Discover how weather affects your coding patterns
            </p>
          </div>
          <div className="flex gap-2">
            <Button onClick={syncGitHub} disabled={syncing} variant="outline" size="lg" className="gap-2">
              <RefreshCw className={`h-4 w-4 ${syncing ? "animate-spin" : ""}`} />
              Sync GitHub
            </Button>
            <Button onClick={syncWeather} disabled={syncing} variant="outline" size="lg" className="gap-2">
              <RefreshCw className={`h-4 w-4 ${syncing ? "animate-spin" : ""}`} />
              Sync Weather
            </Button>
          </div>
        </div>

        {/* Stats Cards */}
        {stats && (
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            <Card className="border-2 hover:shadow-xl transition-all hover:scale-105">
              <CardHeader className="pb-3">
                <div className="flex items-center gap-3">
                  <div className="p-2 rounded-lg bg-blue-100 dark:bg-blue-900/30">
                    <GitCommit className="h-5 w-5 text-blue-600 dark:text-blue-400" />
                  </div>
                  <CardTitle className="text-lg">Commits</CardTitle>
                </div>
              </CardHeader>
              <CardContent>
                <div className="text-4xl font-bold mb-1">{stats.commits.total_commits.toLocaleString()}</div>
                <div className="text-sm text-foreground/60">
                  Across {stats.commits.total_repos} repositories
                </div>
              </CardContent>
            </Card>
            <Card className="border-2 hover:shadow-xl transition-all hover:scale-105">
              <CardHeader className="pb-3">
                <div className="flex items-center gap-3">
                  <div className="p-2 rounded-lg bg-purple-100 dark:bg-purple-900/30">
                    <GitPullRequest className="h-5 w-5 text-purple-600 dark:text-purple-400" />
                  </div>
                  <CardTitle className="text-lg">Pull Requests</CardTitle>
                </div>
              </CardHeader>
              <CardContent>
                <div className="text-4xl font-bold mb-1">{stats.pullRequests.total_prs.toLocaleString()}</div>
                <div className="text-sm text-foreground/60">
                  {stats.pullRequests.merged_prs} merged
                </div>
              </CardContent>
            </Card>
            <Card className="border-2 hover:shadow-xl transition-all hover:scale-105">
              <CardHeader className="pb-3">
                <div className="flex items-center gap-3">
                  <div className="p-2 rounded-lg bg-cyan-100 dark:bg-cyan-900/30">
                    <Cloud className="h-5 w-5 text-cyan-600 dark:text-cyan-400" />
                  </div>
                  <CardTitle className="text-lg">Weather Data</CardTitle>
                </div>
              </CardHeader>
              <CardContent>
                <div className="text-4xl font-bold mb-1">{stats.weather.weather_days.toLocaleString()}</div>
                <div className="text-sm text-foreground/60">Days of data</div>
              </CardContent>
            </Card>
          </div>
        )}

        {/* Correlations */}
        {correlations && (
          <Card className="border-2">
            <CardHeader>
              <div className="flex items-center gap-2">
                <TrendingUp className="h-5 w-5" />
                <CardTitle>Correlations</CardTitle>
              </div>
              <CardDescription>
                Pearson correlation coefficients (-1 to 1). Positive values mean more commits with higher weather values.
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <CorrelationCard
                  icon={Thermometer}
                  label="Temperature"
                  value={correlations.tempVsCommits}
                  colorType="blue"
                />
                <CorrelationCard
                  icon={Droplets}
                  label="Precipitation"
                  value={correlations.precipVsCommits}
                  colorType="green"
                />
                <CorrelationCard
                  icon={Sun}
                  label="Daylight Hours"
                  value={correlations.daylightVsCommits}
                  colorType="yellow"
                />
              </div>
            </CardContent>
          </Card>
        )}

        {/* Seasonal Patterns */}
        {seasonalStats.length > 0 && (
          <Card className="border-2">
            <CardHeader>
              <CardTitle>Seasonal Patterns</CardTitle>
              <CardDescription>Your coding activity across different seasons</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
                {seasonalStats.map((season) => (
                  <SeasonCard key={season.season} season={season.season} stats={season} />
                ))}
              </div>
            </CardContent>
          </Card>
        )}

        {/* Temperature Analysis */}
        {tempRanges.length > 0 && (
          <Card className="border-2">
            <CardHeader>
              <div className="flex items-center gap-2">
                <Thermometer className="h-5 w-5" />
                <CardTitle>Commits by Temperature</CardTitle>
              </div>
              <CardDescription>Do you code more when it&apos;s cold or hot?</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="space-y-5">
                {tempRanges.map((range, idx) => {
                  const maxCommits = Math.max(...tempRanges.map((r) => r.commitCount));
                  const width = maxCommits > 0 ? (range.commitCount / maxCommits) * 100 : 0;
                  const colorClasses = [
                    "bg-gradient-to-r from-blue-500 to-cyan-500",
                    "bg-gradient-to-r from-cyan-400 to-blue-400",
                    "bg-gradient-to-r from-green-400 to-emerald-400",
                    "bg-gradient-to-r from-yellow-400 to-orange-400",
                    "bg-gradient-to-r from-orange-500 to-red-500",
                  ];
                  const colorClass = colorClasses[idx % colorClasses.length];
                  
                  return (
                    <div key={range.tempRange} className="space-y-2">
                      <div className="flex justify-between items-center">
                        <span className="font-semibold text-base">{range.tempRange}</span>
                        <div className="flex items-center gap-4 text-sm">
                          <span className="text-foreground/60">
                            <span className="font-bold text-foreground">{range.commitCount}</span> commits
                          </span>
                          <span className="text-foreground/60">
                            <span className="font-bold text-foreground">{range.avgLinesChanged.toFixed(0)}</span> avg lines
                          </span>
                        </div>
                      </div>
                      <div className="w-full bg-foreground/5 rounded-full h-3 overflow-hidden">
                        <div
                          className={`${colorClass} h-3 rounded-full transition-all duration-500 shadow-sm`}
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

        {/* Precipitation Analysis */}
        {precipCategories.length > 0 && (
          <Card className="border-2">
            <CardHeader>
              <div className="flex items-center gap-2">
                <Droplets className="h-5 w-5" />
                <CardTitle>Indoor Coding Score</CardTitle>
              </div>
              <CardDescription>Do you code more when stuck inside due to rain?</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="space-y-5">
                {precipCategories.map((category, idx) => {
                  const maxCommits = Math.max(...precipCategories.map((c) => c.commitCount));
                  const width = maxCommits > 0 ? (category.commitCount / maxCommits) * 100 : 0;
                  const colorClasses = [
                    "bg-gradient-to-r from-sky-400 to-blue-500",
                    "bg-gradient-to-r from-blue-400 to-cyan-500",
                    "bg-gradient-to-r from-cyan-500 to-teal-500",
                    "bg-gradient-to-r from-teal-500 to-green-500",
                  ];
                  const colorClass = colorClasses[idx % colorClasses.length];
                  
                  return (
                    <div key={category.precipCategory} className="space-y-2">
                      <div className="flex justify-between items-center">
                        <span className="font-semibold text-base">{category.precipCategory}</span>
                        <div className="flex items-center gap-4 text-sm">
                          <span className="text-foreground/60">
                            <span className="font-bold text-foreground">{category.commitCount}</span> commits
                          </span>
                          <span className="text-foreground/60">
                            <span className="font-bold text-foreground">{category.avgCommitsPerDay.toFixed(1)}</span>/day
                          </span>
                        </div>
                      </div>
                      <div className="w-full bg-foreground/5 rounded-full h-3 overflow-hidden">
                        <div
                          className={`${colorClass} h-3 rounded-full transition-all duration-500 shadow-sm`}
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

        {/* Empty State */}
        {(!stats || stats.commits.total_commits === 0) && (
          <Card className="border-2">
            <CardContent className="pt-12 pb-12">
              <div className="text-center space-y-6 max-w-md mx-auto">
                <div className="relative">
                  <Cloud className="h-20 w-20 mx-auto text-foreground/20" />
                  <Wind className="h-8 w-8 mx-auto text-foreground/30 absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 animate-pulse" />
                </div>
                <div>
                  <h3 className="text-2xl font-bold mb-2">No data yet</h3>
                  <p className="text-foreground/60">
                    Sync your GitHub data to start analyzing how weather affects your coding patterns.
                  </p>
                </div>
                <Button onClick={syncGitHub} disabled={syncing} size="lg" className="gap-2">
                  <RefreshCw className={`h-4 w-4 ${syncing ? "animate-spin" : ""}`} />
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
