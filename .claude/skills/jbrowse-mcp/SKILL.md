---
name: jbrowse-mcp
description:
  Use when driving JBrowse Desktop through its MCP server (the "jbrowse" MCP —
  tools like evaluate, docs, inspect_session, load_session_spec, track,
  get_features, screenshot). Covers the working discipline the tool
  descriptions cannot: read the bundled docs first, verify visually, introspect
  instead of guessing, and where the silent failure modes are.
---

# Driving JBrowse Desktop over MCP

The knowledge lives in the APP, not here: the `docs` tool serves documentation
bundled into the running version, so it cannot drift from the model you are
driving. This skill is only the discipline for using it.

## The loop

- **`docs topic:"live-model"` before your first `evaluate`**, and
  `docs topic:"session-spec"` before composing a nontrivial spec. They carry
  working examples for exactly the traps below.
- **`inspect_session` (no path) before acting** — what is open, which views,
  which tracks. Never assume state carried over from an earlier turn: the user
  can click around between your calls.
- After building or changing anything, **`screenshot` and actually read the
  image**. A wrong trackId, an empty region, or a dropped settings key all
  render as a plausible-looking browser with something quietly missing.
- Verify data claims with `get_features` or an `evaluate` aggregation — never
  from the picture alone.

## Introspect, never guess

- trackIds come from `list_tracks`, not from memory of similar configs.
- Settings keys come from the display itself: `evaluate` →
  `jb.describeSlots(session.views[0].tracks[0].displays[0].configuration)`. An
  unknown key in a spec or `track update` is **dropped silently** — that is this
  format's known failure mode.
- What a live view can answer comes from `inspect_session path:"views.0"` — the
  `getters` list names things (visibleLocStrings, totalBp, ...) that session
  snapshots filter out.

## The silent failure modes

- **refName namespaces**: querying a file with the assembly's canonical name
  ("ctgA" vs "contigA", "1" vs "chr1") matches nothing and reads as "no data
  here". `get_features` handles it; raw adapter code in `evaluate` must run
  `jb.renameRegionsIfNeeded` first (the live-model doc shows how).
- **A freshly created view throws "width undefined"** from region getters until
  it mounts — `await jb.mobx.when(() => view.initialized)`.
- **`track show` on an already-shown track applies nothing** — use
  `track update`.
- **Big returns**: don't return thousands of raw features from `evaluate`;
  aggregate in place, or write a file and return the path.

## Scale of change → tool

One field: `track update` / `navigate`. A fresh arrangement of views:
`load_session_spec`. A different dataset: `open`. Anything the verbs cannot say:
`evaluate` — and helpers you build there persist on `globalThis` for the rest of
the app run.

Setup and architecture: `products/jbrowse-desktop/electron/mcp/README.md`.
Conformance check: `pnpm --filter @jbrowse/desktop test:mcp` (launches the built
app, exercises every tool against volvox).
