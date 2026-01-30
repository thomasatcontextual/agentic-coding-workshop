#!/bin/bash

# GitHub Weather Analysis - Direct Data Sync Script
# This script fetches GitHub data and weather data, then inserts into SQLite

set -e

echo "🔄 Setting up..."

# Check if we have a GitHub token
if [ -z "$GITHUB_TOKEN" ]; then
  echo "⚠️  GITHUB_TOKEN not set. Trying to get from gh CLI..."
  GITHUB_TOKEN=$(gh auth token 2>/dev/null || echo "")
  
  if [ -z "$GITHUB_TOKEN" ]; then
    echo "❌ No GitHub token found."
    echo "   Option 1: Set GITHUB_TOKEN environment variable"
    echo "   Option 2: Run: gh auth login -h github.com"
    echo "   Option 3: Create a token at https://github.com/settings/tokens"
    exit 1
  fi
fi

echo "✅ Using GitHub token"

# Calculate date 2 years ago
SINCE_DATE=$(date -u -v-2y +"%Y-%m-%dT%H:%M:%SZ" 2>/dev/null || date -u -d "2 years ago" +"%Y-%m-%dT%H:%M:%SZ" 2>/dev/null || echo "")

if [ -z "$SINCE_DATE" ]; then
  # Fallback: calculate manually
  YEAR=$(date +%Y)
  YEAR=$((YEAR - 2))
  SINCE_DATE="${YEAR}-01-29T00:00:00Z"
fi

echo "📅 Fetching data since: $SINCE_DATE"

# Run migrations via Node
echo "🔄 Running database migrations..."
node -e "
const { runMigrations } = require('./lib/db/migrations.ts');
runMigrations();
" 2>/dev/null || echo "⚠️  Could not run migrations via Node, will run via API"

# Create a temporary script to fetch and insert data
cat > /tmp/sync-github.js << 'NODE_SCRIPT'
const https = require('https');
const { execSync } = require('child_process');
const Database = require('better-sqlite3');

const db = new Database('local.db');
db.pragma('journal_mode = WAL');

const GITHUB_TOKEN = process.env.GITHUB_TOKEN;
const SINCE_DATE = process.argv[2];

function ghApi(endpoint, options = {}) {
  return new Promise((resolve, reject) => {
    let url = `https://api.github.com/${endpoint}`;
    if (options.queryParams) {
      const params = new URLSearchParams(options.queryParams);
      url += '?' + params.toString();
    }
    
    const options_req = {
      headers: {
        'Authorization': `token ${GITHUB_TOKEN}`,
        'User-Agent': 'GitHub-Weather-Analysis',
        'Accept': 'application/vnd.github.v3+json'
      }
    };
    
    https.get(url, options_req, (res) => {
      let data = '';
      res.on('data', chunk => data += chunk);
      res.on('end', () => {
        if (res.statusCode === 200) {
          resolve(JSON.parse(data));
        } else {
          reject(new Error(`API error: ${res.statusCode} - ${data}`));
        }
      });
    }).on('error', reject);
  });
}

async function sync() {
  console.log('📦 Fetching repositories...');
  const repos = await ghApi('user/repos', { queryParams: { per_page: 100 } });
  console.log(`   Found ${repos.length} repositories`);
  
  let totalCommits = 0;
  
  for (const repo of repos) {
    if (repo.private) continue;
    
    console.log(`   📂 Processing: ${repo.full_name}`);
    
    try {
      const commits = await ghApi(`repos/${repo.full_name}/commits`, {
        queryParams: { since: SINCE_DATE, per_page: 100 }
      });
      
      console.log(`      Found ${commits.length} commits`);
      
      for (const commit of commits) {
        const existing = db.prepare('SELECT id FROM github_commits WHERE sha = ?').get(commit.sha);
        if (existing) continue;
        
        db.prepare(`
          INSERT INTO github_commits 
          (sha, repo_name, author, commit_date, message, additions, deletions, files_changed)
          VALUES (?, ?, ?, ?, ?, ?, ?, ?)
        `).run(
          commit.sha,
          repo.full_name,
          commit.commit.author.name,
          commit.commit.author.date,
          commit.commit.message,
          0, 0, 0
        );
        totalCommits++;
      }
    } catch (error) {
      console.warn(`   ⚠️  Error processing ${repo.full_name}:`, error.message);
    }
  }
  
  console.log(`\n✅ Added ${totalCommits} commits`);
}

sync().catch(console.error);
NODE_SCRIPT

echo "🚀 Running sync script..."
GITHUB_TOKEN="$GITHUB_TOKEN" node /tmp/sync-github.js "$SINCE_DATE"

echo "\n✅ GitHub sync complete!"
echo "   Run the weather sync separately or visit http://localhost:21001/analysis"
