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
  It answers with the contract and a table of contents of its deep dives, which
  you then ask for by `section` (or `section:"all"` for the whole guide). On a
  generated type page `section` also takes a member name, which answers with
  that one line instead of the getter list holding it. `docs topic:"recipes"`
  has a verified snippet for most asks, `docs topic:"hosted-data"` the config
  URL for any UCSC or GenArk assembly when nothing is open, and
  `docs topic:"session-spec"` the launch keys for a nontrivial
  `jb.loadSessionSpec`.

The short version, because it is what gets skipped: orient with
`jb.sessionSummary()` and never assume state carried over — the user can click
around between your calls. Introspect rather than guess (`jb.listTracks()` for
trackIds, `jb.describeSlots(...)` for settings keys, `jb.inspect(node)` for what
a live node can answer). Build with `jb.loadSessionSpec`, then change what is
open as a document: `jb.setSession` takes the snapshot back edited, `jb.addView`
adds one view, `jb.fitToWindow()` answers the settle's `offscreen`. Read
`notReady` in the settle result after every change — a wrong trackId, an empty
region or a dropped settings key all render as a plausible browser with
something quietly missing. `screenshot` when the change is visual or the settle
reports `notReady` or `offscreen`, and actually read the image; for
show/hide/reorder/navigate/fit the settle plus `jb.sessionSummary()` verifies it
far cheaper. Verify data claims with `jb.getFeatures`, never from the picture.

## Repo-only

- Setup and architecture: `products/jbrowse-desktop/electron/mcp/README.md`.
- Conformance check: `pnpm --filter @jbrowse/desktop test:mcp` (launches the
  built app and exercises every tool against volvox). It needs
  `pnpm build && pnpm build:electron-main` first, and it takes the per-user
  socket — with another Desktop instance running it refuses, and `--attach`
  drives that one deliberately.
- Agent eval: `pnpm --filter @jbrowse/desktop eval:mcp` (same build, `claude` on
  PATH) runs a real `claude -p` session per task in
  `scripts/agent-evals/tasks.ts` and grades the session state over the bridge.
  Per task it reports calls, errors, docs reads (with the topic and section of
  each), screenshots, seconds, dollars, the run's four token counts, and the
  tool_result chars the model was handed broken out by the tool that produced
  them — pass rate sits at the ceiling, so a change to the instructions, the
  docs or `jb` is judged by calls-to-success and by what those answers cost.
  `--model opus`, `--filter <name>`, `--runs N` (which adds per-task medians),
  `--out <dir>`, and `--client desktop`, which routes the server through
  `scripts/agent-evals/desktopClientProxy.ts` to drop the initialize
  `instructions` and so measure the Claude Desktop experience rather than Claude
  Code's. Everything, events included, lands in the `--out` dir; `summary.json`
  carries the totals and medians. Add a task for each stumble a filmed take
  shows. The harness owns the app it launched and refuses to attach to a Desktop
  it did not start, so close yours or pass `--attach`.
- Browser-agent eval: `node scripts/agent-evals/webAgentEval.ts` runs the same
  tasks against a served `products/jbrowse-web/build` through the Claude in
  Chrome extension (`claude -p --chrome`), grading through a bridge the harness
  injects into the served page. Needs Chrome on a display with the extension
  signed in; `--guide` hands the agent the live-model guide, the bare default
  hands it one line saying `window.jb` exists.
- The discipline above lives in `website/docs/agents_live_model.md` and
  `SERVER_INSTRUCTIONS` (`electron/mcp/toolDefinitions.ts`). Edit it there;
  `products/jbrowse-desktop/src/mcp/docsRoster.test.ts` checks the copies agree,
  and `pnpm check-mcp-text-caps` (CI lint) that the instructions and each tool
  description stay under the 2048 characters Claude Code shows the model
  (sources in `electron/mcp/README.md`). Put what must be read first in the
  first sentence.
