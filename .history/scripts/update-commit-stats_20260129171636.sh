#!/bin/bash

set -e

echo "🔄 Updating commit stats (additions/deletions)..."
echo ""

GH_CMD=$(which gh || echo "gh")

# Get all commits without stats
sqlite3 local.db "SELECT sha, repo_name FROM github_commits WHERE additions = 0 AND deletions = 0 LIMIT 100" | while IFS='|' read -r SHA REPO_NAME; do
    if [ -z "$SHA" ]; then
        continue
    fi
    
    echo "   Fetching stats for $SHA..."
    
    # Fetch detailed commit
    DETAILED=$($GH_CMD api "repos/$REPO_NAME/commits/$SHA" 2>/dev/null || echo "{}")
    
    if [ "$DETAILED" != "{}" ]; then
        ADDITIONS=$(echo "$DETAILED" | jq -r '.stats.additions // 0')
        DELETIONS=$(echo "$DETAILED" | jq -r '.stats.deletions // 0')
        FILES=$(echo "$DETAILED" | jq -r '.files | length // 0')
        
        sqlite3 local.db "UPDATE github_commits SET additions = $ADDITIONS, deletions = $DELETIONS, files_changed = $FILES WHERE sha = '$SHA'"
    fi
    
    sleep 0.1
done

echo ""
echo "✅ Done updating commit stats"
