---
name: desktop-mcp-and-jb-small-defects
description: Three `jb` and Desktop MCP defects an audit left unclaimed — `jb.setSession` blaming the document in production for a wrongly typed live value, a failed apply closing views first, and macOS Connect an AI agent... with no window showing no dialog.
---

# Desktop MCP and `jb` small defects

Each was found by an audit of `products/jbrowse-desktop/electron/mcp/`,
`products/jbrowse-desktop/src/mcp/` and `packages/app-core/src/JbApi/`.

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
