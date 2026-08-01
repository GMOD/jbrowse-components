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
- `901ddb4` bow a deletion arc around the reference it skips (published as
  `demos/graphgenomeviewer/a22cdaf2f74c/`, which is the current pin)

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

## The two flaky launch-out specs: `closeMenusFirst` was a no-op

`rgfa_launch_out_menu` and `rgfa_strain_launch` failed about one regen round in
six, always on the second stage's readiness wait (`synteny_canvas_done` /
`feature-name-clbK`) and never on a click. Those waits were already the right
shape — a real result, 120s — so the fault was above them, in a click path that
did nothing and did not say so.

**Escape does not close a JBrowse cascade menu.** Measured on the live page:
three presses with focus verifiably inside the list (`LI[menuitem]`, then
`UL[menu]`) leave both levels and both modals standing, while one backdrop click
takes the whole cascade down. `closeMenusFirst` was `Escape` plus a 300ms delay,
so a stage that asked for a clean slate got the previous stage's menu. Its first
action then clicked a control the backdrop covered, where `clickElement`'s
covered-element fallback dispatches on the node anyway — so nothing errored, and
what followed was two overlapping copies of the same menu with a `::-p-text()`
match resolving to whichever it liked. The two specs that set that flag are the
only two specs in the suite that set it, and they are the two that were flaky.

It now clicks the backdrop of every modal that contains a menu, loops, and
**throws if a menu is still open**. Both specs re-render byte-stable and pass
`--check`; the committed figures were the lucky outcome and are now the only
one.

Two hypotheses were measured and killed on the way here, so nobody re-walks
them: the cascade row is **not** still moving when puppeteer calls it visible
(its box is identical across 458ms from the first sample), and the "below ~430px
the synteny click stops launching anything" floor in that spec's comment is
**not** a property of the click — opened fresh at that height it launches at
430, 410 and 350. That floor is about a menu opened before the resize, which is
what `closeMenusFirst` existed to handle and now actually does.

## The amylase balloon was a sign, not a layout problem

This was carried as "cosmetic, and the only fix is a PangyPlot-style
`delLinkForce`, which for OGDF FMMM in WASM means a post-pass moving backbone
nodes shared with the whole thread". **No layout change was needed.** Probing the
live drawing said so in one run: the bypassed reference reached 739 units to one
side of a 16-unit chord while the arc bowed 719 units to the other.

Both halves of the bow were wrong.

- **The side was hardcoded** (`bulgeX = -uy * bulge`, always). Whether an arc
  landed on the reference it names or in the empty half of the drawing was down
  to which way the simulation happened to throw that run. The two arcs in the
  same figure that read correctly were the two whose runs fell on the hardcoded
  side — so the figure looked like one bad arc among good ones rather than like
  a coin flip, which is why it read as a layout problem.
- **The size came from summed drawn path length** (`0.35 *` it), which is not
  spatial reach. A chain that snakes, as an FMMM chain does, sizes an arc far
  past where its own nodes are.

Both now come from where the run lies relative to the edge's own chord.
Perpendicular reach to the farthest point gives the side and the clearance; the
run's extent **along** the chord carries the collinear case at the same 0.35.
That second term is not optional: in an anchored layout the backbone is a
straight line, so the run lies ON the chord and reaches nowhere off it, and
clearance alone collapses every anchored arc back into the stub at a joint the
bulge exists to prevent. The unit tests caught exactly that, and the anchored
figures are byte-stable because of it.

The computation moved **into** `computeEdgeCurves`, which now takes the bypassed
nodes rather than a precomputed number: turning a run into a bow needs the chord,
and only that function knows which ends the edge attaches to. Three callers build
this curve — the drawing, the hit index, and the label that rides it — and a
second derivation is a second thing to keep in step.

One knock-on, worth knowing because it will recur: arcs that grow can newly clear
`MIN_DELETION_LABEL_PX` and acquire a label they never had. The MHC force
layout's 1.5 kb arc did, and shipped it clipped against the left edge as
`…ips 1.5 kb of reference`, because the label cull keeps any box that merely
*overlaps* the canvas. A tethered label now slides back into the frame with its
leader redrawn to follow.

## Open

- **A deletion-arc LGV track** off the link index: rejected, see the reference
  doc.
