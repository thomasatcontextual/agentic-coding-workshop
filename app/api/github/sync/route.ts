import { NextResponse } from "next/server";
import { runMigrations } from "@/lib/db/migrations";
import { run, queryOne } from "@/lib/db";
import {
  checkGitHubAuth,
  getUserRepos,
  getRepoCommits,
  getCommitStats,
  getRepoPullRequests,
} from "@/lib/github/cli";

export async function POST() {
  try {
    // Check GitHub CLI authentication
    const isAuthenticated = await checkGitHubAuth();
    if (!isAuthenticated) {
      return NextResponse.json(
        { error: "GitHub CLI not authenticated. Please run: gh auth login" },
        { status: 401 }
      );
    }

    // Run migrations
    runMigrations();

    // Calculate date 2 years ago
    const twoYearsAgo = new Date();
    twoYearsAgo.setFullYear(twoYearsAgo.getFullYear() - 2);
    const sinceDate = twoYearsAgo.toISOString();

    // Fetch repositories
    const repos = await getUserRepos();
    let totalCommits = 0;
    let totalPRs = 0;

    // Process each repository
    for (const repo of repos) {
      if (repo.private) continue; // Skip private repos for now

      const [owner, repoName] = repo.full_name.split("/");

      // Fetch commits
      try {
        const commits = await getRepoCommits(owner, repoName, sinceDate);

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
            const detailedCommit = await getCommitStats(
              owner,
              repoName,
              commit.sha
            );
            additions = detailedCommit.stats?.additions ?? 0;
            deletions = detailedCommit.stats?.deletions ?? 0;
            filesChanged = detailedCommit.files?.length ?? 0;
          } catch (error) {
            console.warn(`Failed to get stats for commit ${commit.sha}:`, error);
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
        console.warn(`Failed to fetch commits for ${repo.full_name}:`, error);
      }

      // Fetch pull requests
      try {
        const prs = await getRepoPullRequests(owner, repoName, "all");

        for (const pr of prs) {
          // Check if PR already exists
          const existing = queryOne<{ id: number }>(
            "SELECT id FROM github_pull_requests WHERE repo_name = ? AND pr_number = ?",
            [repo.full_name, pr.number]
          );

          if (existing) continue;

          // Get PR details (additions/deletions might not be in list endpoint)
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
        console.warn(`Failed to fetch PRs for ${repo.full_name}:`, error);
      }

      // Small delay to avoid rate limits
      await new Promise((resolve) => setTimeout(resolve, 100));
    }

    return NextResponse.json({
      success: true,
      reposProcessed: repos.length,
      commitsAdded: totalCommits,
      prsAdded: totalPRs,
    });
  } catch (error) {
    console.error("GitHub sync error:", error);
    return NextResponse.json(
      {
        error: error instanceof Error ? error.message : "Failed to sync GitHub data",
      },
      { status: 500 }
    );
  }
}
