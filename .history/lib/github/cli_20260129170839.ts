import { exec } from "child_process";
import { promisify } from "util";

const execAsync = promisify(exec);

export interface GitHubRepo {
  id: number;
  name: string;
  full_name: string;
  owner: { login: string };
  language: string | null;
  private: boolean;
}

export interface GitHubCommit {
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

export interface GitHubPullRequest {
  number: number;
  title: string;
  created_at: string;
  merged_at: string | null;
  additions?: number;
  deletions?: number;
  changed_files?: number;
}

async function ghApi<T>(
  endpoint: string,
  options?: { paginate?: boolean; queryParams?: Record<string, string> }
): Promise<T> {
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
    if (stderr && !stderr.includes("warning")) {
      throw new Error(stderr);
    }
    return JSON.parse(stdout) as T;
  } catch (error) {
    if (error instanceof Error) {
      if (error.message.includes("gh: command not found")) {
        throw new Error(
          "GitHub CLI not found. Please install it: brew install gh"
        );
      }
      if (error.message.includes("authentication")) {
        throw new Error(
          "GitHub CLI not authenticated. Please run: gh auth login"
        );
      }
    }
    throw error;
  }
}

export async function checkGitHubAuth(): Promise<boolean> {
  try {
    await execAsync("gh auth status");
    return true;
  } catch {
    return false;
  }
}

export async function getUserRepos(): Promise<GitHubRepo[]> {
  return ghApi<GitHubRepo[]>("user/repos", { paginate: true });
}

export async function getRepoCommits(
  owner: string,
  repo: string,
  since?: string
): Promise<GitHubCommit[]> {
  const params: Record<string, string> = {};
  if (since) {
    params.since = since;
  }
  return ghApi<GitHubCommit[]>(`repos/${owner}/${repo}/commits`, {
    paginate: true,
    queryParams: params,
  });
}

export async function getCommitStats(
  owner: string,
  repo: string,
  sha: string
): Promise<GitHubCommit> {
  return ghApi<GitHubCommit>(`repos/${owner}/${repo}/commits/${sha}`);
}

export async function getRepoPullRequests(
  owner: string,
  repo: string,
  state: "open" | "closed" | "all" = "all"
): Promise<GitHubPullRequest[]> {
  return ghApi<GitHubPullRequest[]>(`repos/${owner}/${repo}/pulls`, {
    paginate: true,
    queryParams: { state },
  });
}
