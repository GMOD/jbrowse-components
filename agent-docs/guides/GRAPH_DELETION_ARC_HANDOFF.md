# Graph deletion arcs: the deploy, and what it cost

Written 2026-07-31, from the `pangenome/hprc_cfhr_deletion` review; the deploy
below landed the same day. Two repos are involved: the figures and their prose
here, the drawing in `jbrowse-plugin-graphgenomeviewer`
(`~/src/jb2plugins/jbrowse-plugin-graphgenomeview`).

## Shipped

Plugin, published as `demos/graphgenomeviewer/4cfdc394380b/`:

- `ce96cd5` graph context follows alleles, not the backbone, default 1 hop
- `36d5a5f` deletion arcs dashed, label and hit box on the drawn curve
- `951c777` follow core onto MST 6 / mobx 7, unblock two dead test suites
- `3b670fe` fit an anchored drawing to the region it was cut for
- `f0e9a1b` scale it against that region too
- `cb3db85` tether a deletion label too wide for the arc it names

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

## The LPA label, and why it got a leader rather than a threshold

`skips 27.7 kb of reference` is 26 characters however small the event is, and at
the LPA KIV-2 locus that was four times the width of the arc it was centred on.
The two candidate fixes were a minimum extent below which no label is drawn, and
a leader line. The leader won, because dropping is right for a node and wrong
for a deletion: a node that loses its label still has a tube drawn, coloured and
hoverable, while a deletion is one dashed curve standing for sequence the
picture does not otherwise contain, and unlabelled it is just another link.

So the node rule (a label may not exceed twice what it names) now gates the
deletion label too, and failing it displaces the label instead of dropping it.
Two pieces of geometry, both in `graphLabels.ts`:

- **Direction is the arc's own bow** — chord midpoint towards apex. The bulge is
  perpendicular to the chord by construction, so this is the side the curve was
  opened into, which is the side with room in it. No search, no free parameter.
- **Displace by the box's support distance, stop the leader at the box's real
  edge.** Those are not the same number and the difference is the whole leader:
  support is the distance to the supporting line perpendicular to the direction,
  which a box six times wider than it is tall touches at a corner. Displacing by
  support is what clears the arc at any angle; stopping the *line* there drew an
  8px stub with 50px of white between it and the words. The line has to stop at
  the ray/box crossing.

**Only `hprc_lpa_kiv2` moved.** The other 24 graph figures re-render byte-stable
against the new bundle, which is the evidence that every arc already wide enough
to hold its name is untouched. And the LPA regen came back `≈ kept` at 0.123% —
under the plain 0.5% default, so a moved label plus a new leader line reads as
unchanged. That is the documented `--force it and diff the two` case, not a sign
the change did not land.

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
- The `*_local.json` configs that switch reads are now **written by `graph.ts`
  from their tracked siblings** on every run, and were hand-made copies before.
  A gitignored copy of a tracked config drifts and nothing notices:
  `hprc_local.json` predated the two CFHR gene tracks, so under
  `GRAPH_PLUGIN_LOCAL` those tracks were absent and `hprc_cfhr_deletion` failed
  on annotation anchors resolving to nothing — which reads as a regression in
  whatever you are testing, the worst failure for the one switch you flip only
  when hunting one. Don't reintroduce a hand-maintained copy.
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

- **The two launch-out specs, if they go flaky again.** `rgfa_launch_out_menu`
  and `rgfa_strain_launch` failed one regen round of five and passed the other
  four, always on the second stage's readiness wait
  (`synteny_canvas_done` / `feature-name-clbK`) rather than on a click. Those
  waits are already the right shape — a real result, 120s — so the suspect is
  the click path above them. Stage one clicks the cascade parent, waits for the
  child row's text, then delays 500ms; **stage two clicks the parent and the
  child back to back**. `resolveTarget` does wait for the child to be visible,
  but MUI's Grow transition is visible-and-still-moving, so the click lands at a
  coordinate the row has left, nothing launches, and the wait below times out
  looking like a fetch problem. Check that before anything else. The fix is not
  a `delay` — that is the arbitrary timeout the website guide names as a red
  flag — it is a settle condition on the menu itself.
- **The amylase 94.2 kb arc is still a balloon enclosing nothing.** Readable now
  that it is dashed and labelled, so this is cosmetic. A force-layout equivalent
  of PangyPlot's `delLinkForce` was **considered and not attempted**: our force
  layout is OGDF FMMM in WASM, so the only equivalent is a post-pass moving
  backbone nodes shared with the whole thread. `bubbleCrossing.test.ts` is the
  guard if anyone tries.
- **A deletion-arc LGV track** off the link index: rejected, see the reference
  doc.
