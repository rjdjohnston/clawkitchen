# Claw Kitchen

Local-first UI companion for **ClawRecipes** (OpenClaw Recipes plugin).

Phase 1 focus:
- list recipes (builtin + workspace)
- edit recipes (including builtin) and save back to disk
- scaffold agents/teams via `openclaw recipes scaffold` / `scaffold-team`

## Prerequisites
- OpenClaw installed and on PATH (`openclaw`)
- ClawRecipes plugin installed/linked so `openclaw recipes ...` works

## Running locally
```bash
npm install
npm run dev -- --port 3001
```

Open:
- http://localhost:3001

## Goals
See [docs/GOALS.md](docs/GOALS.md).

## Notes
- This app shells out to `openclaw` on the same machine (local-first by design).
- Phase 2 will add marketplace/search/publish flows.
