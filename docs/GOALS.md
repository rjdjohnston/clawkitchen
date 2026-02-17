# Goals (ClawKitchen)

ClawKitchen stores goals as **markdown files** in the OpenClaw **global workspace**.

## Canonical storage root

`~/.openclaw/workspace/notes/goals/`

Each goal is a single file:

`~/.openclaw/workspace/notes/goals/<id>.md`

## Frontmatter schema

Goals are markdown with YAML frontmatter:

```yaml
---
id: increase-trial-activation
title: Increase trial activation
status: planned # planned|active|done
tags: [growth, onboarding]
teams: [development-team, marketing-team]
updatedAt: 2026-02-17T00:30:00Z
---
```

Body below the frontmatter is freeform markdown.

## Multi-team association

A goal that spans multiple teams is represented by **one canonical goal file**.
Use `teams: [...]` to associate it with multiple teams. The UI supports filtering by team.

## Safety

The Goals API:
- restricts writes/reads to the allowlisted goals root
- rejects path traversal
- validates goal ids (lowercase letters/numbers/hyphens)
