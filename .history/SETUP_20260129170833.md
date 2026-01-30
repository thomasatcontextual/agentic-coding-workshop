# GitHub Weather Analysis Setup

## Prerequisites

1. **GitHub CLI** - Install if not already installed:
   ```bash
   # macOS
   brew install gh
   
   # Or download from: https://cli.github.com/
   ```

2. **Authenticate GitHub CLI**:
   ```bash
   gh auth login
   ```
   Follow the prompts to authenticate via browser OAuth (no manual API key needed!)

3. **Verify authentication**:
   ```bash
   gh auth status
   ```

## Running the App

1. **Install dependencies** (if not already done):
   ```bash
   npm install
   ```

2. **Start development server**:
   ```bash
   npm run dev
   ```

3. **Open the app**:
   - Home: http://localhost:3000
   - Analysis Dashboard: http://localhost:3000/analysis

## First-Time Setup

1. **Sync GitHub Data**:
   - Go to http://localhost:3000/analysis
   - Click "Sync GitHub" button
   - This will fetch commits and PRs from your repositories (last 2 years)
   - May take a few minutes depending on repository count

2. **Sync Weather Data**:
   - After GitHub sync completes, click "Sync Weather"
   - This fetches historical weather data for NYC for all commit dates
   - Uses Open-Meteo API (free, no API key needed)

3. **View Analysis**:
   - The dashboard will automatically show correlations and patterns
   - Explore seasonal patterns, temperature correlations, and precipitation effects

## Troubleshooting

**"GitHub CLI not found"**:
- Install GitHub CLI: `brew install gh`

**"GitHub CLI not authenticated"**:
- Run: `gh auth login`
- Choose "GitHub.com" and "HTTPS" when prompted
- Complete browser authentication

**"No data yet"**:
- Make sure you've synced GitHub data first
- Then sync weather data
- Refresh the page

**Rate Limits**:
- GitHub CLI has the same rate limits as the API (5000 requests/hour)
- If you hit limits, wait an hour and try again
- The sync process includes small delays to avoid hitting limits

## Data Storage

All data is stored locally in `local.db` (SQLite database):
- GitHub commits and PRs
- Weather data
- Analysis cache

The database file is gitignored and stays local to your machine.
