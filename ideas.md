# GitHub Insights Workshop - Ideas

## Overview

A personal insights dashboard using GitHub contribution data. Works even for contributions to private repos you no longer have access to (from past employers, etc.).

---

## GitHub API: What's Available

### Data You CAN Get (even for lost-access private repos)

| Data | Example |
|------|---------|
| Date | `2022-06-15` |
| Day of week | `3` (Wednesday) |
| Contribution count | `26` commits that day |
| Color intensity | `#30a14e` (for heatmap) |
| Total contributions | `3,490` for 2022 |
| Restricted count | `3,488` (private repos) |
| Contribution years | `[2014, 2015, ... 2026]` |

### Data You CANNOT Get (for lost-access repos)

- Repo names
- Commit messages
- Commit timestamps (hour/minute)
- Files changed
- Lines added/removed
- Languages used
- Collaborators

### Data You CAN Get (for repos you still have access to)

- Full commit history with timestamps
- Repo names and details
- Commit messages
- Files changed, lines added/removed
- Languages used
- Collaborators

---

## Feature Ideas

### Visualizations

- **Contribution heatmap** (like GitHub's green squares)
- **Year-over-year comparison** charts
- **Monthly trends** bar charts
- **Day-of-week analysis** ("I code most on Tuesdays")
- **Weekday vs weekend patterns**

### Insights & Analytics

- **Streak tracking** (longest streak, current streak)
- **"When did I take time off?"** (gaps in activity)
- **Work/life balance score** (weekend commit ratio)
- **Productivity patterns** by month, season
- **Career timeline** with job changes overlaid

### Nostalgia & Reflection

- "Show me my first ever commit"
- "How has my coding evolved over the years?"
- "What mass did I abandon and why?"
- "My coding journey timeline"

### Portfolio & Showcase

- Auto-generate a portfolio site from repos
- "Greatest hits" - surface best work
- Skills visualization from actual code
- Project timeline with descriptions

### Job & Career

- Generate resume bullet points from commit history
- "Prove" experience in a language/framework
- Contribution evidence for performance reviews
- Interview prep - "walk me through your projects"

### AI-Powered Features

- "Explain this old repo I wrote 5 years ago"
- "Summarize what each of my repos does"
- "Generate better READMEs for my projects"
- "Find code I wrote that does X"
- Chat with your GitHub history

### Social & Fun

- "GitHub Wrapped" - year in review
- Compare stats with friends
- "Roast my GitHub profile"
- Guess the repo from the description

### Cleanup & Maintenance

- Find repos to archive or delete
- Repos missing READMEs or licenses
- Identify repos with dependency vulnerabilities
- "What have I left half-finished?"

---

## Questions Users Might Ask

- "When am I most productive?"
- "What was I working on in [month/year]?"
- "How consistent am I?" (streaks)
- "Do I work weekends?"
- "What's my busiest day of the week?"
- "How has my output changed over time?"
- "When did I take breaks/vacations?"
- "What years was I most active?"

---

## Combining GitHub with Other Data Sources

### Time & Context Correlations

| Data Source | Insight | API Difficulty |
|-------------|---------|----------------|
| **Weather API** (Open-Meteo) | "Do I code more on rainy days?" | Easy, no auth |
| **Google Calendar** | "Meetings vs. deep work days" | OAuth required |
| **Public holidays API** | "Do I work through holidays?" | Easy, no auth |

### Health & Productivity

| Data Source | Insight |
|-------------|---------|
| **Strava** | "Am I more productive after a run?" |
| **Apple Health export** | "Sleep vs. commits correlation" |
| **Screen Time export** | "Phone usage vs. coding output" |

### Entertainment & Mood

| Data Source | Insight |
|-------------|---------|
| **Last.fm** | "What music = most commits?" |
| **Letterboxd** | "Did I binge movies during low-commit periods?" |
| **Steam playtime** | "Gaming vs. coding balance" |

### Work Context

| Data Source | Insight |
|-------------|---------|
| **LinkedIn** (manual input) | Overlay job changes on commit graph |
| **Stock prices** | "Company stock vs. my commit velocity" |

---

## Alternative/Additional APIs

If expanding beyond GitHub, these are good options:

| Service | Category | API Ease | Notes |
|---------|----------|----------|-------|
| **Last.fm** | Music | Easy | Spotify alternative, instant API key |
| **Letterboxd** | Movies | RSS feed | "Goodreads for film" |
| **Goodreads** | Books | OAuth | Reading stats |
| **Strava** | Fitness | OAuth | Running/cycling data |
| **Chess.com** | Gaming | Very easy | No auth, just username |
| **Lichess** | Gaming | Very easy | Fully open API |
| **Steam** | Gaming | Easy | Playtime, achievements |
| **Trakt** | TV Shows | Easy | Binge tracking |
| **Duolingo** | Learning | Unofficial | Streaks, languages |

### Best Combos for Workshop

1. **GitHub + Weather** - Free, no auth, fun correlation
2. **GitHub + Last.fm** - "My coding soundtrack"
3. **GitHub + Strava** - Health-conscious dev crowd
4. **GitHub + Job history** - Career timeline visualization

---

## Technical Notes

### Fetching GitHub Contribution Data

```bash
# Get contribution calendar for a year
gh api graphql -f query='
{
  user(login: "USERNAME") {
    contributionsCollection(from: "2024-01-01T00:00:00Z", to: "2024-12-31T23:59:59Z") {
      contributionCalendar {
        totalContributions
        weeks {
          contributionDays {
            contributionCount
            date
            weekday
          }
        }
      }
      restrictedContributionsCount
    }
  }
}'
```

### Key API Fields

- `contributionCalendar.weeks[].contributionDays[]` - Daily contribution data
- `restrictedContributionsCount` - Contributions to private repos you can't access
- `totalCommitContributions` - Commits to repos you CAN access
- `commitContributionsByRepository` - Breakdown by repo (only accessible repos)

### Limitations

- Events API only goes back 90 days
- Contribution calendar has dates but not times
- Private repo details hidden after losing access
- Rate limits apply (5000 requests/hour authenticated)
