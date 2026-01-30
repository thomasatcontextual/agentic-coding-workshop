# Security Scan Report

**Scan date:** 2026-01-30  
**Scope:** agentic-coding-workshop (Next.js 14, SQLite, TypeScript)

---

## 1. Environment verification

| Step | Command | Result |
|------|---------|--------|
| Install | `npm install` | OK – 415 packages |
| Lint | `npm run lint` | OK – no ESLint warnings or errors |
| Build | `npm run build` | OK – Next.js 14.2.35, static pages generated |

---

## 2. Dependency audit (`npm audit`)

**Summary:** 6 vulnerabilities (0 critical, 4 high, 2 moderate)

| Package | Severity | Issue | Fix |
|---------|----------|--------|-----|
| **next** | High | DoS via Image Optimizer `remotePatterns` (GHSA-9g9p-9gw9-jx7f) | Upgrade to next@15.5.10+ or 16.x |
| **next** | High | DoS via RSC HTTP deserialization (GHSA-h25m-26qc-wcjf) | Upgrade to next@15.0.8+ or 16.x |
| **eslint-config-next** | High | Pulls in vulnerable eslint, glob, @next/eslint-plugin-next | Upgrade to eslint-config-next@16.1.6 |
| **@next/eslint-plugin-next** | High | Vulnerable glob (command injection via CLI -c/--cmd) | Via eslint-config-next upgrade |
| **eslint** | Moderate | Stack overflow serializing circular refs (GHSA-p5wg-g6qr-c7cg) | Upgrade to eslint@9.26.0+ |
| **eslint-plugin-react-hooks** | Moderate | Depends on vulnerable eslint | Via eslint upgrade |

**Notes:**

- All findings are in **dev/build tooling** (ESLint, Next.js build). No runtime app dependencies (e.g. better-sqlite3, react) are flagged.
- Fixing requires **major upgrades**: Next 16.x, ESLint 9.x, eslint-config-next 16.x, which may introduce breaking changes.
- For **local workshop use only** (localhost, no production deploy): risk is reduced; Image Optimizer and RSC deserialization are less relevant for a static/minimal app.

**Recommendation:** Use as-is for the workshop demo. Plan a post-workshop dependency upgrade if this repo will be deployed or shared beyond local use.

---

## 3. Code-level checks

| Area | Status |
|------|--------|
| SQL injection | DB layer (`lib/db/index.ts`) uses parameterized queries only (`?` placeholders). No string concatenation into SQL. |
| API routes | None present yet. When adding: validate input, use DB helpers with params. |
| Secrets | No keys or tokens in repo. `.env*.local` is gitignored. |
| Sensitive files | `*.db`, `*.db-shm`, `*.db-wal` gitignored; `local.db` not committed. |

---

## 4. Commands to re-run scan

```bash
npm install
npm run lint
npm run build
npm audit
```

Update this file with the date and any result changes after future scans.
