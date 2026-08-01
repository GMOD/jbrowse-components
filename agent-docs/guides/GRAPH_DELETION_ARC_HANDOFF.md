# Graph deletion arcs: the deploy, and what it cost

Written 2026-07-31, from the `pangenome/hprc_cfhr_deletion` review; the deploy
below landed the same day. Two repos are involved: the figures and their prose
here, the drawing in `jbrowse-plugin-graphgenomeviewer`
(`~/src/jb2plugins/jbrowse-plugin-graphgenomeview`).

## Shipped

Plugin, published as `demos/graphgenomeviewer/307ffaf78f95/`:

- `ce96cd5` graph context follows alleles, not the backbone, default 1 hop
- `36d5a5f` deletion arcs dashed, label and hit box on the drawn curve
- `951c777` follow core onto MST 6 / mobx 7, unblock two dead test suites
- `3b670fe` fit an anchored drawing to the region it was cut for
- `f0e9a1b` scale it against that region too

Here: the three `test_data/graphgenomeview/*.json` configs pin that prefix, all
25 graph figures are regenerated against it, and the prose that the hop-default
change falsified is fixed (graph context defaults to 1 hop; the user guide's
`2 hops` paragraph no longer describes the old walk-the-reference rule; captions
say dashed arcs carrying their own labels; amylase reads 78 nodes).

`pangenome/hprc_cfhr_deletion` also moved to the anchored layout, and
`bubbleSpread` came off its spec (a floor in FMMM units passed to the remote
engine, so dead under a local layout and a no-op step in the recipe dialog).

**No linearized deletion track**, decided rather than deferred. Reasons in
`reference/PANGENOME_GRAPHS.md` under Carriage.

## What the betabuild gate was actually blocked on

The earlier note here blamed uncommitted `packages/core` edits. That was wrong,
and re-checking beats inheriting it:

- **19 typecheck errors under `src/`** were a two-MST-copies brand mismatch.
  Core had moved to `@jbrowse/mobx-state-tree` 6 / `mobx` 7 and the plugin still
  pinned MST 5 / mobx 6. Both are host globals at runtime, so the bump is
  types-only. A wave of `[$type]` / assignability errors across unrelated files
  is this, not real breakage.
- **Two suites failed to LOAD** because they mocked `@jbrowse/core/configuration`
  wholesale for one `readConfObject` stub, so anything transitively pulling
  `BaseFeatureWidget`'s schema hit an undefined `ConfigurationSchema` at
  module-eval time. `importOriginal` fixed it and gave back 58 tests that had
  silently not been running (272 -> 330).

## The regression the hop default caused, and how it was found

`pangenome/pggb_locus_sample_rows` came back with its 484 bp window drawn at 6%
of the frame, everything crushed against the right edge.

Not FMMM jitter and not a fetch bug. CFT073 has a 75 bp segment that attaches at
K12:997,574 and rejoins at K12:1,004,667, a real 7 kb deletion, so once 1 hop
fetched its distant backbone anchor the drawing legitimately spanned 7.5 kb.
Correct layout, wrong scale — and it broke the one thing the reference-anchored
layouts are for, which is sharing an axis with the linear view above them.

It took two commits because the region enters in two places, and fixing only the
first looks like progress while still being wrong (12% became 35%, with the rows
now 15x too far apart instead):

- `3b670fe` — `zoomToFit` measured the drawing. `layoutBounds` now takes x from
  `loadedRegion` when the layout marks its x as reference bp.
- `f0e9a1b` — row spacing and the off-reference visibility floor are fractions
  of a span that came from measuring the backbone, which the far anchor
  stretches the same way. `referenceSpan()` takes the region, threaded through
  the layout-mode dispatch.

y stays measured in both, rows not being on the reference; force layouts and
whole-file imports are untouched.

**How to diagnose the next one of these: ask the model, don't read pixels.** The
view exposes `nodePositions` in layout units plus `scale`/`translateX`, so a
puppeteer script over `window.JBrowseSession.views[n]` prints exactly which node
sits where, with its `stable` coordinate and rank. Estimating the extent off a
downscaled PNG produced three wrong hypotheses in a row before that; the probe
named the node on the first run. `website/scripts/graphAnchor.ts` already does
this lookup for annotation anchors and is the thing to copy.

Two spec heights moved with the new cut, both flagged by the generator's own
clipped/blank reports rather than by eye: the anchored MHC half grew past 775px,
and `rgfa_strain_launch`'s second frame lost 57px it was reserving.

## Traps worth keeping

- **`--filter` by spec name misses compose parts.** Six part specs
  (`graph_context_none/_hop1`, `hprc_mhc_layout_*`, `local_subgraph_*`) are
  positional arguments to a `part(...)` helper, not `name:` properties, so a
  filter list scraped from `name: '...'` skips them and the parent silently
  restacks from stale halves. Scrape every `'pangenome/...'` string literal.
- **Iterating against a local plugin build**: `GRAPH_PLUGIN_LOCAL=1` (header of
  `website/scripts/specs/graph.ts`) plus the plugin's `dist/` copied to
  **`test_data/graphgenomeview/_localdist/` at the repo root**. Switch back
  before committing figures; `pnpm check-live-configs` is the tripwire.
- **Not** `products/jbrowse-web/build/test_data/.../_localdist/`, which an
  earlier version of this doc said and which silently serves whatever was there
  before. `createTestServer` routes `/test_data/*` to `jbrowseWebRoot` itself,
  and `products/jbrowse-web/test_data` is a symlink to the repo root's, so the
  `build/` copy is never consulted for it. The tell is a render that reproduces
  the pre-fix behaviour bit-for-bit; confirm by reading a marker off the model
  rather than by re-diffing images.
- `products/jbrowse-web/build/test_data/` is a gitignored **copy** used for the
  app's own config, and a pin bump does have to be copied there too.
- The betabuild gate is not optional: it is what catches a bundle importing a
  host global that does not exist.

## Open

- **The LPA KIV-2 arc's label overwhelms its arc.** `skips 27.7 kb of reference`
  is several times wider than the ~10px curve it rides, so it reads as detached
  and covers neighbouring nodes. The label gate is the arc's drawn extent, which
  is the right gate; what is missing is a minimum extent before a label is worth
  drawing at all, or a leader line.
- **The amylase 94.2 kb arc is still a balloon enclosing nothing.** Readable now
  that it is dashed and labelled, so this is cosmetic. A force-layout equivalent
  of PangyPlot's `delLinkForce` was **considered and not attempted**: our force
  layout is OGDF FMMM in WASM, so the only equivalent is a post-pass moving
  backbone nodes shared with the whole thread. `bubbleCrossing.test.ts` is the
  guard if anyone tries.
- **A deletion-arc LGV track** off the link index: rejected, see the reference
  doc.
