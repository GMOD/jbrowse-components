---
name: a-headless-agent-gets-the-desktop-mcp-tools
description: An agent with no display (a cloud session, CI) can reach JBrowse only through `@jbrowse/capture`, whose CLI relaunches Chromium per call. `jb2capture mcp` would serve Desktop's four tools over headless Chromium and `window.jb`. Waits on whether a second MCP server is worth keeping beside Desktop's.
---

# A headless agent gets the Desktop MCP tools

## The gap

An agent drives JBrowse three ways today:

- **Desktop:** the MCP server (`products/jbrowse-desktop/electron/mcp/`) with
  `run_javascript`, `screenshot`, `open` and `docs` on one session that
  persists between calls.
- **Web in Chrome:** Claude in Chrome runs JavaScript against `window.jb` in a
  tab the user has open.
- **A shell with no display:** `@jbrowse/capture`. The CLI launches Chromium,
  loads the app, shoots and closes, so each look-and-adjust turn pays a browser
  launch and a full app load. The library keeps a page (`openJBrowse`, then
  `page.evaluate` against `jb`), but the agent writes and reruns a Node script
  to use it, and the script relaunches too.

A cloud Claude Code session, a CI job, or a sandbox without Desktop or Chrome
has only the third.

## The proposal

`jb2capture mcp`: a stdio MCP server that holds one headless page from
`openJBrowse` and answers the same four tools:

- `run_javascript`: the code as an async function body in the page, with `jb`
  in scope, through `page.evaluate`. The envelope (value, `logs`,
  `notifications`, `pageErrors`) is built in Desktop's renderer by
  `src/mcp/handleMcpRequest.ts`; its console shadowing and page-error drain
  would move into code capture injects or jbrowse-web publishes beside `jb`.
- `screenshot`: `waitForFrame`, then `page.screenshot`, with `--annotations`'
  callouts.
- `open`: `jbrowseUrl` from a genome, config or spec, then
  `waitForJBrowseReady`.
- `docs`: the `typeDocs.generated.json` bundle Desktop ships.

The trust model is Desktop's: stdio to a process the user started, which
drives a local headless browser. The page holds no more privilege than any web
page, so it is not the network-reachable port `electron/mcp/README.md`
forbids.

## What it costs

- A second MCP server beside Desktop's: tool descriptions under the 2 KB client
  cap, the instructions repeat, `pnpm eval:mcp` for a second transport. Sharing
  `toolDefinitions.ts` and the envelope through a package both import is the
  way to keep one surface, and moves code out of `jbrowse-desktop`.
- `@modelcontextprotocol/sdk` or Desktop's hand-rolled `jsonLines.ts` as a
  capture dependency; capture depends only on puppeteer and launch-args today
  (ADR-101).
- No file access: Desktop's renderer has Node, so `jb.addTrack` takes a local
  path there. A headless page has none, so a local file needs capture to serve
  a directory. ADR-253 sends file writes to the agent's own tools, and serving
  reads is a separate call.

## The call

Whether headless agents are a route worth a second server, or whether the
library route (`openJBrowse` with `jb`, documented in the capture README's "For
an AI agent") is enough until one asks.
