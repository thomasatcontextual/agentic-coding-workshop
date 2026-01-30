# Data Sync Scripts

## Quick Start

Run the sync script to fetch GitHub data and weather data:

```bash
npm run sync
```

## Prerequisites

1. **GitHub CLI Authentication**:
   ```bash
   gh auth login -h github.com
   ```
   
   If you get TLS certificate errors, you can also use a personal access token:
   ```bash
   export GITHUB_TOKEN=your_token_here
   npm run sync
   ```

2. **Create GitHub Token** (if CLI doesn't work):
   - Go to https://github.com/settings/tokens
   - Create a new token with `repo` scope
   - Set it as environment variable: `export GITHUB_TOKEN=your_token`

## What It Does

1. **Runs database migrations** - Creates tables if they don't exist
2. **Fetches GitHub data**:
   - Lists all your repositories
   - Fetches commits from last 2 years
   - Fetches pull requests
   - Stores everything in SQLite database
3. **Fetches weather data**:
   - Gets unique commit dates
   - Fetches historical weather for NYC
   - Stores weather data in database

## Troubleshooting

**TLS Certificate Error**:
- Try: `gh auth refresh`
- Or use a personal access token instead

**No data synced**:
- Check that you have repositories with commits in the last 2 years
- Verify GitHub CLI is authenticated: `gh auth status`
