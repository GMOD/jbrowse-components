---
name: mcp-and-jb-audit-followups
description: "Left open by the 2026-11-11 audit of the MCP server and `jb` API: an unverified macOS shim/app path mismatch, `open` answering for the wrong page on a cold start, a release note, surface changes awaiting the eval matrix. Read before touching or re-auditing `electron/mcp/` or `JbApi/`."
---

# MCP and `jb` audit follow-ups

- **In:** Desktop's MCP transport (`products/jbrowse-desktop/electron/mcp/`),
  the renderer handler (`products/jbrowse-desktop/src/mcp/`), `jb`
  (`packages/app-core/src/JbApi/`) and the agent-facing texts.
- **Out:** the findings that landed. `git log d1d43cdfe5^..30c452449b` on those
  paths holds them, each commit body naming the defect.

Claim a step here before starting it.

## Next

- **Verify the macOS rendezvous on a Mac, before the next Desktop release.**
  The app and the shim both derive the socket directory from `os.tmpdir()`
  (`electron/mcp/socketPath.ts`), which reads `TMPDIR`. A reviewer recalled that
  MCP SDK clients spawn a stdio server with only `HOME`, `LOGNAME`, `PATH`,
  `SHELL`, `TERM` and `USER`; nobody checked. If Claude Desktop does that, the
  shim looks in `/tmp` and the app serves under `/var/folders/…`, and the README's
  Claude Desktop setup cannot connect.
  - The test: on a Mac, connect from Claude Desktop and call any tool.
  - If it fails: add a candidate derived from the home directory, which every
    client passes, to `socketDirs`.
- **`open` can answer for the wrong page.** `bridge.ts` records
  `before = listening?.install` and then accepts any page announcement as the
  new session. During a cold start, or while an earlier navigation is in flight,
  the first page's `startScreen` announcement answers "fell back to the start
  screen" while the target is still loading, and a `session` announcement
  reports the previous session as the new one. Every `open` test in
  `bridge.test.ts` announces before calling, so this is untested.
  - The fix: a nonce carried through the launch and echoed back in
    `McpReadyState`, with a test that calls `open` before any page announced.
- **Release note for the socket move.** On Linux the app now serves under
  `/run/user/<uid>` when that directory is the user's own. A shim from a build
  before `0c773f57ce` looks only under tmpdir, so an MCP client config still
  pointing at an older AppImage or another checkout's `build/mcpServer.js` is
  told to launch an app that is already running.

## Smaller, unclaimed

- **Screenshot's waits exceed the budget the stdio timeout assumes.**
  `LONGEST_CALL_MS` (`electron/mcp/budgets.ts`) counts a screenshot as one
  relay; it chains a settle, a paint and, for a full page, a second settle,
  paint and measure. The 20 s wait for the page to listen runs before any
  relay's timer. The stdio timeout can fire first, which gives a vaguer error
  and no cancel, not a hang.
- **The docs version-skew note is cached for the shim's whole life**
  (`stdioServer.ts`, `versionSkewNote`), and Claude Desktop keeps one shim across
  app relaunches and updates.
- **Windows named-pipe squatting is not detected.** The README says so.
- **A key misspelled inside a region object is still dropped.**
  `jb.getFeatures({ trackId, loc: { refName, start, stop } })` reads to the end
  of the sequence. Refusing extra keys there would refuse a feature or a
  `jb.visibleRegions()` entry passed straight in, so only the types of `start`
  and `end` are checked.
- **`jb.setSession` in a production build refuses every document once the live
  session holds a wrongly typed value**, and blames the document: the
  `typecheck` it runs first validates the merged snapshot, and production MST
  skips the write checks that would have stopped the bad value going in.
- **A failure while a document is being applied can still close views first**
  (a lifecycle hook throwing, two nodes claiming one id). The typecheck catches
  type errors only.

## Waiting on the eval matrix

Each changes what an agent types or is told, so each is an A/B against the kept
baseline ([reference/AGENT_EVALS.md](../reference/AGENT_EVALS.md)). The
variant-server matrix has to be rebuilt first
(`ideas/waiting-on-a-number/mcp-docs-site-pages-and-always-load.md`).

- **One spelling for the session.** Desktop code gets `session`, `rootModel` and
  `pluginManager` as arguments; Web has `jb.session` and `jb.rootModel` and no
  `pluginManager`. The guide and recipes use the bare `session.` throughout, so
  they do not run on Web as written, and the bare argument goes stale after
  `jb.loadSessionSpec` within a call. The candidate is `jb.pluginManager` plus
  teaching `jb.session` everywhere.
- **`jb.help` without the plot and `rows` grammar.** About 6 of its 7.6 KB is
  display grammar that `jb.describeSlots` answers with descriptions. Run the Web
  eval with those two paragraphs cut to a pointer.
- **`applyDisplaySettings` throwing on an unknown key** instead of listing it
  under `unapplied`, as `jb.addView` throws.
- **`jb.showTrack(trackId, { settings?, viewId? })` for catalog tracks**, leaving
  `jb.addTrack` to files. This is a concrete alternative for the first candidate
  in `ideas/ready/ablate-the-jb-spellings-agents-stumbled-on.md`; that file's
  second candidate, positional `getFeatures`, a cold reader also asked to cut.
- **Skipping the trailing settle on a call that changed nothing.** Every
  `run_javascript` call waits at least a second for it
  (`SETTLE_AFTER_CODE_MS` in `src/mcp/handleMcpRequest.ts`), pure reads and
  calls that just settled themselves included.

## Declined, with the reason

- **A settle timeout that throws.** The report with `notReady` is what the
  caller needs, and a throw discards it.
- **`jb.docs()` on Web.** `jb.help` ends with the guide's URL, which a browser
  agent fetches itself.
- **Dropping one of `jb.readConfObject` and `jb.getConf`.** They read different
  things (`packages/app-core/src/JbApi/CLAUDE.md`).
- **`$XDG_RUNTIME_DIR` as a socket candidate.** MCP clients strip it from the
  shim's environment, so the app and the shim disagreed about the list.
