import { exec } from "./index";

export function runMigrations() {
  // GitHub commits table
  exec(`
    CREATE TABLE IF NOT EXISTS github_commits (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      sha TEXT UNIQUE NOT NULL,
      repo_name TEXT NOT NULL,
      author TEXT NOT NULL,
      commit_date DATETIME NOT NULL,
      message TEXT,
      additions INTEGER DEFAULT 0,
      deletions INTEGER DEFAULT 0,
      files_changed INTEGER DEFAULT 0,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP
    )
  `);

  // GitHub pull requests table
  exec(`
    CREATE TABLE IF NOT EXISTS github_pull_requests (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      pr_number INTEGER NOT NULL,
      repo_name TEXT NOT NULL,
      title TEXT,
      created_at DATETIME NOT NULL,
      merged_at DATETIME,
      additions INTEGER DEFAULT 0,
      deletions INTEGER DEFAULT 0,
      files_changed INTEGER DEFAULT 0,
      stored_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      UNIQUE(repo_name, pr_number)
    )
  `);

  // Weather data table
  exec(`
    CREATE TABLE IF NOT EXISTS weather_data (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      date DATE UNIQUE NOT NULL,
      location TEXT DEFAULT 'NYC',
      temp_min REAL,
      temp_max REAL,
      temp_avg REAL,
      precipitation REAL DEFAULT 0,
      humidity INTEGER,
      cloud_cover INTEGER,
      daylight_hours REAL,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP
    )
  `);

  // Analysis cache table
  exec(`
    CREATE TABLE IF NOT EXISTS analysis_cache (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      metric_type TEXT NOT NULL,
      date DATE NOT NULL,
      value REAL NOT NULL,
      weather_factor TEXT,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP
    )
  `);

  // Create indexes for performance
  exec(`
    CREATE INDEX IF NOT EXISTS idx_commits_date ON github_commits(commit_date);
    CREATE INDEX IF NOT EXISTS idx_commits_repo ON github_commits(repo_name);
    CREATE INDEX IF NOT EXISTS idx_prs_date ON github_pull_requests(created_at);
    CREATE INDEX IF NOT EXISTS idx_weather_date ON weather_data(date);
  `);
}
