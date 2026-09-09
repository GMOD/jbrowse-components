---
name: jbrowse-mcp
description:
  Use when driving JBrowse Desktop through its MCP server (the "jbrowse" MCP —
  run_javascript, docs, open, screenshot). Points at the discipline the app
  itself serves, and carries the repo-only parts.
---

# Driving JBrowse Desktop over MCP

One interface: `run_javascript` executes your code against the live session,
with `jb` as the standard library; `open`, `screenshot`, and `docs` cover the
three things code inside the app cannot do.

**The working discipline is served by the app, not written here.** It ships with
the server, so it cannot drift from the version you are driving, and reaches the
agent three ways:

- the `initialize` response's `instructions`, which Claude Code shows you and
  Claude Desktop does not (anthropics/claude-ai-mcp#93)
- the same text after the value in a session's first `run_javascript` result,
  for the clients that drop it
- `docs topic:"live-model"` — read it before your first `run_javascript` call.
  `docs topic:"recipes"` has a verified snippet for most asks,
  `docs topic:"hosted-data"` the config URL for any UCSC or GenArk assembly when
  nothing is open, and `docs topic:"session-spec"` the launch keys for a
  nontrivial `jb.loadSessionSpec`.

The short version, because it is what gets skipped: orient with
`jb.sessionSummary()` and never assume state carried over — the user can click
around between your calls. Introspect rather than guess (`jb.listTracks()` for
trackIds, `jb.describeSlots(...)` for settings keys, `jb.inspect(path)` for what
a live node can answer). After changing anything, `screenshot` and actually read
the image, and read `notReady` in the settle result — a wrong trackId, an empty
region or a dropped settings key all render as a plausible browser with
something quietly missing. Verify data claims with `jb.getFeatures`, never from
the picture.

## Repo-only

- Setup and architecture: `products/jbrowse-desktop/electron/mcp/README.md`.
- Conformance check: `pnpm --filter @jbrowse/desktop test:mcp` (launches the
  built app and exercises every tool against volvox). It needs
  `pnpm build && pnpm build:electron-main` first, and it takes the per-user
  socket — with another Desktop instance running it attaches to that one.
- The discipline above lives in `website/docs/agents_live_model.md` and
  `SERVER_INSTRUCTIONS` (`electron/mcp/toolDefinitions.ts`). Edit it there;
  `products/jbrowse-desktop/src/mcp/docsRoster.test.ts` checks the copies agree,
  and `pnpm check-mcp-text-caps` (CI lint) that the instructions and each tool
  description stay under the 2048 characters Claude Code shows the model
  (sources in `electron/mcp/README.md`). Put what must be read first in the
  first sentence.
