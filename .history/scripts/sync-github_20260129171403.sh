#!/bin/bash

set -e

echo "🔄 GitHub Weather Analysis - Data Sync"
echo ""

# Check dependencies
if ! command -v jq &> /dev/null; then
    echo "❌ jq not found. Install: brew install jq"
    exit 1
fi

# Check for GitHub token
GITHUB_TOKEN="${GITHUB_TOKEN:-}"
if [ -z "$GITHUB_TOKEN" ]; then
    # Try to get from gh CLI
    GITHUB_TOKEN=$(gh auth token 2>/dev/null || echo "")
fi

if [ -z "$GITHUB_TOKEN" ]; then
    echo "❌ No GitHub token found."
    echo "   Set GITHUB_TOKEN environment variable:"
    echo "   export GITHUB_TOKEN=your_token_here"
    echo "   Or create token at: https://github.com/settings/tokens"
    exit 1
fi

echo "✅ Using GitHub token"
echo ""

# Run migrations first (via Node)
echo "🔄 Running database migrations..."
node -e "
const { runMigrations } = require('./lib/db/migrations.ts');
runMigrations();
console.log('✅ Migrations complete');
" 2>/dev/null || {
    echo "⚠️  Could not run migrations via Node, creating tables manually..."
    sqlite3 local.db <<EOF
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
);
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
);
CREATE INDEX IF NOT EXISTS idx_commits_date ON github_commits(commit_date);
CREATE INDEX IF NOT EXISTS idx_commits_repo ON github_commits(repo_name);
EOF
    echo "✅ Tables created"
}

# Calculate date 2 years ago
if [[ "$OSTYPE" == "darwin"* ]]; then
    SINCE_DATE=$(date -u -v-2y +"%Y-%m-%dT%H:%M:%SZ" 2>/dev/null || date -u -j -f "%Y-%m-%d" "$(date +%Y-%m-%d)" -v-2y +"%Y-%m-%dT%H:%M:%SZ")
else
    SINCE_DATE=$(date -u -d "2 years ago" +"%Y-%m-%dT%H:%M:%SZ")
fi

echo "📅 Fetching commits since: $SINCE_DATE"
echo ""

# Fetch repositories using curl (bypasses TLS issues)
echo "📦 Fetching repositories..."
REPOS=$(curl -s -H "Authorization: token $GITHUB_TOKEN" \
    -H "Accept: application/vnd.github.v3+json" \
    "https://api.github.com/user/repos?per_page=100&type=all" | \
    jq -r '.[] | select(.private == false) | .full_name')

REPO_COUNT=$(echo "$REPOS" | wc -l | tr -d ' ')
echo "   Found $REPO_COUNT public repositories"
echo ""

# Process each repository
TOTAL_COMMITS=0
TOTAL_PRS=0

while IFS= read -r REPO_FULL_NAME; do
    if [ -z "$REPO_FULL_NAME" ]; then
        continue
    fi
    
    echo "📂 Processing: $REPO_FULL_NAME"
    
    # Fetch commits using curl
    COMMITS=$(curl -s -H "Authorization: token $GITHUB_TOKEN" \
        -H "Accept: application/vnd.github.v3+json" \
        "https://api.github.com/repos/$REPO_FULL_NAME/commits?since=$SINCE_DATE&per_page=100" | \
        jq '.[] | {sha: .sha, author: (.author.login // .commit.author.name), date: .commit.author.date, message: .commit.message}' 2>/dev/null || echo "")
    
    if [ -n "$COMMITS" ]; then
        COMMIT_COUNT=$(echo "$COMMITS" | jq -s 'length')
        echo "   Found $COMMIT_COUNT commits"
        
        # Insert commits using Node.js (easier than bash for SQL escaping)
        echo "$COMMITS" | jq -c '.' | node -e "
        const Database = require('better-sqlite3');
        const db = new Database('local.db');
        const readline = require('readline');
        
        const rl = readline.createInterface({
          input: process.stdin,
          output: process.stdout,
          terminal: false
        });
        
        let count = 0;
        rl.on('line', (line) => {
          try {
            const commits = JSON.parse(line);
            if (Array.isArray(commits)) {
              commits.forEach(c => {
                try {
                  db.prepare(\`
                    INSERT OR IGNORE INTO github_commits 
                    (sha, repo_name, author, commit_date, message, additions, deletions, files_changed)
                    VALUES (?, ?, ?, ?, ?, 0, 0, 0)
                  \`).run(
                    c.sha,
                    '$REPO_FULL_NAME',
                    c.author || 'unknown',
                    c.date,
                    (c.message || '').substring(0, 1000)
                  );
                  count++;
                } catch (e) {
                  // Skip duplicates
                }
              });
            } else {
              const c = commits;
              try {
                db.prepare(\`
                  INSERT OR IGNORE INTO github_commits 
                  (sha, repo_name, author, commit_date, message, additions, deletions, files_changed)
                  VALUES (?, ?, ?, ?, ?, 0, 0, 0)
                \`).run(
                  c.sha,
                  '$REPO_FULL_NAME',
                  c.author || 'unknown',
                  c.date,
                  (c.message || '').substring(0, 1000)
                );
                count++;
              } catch (e) {
                // Skip duplicates
              }
            }
          } catch (e) {
            // Skip invalid JSON
          }
        });
        
        rl.on('close', () => {
          console.log(count);
          db.close();
        });
        " | while read -r INSERTED; do
            TOTAL_COMMITS=$((TOTAL_COMMITS + INSERTED))
        done
    fi
    
    # Fetch pull requests using curl
    PRS=$(curl -s -H "Authorization: token $GITHUB_TOKEN" \
        -H "Accept: application/vnd.github.v3+json" \
        "https://api.github.com/repos/$REPO_FULL_NAME/pulls?state=all&per_page=100" | \
        jq '.[] | {number: .number, title: .title, created_at: .created_at, merged_at: .merged_at, additions: (.additions // 0), deletions: (.deletions // 0), changed_files: (.changed_files // 0)}' 2>/dev/null || echo "")
    
    if [ -n "$PRS" ]; then
        PR_COUNT=$(echo "$PRS" | jq -s 'length')
        echo "   Found $PR_COUNT pull requests"
        
        # Insert PRs
        echo "$PRS" | jq -c '.' | node -e "
        const Database = require('better-sqlite3');
        const db = new Database('local.db');
        const readline = require('readline');
        
        const rl = readline.createInterface({
          input: process.stdin,
          output: process.stdout,
          terminal: false
        });
        
        let count = 0;
        rl.on('line', (line) => {
          try {
            const prs = JSON.parse(line);
            if (Array.isArray(prs)) {
              prs.forEach(pr => {
                try {
                  db.prepare(\`
                    INSERT OR IGNORE INTO github_pull_requests 
                    (pr_number, repo_name, title, created_at, merged_at, additions, deletions, files_changed)
                    VALUES (?, ?, ?, ?, ?, ?, ?, ?)
                  \`).run(
                    pr.number,
                    '$REPO_FULL_NAME',
                    pr.title || '',
                    pr.created_at,
                    pr.merged_at || null,
                    pr.additions || 0,
                    pr.deletions || 0,
                    pr.changed_files || 0
                  );
                  count++;
                } catch (e) {
                  // Skip duplicates
                }
              });
            } else {
              const pr = prs;
              try {
                db.prepare(\`
                  INSERT OR IGNORE INTO github_pull_requests 
                  (pr_number, repo_name, title, created_at, merged_at, additions, deletions, files_changed)
                  VALUES (?, ?, ?, ?, ?, ?, ?, ?)
                  \`).run(
                    pr.number,
                    '$REPO_FULL_NAME',
                    pr.title || '',
                    pr.created_at,
                    pr.merged_at || null,
                    pr.additions || 0,
                    pr.deletions || 0,
                    pr.changed_files || 0
                  );
                  count++;
              } catch (e) {
                // Skip duplicates
              }
            }
          } catch (e) {
            // Skip invalid JSON
          }
        });
        
        rl.on('close', () => {
          console.log(count);
          db.close();
        });
        " | while read -r INSERTED; do
            TOTAL_PRS=$((TOTAL_PRS + INSERTED))
        done
    fi
    
    echo ""
    
    # Small delay to avoid rate limits
    sleep 0.1
    
done <<< "$REPOS"

echo "✅ GitHub sync complete!"
echo "   Commits added: $TOTAL_COMMITS"
echo "   PRs added: $TOTAL_PRS"
echo ""
echo "🌤️  Now fetching weather data..."

# Fetch weather data
node scripts/sync-weather.js || {
    echo "⚠️  Weather sync script not found, skipping..."
}

echo ""
echo "🎉 All done! Visit http://localhost:21001/analysis to view results."
