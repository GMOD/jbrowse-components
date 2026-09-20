---
name: one-generated-description-of-the-jb-surface
description: The jb helper library is described in three hand-kept prose copies (the live model guide, run_javascript's tool description, jb.help) that have already drifted on getFeatures' options; docsRoster.test.ts pins only that the names exist. Parked until the roster changes again — a per-member signature-and-purpose table generated from one source would end the drift, at the cost of losing the prose each copy tunes for its reader.
---

# One generated description of the `jb` surface

## What drifts

`jb` is described for an agent in three places, each written by hand for a
different reader:

- `website/docs/agents_live_model.md`, "The helper library" — the reference the
  agent reads, and the one Desktop serves as `docs topic:"live-model"`
- `products/jbrowse-desktop/electron/mcp/toolDefinitions.ts`, the
  `run_javascript` description — what an MCP client sees before reading any doc
- `JB_HELP` in `packages/app-core/src/JbApi/jbApi.ts` — the whole contract for
  a browser agent that found `window.jb` and has no docs tool

The 2026-09-06 review found them disagreeing: the guide omitted `getFeatures`'
`assembly` and `viewId` options and the positional form, and `jb.help` showed
only the positional form. That pass aligned them by hand and added `jb.view`,
`trackModel`'s `viewId` and `addTrack`'s `settleMs` to all three, again by hand.

`products/jbrowse-desktop/src/mcp/docsRoster.test.ts` pins that every `jb.X`
any copy names is a member the live object has. It does not pin signatures or
that every member is described anywhere.

## The generated version

One table, `member | signature | one line`, generated from a single source and
spliced into all three at build time the way `typeDocs.generated.json` already
carries model and config types into the `docs` tool. The source could be a
literal beside `createJbApi`, or TSDoc on each member read by the same autogen
pass that builds the type pages, with `pnpm autogen --check` failing on drift.

## Why it is parked

- The three copies are tuned for their readers on purpose: the tool description
  leads with traps, `jb.help` is a paragraph, the guide has examples. A table
  replaces the signature line in each, not the prose around it, so the win is
  the signatures only.
- The roster is 26 members and changes by one or two a week during active work
  on the surface. Hand-alignment plus the roster test has been enough; the cost
  showed up as one review finding, not a lost take.
- The frozen re-exports never change and need no generation.

Pick it up when a signature drifts a second time, or when the roster test's
admission rule (`jbApi.test.ts`, "the jb roster") starts admitting members
faster than the copies get updated.
