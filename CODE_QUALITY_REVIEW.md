# Code Quality Review

**Date:** 2026-02-27  
**Scope:** Full codebase audit for remaining issues

---

## Executive Summary

| Category | Status | Count |
|----------|--------|-------|
| ESLint | Pass | 0 errors, 0 warnings |
| jscpd clones | Pass | 0 clones |
| Lib coverage (≥80%) | Pass | All lib files meet threshold |
| API route tests | Pass | All 36 routes have tests |
| fetchJson adoption | Done | Client API calls migrated to fetchJson/fetchAll |

---

## 1. ESLint

Lint passes with no errors or warnings. Cognitive complexity limits are raised for `team-editor.tsx` (40) and workflow routes/editor (45) in [eslint.config.mjs](eslint.config.mjs).

---

## 2. jscpd Clones

0 clones at min-tokens 50, min-lines 10. Recent refactors extracted shared helpers (swarms, api-handlers, readdir, TeamTabSetters, fetchJson/fetchAll).

---

## 3. fetchJson / fetchAll Usage

Client components now use `fetchJson` and `fetchAll` from [src/lib/fetch-json.ts](src/lib/fetch-json.ts) for API calls:

- **workflows-editor-client.tsx** – 4 calls (load workflow, save, sample run, load run)
- **AppShell.tsx** – agents list for team switcher
- **OrchestratorPanel.tsx** – orchestrator state
- **OrchestratorSetupModal.tsx** – orchestrator install
- **agent-editor.tsx** – fetchAll for files/skills/available; fetchJson elsewhere
- **settings-client.tsx** – cron-installation GET and PUT
- **team-editor-data.ts** – fetchAll, fetchJson
- **recipes-client, goals-client, channels-client, etc.** – fetchJson

**Remaining raw fetch:** `recipes-client` waitForTeamPageReady, gateway restart (fire-and-forget), scaffold-client (returns `{ res, json }` for caller to inspect stderr). Low priority.

---

## 4. Coverage

### Lib files (threshold: 80%)

All `src/lib/**/*.ts` files meet the 80% threshold.

### API route helpers (below 80%, not in threshold)

| File | Coverage | Note |
|------|----------|------|
| `src/app/api/recipes/team-agents/helpers.ts` | 39% | Consider adding unit tests |
| `src/app/api/scaffold/helpers.ts` | 58% | Complex; integration tests may be more practical |
| `src/app/api/teams/orchestrator/install/route.ts` | 21% | |
| `src/app/api/teams/workflow-runs/route.ts` | 21% | |
| `src/app/api/swarms/start/route.ts` | 35% | |
| `src/app/api/tickets/move/route.ts` | 56% | |
| `src/app/api/teams/files/route.ts` | 62% | |
| `src/app/api/teams/orchestrator/route.ts` | 65% | |

**Optional:** Add unit tests for helpers if they become a maintenance burden.

### Client components (0% – excluded from threshold)

React components and pages have 0% coverage. Current config focuses on lib and API.

---

## 5. API Route Test Coverage

All 36 API routes have test coverage.

---

## 6. eslint-disable Usage

All `react-hooks/exhaustive-deps` and similar disables have explanatory comments.

---

## 7. Optional Follow-ups

| Item | Effort | Note |
|------|--------|------|
| proxy.ts (0% coverage) | Low | If used in production, add tests. May be dev-only. |
| scaffold-client fetchScaffold | Low | Returns `{ res, json }`; callers need stderr for "Restart required". Could add custom helper. |
| recipes-client waitForTeamPageReady | Low | Uses raw fetch in poll; could use fetchAll for consistency. |

---

## Verification Commands

```bash
npm run lint
npm run dup:check
npm run test:run
npm run coverage
npm run refactor:report
```
