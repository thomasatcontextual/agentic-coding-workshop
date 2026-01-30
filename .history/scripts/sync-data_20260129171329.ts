#!/usr/bin/env node

import { exec } from "child_process";
import { promisify } from "util";
import { runMigrations } from "../lib/db/migrations";
import { query, run, queryOne } from "../lib/db";
import { getHistoricalWeather } from "../lib/weather/client";

const execAsync = promisify(exec);

const NYC_LAT = 40.7128;
const NYC_LON = -74.006;

interface GitHubRepo {
  id: number;
  name: string;
  full_name: string;
  owner: { login: string };
  language: string | null;
  private: boolean;
}

interface GitHubCommit {
  sha: string;
  commit: {
    author: { name: string; date: string };
    message: string;
  };
  author: { login: string } | null;
  stats?: {
    additions: number;
    deletions: number;
    total: number;
  };
  files?: Array<{ filename: string; additions: number; deletions: number }>;
}

interface GitHubPullRequest {
  number: number;
  title: string;
  created_at: string;
  merged_at: string | null;
  additions?: number;
  deletions?: number;
  changed_files?: number;
}

async function ghApi<T>(endpoint: string, options?: { paginate?: boolean; queryParams?: Record<string, string> }): Promise<T> {
  // Try using GITHUB_TOKEN environment variable first
  const token = process.env.GITHUB_TOKEN;
  
  if (token) {
    // Use direct API call with token
    const https = require("https");
    return new Promise((resolve, reject) => {
      let url = `https://api.github.com/${endpoint}`;
      if (options?.queryParams) {
        const params = new URLSearchParams(options.queryParams);
        url += `?${params.toString()}`;
      }
      
      https.get(
        url,
        {
          headers: {
            Authorization: `token ${token}`,
            "User-Agent": "GitHub-Weather-Analysis",
            Accept: "application/vnd.github.v3+json",
          },
        },
        (res: any) => {
          let data = "";
          res.on("data", (chunk: string) => (data += chunk));
          res.on("end", () => {
            if (res.statusCode === 200) {
              resolve(JSON.parse(data) as T);
            } else {
              reject(new Error(`API error: ${res.statusCode} - ${data}`));
            }
          });
        }
      ).on("error", reject);
    });
  }
  
  // Fallback to gh CLI
  let cmd = `gh api ${endpoint}`;

  if (options?.queryParams) {
    const params = new URLSearchParams(options.queryParams);
    cmd += `?${params.toString()}`;
  }

  if (options?.paginate) {
    cmd += " --paginate";
  }

  try {
    const { stdout, stderr } = await execAsync(cmd);
    if (stderr && !stderr.includes("warning") && !stderr.includes("tls")) {
      console.warn(`Warning: ${stderr}`);
    }
    return JSON.parse(stdout) as T;
  } catch (error: any) {
    if (error.message?.includes("tls") || error.message?.includes("certificate")) {
      console.error("\n❌ TLS certificate error detected.");
      console.error("   Try one of these solutions:");
      console.error("   1. Set GITHUB_TOKEN environment variable:");
      console.error("      export GITHUB_TOKEN=your_token_here");
      console.error("   2. Or run: gh auth refresh");
      throw new Error("GitHub CLI authentication issue");
    }
    throw error;
  }
}

async function syncGitHub() {
  console.log("🔄 Running migrations...");
  runMigrations();

  console.log("🔍 Checking GitHub authentication...");
  try {
    // Try to get token - if this works, we're authenticated
    await execAsync("gh auth token");
    console.log("   ✅ GitHub CLI authenticated");
  } catch (error) {
    console.log("   ⚠️  Could not get auth token, but proceeding anyway...");
    console.log("   (If this fails, you may need to run: gh auth login -h github.com)");
  }

  console.log("📦 Fetching repositories...");
  const repos = await ghApi<GitHubRepo[]>("user/repos", { paginate: true });
  console.log(`   Found ${repos.length} repositories`);

  const twoYearsAgo = new Date();
  twoYearsAgo.setFullYear(twoYearsAgo.getFullYear() - 2);
  const sinceDate = twoYearsAgo.toISOString();

  let totalCommits = 0;
  let totalPRs = 0;

  for (const repo of repos) {
    if (repo.private) {
      console.log(`   ⏭️  Skipping private repo: ${repo.full_name}`);
      continue;
    }

    const [owner, repoName] = repo.full_name.split("/");
    console.log(`   📂 Processing: ${repo.full_name}`);

    // Fetch commits
    try {
      const commits = await ghApi<GitHubCommit[]>(`repos/${owner}/${repoName}/commits`, {
        paginate: true,
        queryParams: { since: sinceDate },
      });

      console.log(`      Found ${commits.length} commits`);

      for (const commit of commits) {
        // Check if commit already exists
        const existing = queryOne<{ id: number }>(
          "SELECT id FROM github_commits WHERE sha = ?",
          [commit.sha]
        );

        if (existing) continue;

        // Get detailed commit stats
        let additions = 0;
        let deletions = 0;
        let filesChanged = 0;

        try {
          const detailedCommit = await ghApi<GitHubCommit>(
            `repos/${owner}/${repoName}/commits/${commit.sha}`
          );
          additions = detailedCommit.stats?.additions ?? 0;
          deletions = detailedCommit.stats?.deletions ?? 0;
          filesChanged = detailedCommit.files?.length ?? 0;
        } catch (error) {
          console.warn(`      ⚠️  Failed to get stats for commit ${commit.sha.substring(0, 7)}`);
        }

        // Insert commit
        run(
          `INSERT INTO github_commits 
          (sha, repo_name, author, commit_date, message, additions, deletions, files_changed)
          VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
          [
            commit.sha,
            repo.full_name,
            commit.author?.login ?? commit.commit.author.name,
            commit.commit.author.date,
            commit.commit.message,
            additions,
            deletions,
            filesChanged,
          ]
        );
        totalCommits++;
      }
    } catch (error) {
      console.warn(`   ⚠️  Failed to fetch commits for ${repo.full_name}:`, error);
    }

    // Fetch pull requests
    try {
      const prs = await ghApi<GitHubPullRequest[]>(`repos/${owner}/${repoName}/pulls`, {
        paginate: true,
        queryParams: { state: "all" },
      });

      console.log(`      Found ${prs.length} pull requests`);

      for (const pr of prs) {
        // Check if PR already exists
        const existing = queryOne<{ id: number }>(
          "SELECT id FROM github_pull_requests WHERE repo_name = ? AND pr_number = ?",
          [repo.full_name, pr.number]
        );

        if (existing) continue;

        const additions = pr.additions ?? 0;
        const deletions = pr.deletions ?? 0;
        const filesChanged = pr.changed_files ?? 0;

        // Insert PR
        run(
          `INSERT INTO github_pull_requests 
          (pr_number, repo_name, title, created_at, merged_at, additions, deletions, files_changed)
          VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
          [
            pr.number,
            repo.full_name,
            pr.title,
            pr.created_at,
            pr.merged_at,
            additions,
            deletions,
            filesChanged,
          ]
        );
        totalPRs++;
      }
    } catch (error) {
      console.warn(`   ⚠️  Failed to fetch PRs for ${repo.full_name}:`, error);
    }

    // Small delay to avoid rate limits
    await new Promise((resolve) => setTimeout(resolve, 100));
  }

  console.log(`\n✅ GitHub sync complete!`);
  console.log(`   Commits added: ${totalCommits}`);
  console.log(`   PRs added: ${totalPRs}`);
}

async function syncWeather() {
  console.log("\n🌤️  Fetching weather data...");

  // Get unique dates from commits
  const commitDates = query<{ commit_date: string }>(
    `SELECT DISTINCT DATE(commit_date) as commit_date 
     FROM github_commits 
     ORDER BY commit_date`
  );

  if (commitDates.length === 0) {
    console.log("   ⚠️  No commit dates found. Sync GitHub data first.");
    return;
  }

  console.log(`   Found ${commitDates.length} unique commit dates`);

  // Find date range
  const dates = commitDates.map((d) => d.commit_date);
  const startDate = dates[0];
  const endDate = dates[dates.length - 1];

  console.log(`   Fetching weather from ${startDate} to ${endDate}...`);

  // Fetch weather data for the entire range
  const weatherData = await getHistoricalWeather(NYC_LAT, NYC_LON, startDate, endDate);

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

  console.log(`\n✅ Weather sync complete!`);
  console.log(`   Weather days added: ${weatherAdded}`);
}

async function main() {
  try {
    await syncGitHub();
    await syncWeather();
    console.log("\n🎉 All done! Data is ready for analysis.");
  } catch (error) {
    console.error("\n❌ Error:", error instanceof Error ? error.message : error);
    process.exit(1);
  }
}

main();
