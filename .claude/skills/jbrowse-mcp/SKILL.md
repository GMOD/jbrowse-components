---
name: jbrowse-mcp
description:
  Use when driving JBrowse Desktop through its MCP server (the "jbrowse" MCP —
  run_javascript, docs, open, screenshot). Covers the working discipline the
  tool descriptions cannot: read the bundled docs first, verify visually,
  introspect instead of guessing, and where the silent failure modes are.
---

# Driving JBrowse Desktop over MCP

One interface: `run_javascript` executes your code against the live session,
with `jb` as the standard library; `open`, `screenshot`, and `docs` cover the
three things code inside the app cannot do. The knowledge lives in the APP, not
here — the `docs` tool serves documentation bundled into the running version, so
it cannot drift from the model you are driving. This skill is only the
discipline for using it.

## The loop

- **`docs topic:"live-model"` before your first `run_javascript`**, and
  `docs topic:"session-spec"` before composing a nontrivial `jb.loadSessionSpec`
  — it answers with a table of contents; read
  `section:"Fields every view takes"` and the section for your view type. They
  carry working examples for exactly the traps below.
- **Orient before acting**: `return jb.sessionSummary()`. Never assume state
  carried over from an earlier turn — the user can click around between your
  calls.
- After building or changing anything, **`screenshot` and actually read the
  image**. A wrong trackId, an empty region, or a dropped settings key all
  render as a plausible-looking browser with something quietly missing.
- Verify data claims with `jb.getFeatures` aggregations, never from the picture
  alone. Every result carries `logs` (the code's console output) and
  `notifications` (the session's own toasts since your previous call, each
  reported once, with level), so read them. A thrown error names the line in
  your code.

## Introspect, never guess

- trackIds come from `jb.listTracks()`, not from memory of similar configs.
- Settings keys come from the display itself:
  `jb.describeSlots(jb.trackModel('x').activeDisplay.configuration)`. An unknown
  key is **dropped silently** — that is this format's known failure mode.
- What a live view can answer comes from `jb.inspect('views.0')` — the `getters`
  list names things (visibleLocStrings, totalBp, ...) that session snapshots
  filter out.

## The silent failure modes

- **refName namespaces**: querying a file with the assembly's canonical name
  ("ctgA" vs "contigA", "1" vs "chr1") matches nothing and reads as "no data
  here". `jb.getFeatures` handles it; raw adapter code must run
  `jb.renameRegionsIfNeeded` first (the live-model doc shows how).
- **Mutations go through actions** — raw assignment throws. Display settings go
  through `track.applyDisplaySettings(settings)`, and `view.showTrack` on an
  already-shown track applies nothing (applyDisplaySettings is the update path).
- **A freshly created view throws "width undefined"** from region getters until
  it mounts — `await jb.mobx.when(() => view.initialized)`.
- **Big returns**: don't return thousands of raw features; aggregate in code, or
  write a file with `window.require('fs')` and return the path.
- **Long jobs**: a call outliving `timeoutMs` (default 120 s) errors but keeps
  running. Park the promise on `globalThis` and await it from a later call.

Setup and architecture: `products/jbrowse-desktop/electron/mcp/README.md`.
Conformance check: `pnpm --filter @jbrowse/desktop test:mcp` (launches the built
app, exercises every tool against volvox).
