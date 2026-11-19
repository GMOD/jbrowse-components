---
name: a-headless-agent-gets-the-desktop-mcp-tools
description: An agent with no display (a cloud session, CI) can hold a JBrowse Web page through a generic browser MCP (Playwright MCP headless) and drive window.jb, or script @jbrowse/capture. `jb2capture mcp` would serve Desktop's four tools instead. Waits on running the eval tasks over the generic route to see whether it falls short.
---

# A headless agent gets the Desktop MCP tools

## The routes today

- **Desktop:** the MCP server (`products/jbrowse-desktop/electron/mcp/`) with
  `run_javascript`, `screenshot`, `open` and `docs` on one session that
  persists between calls.
- **Web, through a browser the agent drives:** the page publishes `window.jb`,
  with `jb.help`, `jb.waitReady` and `jb.sessionSummary` in it. Claude in
  Chrome reaches it in the user's tab; a coding agent reaches it through a
  generic browser MCP, Chrome DevTools MCP or Playwright MCP, which Help,
  Connect an AI agent... names. Playwright MCP runs headless, so this route
  needs no display.
- **A shell:** `@jbrowse/capture`. The CLI relaunches Chromium per call;
  `openJBrowse` keeps a page for `page.evaluate` against `jb`, inside a Node
  script the agent writes.

So a headless agent already has a page that persists between calls, through
the second route. It works: on 2026-11-19 a fresh `claude -p` holding only
Playwright MCP (`--headless`), and another holding only Chrome DevTools MCP
(`--headless --isolated`), each built a volvox view from the dialog's in-page
prompt on a dev server, counted its variants and checked a screenshot, in 7-8
calls for about $0.22. Each had to poll for `window.jb` in its first evaluate.
Nobody has measured whether the route is enough across the eval tasks.

## The proposal

`jb2capture mcp`: a stdio MCP server that holds one headless page from
`openJBrowse` and answers Desktop's four tools:

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

Over the generic route it would add the envelope Desktop's evals were tuned
against, a screenshot that waits on the readiness contract, and the docs
without a network fetch. The trust model is Desktop's: stdio to a process the
user started, which drives a local headless browser holding no more privilege
than any web page, so it is not the network-reachable port
`electron/mcp/README.md` forbids.

## What it costs

- A second MCP server beside Desktop's: tool descriptions under the 2 KB client
  cap, the instructions repeat, `pnpm eval:mcp` for a second transport. Sharing
  `toolDefinitions.ts` and the envelope through a package both import is the
  way to keep one surface, and moves code out of `jbrowse-desktop`.
- `@modelcontextprotocol/sdk` or Desktop's hand-rolled `jsonLines.ts` as a
  capture dependency; capture depends only on puppeteer and launch-args today
  (ADR-101).
- No file access: Desktop's renderer has Node, so `jb.addTrack` takes a local
  path there. A headless page has none, so a local file needs serving. ADR-253
  sends file writes to the agent's own tools, and serving reads is a separate
  call.

## The number

`scripts/agent-evals/webAgentEval.ts` runs the eval tasks against jbrowse-web
through Claude in Chrome. Running them through Playwright MCP headless, and
comparing pass rate, calls and dollars with `pnpm eval:mcp` on Desktop, says
whether the generic route falls short. Build the server only if it does, and
then only the part the gap names.
