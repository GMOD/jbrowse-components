---
name: desktop-mcp-and-jb-small-defects
description: Small Desktop MCP and `jb` defects — a screenshot outliving the stdio timeout, a cached version-skew note, `jb.setSession` blaming the document in production, a failed apply closing views first, and macOS Connect an AI agent... with no window showing no dialog.
---

# Desktop MCP and `jb` small defects

The first four were found by the 2026-11-11 audit of `products/jbrowse-desktop/electron/mcp/`,
`products/jbrowse-desktop/src/mcp/` and `packages/app-core/src/JbApi/`, and
still stands on main as of 2026-11-15.

- **A screenshot can outlive the stdio timeout.** `LONGEST_CALL_MS`
  (`electron/mcp/budgets.ts`) counts a screenshot as one relay; it chains a
  settle, a paint and, for a full page, a second settle, paint and measure,
  and the 20 s wait for a listening page (`READY_WAIT_MS` in `bridge.ts`) runs
  before any relay's timer. The stdio timeout can fire first, which gives a
  vaguer error and no cancel, not a hang.
- **The docs version-skew note is cached for the shim's whole life**
  (`docsSkewNote` in `electron/mcp/stdioServer.ts` sets `skewChecked` once).
  Claude Desktop keeps one shim across app relaunches and updates, so the note
  describes the first app the shim reached.
- **`jb.setSession` in a production build refuses every document once the
  live session holds a wrongly typed value, and blames the document.** The
  `typecheck(getType(session), next)` it runs first (`jbApi.ts`) validates the
  merged snapshot, and production MST skips the write checks that would have
  kept the bad value out.
- **A failure while a document is being applied can still close views
  first** (a lifecycle hook throwing, two nodes claiming one id):
  `takeOutViewsMissingFrom` runs before `applySnapshot`, and the typecheck
  catches type errors only.
- **On macOS, Help → Connect an AI agent... with no window open opens a
  window but no dialog.** `connectAgent` in `electron/electron.ts` only calls
  `ensureWindow()` when `wm.current` is null, and pushing `connectAgentSetup`
  right after the load would be discarded, because `ConnectAgentHost`
  subscribes in an effect after the load finishes. A fix would have the main
  process hold the request and the host ask for it when it mounts. Found
  reading `electron.ts`, not by the audit above.
