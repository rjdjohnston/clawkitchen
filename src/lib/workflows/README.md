This folder contains the (early) file-first workflow model for ClawKitchen's Visual Workflows MVP.

Source of truth lives in each team workspace:

- shared-context/workflows/<id>.workflow.json

API (temporary):

- GET /api/teams/workflows?teamId=... (list)
- GET /api/teams/workflows?teamId=...&id=... (read)
- POST /api/teams/workflows { teamId, workflow } (write)
