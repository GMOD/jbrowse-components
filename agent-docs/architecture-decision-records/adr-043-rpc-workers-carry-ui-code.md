---
status: Accepted
summary: "RPC workers parse 2.2 MB of MUI/react-dom they never run; the fix is blocked on splitting every plugin index's model half from its React half, so we measure it and take smaller wins instead"
---

# ADR-043: RPC workers carry UI code, and we are not fixing it yet

## Status

Accepted (2026-07) as a deliberate deferral, not as a design we endorse. The
cost is measured, the fix is understood, and the reason we are not doing it is
scope — recorded so the next reader can pick it up with the numbers already in
hand instead of re-deriving them.

## Context

Nothing in an RPC worker renders React. Workers fetch and process data; the main
thread draws. Yet of the ~6.35 MB of module bytes in the chunks a worker
`importScripts` on boot, **2.2 MB (35%) is UI code**: `@mui/material` 983 KB,
`react-dom` 533 KB, `@floating-ui/react` 183 KB, `@mui/system` 125 KB,
`@popperjs/core` 67 KB. A three-track load boots three workers, so it is parsed
three times. Per worker, 400–560 ms goes to `importScripts` +
`__webpack_require__` before any data work begins.

Measured by bucketing `build/bundle-stats.json` (from
`node scripts/build.ts --stats`) over the chunk files
`website/scripts/probe-startup.ts` reports the worker loading.

The mechanism is a single chain. Every product's `rpcWorker.ts` statically
imports `corePlugins.ts`, which statically imports every plugin's `index.ts`. A
plugin's `index.ts` is one module doing two jobs: it defines the `Plugin`
subclass, and it re-exports the plugin's public API — which includes React
components. Webpack pulls re-exported modules, so the worker's graph contains
the whole UI layer. `node scripts/check-worker-imports.ts --causes` enumerates
it: **258 static import sites across 23 packages** (89 in `packages/core`, 57 in
`linear-genome-view`, 18 in `synteny-core`, …).

## Decision

Leave it. Do not add a `splitChunks` cacheGroup to paper over it, and do not
start a partial de-React pass.

## Why the fix is blocked

**It is all-or-nothing for the worker.** Webpack keeps a module if any reachable
importer needs it, so cutting one chain to `@mui/material` saves zero bytes.
Only cutting the last one removes the package. A partial pass buys nothing
measurable, which means it cannot be sequenced into small verifiable steps
against the worker metric.

**The coupling lives in consumers, not in the plugin.** Taking
`linear-genome-view` as the pilot: its barrel mixes worker-safe model exports
(`TrackHeightMixin`, `linearGenomeViewStateModelFactory`,
`MultiRegionDisplayMixin`, `baseLinearDisplayConfigSchema`) with React exports
(`DisplayChrome`, `BaseLinearDisplayComponent`, `SvgChrome`, `SVGView`,
`TrackOverlayPortal`, `FloatingLegend`, `SearchBox`, `MultiLevelRubberband`) in
one module. **94 in-repo files** import value symbols from that barrel —
variants 15, canvas 13, alignments 12, wiggle 11, arc 9, and eight more plugins
— and each drags React in through the side door regardless of what LGV itself
does. (A further 178 imports are type-only and erased at build.) So "de-React
one plugin" is really "edit ~100 files across a dozen plugins," and there is no
hermetic pilot.

**The incremental payoff is back-loaded.** On the main thread the same static
`corePlugins.ts` import is why the cold shell eagerly loads a ~1 MB all-plugins
chunk (`products/jbrowse-web/CLAUDE.md`), so the campaign helps first paint too.
But per plugin you only move that plugin's *own* component bytes into lazy
chunks — for LGV roughly 150–250 KB of its 324 KB. The large shared items (MUI,
react-dom) stay eager until the last plugin stops reaching them. So the curve is
a long flat stretch with the payoff at the end, which is the worst shape for
work that has to survive a shared, actively-edited tree.

**It is ABI-adjacent.** Those re-exports are the plugin's public surface, and
per [PLUGIN_ABI_STABILITY.md](../reference/PLUGIN_ABI_STABILITY.md) they ossify.
A split has to keep the fat barrel intact for external plugins while in-repo
code moves to narrow entry points, which is doable but adds a compatibility
surface to maintain for the length of the campaign.

## What would unblock it

- A narrow per-plugin entry (`plugin.ts`: the `Plugin` subclass plus model and
  config exports only) that `corePlugins.ts` imports, with `index.ts` left as
  the fat barrel so external plugin ABI is untouched.
- In-repo consumers repointed off the barrel onto narrow subpaths — the 94
  files above for LGV, and the equivalent for each other plugin.
- Eager React imports inside each `Plugin` class moved behind `lazy()`
  (LGV has three: a direct `@mui/icons-material/LineStyle` import plus
  `HeaderZoomControls.tsx` and `SequenceFeatureHoverHighlightExtension.tsx`).
- A ratchet on `scripts/check-worker-imports.ts` once the campaign starts, since
  the terminal target needs regression protection across a long sequence.

Sequencing note: order the work by **bytes, not site count**. `packages/core`
has the most sites but is needed on the main thread anyway, so its sites only
matter for the terminal worker win, not for first paint.

## Rejected alternatives

**A `splitChunks` cacheGroup separating worker code from UI.** The import graph
is the actual defect; a manual chunk split hides it, has to be maintained by
hand against a moving module graph, and cannot help the main-thread eager chunk.

**Routing the worker entries around the `@jbrowse/product-core` barrel.** The
barrel re-exports the whole `ui/` tree, so pointing the four `rpcWorker.ts`
entries at `@jbrowse/product-core/src/rpcWorker` looks like an obvious cut. It
was tried and **removes exactly one module** from the graph (1305 → 1304),
because the plugin indexes pull the same modules anyway. Reverted; correct in
direction, worthless on its own, and it makes the import path worse.

**Shrinking the worker pool** so fewer workers pay the parse cost. Measured
separately and rejected: forcing `rpc.workerCount: 1` is a wash (3430 vs
3534 ms to settled) because the boots overlap and are not on the wall-clock
critical path. See [PERF_INSTRUMENTATION.md](../guides/PERF_INSTRUMENTATION.md).

## Consequences

Workers stay heavier than they need to be. The cost is paid on worker boot,
which overlaps other startup work and so is not a direct latency regression, but
it is real memory and CPU on every session and it scales with worker count.
`scripts/check-worker-imports.ts` keeps the number visible so the decision can
be revisited against evidence rather than vibes.
