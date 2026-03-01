# ClawKitchen — QA / Headless Auth

ClawKitchen is usually protected by HTTP Basic auth when it is bound to a non-localhost host (e.g. a Tailscale IP). This is intentional.

For automated/headless QA (e.g. using OpenClaw `browser` tool), you can enable a **short-lived QA cookie** flow.

## 1) Configure `qaToken`

In your OpenClaw plugin config for Kitchen (plugin id: `kitchen`), set:

- `authToken`: required when binding to a non-localhost host
- `qaToken`: optional; enables the QA-cookie bypass

Notes:
- This is **disabled by default**. If `qaToken` is not set, the bypass is not available.
- Intended for **local/dev environments only**.

## 2) Use it (one-time URL)

Visit any Kitchen URL once with `?qaToken=...`:

- `http://<host>:<port>/tickets?qaToken=<QA_TOKEN>`

Behavior:
- If the token matches, Kitchen sets an `HttpOnly` cookie `kitchenQaToken` (valid for 15 minutes) and **302-redirects** to the same URL without the query param.
- Subsequent requests will be authorized via the cookie.

## 3) Automation tip

When running browser automation, do a first navigation to a known page with the `qaToken` query param to establish the cookie, then navigate normally.
