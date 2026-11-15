---
name: jb-surface-changes-awaiting-the-eval-matrix
description: "Five changes to what an agent types or is told through `jb`: one spelling for the session, a shorter `jb.help`, `applyDisplaySettings` throwing on an unknown key, `jb.showTrack`, skipping the idle settle. Each is an A/B against the kept eval baseline."
---

# `jb` surface changes awaiting the eval matrix

Each changes what an agent types or is told, so each is an A/B against the kept
baseline ([reference/AGENT_EVALS.md](../../reference/AGENT_EVALS.md)). The
variant-server matrix has to be rebuilt first
([mcp-docs-site-pages-and-always-load](mcp-docs-site-pages-and-always-load.md)).
Filed from the 2026-11-11 MCP and `jb` audit.

- **One spelling for the session.** Desktop code gets `session`, `rootModel`
  and `pluginManager` as arguments; Web has `jb.session` and `jb.rootModel` and
  no `pluginManager`. The guide and recipes use the bare `session.` throughout,
  so they do not run on Web as written, and the bare argument goes stale after
  `jb.loadSessionSpec` within a call. The candidate is `jb.pluginManager` plus
  teaching `jb.session` everywhere.
- **`jb.help` without the plot and `rows` grammar.** About 6 of its 7.6 KB is
  display grammar that `jb.describeSlots` answers with descriptions. Run the Web
  eval with those two paragraphs cut to a pointer.
- **`applyDisplaySettings` throwing on an unknown key** instead of listing it
  under `unapplied`, as `jb.addView` throws.
- **`jb.showTrack(trackId, { settings?, viewId? })` for catalog tracks**,
  leaving `jb.addTrack` to files. A concrete alternative for the first
  candidate in
  [ablate-the-jb-spellings-agents-stumbled-on](../ready/ablate-the-jb-spellings-agents-stumbled-on.md).
- **Skipping the trailing settle on a call that changed nothing.** Every
  `run_javascript` call waits on it (`SETTLE_AFTER_CODE_MS` in
  `products/jbrowse-desktop/src/mcp/handleMcpRequest.ts`), pure reads and calls
  that just settled themselves included.

Declined by the same audit: `jb.docs()` on Web, since `jb.help` ends with the
guide's URL and a browser agent fetches it itself.
