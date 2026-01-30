#!/bin/bash

set -e

echo "🔄 GitHub Weather Analysis - Data Sync"
echo ""

# Ensure we're using the right gh
GH_CMD=$(which gh || echo "gh")

# Check dependencies
if ! command -v "$GH_CMD" &> /dev/null; then
    echo "❌ GitHub CLI not found. Install: brew install gh"
    exit 1
fi

if ! command -v jq &> /dev/null; then
    echo "❌ jq not found. Install: brew install jq"
    exit 1
fi

echo "✅ Using GitHub CLI: $GH_CMD"
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

# Fetch repositories
echo "📦 Fetching repositories..."
REPOS=$($GH_CMD api user/repos --paginate --jq '.[] | select(.private == false) | .full_name')

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
    
    # Fetch commits
    COMMITS=$($GH_CMD api "repos/$REPO_FULL_NAME/commits?since=$SINCE_DATE" --paginate --jq '.[] | {sha: .sha, author: (.author.login // .commit.author.name), date: .commit.author.date, message: .commit.message}' 2>/dev/null || echo "")
    
    if [ -n "$COMMITS" ]; then
        COMMIT_COUNT=$(echo "$COMMITS" | jq -s 'length')
        echo "   Found $COMMIT_COUNT commits"
        
        # Insert commits and fetch stats for each
        INSERTED=$(echo "$COMMITS" | jq -s '.' | node -e "
        const Database = require('better-sqlite3');
        const { execSync } = require('child_process');
        const db = new Database('local.db');
        const commits = JSON.parse(require('fs').readFileSync(0, 'utf-8'));
        const ghCmd = '$GH_CMD';
        const repoFullName = '$REPO_FULL_NAME';
        
        let count = 0;
        for (const c of commits) {
          try {
            // Check if already exists
            const existing = db.prepare('SELECT id FROM github_commits WHERE sha = ?').get(c.sha);
            if (existing) continue;
            
            // Fetch detailed commit stats
            let additions = 0;
            let deletions = 0;
            let filesChanged = 0;
            
            try {
              const cmd = \`\${ghCmd} api repos/\${repoFullName}/commits/\${c.sha}\`;
              const detailed = JSON.parse(execSync(cmd, { encoding: 'utf-8', stdio: ['pipe', 'pipe', 'ignore'] }));
              additions = detailed.stats?.additions || 0;
              deletions = detailed.stats?.deletions || 0;
              filesChanged = detailed.files?.length || 0;
            } catch (e) {
              // If we can't get stats, continue with 0
            }
            
            const result = db.prepare(\`
              INSERT INTO github_commits 
              (sha, repo_name, author, commit_date, message, additions, deletions, files_changed)
              VALUES (?, ?, ?, ?, ?, ?, ?, ?)
            \`).run(
              c.sha,
              repoFullName,
              c.author || 'unknown',
              c.date,
              (c.message || '').substring(0, 1000),
              additions,
              deletions,
              filesChanged
            );
            count++;
          } catch (e) {
            // Skip duplicates/errors
          }
        }
        
        console.log(count);
        db.close();
        ")
        TOTAL_COMMITS=$((TOTAL_COMMITS + INSERTED))
    fi
    
    # Fetch pull requests
    PRS=$($GH_CMD api "repos/$REPO_FULL_NAME/pulls?state=all" --paginate --jq '.[] | {number: .number, title: .title, created_at: .created_at, merged_at: .merged_at, additions: (.additions // 0), deletions: (.deletions // 0), changed_files: (.changed_files // 0)}' 2>/dev/null || echo "")
    
    if [ -n "$PRS" ]; then
        PR_COUNT=$(echo "$PRS" | jq -s 'length')
        echo "   Found $PR_COUNT pull requests"
        
        # Insert PRs
        INSERTED=$(echo "$PRS" | jq -s '.' | node -e "
        const Database = require('better-sqlite3');
        const db = new Database('local.db');
        const prs = JSON.parse(require('fs').readFileSync(0, 'utf-8'));
        
        let count = 0;
        prs.forEach(pr => {
          try {
            const result = db.prepare(\`
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
            if (result.changes > 0) count++;
          } catch (e) {
            // Skip duplicates/errors
          }
        });
        
        console.log(count);
        db.close();
        ")
        TOTAL_PRS=$((TOTAL_PRS + INSERTED))
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
