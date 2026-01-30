# Agentic Coding Workshop – Plan

This document plans: (1) security scan of the codebase, (2) launch/build environment, and (3) documentation. It is for the **coding workshop focused on agentic coding values** and the projected demo. Feedback and changes from facilitators or participants should be incorporated here without deviating from the intended demo flow.

---

## 1. Security Scan Plan

### Scope

- **In scope**: This repo only (no transitive or external services in scope unless you add them).
- **Focus**: Next.js 14 app, SQLite via `better-sqlite3`, UI components, and any API routes or server code you add during the workshop.

### 1.1 Automated Checks (pre-workshop or CI)

| Check | Tool / Method | What it covers |
|-------|----------------|----------------|
| **Dependencies** | `npm audit` | Known CVEs in `package.json` deps |
| **Lint** | `npm run lint` | ESLint (Next + TypeScript); catches some unsafe patterns |
| **Build** | `npm run build` | TypeScript and Next build; ensures no broken imports or types |

**Commands to run:**

```bash
npm install
npm run lint
npm run build
npm audit
```

Resolve any `npm audit` high/critical before the demo. Document acceptable exceptions (e.g. dev-only, false positive) in this file or a short `SECURITY.md` if you add one.

### 1.2 Code-Level Security Checklist

Use this when **adding or reviewing** features during the workshop (e.g. API routes, forms, DB usage):

| Area | Rule | Current / workshop guidance |
|------|------|-----------------------------|
| **SQL** | Use parameterized queries only (`?` placeholders in `lib/db`: `query`, `queryOne`, `run`). Never concatenate user input into SQL. | DB layer already uses params; any new routes must do the same. |
| **API routes** | Validate and sanitize request body/query; reject invalid shapes; use `NextResponse.json()` with sensible status codes. | No API routes yet; when adding (e.g. Todo CRUD), validate input and use DB helpers with params. |
| **Secrets** | No keys/tokens in repo. Use `process.env` and `.env*.local` (gitignored). | No secrets in repo today. If workshop adds GitHub/weather API keys, document “use env vars only” in CLAUDE.md/AGENTS.md. |
| **Headers / CSP** | Optional: later add security headers (e.g. in `next.config.mjs`) if you expose the app beyond localhost. | Not required for local workshop demo. |
| **SQLite file** | `local.db` and `*.db*` are gitignored. DB is local-only. | No change needed for demo. |

### 1.3 When to Run the Scan

- **Before workshop**: Run automated checks once; fix critical/high issues.
- **During workshop**: If you add API routes or forms, apply the code-level checklist to new code; keep using parameterized SQL and env-based secrets.
- **After feedback**: If someone suggests a security improvement, add it to this checklist or to the automation steps above and note it here.

### 1.4 Output / Documentation

- Keep a one-line note in this file after each run, e.g.  
  `Last scan: YYYY-MM-DD — npm audit: 0 high/critical; lint/build: OK.`
- No separate security report is required unless you decide to add a `SECURITY.md` for participants.

### 1.5 Current Scan Status (as of plan creation)

- **Lint**: `npm run lint` — OK (no ESLint warnings or errors).
- **Build**: `npm run build` — OK (Next.js 14.2.35, static pages generated).
- **npm audit**: 6 vulnerabilities (2 moderate, 4 high) in dev/dependency chain:
  - ESLint (moderate), glob (high) via eslint-config-next / Next tooling.
  - Next.js (high): Image Optimizer DoS, RSC deserialization DoS (see advisories).
  - **Recommendation for workshop**: For a **local-only demo** (localhost, no production deploy), risk is reduced. Fixing all issues would require `npm audit fix --force` (Next 16, ESLint 9, etc.) and may break the demo. Document this for the facilitator; optionally plan a post-workshop dependency upgrade.

---

## 2. Launch and Build Environment Plan

### 2.1 Prerequisites

- **Node.js**: v18+ (LTS recommended). Check: `node -v`
- **npm**: v9+ (usually with Node). Check: `npm -v`
- **Git**: For cloning and optional version control during the workshop.

### 2.2 One-Time Setup

```bash
# From repo root
cd /path/to/agentic-coding-workshop   # or your clone path
npm install
```

- No `.env` is required for the minimal starter (no API keys yet).
- If the workshop adds an API that needs keys (e.g. GitHub, Open-Meteo), create `.env.local` and add variables there; document the exact names in CLAUDE.md (e.g. `GITHUB_TOKEN`).

### 2.3 Commands

| Command | Purpose | When to use |
|---------|--------|-------------|
| `npm run dev` | Start Next.js dev server (default port 3000) | During workshop; hot reload. |
| `npm run build` | Production build | Before “production” demo or to verify build. |
| `npm run start` | Run production build (after `npm run build`) | Optional; for showing production mode. |
| `npm run lint` | Run ESLint | Before committing or when checking code quality. |

### 2.4 Verification

1. **Install**: `npm install` completes without errors.
2. **Dev**: `npm run dev` → open http://localhost:3000 → see “Hello, World!” and “Welcome to the Agentic Coding Workshop”.
3. **Build**: `npm run build` succeeds.
4. **Lint**: `npm run lint` passes.

If any step fails, fix before the demo (and note the fix in “Troubleshooting” below or in README).

### 2.5 Troubleshooting (to extend with feedback)

- **Port 3000 in use**: Start on another port: `npm run dev -- -p 3001`.
- **Native module (better-sqlite3)**: Requires a working Node native build toolchain (e.g. Xcode CLI tools on macOS). If a participant cannot install it, document the exact error and consider a fallback (e.g. optional SQLite) only if it doesn’t change the projected demo.
- **Database**: `local.db` is created on first use; ensure the app directory is writable.

---

## 3. Documentation Plan

### 3.1 Existing Docs (do not remove; extend as needed)

| Document | Role |
|----------|------|
| **README.md** | First touch: quick start, stack, commands. |
| **CLAUDE.md** | Detailed usage for AI/agents: stack, project layout, DB helpers, API route pattern, UI components, workshop ideas. |
| **AGENTS.md** | Conventions for coding agents: setup, structure, patterns, style, testing, git. |
| **ideas.md** | Feature and integration ideas (e.g. GitHub Insights, APIs). |
| **.cursor/rules/** | Cursor-specific rules (API routes, DB, UI, etc.). |

### 3.2 Documentation Principles for the Demo

- **Single source of truth**: Keep “how to run and build” in README and this plan; keep “how to write code” in CLAUDE.md and AGENTS.md so agents and humans stay aligned.
- **Demo alignment**: All docs should support the **projected demo** (minimal starter → add one or more of: Todo list, Weather, GitHub viewer, etc.). Avoid documenting features or flows that are out of scope for the workshop.
- **Feedback loop**: When you receive input (e.g. “add a section on X”, “clarify Y”), update the relevant doc and, if it affects security or environment, update this plan as well.

### 3.3 Suggested Additions (only if they support the demo)

- **WORKSHOP_PLAN.md** (this file): Security scan, env/build, and doc plan; place for “last scan” and troubleshooting.
- **Optional**: Short “Workshop flow” subsection in README or CLAUDE.md (e.g. “1. Start with Hello World 2. Add Todo API + page 3. …”) if the facilitator wants a written script.
- **Optional**: `SECURITY.md` only if you want a dedicated place for security contact or policy; otherwise this plan is enough.

### 3.4 What Not to Do

- Do not add documentation for features that are not part of the projected demo.
- Do not duplicate the same instructions in many places; link (e.g. “See WORKSHOP_PLAN.md for launch and security”) instead.
- Do not change the intended agentic-coding flow (e.g. “agent adds a page/API/component following CLAUDE.md and AGENTS.md”) without explicit facilitator input.

---

## 4. Feedback and Changes

- **Taking input**: When you get feedback (from facilitators or participants), implement it in the repo and in the relevant doc (README, CLAUDE.md, AGENTS.md, or this plan).
- **Staying on demo**: If a suggestion would deviate from the projected demo, either (a) note it as a “post-workshop” idea in `ideas.md` or (b) get explicit approval before changing the demo flow.
- **Updating this plan**: When you add a security step, env var, or doc section, add a short note in the relevant section above and, if useful, a one-line “Changelog” below.

### Changelog (optional)

- *(2026-01-30)* Initial plan: security scan, launch/build env, documentation. Verified: `npm install` → `npm run lint` → `npm run build` OK; `npm audit` shows 6 vulns (see §1.5).

---

## Quick Reference

| Need | Where to look |
|------|----------------|
| Run the app | README / §2.3 above |
| Security scan steps | §1.1, §1.2 |
| Add API route safely | CLAUDE.md, AGENTS.md, §1.2 |
| Workshop ideas | ideas.md, CLAUDE.md “Workshop Ideas” |
| Agent conventions | AGENTS.md, .cursor/rules/ |
